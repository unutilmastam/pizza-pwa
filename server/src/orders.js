/**
 * Buyurtma yakunlash — servisning asosiy vazifasi (SPEC 4.1).
 *
 * QOIDA: client yuborgan narxga ISHONILMAYDI. Har bir element narxi
 * `menu/current` dan qayta hisoblanadi, yetkazish narxi filial zonasidan
 * olinadi, promokod va bonus serverda tekshiriladi, `orderNumber` esa
 * transaction bilan beriladi.
 *
 * To'lov: hozircha faqat NAQD va KURYERDA KARTA. Ikkalasi ham buyurtmada
 * belgi sifatida saqlanadi (`paymentMethod`), pul oqimi bilan servis
 * ishlamaydi. Payme/Click integratsiyasi keyingi bosqichga qoldirilgan.
 */

import { createHash } from 'node:crypto';
import { config } from './config.js';
import { getDb, getFieldTypes } from './firebase.js';
import { findZone } from './geo.js';
import { httpError } from './otp.js';
import { notifyNewOrder, notifyStatus } from './telegram.js';

/** Ruxsat etilgan to'lov usullari. */
export const PAYMENT_METHODS = ['cash', 'card'];

/** Buyurtma statuslari ketma-ketligi. */
export const STATUSES = [
  'new', 'accepted', 'cooking', 'in_oven', 'packing', 'on_way', 'delivered'
];

/**
 * Mijoz O'ZI bekor qila oladigan bosqichlar.
 * Oshxona tayyorlashni boshlagach (`cooking`) mahsulot sarflanadi —
 * bundan keyin bekor qilishni operator hal qiladi.
 */
export const CUSTOMER_CANCELABLE = ['new', 'accepted'];

/** Bitta buyurtmadagi eng ko'p element soni — nojo'ya so'rovlardan himoya. */
const MAX_ITEMS = 50;
const MAX_QTY = 30;

/**
 * Idempotency kaliti bo'yicha "band" yozuv necha vaqt tirik hisoblanadi.
 * Birinchi so'rov shu vaqt ichida tugamasa, kalit bo'shatiladi.
 */
const IDEMPOTENCY_STALE_MS = 120000;

/** Takroriy so'rov birinchisini kutish vaqti va tekshiruv oralig'i. */
const IDEMPOTENCY_WAIT_MS = 20000;
const IDEMPOTENCY_POLL_MS = 500;

/**
 * Kalitdan Firestore hujjat ID yasaydi.
 * Kalit foydalanuvchi yuborgan matn — hujjat ID sifatida to'g'ridan-to'g'ri
 * ishlatib bo'lmaydi (`/` va uzunlik cheklovi), shuning uchun xeshlanadi.
 * uid ham aralashtiriladi: bir foydalanuvchining kaliti boshqasinikiga
 * ta'sir qilmasin.
 *
 * @param {string} uid
 * @param {string} key
 * @returns {string}
 */
function idempotencyDocId(uid, key) {
  return createHash('sha256').update(`${uid}:${key}`).digest('hex');
}

/**
 * Kutadi.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Idempotency kalitini band qiladi.
 *
 * Render bepul planida servis uyqudan uyg'onganda birinchi so'rov
 * client tomonda timeout bo'lishi mumkin, lekin SERVER uni baribir
 * oxirigacha bajaradi. Foydalanuvchi qayta bosganda ayni o'sha kalit
 * keladi va bu funksiya yangi buyurtma yaratishga yo'l qo'ymaydi.
 *
 * `create()` atomik: hujjat bor bo'lsa xato beradi, shuning uchun ikki
 * so'rov bir vaqtda kelsa ham faqat bittasi "egasi" bo'ladi.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} uid
 * @param {string} key
 * @returns {Promise<{owner: boolean, ref: object, orderId?: string,
 *                    orderNumber?: number, total?: number}>}
 *
 * Eksport qilingan: `server/test/idempotency.test.js` uni xotiradagi
 * soxta Firestore bilan sinaydi.
 */
