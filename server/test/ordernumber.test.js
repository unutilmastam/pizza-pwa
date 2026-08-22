/**
 * Buyurtma raqami testi — xotiradagi soxta Firestore bilan.
 *
 * Tekshiriladigan asosiy holat: raqam va buyurtma BITTA transaction'da
 * yozilishi kerak. Ilgari raqam alohida olinardi va yozuv yiqilganda
 * sarflanib ketardi — ro'yxatda №17, keyin darhol №19 bo'lib bo'shliq
 * qolardi.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { claimOrderNumber } from '../src/orders.js';

/**
 * Firestore transaction semantikasini taqlid qiladi: yozuvlar buferga
 * to'planadi va FAQAT callback muvaffaqiyatli tugaganda qo'llanadi.
 * @returns {object}
 */
function fakeDb() {
  const docs = new Map();

  const makeRef = (path) => ({ path });

  return {
    docs,
    collection: (name) => ({ doc: (id) => makeRef(`${name}/${id}`) }),

    async runTransaction(fn) {
      /** @type {Array<{ref: object, data: object, merge: boolean}>} */
      const pending = [];
      const tx = {
        async get(ref) {
          const data = docs.get(ref.path);
          return { exists: Boolean(data), data: () => (data ? { ...data } : undefined) };
        },
        set(ref, data, opts) {
          pending.push({ ref, data, merge: Boolean(opts?.merge) });
        }
      };

      // Callback xato bersa bufer TASHLANADI — hech nima yozilmaydi
      const result = await fn(tx);
      pending.forEach(({ ref, data, merge }) => {
        docs.set(ref.path, merge ? { ...(docs.get(ref.path) || {}), ...data } : { ...data });
      });
      return result;
    }
  };
}

test('birinchi buyurtma 1-raqamni oladi', async () => {
  const db = fakeDb();
  const n = await db.runTransaction((tx) => claimOrderNumber(tx, db));

  assert.equal(n, 1);
  assert.equal(db.docs.get('counters/orderNumber').value, 1);
});

test('raqamlar ketma-ket oshadi', async () => {
  const db = fakeDb();
  const numbers = [];
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    numbers.push(await db.runTransaction((tx) => claimOrderNumber(tx, db)));
  }

  assert.deepEqual(numbers, [1, 2, 3, 4, 5]);
  assert.equal(db.docs.get('counters/orderNumber').value, 5);
});

test('yozuv yiqilsa raqam SARFLANMAYDI', async () => {
  const db = fakeDb();
  await db.runTransaction((tx) => claimOrderNumber(tx, db));

  // Buyurtma yozayotganda xato — masalan promokod hujjati o'chirilgan
  await assert.rejects(
    db.runTransaction(async (tx) => {
      await claimOrderNumber(tx, db);
      throw new Error('promokod topilmadi');
    }),
    /promokod topilmadi/
  );

  // Hisoblagich hamon 1 — bo'shliq qolmadi
  assert.equal(db.docs.get('counters/orderNumber').value, 1);

  // Keyingi buyurtma 2-raqamni oladi, 3-ni emas
  const next = await db.runTransaction((tx) => claimOrderNumber(tx, db));
  assert.equal(next, 2);
});

test('buyurtma va hisoblagich birga yoziladi', async () => {
  const db = fakeDb();
  const orderRef = db.collection('orders').doc('ord-1');

  const n = await db.runTransaction(async (tx) => {
    const number = await claimOrderNumber(tx, db);
    tx.set(orderRef, { orderNumber: number, total: 100000 });
    return number;
  });

  assert.equal(n, 1);
  assert.equal(db.docs.get('orders/ord-1').orderNumber, 1);
  assert.equal(db.docs.get('counters/orderNumber').value, 1);
});

test('buyurtma yozilmasa hisoblagich ham o\'zgarmaydi', async () => {
  const db = fakeDb();
  const orderRef = db.collection('orders').doc('ord-1');

  await assert.rejects(db.runTransaction(async (tx) => {
    const number = await claimOrderNumber(tx, db);
    tx.set(orderRef, { orderNumber: number });
    throw new Error('bonus yetmadi');
  }));

  assert.equal(db.docs.has('orders/ord-1'), false);
  assert.equal(db.docs.has('counters/orderNumber'), false);
});
