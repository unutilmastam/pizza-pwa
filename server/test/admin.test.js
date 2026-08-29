/**
 * Admin servis amallari testi (SPEC 118–119) — xotiradagi soxta
 * Firestore bilan, Firebase kerak emas.
 *
 * `giveBonus()` va `audienceUsers()` `getDb()` ga tayanadi, shuning
 * uchun `node:test` ning modul mock'i ishlatiladi.
 */

import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Transaction semantikasini taqlid qiladi: yozuvlar buferga to'planadi
 * va FAQAT callback muvaffaqiyatli tugaganda qo'llanadi.
 * @returns {object}
 */
function fakeDb(seed = {}) {
  const docs = new Map(Object.entries(seed));

  const makeRef = (path) => ({
    path,
    id: path.split('/').pop(),
    collection: (name) => ({
      doc: (id) => makeRef(`${path}/${name}/${id || 'auto-1'}`)
    }),
    async set(data, opts) {
      docs.set(path, opts?.merge ? { ...(docs.get(path) || {}), ...data } : { ...data });
    },
    async get() {
      const data = docs.get(path);
      return { exists: Boolean(data), data: () => (data ? { ...data } : undefined) };
    }
  });

  return {
    docs,
    collection: (name) => ({
      doc: (id) => makeRef(`${name}/${id || 'auto-1'}`),
      async get() {
        return {
          docs: [...docs.entries()]
            .filter(([k]) => k.startsWith(`${name}/`) && k.split('/').length === 2)
            .map(([k, v]) => ({ id: k.split('/')[1], data: () => v }))
        };
      }
    }),
    async runTransaction(fn) {
      const pending = [];
      const tx = {
        async get(ref) {
          const data = docs.get(ref.path);
          return { exists: Boolean(data), data: () => (data ? { ...data } : undefined) };
        },
        set(ref, data, opts) { pending.push({ ref, data, merge: Boolean(opts?.merge) }); }
      };
      const result = await fn(tx);
      pending.forEach(({ ref, data, merge }) => {
        docs.set(ref.path, merge ? { ...(docs.get(ref.path) || {}), ...data } : { ...data });
      });
      return result;
    }
  };
}

/** Joriy soxta baza — mock shu yerga qaraydi. */
let db = fakeDb();

mock.module('../src/firebase.js', {
  namedExports: {
    getDb: async () => db,
    // `otp.js` ham shu moduldan import qiladi — mock TO'LIQ bo'lishi
    // kerak, aks holda "does not provide an export" xatosi chiqadi
    getAuth: async () => ({}),
    getFieldTypes: async () => ({
      Timestamp: { now: () => ({ __ts: true, toMillis: () => Date.now() }) },
      FieldValue: {}
    }),
    pingDb: async () => true
  }
});

/** Telegram chaqirilmasin — xabar yuborilgani sanoqda qoladi. */
const sent = [];
mock.module('../src/telegram.js', {
  namedExports: {
    sendMessage: async (chatId, text) => { sent.push({ chatId, text }); return true; },
    sendTelegramLog: async () => true,
    notifyNewOrder: async () => true,
    notifyStatus: async () => true
  }
});

const { giveBonus, audienceUsers, AUDIENCES } = await import('../src/admin.js');

const BY = { uid: 'super1', name: 'Bosh admin' };
const DAY = 86400000;

/* ------------------------------------------------------------- bonus */

test('bonus qo\'shiladi va tarixga yoziladi', async () => {
  db = fakeDb({ 'users/u1': { name: 'Ali', bonusBalance: 5000 } });
  const result = await giveBonus({ uid: 'u1', amount: 10000, reason: 'Uzr uchun', by: BY });

  assert.equal(result.bonusBalance, 15000);
  assert.equal(db.docs.get('users/u1').bonusBalance, 15000);

  const entry = [...db.docs.entries()].find(([k]) => k.includes('bonusHistory'));
  assert.ok(entry, 'bonusHistory yozuvi bo\'lishi kerak');
  assert.equal(entry[1].type, 'gift');
  assert.equal(entry[1].amount, 10000);
  assert.equal(entry[1].reason, 'Uzr uchun');
  assert.equal(entry[1].byUid, 'super1');
});

test('manfiy summa bonusni ayiradi', async () => {
  db = fakeDb({ 'users/u1': { bonusBalance: 5000 } });
  const result = await giveBonus({ uid: 'u1', amount: -2000, reason: 'Xato edi', by: BY });
  assert.equal(result.bonusBalance, 3000);
});

test('balans MANFIY bo\'lmaydi', async () => {
  db = fakeDb({ 'users/u1': { bonusBalance: 1000 } });
  await assert.rejects(
    giveBonus({ uid: 'u1', amount: -5000, reason: 'ko\'p', by: BY }),
    (e) => e.code === 'not-enough-bonus'
  );
  // Yiqilganda balans ham o'zgarmagan bo'lishi kerak
  assert.equal(db.docs.get('users/u1').bonusBalance, 1000);
});

test('sababsiz va nol summa rad etiladi', async () => {
  db = fakeDb({ 'users/u1': { bonusBalance: 0 } });
  await assert.rejects(giveBonus({ uid: 'u1', amount: 1000, reason: '', by: BY }));
  await assert.rejects(giveBonus({ uid: 'u1', amount: 0, reason: 'sabab', by: BY }));
  await assert.rejects(giveBonus({ uid: '', amount: 1000, reason: 'sabab', by: BY }));
});

test('juda katta summa rad etiladi', async () => {
  db = fakeDb({ 'users/u1': { bonusBalance: 0 } });
  await assert.rejects(
    giveBonus({ uid: 'u1', amount: 99000000, reason: 'sabab', by: BY }),
    (e) => e.code === 'amount-too-big'
  );
});

test('mavjud bo\'lmagan mijozga bonus berilmaydi', async () => {
  db = fakeDb({});
  await assert.rejects(
    giveBonus({ uid: 'yoq', amount: 1000, reason: 'sabab', by: BY }),
    (e) => e.code === 'no-user'
  );
});

/* --------------------------------------------------------- auditoriya */

test('auditoriya: faqat Telegram ulaganlar va bloklanmaganlar', async () => {
  const now = Date.now();
  db = fakeDb({
    'users/a': { telegramId: 111, lastOrderAt: now - 5 * DAY },
    'users/b': { telegramId: 222, lastOrderAt: now - 90 * DAY },
    // Telegram yo'q — hech qaysi guruhga kirmaydi
    'users/c': { lastOrderAt: now - 1 * DAY },
    // Bloklangan — chiqarib tashlanadi
    'users/d': { telegramId: 444, blocked: true, lastOrderAt: now - 1 * DAY },
    // Hech qachon buyurtma bermagan
    'users/e': { telegramId: 555 }
  });

  const all = await audienceUsers('all');
  assert.deepEqual(all.map((u) => u.uid).sort(), ['a', 'b', 'e']);

  const active = await audienceUsers('active');
  assert.deepEqual(active.map((u) => u.uid), ['a']);

  // 60 kundan beri buyurtma yo'q + hech qachon bermaganlar
  const sleeping = await audienceUsers('sleeping');
  assert.deepEqual(sleeping.map((u) => u.uid).sort(), ['b', 'e']);
});

test('noto\'g\'ri auditoriya rad etiladi', async () => {
  db = fakeDb({});
  await assert.rejects(audienceUsers('hammasi'), (e) => e.code === 'bad-audience');
  assert.deepEqual(AUDIENCES, ['all', 'active', 'sleeping']);
});