export async function claimIdempotency(db, uid, key) {
  const { Timestamp } = await getFieldTypes();
  const ref = db.collection('idempotency').doc(idempotencyDocId(uid, key));

  try {
    await ref.create({ uid, status: 'pending', createdAt: Timestamp.now() });
    return { owner: true, ref };
  } catch (e) {
    if (e.code !== 6 && e.code !== 'already-exists') throw e;
  }

  // Kalit band — birinchi so'rov tugashini kutamiz
  const deadline = Date.now() + IDEMPOTENCY_WAIT_MS;
  for (;;) {
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : null;

    if (!data) {
      // Yozuv o'chirilgan (birinchi so'rov xato bilan tugagan) — qayta urinamiz
      return claimIdempotency(db, uid, key);
    }
    if (data.orderId) {
      return {
        owner: false,
        ref,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        total: data.total
      };
    }

    // Birinchi so'rov osilib qolgan bo'lsa (process qayta ishga tushgan
    // va `finally` bajarilmagan) — kalitni bo'shatamiz
    const age = Date.now() - (data.createdAt?.toMillis?.() ?? 0);
    if (age > IDEMPOTENCY_STALE_MS) {
      await ref.delete().catch(() => {});
      return claimIdempotency(db, uid, key);
    }
    if (Date.now() > deadline) {
      throw httpError(409, 'order-in-progress', 'Buyurtma yaratilmoqda, biroz kuting');
    }
    await sleep(IDEMPOTENCY_POLL_MS);
  }
}

/**
 * `settings/global` — bo'lmasa env qiymatlari ishlatiladi.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @returns {Promise<object>}
 */
async function getSettings(db) {
  const snap = await db.collection('settings').doc('global').get();
  const data = snap.exists ? snap.data() : {};
  return {
    guaranteeMinutes: data.guaranteeMinutes ?? config.rules.guaranteeMinutes,
    cashbackPercent: data.cashbackPercent ?? config.rules.cashbackPercent,
    bonusExpiryDays: data.bonusExpiryDays ?? config.rules.bonusExpiryDays
  };
}

/**
 * `menu/current` hujjatini indekslangan ko'rinishda beradi.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @returns {Promise<{version: number, products: Map<string, object>}>}
 */
async function getMenu(db) {
  const snap = await db.collection('menu').doc('current').get();
  if (!snap.exists) throw httpError(503, 'no-menu', 'Menyu topilmadi');

  const data = snap.data();
  const products = new Map();
  (data.products || []).forEach((product) => products.set(product.id, product));
  return { version: data.version ?? 0, products };
}

/**
 * Filialni o'qiydi.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} branchId
 * @returns {Promise<object>}
 */
async function getBranch(db, branchId) {
  const snap = await db.collection('branches').doc(branchId).get();
  if (!snap.exists) throw httpError(400, 'no-branch', 'Filial topilmadi');
  const branch = { id: snap.id, ...snap.data() };
  if (branch.active === false) throw httpError(400, 'branch-closed', 'Filial yopiq');
  return branch;
}

/**
 * Barcha faol filiallar.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @returns {Promise<object[]>}
 */
