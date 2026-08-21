/**
 * Narxlash va zona testi — Firestore'siz, sof funksiyalar ustida.
 * Ishga tushirish: `npm test` (server papkasida).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { priceItems } from '../src/orders.js';
import { pointInPolygon, findZone } from '../src/geo.js';
import { normalizePhone } from '../src/otp.js';

/** Kichik soxta menyu. */
const menu = {
  version: 1,
  products: new Map([
    ['pizza-margarita', {
      id: 'pizza-margarita',
      name: { uz: 'Margarita' },
      active: true,
      variants: [
        { id: 'marg-30', size: '30', dough: 'thin', price: 45000 },
        { id: 'marg-35', size: '35', dough: 'thick', price: 59000 }
      ],
      addons: [
        { id: 'cheese', name: { uz: 'Pishloq' }, price: 8000 },
        { id: 'bacon', name: { uz: 'Bekon' }, price: 12000 }
      ],
      removable: [{ id: 'onion', name: { uz: 'Piyoz' } }]
    }],
    ['drink-cola', {
      id: 'drink-cola',
      name: { uz: 'Cola' },
      active: true,
      variants: [{ id: 'cola-05', size: '0.5', price: 12000 }]
    }],
    ['pizza-off', {
      id: 'pizza-off',
      name: { uz: 'Yopilgan' },
      active: false,
      variants: [{ id: 'off-30', price: 10000 }]
    }]
  ])
};

const branch = { stopList: [], priceOverrides: {} };

test('asos narx variantdan olinadi, client narxi e\'tiborga olinmaydi', () => {
  const { items, subtotal } = priceItems(
    [{ productId: 'pizza-margarita', variantId: 'marg-30', qty: 2, unitPrice: 1 }],
    menu,
    branch
  );
  assert.equal(items[0].unitPrice, 45000);
  assert.equal(items[0].total, 90000);
  assert.equal(subtotal, 90000);
});

test('qo\'shimchalar narxga qo\'shiladi', () => {
  const { subtotal } = priceItems(
    [{ productId: 'pizza-margarita', variantId: 'marg-35', qty: 1, addons: ['cheese', 'bacon'] }],
    menu,
    branch
  );
  assert.equal(subtotal, 59000 + 8000 + 12000);
});

test('filial narx o\'zgarishi ustun turadi', () => {
  const { subtotal } = priceItems(
    [{ productId: 'pizza-margarita', variantId: 'marg-30', qty: 1 }],
    menu,
    { stopList: [], priceOverrides: { 'marg-30': 52000 } }
  );
  assert.equal(subtotal, 52000);
});

test('stop-listdagi mahsulot rad etiladi', () => {
  assert.throws(
    () => priceItems(
      [{ productId: 'pizza-margarita', variantId: 'marg-30', qty: 1 }],
      menu,
      { stopList: ['pizza-margarita'], priceOverrides: {} }
    ),
    /mavjud emas/
  );
});

test('nofaol mahsulot, noma\'lum variant va qo\'shimcha rad etiladi', () => {
  assert.throws(() => priceItems(
    [{ productId: 'pizza-off', variantId: 'off-30', qty: 1 }], menu, branch
  ), /Mahsulot mavjud emas/);

  assert.throws(() => priceItems(
    [{ productId: 'pizza-margarita', variantId: 'yolgon', qty: 1 }], menu, branch
  ), /Variant mavjud emas/);

  assert.throws(() => priceItems(
    [{ productId: 'pizza-margarita', variantId: 'marg-30', qty: 1, addons: ['oltin'] }], menu, branch
  ), /Qo'shimcha mavjud emas/);
});

test('miqdor chegaralari tekshiriladi', () => {
  assert.throws(() => priceItems(
    [{ productId: 'drink-cola', variantId: 'cola-05', qty: 0 }], menu, branch
  ), /Miqdor/);
  assert.throws(() => priceItems(
    [{ productId: 'drink-cola', variantId: 'cola-05', qty: 999 }], menu, branch
  ), /Miqdor/);
  assert.throws(() => priceItems([], menu, branch), /bo'sh/);
});

test('faqat ro\'yxatdagi ingredient olib tashlanadi', () => {
  const { items } = priceItems(
    [{ productId: 'pizza-margarita', variantId: 'marg-30', qty: 1, removed: ['onion', 'yolgon'] }],
    menu,
    branch
  );
  assert.deepEqual(items[0].removed, ['onion']);
});

test('polygon obyekt formatida ishlaydi', () => {
  const square = [
    { lat: 41.30, lng: 69.20 },
    { lat: 41.30, lng: 69.30 },
    { lat: 41.35, lng: 69.30 },
    { lat: 41.35, lng: 69.20 }
  ];
  assert.equal(pointInPolygon({ lat: 41.32, lng: 69.25 }, square), true);
  assert.equal(pointInPolygon({ lat: 41.40, lng: 69.25 }, square), false);
  assert.equal(pointInPolygon([41.32, 69.25], square), true);
});

test('findZone tanlangan filialni afzal ko\'radi', () => {
  const ring = (dLng) => [
    { lat: 41.30, lng: 69.20 + dLng },
    { lat: 41.30, lng: 69.30 + dLng },
    { lat: 41.35, lng: 69.30 + dLng },
    { lat: 41.35, lng: 69.20 + dLng }
  ];
  const branches = [
    { id: 'a', active: true, zones: [{ name: 'A', polygon: ring(0), deliveryPrice: 12000 }] },
    { id: 'b', active: true, zones: [{ name: 'B', polygon: ring(0), deliveryPrice: 20000 }] }
  ];
  assert.equal(findZone({ lat: 41.32, lng: 69.25 }, branches).branch.id, 'a');
  assert.equal(findZone({ lat: 41.32, lng: 69.25 }, branches, 'b').branch.id, 'b');
  assert.equal(findZone({ lat: 10, lng: 10 }, branches), null);
});

test('telefon normallashtirish', () => {
  assert.equal(normalizePhone('+998 90 123 45 67'), '998901234567');
  assert.equal(normalizePhone('901234567'), '998901234567');
  assert.equal(normalizePhone('12345'), null);
});
