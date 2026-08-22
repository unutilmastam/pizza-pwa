/**
 * Kuryer servisi testi (9-bosqich).
 *
 * Firestore'ga tegmaydigan qismlar sinaladi: `pending_` ID yasash,
 * ruxsat etilgan statuslar va kunlik hisob yig'indisi.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { pendingId, PENDING_PREFIX, COURIER_STATUSES, summarizeOrders } from '../src/couriers.js';

test('pendingId turli yozilishdan bir xil ID beradi', () => {
  const expected = 'pending_998901112233';
  assert.equal(pendingId('+998901112233'), expected);
  assert.equal(pendingId('+998 90 111 22 33'), expected);
  assert.equal(pendingId('998-90-111-22-33'), expected);
});

test('pendingId prefiksi eksport bilan mos', () => {
  assert.ok(pendingId('+998901112233').startsWith(PENDING_PREFIX));
});

test('kuryerga faqat ikki status ruxsat etilgan', () => {
  assert.deepEqual(COURIER_STATUSES, ['on_way', 'delivered']);
  // Oshxona statuslari kuryerga yopiq
  ['new', 'accepted', 'cooking', 'in_oven', 'packing', 'cancelled']
    .forEach((s) => assert.equal(COURIER_STATUSES.includes(s), false, s));
});

test('hisob: yetkazilganlar naqd va kartaga ajraladi', () => {
  const r = summarizeOrders([
    { status: 'delivered', paymentMethod: 'cash', total: 142000, deliveryPrice: 12000 },
    { status: 'delivered', paymentMethod: 'cash', total: 58000, deliveryPrice: 12000 },
    { status: 'delivered', paymentMethod: 'card', total: 100000, deliveryPrice: 0 }
  ], '2026-08-22');

  assert.equal(r.delivered, 3);
  assert.equal(r.cashTotal, 200000);
  assert.equal(r.cardTotal, 100000);
  assert.equal(r.deliveryTotal, 24000);
  assert.equal(r.orderTotal, 300000);
  assert.equal(r.date, '2026-08-22');
});

test('hisob: yo\'ldagilar "active", bekor qilinganlar hisobga olinmaydi', () => {
  const r = summarizeOrders([
    { status: 'on_way', paymentMethod: 'cash', total: 50000 },
    { status: 'packing', paymentMethod: 'card', total: 60000 },
    // Ikki xil yozilish — ikkalasi ham chiqib qolishi kerak
    { status: 'cancelled', paymentMethod: 'cash', total: 70000 },
    { status: 'canceled', paymentMethod: 'cash', total: 80000 }
  ], '2026-08-22');

  assert.equal(r.active, 2);
  assert.equal(r.delivered, 0);
  assert.equal(r.cashTotal, 0);
  assert.equal(r.orderTotal, 0);
});

test('hisob: bo\'sh ro\'yxatda nollar qaytadi', () => {
  const r = summarizeOrders([], '2026-08-22');
  assert.deepEqual(r, {
    date: '2026-08-22',
    delivered: 0,
    active: 0,
    deliveryTotal: 0,
    cashTotal: 0,
    cardTotal: 0,
    orderTotal: 0
  });
});

test('hisob: buzuq summalar noldek qabul qilinadi', () => {
  const r = summarizeOrders([
    { status: 'delivered', paymentMethod: 'cash', total: null, deliveryPrice: undefined },
    { status: 'delivered', paymentMethod: 'cash', total: 'xx', deliveryPrice: '12000' }
  ], '2026-08-22');

  assert.equal(r.delivered, 2);
  assert.equal(r.cashTotal, 0);
  assert.equal(r.deliveryTotal, 12000);
});