async function getBranches(db) {
  const snap = await db.collection('branches').get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Savat elementlarini menyu bo'yicha qayta narxlaydi.
 *
 * @param {Array<object>} rawItems - client yuborgan elementlar
 * @param {{products: Map<string, object>}} menu
 * @param {object} branch - stop list va narx o'zgarishlari uchun
 * @returns {{items: object[], subtotal: number}}
 *
 * Eksport qilingan, chunki narxlash servisning eng muhim qismi —
 * `server/test/price.test.js` uni Firestore'siz sinaydi.
 */
export function priceItems(rawItems, menu, branch) {
  if (!Array.isArray(rawItems) || !rawItems.length) {
    throw httpError(400, 'empty-cart', 'Savat bo\'sh');
  }
  if (rawItems.length > MAX_ITEMS) {
    throw httpError(400, 'too-many-items', 'Elementlar juda ko\'p');
  }

  const stopList = new Set(branch.stopList || []);
  const overrides = branch.priceOverrides || {};
  const items = [];
  let subtotal = 0;

  rawItems.forEach((raw) => {
    const product = menu.products.get(raw.productId);
    if (!product || product.active === false) {
      throw httpError(409, 'product-unavailable', `Mahsulot mavjud emas: ${raw.productId}`, {
        productId: raw.productId
      });
    }
    const variant = (product.variants || []).find((v) => v.id === raw.variantId);
    if (!variant) {
      throw httpError(409, 'variant-unavailable', `Variant mavjud emas: ${raw.variantId}`, {
        productId: raw.productId
      });
    }
    if (stopList.has(product.id) || stopList.has(variant.id)) {
      throw httpError(409, 'stop-list', `Hozircha mavjud emas: ${product.id}`, {
        productId: product.id
      });
    }

    const qty = Math.floor(Number(raw.qty) || 0);
    if (qty < 1 || qty > MAX_QTY) {
      throw httpError(400, 'bad-qty', 'Miqdor noto\'g\'ri');
    }

    // Asos narx: filial o'zgartirgan bo'lsa — o'shanisi
    const base = Number(overrides[variant.id] ?? variant.price) || 0;

    // Qo'shimchalar — faqat mahsulotda ro'yxatdagilar qabul qilinadi
    const addons = [];
    let addonsPrice = 0;
    (raw.addons || []).forEach((rawAddon) => {
      const id = typeof rawAddon === 'string' ? rawAddon : rawAddon?.id;
      const addon = (product.addons || []).find((a) => a.id === id);
      if (!addon) {
        throw httpError(409, 'addon-unavailable', `Qo'shimcha mavjud emas: ${id}`);
      }
      addons.push({ id: addon.id, name: addon.name, price: Number(addon.price) || 0 });
      addonsPrice += Number(addon.price) || 0;
    });

    // Olib tashlanadigan ingredientlar narxga ta'sir qilmaydi
    const removed = (raw.removed || [])
      .map((r) => (typeof r === 'string' ? r : r?.id))
      .filter((id) => (product.removable || []).some((item) => item.id === id));

    const unitPrice = base + addonsPrice;
    const total = unitPrice * qty;
    subtotal += total;

    items.push({
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      size: variant.size ?? null,
      dough: variant.dough ?? null,
      addons,
      removed,
      qty,
      unitPrice,
      total
    });
  });

  return { items, subtotal };
}

/**
 * Promokodni tekshiradi va chegirmani hisoblaydi.
 * Kodni topolmasa jim o'tmaydi — aniq xato qaytaradi.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} code
 * @param {{uid: string, subtotal: number, deliveryPrice: number,
 *          branchId: string, isFirstOrder: boolean}} ctx
 * @returns {Promise<{discount: number, freeDelivery: boolean, code: string, ref: object}>}
 */
async function applyPromo(db, code, ctx) {
  const id = String(code).trim().toUpperCase();
  const ref = db.collection('promocodes').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw httpError(400, 'promo-not-found', 'Promokod topilmadi');

  const promo = snap.data();
  const now = Date.now();
  const from = promo.validFrom?.toMillis?.() ?? 0;
  const to = promo.validTo?.toMillis?.() ?? Infinity;

  if (promo.active === false) throw httpError(400, 'promo-inactive', 'Promokod faol emas');
  if (now < from || now > to) throw httpError(400, 'promo-expired', 'Promokod muddati tugagan');
  if (promo.minOrder && ctx.subtotal < promo.minOrder) {
    throw httpError(400, 'promo-min-order', 'Buyurtma summasi yetarli emas', {
      minOrder: promo.minOrder
    });
  }
  if (promo.usageLimit && (promo.usedCount ?? 0) >= promo.usageLimit) {
    throw httpError(400, 'promo-used-up', 'Promokod limiti tugagan');
  }
  if (promo.firstOrderOnly && !ctx.isFirstOrder) {
    throw httpError(400, 'promo-first-only', 'Promokod faqat birinchi buyurtma uchun');
  }
  if (Array.isArray(promo.branchIds) && promo.branchIds.length &&
      !promo.branchIds.includes(ctx.branchId)) {
    throw httpError(400, 'promo-other-branch', 'Promokod bu filialda ishlamaydi');
  }
  if (promo.perUserLimit) {
    const used = await db.collection('orders')
      .where('uid', '==', ctx.uid)
      .where('promoCode', '==', id)
      .limit(promo.perUserLimit)
      .get();
    if (used.size >= promo.perUserLimit) {
      throw httpError(400, 'promo-user-limit', 'Siz bu promokoddan foydalangansiz');
    }
  }

  let discount = 0;
  let freeDelivery = false;
  if (promo.type === 'percent') {
    discount = Math.round((ctx.subtotal * (Number(promo.value) || 0)) / 100);
  } else if (promo.type === 'amount') {
    discount = Number(promo.value) || 0;
  } else if (promo.type === 'freeDelivery') {
    freeDelivery = true;
  }
  if (promo.maxDiscount) discount = Math.min(discount, Number(promo.maxDiscount));
  discount = Math.min(discount, ctx.subtotal);

  return { discount, freeDelivery, code: id, ref };
}

/**
 * Yetkazish narxi va zonani aniqlaydi.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {object} payload
 * @param {number} subtotal
 * @returns {Promise<{branch: object, zone: ?object, deliveryPrice: number,
 *                    minOrder: number, etaMinutes: ?number}>}
 */
async function resolveDelivery(db, payload, subtotal) {
  if (payload.type === 'pickup') {
    if (!payload.branchId) throw httpError(400, 'no-branch', 'Filial tanlanmagan');
    const branch = await getBranch(db, payload.branchId);
    return { branch, zone: null, deliveryPrice: 0, minOrder: 0, etaMinutes: null };
  }

  const address = payload.address;
  const lat = Number(address?.lat);
  const lng = Number(address?.lng);
  if (!address || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw httpError(400, 'no-address', 'Manzil koordinatasi yo\'q');
  }

  const branches = await getBranches(db);
  const found = findZone({ lat, lng }, branches, payload.branchId || null);
  if (!found) throw httpError(400, 'out-of-zone', 'Manzil yetkazish zonasidan tashqarida');

  const { branch, zone } = found;
  if (subtotal < (Number(zone.minOrder) || 0)) {
    throw httpError(400, 'min-order', 'Minimal summa yig\'ilmagan', {
      minOrder: Number(zone.minOrder) || 0
    });
  }

  return {
    branch,
    zone,
    deliveryPrice: Number(zone.deliveryPrice) || 0,
    minOrder: Number(zone.minOrder) || 0,
    etaMinutes: Number(zone.etaMinutes) || null
  };
}

/**
 * Navbatdagi buyurtma raqamini transaction bilan beradi.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @returns {Promise<number>}
 */
async function nextOrderNumber(db) {
  const ref = db.collection('counters').doc('orderNumber');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const value = (snap.exists ? Number(snap.data().value) || 0 : 0) + 1;
    tx.set(ref, { value }, { merge: true });
    return value;
  });
}

