/**
 * Firebase private key'ni muhit o'zgaruvchisidan o'qish testi.
 *
 * `config.js` qiymatlarni import paytida o'qiydi, shuning uchun har
 * holatda `process.env` avval to'ldiriladi va modul so'rov qatori bilan
 * (`?case=...`) qaytadan import qilinadi — ESM keshi shunda chetlab
 * o'tiladi.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';

/** Haqiqiy PEM kalit — sinov uchun yaratiladi. */
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' }
});
const PEM = privateKey.trim();

/**
 * Berilgan muhit bilan config'ni qaytadan yuklaydi.
 * @param {string} label - keshni chetlab o'tish uchun noyob nom
 * @param {object} env
 * @returns {Promise<object>}
 */
async function load(label, env) {
  delete process.env.FIREBASE_PRIVATE_KEY;
  delete process.env.FIREBASE_PRIVATE_KEY_BASE64;
  Object.assign(process.env, env);
  return import(`../src/config.js?case=${label}`);
}

test('base64 kalit dekodlanadi', async () => {
  const { config, isPemKey } = await load('b64', {
    FIREBASE_PRIVATE_KEY_BASE64: Buffer.from(`${PEM}\n`).toString('base64')
  });
  assert.equal(config.firebase.privateKey, `${PEM}\n`);
  assert.ok(isPemKey(config.firebase.privateKey));
});

test('base64 ichidagi qator ko\'chishlari tozalanadi', async () => {
  // Ba'zi vositalar base64 ni 64 belgidan keyin sindiradi
  const wrapped = Buffer.from(`${PEM}\n`).toString('base64').replace(/(.{64})/g, '$1\n');
  const { config } = await load('b64wrap', { FIREBASE_PRIVATE_KEY_BASE64: wrapped });
  assert.equal(config.firebase.privateKey, `${PEM}\n`);
});

test('base64 bo\'lmasa `\\n` li oddiy variant ishlatiladi', async () => {
  const { config, isPemKey } = await load('escaped', {
    FIREBASE_PRIVATE_KEY: PEM.replace(/\n/g, '\\n')
  });
  assert.equal(config.firebase.privateKey, `${PEM}\n`);
  assert.ok(isPemKey(config.firebase.privateKey));
});

test('qiymatni o\'rab turgan qo\'shtirnoq olib tashlanadi', async () => {
  const { config, isPemKey } = await load('quoted', {
    FIREBASE_PRIVATE_KEY: `"${PEM.replace(/\n/g, '\\n')}"`
  });
  assert.equal(config.firebase.privateKey, `${PEM}\n`);
  assert.ok(isPemKey(config.firebase.privateKey));
});

test('base64 ikkalasi bo\'lganda ustun turadi', async () => {
  const { config } = await load('both', {
    FIREBASE_PRIVATE_KEY: 'buzuq-qiymat',
    FIREBASE_PRIVATE_KEY_BASE64: Buffer.from(`${PEM}\n`).toString('base64')
  });
  assert.equal(config.firebase.privateKey, `${PEM}\n`);
});

test('buzuq kalit checkConfig da aniq sabab bilan chiqadi', async () => {
  const { checkConfig } = await load('broken', { FIREBASE_PRIVATE_KEY: 'buzuq-qiymat' });
  const problems = checkConfig();
  assert.ok(problems.some((p) => p.includes('PEM shaklida emas')), problems.join(' | '));
});

test('kalit umuman yo\'q bo\'lsa ham aytiladi', async () => {
  const { checkConfig } = await load('missing', {});
  const problems = checkConfig();
  assert.ok(problems.some((p) => p.includes('FIREBASE_PRIVATE_KEY_BASE64')), problems.join(' | '));
});
