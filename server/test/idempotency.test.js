/**
 * Idempotency kaliti testi — xotiradagi soxta Firestore bilan.
 *
 * Tekshiriladigan asosiy holat: Render uyqudan uyg'onganda birinchi
 * so'rov client tomonda timeout bo'ladi, lekin server uni bajaradi.
 * Foydalanuvchi qayta bosganda ikkinchi buyurtma YARATILMASLIGI kerak.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { claimIdempotency } from '../src/orders.js';

/**
 * Firestore'ning shu funksiyaga kerak bo'lgan qismini taqlid qiladi:
 * `create()` (mavjud bo'lsa xato), `get()`, `set(..., {merge})`, `delete()`.
 * @returns {object}
 */
function fakeDb() {
  const docs = new Map();

  const makeRef = (id) => ({
    id,
    async create(data) {
      if (docs.has(id)) {
        const e = new Error('ALREADY_EXISTS');
        e.code = 6;
        throw e;
      }
      docs.set(id, { ...data });
    },
    async get() {
      const data = docs.get(id);
      return { exists: Boolean(data), data: () => (data ? { ...data } : undefined) };
    },
    async set(patch, opts) {
      docs.set(id, opts?.merge ? { ...(docs.get(id) || {}), ...patch } : { ...patch });
    },
    async delete() {
      docs.delete(id);
    }
  });

  return {
    docs,
    collection: () => ({ doc: (id) => makeRef(id) })
  };
}

test('birinchi so\'rov kalit egasi bo\'ladi', async () => {
  const db = fakeDb();
  const claim = await claimIdempotency(db, 'u1', 'key-1');
  assert.equal(claim.owner, true);
  assert.equal(db.docs.size, 1);
});

test('tugagan so\'rovdan keyin takror mavjud buyurtmani qaytaradi', async () => {
  const db = fakeDb();
  const first = await claimIdempotency(db, 'u1', 'key-1');
  await first.ref.set({ status: 'done', orderId: 'ord-7', orderNumber: 12, total: 77000 }, { merge: true });

  const second = await claimIdempotency(db, 'u1', 'key-1');
  assert.equal(second.owner, false);
  assert.equal(second.orderId, 'ord-7');
  assert.equal(second.orderNumber, 12);
  assert.equal(second.total, 77000);
  // Yangi hujjat ochilmadi — ya'ni yangi buyurtma ham yaratilmaydi
  assert.equal(db.docs.size, 1);
});

test('turli foydalanuvchilarda bir xil kalit to\'qnashmaydi', async () => {
  const db = fakeDb();
  const a = await claimIdempotency(db, 'u1', 'same-key');
  const b = await claimIdempotency(db, 'u2', 'same-key');
  assert.equal(a.owner, true);
  assert.equal(b.owner, true);
  assert.equal(db.docs.size, 2);
});

test('xato bilan tugagan urinishdan keyin kalit qayta ishlatiladi', async () => {
  const db = fakeDb();
  const first = await claimIdempotency(db, 'u1', 'key-1');
  // createOrder xato bersa kalit o'chiriladi
  await first.ref.delete();

  const retry = await claimIdempotency(db, 'u1', 'key-1');
  assert.equal(retry.owner, true);
});

test('osilib qolgan yozuv (eski `pending`) bo\'shatiladi', async () => {
  const db = fakeDb();
  await claimIdempotency(db, 'u1', 'key-1');

  // Process qayta ishga tushib `finally` bajarilmagan holat: yozuv
  // `pending` bo'lib qolgan va eskirgan
  const [id] = [...db.docs.keys()];
  db.docs.set(id, { uid: 'u1', status: 'pending', createdAt: { toMillis: () => Date.now() - 300000 } });

  const retry = await claimIdempotency(db, 'u1', 'key-1');
  assert.equal(retry.owner, true);
});

test('kalitsiz so\'rovlar bir-biriga xalaqit bermaydi', async () => {
  const db = fakeDb();
  const a = await claimIdempotency(db, 'u1', 'key-a');
  const b = await claimIdempotency(db, 'u1', 'key-b');
  assert.equal(a.owner, true);
  assert.equal(b.owner, true);
  assert.equal(db.docs.size, 2);
});