/**
 * Buyurtma yaratadi — idempotency kaliti bilan himoyalangan.
 *
 * Kalit berilsa, AYNI o'sha kalit bilan kelgan ikkinchi so'rov yangi
 * buyurtma yaratmaydi: birinchisining natijasi qaytariladi (`duplicate:
 * true`). Kalitsiz so'rov ham qabul qilinadi, lekin unda takrorlanishdan
 * himoya yo'q.
 *
 * @param {{uid: string, phone: string, payload: object,
 *          idempotencyKey?: string}} input
 * @returns {Promise<{id: string, orderNumber: number, total: number,
 *                    duplicate?: boolean}>}
 */
export async function createOrder({ uid, phone, payload, idempotencyKey }) {
  const key = String(idempotencyKey || '').trim().slice(0, 128);
  if (!key) return createOrderOnce({ uid, phone, payload });

  const db = await getDb();
  const { Timestamp } = await getFieldTypes();
  const claim = await claimIdempotency(db, uid, key);

  // Kalit allaqachon ishlatilgan — o'sha buyurtmani qaytaramiz
  if (!claim.owner) {
    console.log(`[orders] takroriy so'rov, mavjud buyurtma qaytarildi: ${claim.orderId}`);
    return {
      id: claim.orderId,
      orderNumber: claim.orderNumber,
      total: claim.total,
      duplicate: true
    };
  }

  try {
    const order = await createOrderOnce({ uid, phone, payload });
    await claim.ref.set({
      status: 'done',
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      doneAt: Timestamp.now()
    }, { merge: true });
    return order;
  } catch (e) {
    // Buyurtma yaratilmadi — kalit bo'shatiladi, foydalanuvchi xatoni
    // tuzatib qayta yuborishi mumkin
    await claim.ref.delete().catch(() => {});
    throw e;
  }
}

/**
 * Buyurtmani haqiqatda yaratadi (idempotency tekshiruvisiz).
 *
 * @param {{uid: string, phone: string, payload: object}} input
 * @returns {Promise<{id: string, orderNumber: number, total: number}>}
 */
async function createOrderOnce({ uid, phone, payload }) {
  const db = await getDb();
  const { FieldValue, Timestamp } = await getFieldTypes();

  const type = payload.type === 'pickup' ? 'pickup' : 'delivery';
  const paymentMethod = String(payload.paymentMethod || 'cash');
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw httpError(400, 'bad-payment', 'To\'lov usuli qo\'llab-quvvatlanmaydi');
  }

  const userRef = db.collection('users').doc(uid);
  const [menu, settings, userSnap] = await Promise.all([
    getMenu(db),
    getSettings(db),
    userRef.get()
  ]);

  const user = userSnap.exists ? userSnap.data() : {};
  if (user.blocked) throw httpError(403, 'blocked', 'Foydalanuvchi bloklangan');

  // 1. Yetkazish (filial ham shu yerda aniqlanadi — stop list undan olinadi)
  //    Narxlash filialga bog'liq, shuning uchun avval taxminiy summa bilan
  //    zona topiladi, keyin aniq summa hisoblanadi va minimal summa
  //    qaytadan tekshiriladi.
  const rough = priceItems(payload.items, menu, { stopList: [], priceOverrides: {} });
  const delivery = await resolveDelivery(db, { ...payload, type }, rough.subtotal);

  // 2. Aniq narxlash — endi filial stop-listi va narx o'zgarishlari bilan
  const { items, subtotal } = priceItems(payload.items, menu, delivery.branch);
  if (type === 'delivery' && subtotal < delivery.minOrder) {
    throw httpError(400, 'min-order', 'Minimal summa yig\'ilmagan', { minOrder: delivery.minOrder });
  }

  // 3. Promokod
  let discount = 0;
  let promoCode = null;
  let promoRef = null;
  let deliveryPrice = delivery.deliveryPrice;

  if (payload.promoCode) {
    const firstOrder = await db.collection('orders').where('uid', '==', uid).limit(1).get();
    const promo = await applyPromo(db, payload.promoCode, {
      uid,
      subtotal,
      deliveryPrice,
      branchId: delivery.branch.id,
      isFirstOrder: firstOrder.empty
    });
    discount = promo.discount;
    promoCode = promo.code;
    promoRef = promo.ref;
    if (promo.freeDelivery) deliveryPrice = 0;
  }

  // 4. Bonus — foydalanuvchi balansidan oshib ketmasin
  const requested = Math.max(0, Math.floor(Number(payload.bonusUsed) || 0));
  const balance = Math.max(0, Math.floor(Number(user.bonusBalance) || 0));
  const payable = Math.max(0, subtotal - discount);
  const bonusUsed = Math.min(requested, balance, payable);

  const total = Math.max(0, subtotal - discount - bonusUsed + deliveryPrice);
  const cashback = Math.round((subtotal * settings.cashbackPercent) / 100);

  // 5. Kafolat muddati — faqat "hozir" buyurtmalar uchun
  const scheduledFor = parseScheduled(payload.scheduledFor);
  const guaranteeDeadline = scheduledFor
    ? null
    : Timestamp.fromMillis(Date.now() + settings.guaranteeMinutes * 60000);

  const orderNumber = await nextOrderNumber(db);
  const orderRef = db.collection('orders').doc();

  const order = {
    orderNumber,
    uid,
    phone: phone || user.phone || null,
    name: user.name || null,
    branchId: delivery.branch.id,
    type,
    address: type === 'delivery' ? sanitizeAddress(payload.address) : null,
    lat: type === 'delivery' ? Number(payload.address.lat) : Number(delivery.branch.lat) || null,
    lng: type === 'delivery' ? Number(payload.address.lng) : Number(delivery.branch.lng) || null,
    zoneName: delivery.zone?.name ?? null,
    etaMinutes: delivery.etaMinutes,
    items,
    subtotal,
    deliveryPrice,
    discount,
    bonusUsed,
    total,
    cashback,
    promoCode,
    // To'lov usuli faqat BELGI: naqd yoki kuryerda karta. Onlayn to'lov yo'q.
    paymentMethod,
    paymentStatus: 'unpaid',
    transactionId: null,
    status: 'new',
    statusHistory: [{ status: 'new', at: Timestamp.now(), by: 'client' }],
    courierId: null,
    courierLocation: null,
    scheduledFor,
    guaranteeDeadline,
    guaranteeBroken: false,
    comment: String(payload.comment || '').slice(0, 500),
    changeFrom: paymentMethod === 'cash' && payload.changeFrom
      ? Number(payload.changeFrom)
      : null,
    cutlery: Math.max(0, Math.min(10, Math.floor(Number(payload.cutlery) || 0))),
    menuVersion: menu.version,
    rating: null,
    createdAt: Timestamp.now(),
    deliveredAt: null
  };

  // 6. Yozish — buyurtma, bonus yechilishi va promo hisoblagichi bitta batch'da
  const batch = db.batch();
  batch.set(orderRef, order);

  if (bonusUsed > 0) {
    batch.set(userRef, { bonusBalance: FieldValue.increment(-bonusUsed) }, { merge: true });
    batch.set(userRef.collection('bonusHistory').doc(), {
      type: 'spend',
      amount: -bonusUsed,
      orderId: orderRef.id,
      createdAt: Timestamp.now()
    });
  }
  if (promoRef) {
    batch.set(promoRef, { usedCount: FieldValue.increment(1) }, { merge: true });
  }
  await batch.commit();

  // Telegram xabari buyurtmani to'sib qo'ymasin
  notifyNewOrder(order).catch(() => {});

  return { id: orderRef.id, orderNumber, total };
}

/**
 * Rejalashtirilgan vaqtni tekshiradi.
 * @param {*} value - ISO satr
 * @returns {?import('firebase-admin/firestore').Timestamp}
 */
function parseScheduled(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) throw httpError(400, 'bad-time', 'Vaqt noto\'g\'ri');
  if (time < Date.now() + 15 * 60000) throw httpError(400, 'time-too-soon', 'Vaqt juda yaqin');
  if (time > Date.now() + 7 * 86400000) throw httpError(400, 'time-too-far', 'Vaqt juda uzoq');
  // Timestamp turini bu yerda import qilmaslik uchun oddiy Date qaytariladi —
  // Firestore Date obyektini o'zi Timestamp'ga aylantiradi.
  return new Date(time);
}

/**
 * Manzildan faqat kerakli maydonlarni oladi.
 * @param {object} address
 * @returns {object}
 */
function sanitizeAddress(address) {
  const text = (value, max = 200) => String(value || '').slice(0, max) || null;
  return {
    label: text(address.label, 40),
    address: text(address.address),
    lat: Number(address.lat),
    lng: Number(address.lng),
    apartment: text(address.apartment, 20),
    entrance: text(address.entrance, 20),
    floor: text(address.floor, 20),
    intercom: text(address.intercom, 20),
    comment: text(address.comment, 200)
  };
}

/**
 * Buyurtma statusini o'zgartiradi (admin/kuryer uchun).
 *
 * `reason` — rad etish sababi (SPEC 107), mijozga xabarda ko'rsatiladi.
 * `etaMinutes` — operator belgilagan tayyorlanish vaqti (SPEC 108);
 * u kafolat muddatini ham suradi.
 *
 * @param {{orderId: string, status: string, by: string,
 *          reason?: string, etaMinutes?: number}} input
 * @returns {Promise<{status: string}>}
 */
export async function updateStatus({ orderId, status, by, reason, etaMinutes }) {
  if (!STATUSES.includes(status) && status !== 'cancelled') {
    throw httpError(400, 'bad-status', 'Status noto\'g\'ri');
  }

  const db = await getDb();
  const { FieldValue, Timestamp } = await getFieldTypes();
  const ref = db.collection('orders').doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw httpError(404, 'no-order', 'Buyurtma topilmadi');

  const order = snap.data();
  if (order.status === status) return { status };
  if (order.status === 'delivered' || order.status === 'cancelled') {
    throw httpError(409, 'order-closed', 'Buyurtma yopilgan');
  }

  const patch = {
    status,
    statusHistory: FieldValue.arrayUnion({ status, at: Timestamp.now(), by })
  };

  if (status === 'delivered') {
    patch.deliveredAt = Timestamp.now();
    // Kafolat buzilganmi — cron ulgurmagan bo'lsa shu yerda ham tekshiriladi
    const deadline = order.guaranteeDeadline?.toMillis?.() ?? 0;
    if (deadline && Date.now() > deadline) patch.guaranteeBroken = true;
  }

  if (status === 'cancelled' && reason) {
    patch.cancelReason = String(reason).slice(0, 200);
  }

  // Operator tayyorlanish vaqtini belgilaganda kafolat muddati ham suriladi
  const eta = Math.floor(Number(etaMinutes) || 0);
  if (status === 'accepted' && eta > 0 && eta <= 240) {
    patch.etaMinutes = eta;
    patch.guaranteeDeadline = Timestamp.fromMillis(Date.now() + eta * 60000);
    // Yangi muddat qo'yildi — kafolat qaytadan hisoblanadi
    patch.guaranteeBroken = false;
    patch.guaranteeClosed = false;
  }

  const batch = db.batch();
  batch.update(ref, patch);

  // Yetkazilganda cashback beriladi va sarflangan summa yangilanadi
  if (status === 'delivered' && order.cashback > 0) {
    const settings = await getSettings(db);
    const userRef = db.collection('users').doc(order.uid);
    const expiresAt = new Date(Date.now() + settings.bonusExpiryDays * 86400000);
    batch.set(userRef, {
      bonusBalance: FieldValue.increment(order.cashback),
      totalSpent: FieldValue.increment(order.total || 0)
    }, { merge: true });
    batch.set(userRef.collection('bonusHistory').doc(), {
      type: 'earn',
      amount: order.cashback,
      orderId,
      expiresAt,
      createdAt: Timestamp.now()
    });
  }
  // Bekor qilinganda ishlatilgan bonus qaytariladi
  if (status === 'cancelled' && order.bonusUsed > 0) {
    const userRef = db.collection('users').doc(order.uid);
    batch.set(userRef, { bonusBalance: FieldValue.increment(order.bonusUsed) }, { merge: true });
    batch.set(userRef.collection('bonusHistory').doc(), {
      type: 'gift',
      amount: order.bonusUsed,
      orderId,
      createdAt: Timestamp.now()
    });
  }

  await batch.commit();

  const userSnap = await db.collection('users').doc(order.uid).get();
  notifyStatus(order, status, userSnap.data()?.telegramId).catch(() => {});

  return { status };
}

/**
 * Mijoz O'Z buyurtmasini bekor qiladi.
 *
 * Xodimning `updateStatus()` idan farqi: bu yerda EGALIK tekshiriladi
 * va faqat erta bosqichlarda ruxsat beriladi — oshxona tayyorlashni
 * boshlagach mijoz o'zi bekor qila olmaydi.
 *
 * @param {{orderId: string, uid: string}} input
 * @returns {Promise<{status: string, orderNumber: number}>}
 */
export async function cancelOwnOrder({ orderId, uid }) {
  const db = await getDb();
  const ref = db.collection('orders').doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw httpError(404, 'no-order', 'Buyurtma topilmadi');

  const order = snap.data();
  if (order.uid !== uid) throw httpError(403, 'not-yours', 'Bu buyurtma sizniki emas');

  if (order.status === 'cancelled') {
    return { status: 'cancelled', orderNumber: order.orderNumber };
  }
  if (!CUSTOMER_CANCELABLE.includes(order.status)) {
    throw httpError(409, 'too-late', 'Buyurtma tayyorlanmoqda, bekor qilib bo\'lmaydi');
  }

  await updateStatus({
    orderId,
    status: 'cancelled',
    by: uid,
    reason: 'Mijoz bekor qildi'
  });
  return { status: 'cancelled', orderNumber: order.orderNumber };
}

/**
 * Buyurtmaga kuryer tayinlaydi (SPEC 110). Status o'zgarmaydi —
 * kuryer "Oldim" deganda status alohida yangilanadi.
 *
 * @param {{orderId: string, courierId: string, by: string}} input
 * @returns {Promise<{courierId: string, courierName: ?string}>}
 */
export async function assignCourier({ orderId, courierId, by }) {
  const id = String(courierId || '').trim();
  if (!id) throw httpError(400, 'no-courier', 'Kuryer tanlanmagan');

  const db = await getDb();
  const { FieldValue, Timestamp } = await getFieldTypes();

  const orderRef = db.collection('orders').doc(orderId);
  const courierRef = db.collection('couriers').doc(id);
  const [orderSnap, courierSnap] = await Promise.all([orderRef.get(), courierRef.get()]);

  if (!orderSnap.exists) throw httpError(404, 'no-order', 'Buyurtma topilmadi');
  if (!courierSnap.exists) throw httpError(404, 'no-courier', 'Kuryer topilmadi');

  const order = orderSnap.data();
  if (order.status === 'delivered' || order.status === 'cancelled') {
    throw httpError(409, 'order-closed', 'Buyurtma yopilgan');
  }
  if (order.type === 'pickup') {
    throw httpError(400, 'pickup-order', 'Olib ketish buyurtmasiga kuryer kerak emas');
  }

  const courier = courierSnap.data();

  const batch = db.batch();
  batch.update(orderRef, {
    courierId: id,
    courierName: courier.name ?? null,
    courierPhone: courier.phone ?? null,
    // Kuryer joylashuvi bo'lsa darhol ko'rsatiladi, keyin o'zi yangilaydi
    courierLocation: courier.location ?? null,
    assignedAt: Timestamp.now(),
    assignedBy: by
  });
  batch.set(courierRef, {
    activeOrders: FieldValue.arrayUnion(orderId)
  }, { merge: true });

  // Oldingi kuryer bo'lsa uning ro'yxatidan olib tashlanadi
  if (order.courierId && order.courierId !== id) {
    batch.set(db.collection('couriers').doc(order.courierId), {
      activeOrders: FieldValue.arrayRemove(orderId)
    }, { merge: true });
  }

  await batch.commit();
  return { courierId: id, courierName: courier.name ?? null };
}
