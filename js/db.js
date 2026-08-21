/**
 * Firestore bilan ishlaydigan YAGONA fayl.
 * Boshqa hech qaysi modulda `getDoc`, `setDoc`, `collection` chaqirilmaydi —
 * sahifalar faqat shu yerdagi funksiyalarni ishlatadi.
 *
 * Tanasi bosqichma-bosqich to'ldiriladi:
 *   menyu → 1-bosqich (yozildi), savat/checkout → 2, manzil/filial → 3,
 *   auth/foydalanuvchi → 4, buyurtma va treking → 5.
 * Hali yozilmagan funksiyalar shartnoma (kontrakt) sifatida turibdi.
 */

/* eslint-disable no-unused-vars */

import { getFirebase, STORAGE_KEYS } from './config.js';

/**
 * Menyu keshining yashash muddati (ms). Shu vaqt ichida Firestore'ga
 * umuman murojaat qilinmaydi — SPEC'dagi eng muhim optimizatsiya.
 */
const MENU_TTL = 10 * 60 * 1000;

/**
 * localStorage'dan JSON o'qiydi.
 * @param {string} key
 * @returns {?object}
 */
function readCache(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * localStorage'ga JSON yozadi. Xotira to'lgan bo'lsa jim o'tadi.
 * @param {string} key
 * @param {object} value
 */
function writeCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* kesh ixtiyoriy — yozilmasa ham ilova ishlaydi */
  }
}

/* ------------------------------------------------------------- sozlamalar */

/**
 * `settings/global` hujjatini o'qiydi (kafolat daqiqasi, cashback foizi,
 * support telefoni). Natija localStorage'ga keshlanadi.
 * @returns {Promise<object>}
 */
export async function getSettings() {}

/* -------------------------------------------------------------------- menyu */

/**
 * `menu/current` — bitta hujjat, butun katalog.
 *
 * Tartib:
 *  1. localStorage'da yangi kesh bo'lsa (TTL ichida) — Firestore'ga
 *     murojaat QILINMAYDI, kesh qaytadi;
 *  2. aks holda hujjat o'qiladi va keshga yoziladi;
 *  3. tarmoq uzilgan bo'lsa — eski kesh qaytadi (oflaynda menyu ko'rinadi).
 *
 * @param {{force?: boolean}} [opts] - `force: true` keshni chetlab o'tadi
 * @returns {Promise<{version: number, categories: object[], products: object[]}>}
 */
export async function getMenu(opts = {}) {
  const cached = readCache(STORAGE_KEYS.menu);
  const isFresh = cached && Date.now() - (cached.fetchedAt || 0) < MENU_TTL;
  if (cached && isFresh && !opts.force) return cached.data;

  try {
    const { dbx, sdk } = await getFirebase();
    const snap = await sdk.getDoc(sdk.doc(dbx, 'menu', 'current'));
    if (!snap.exists()) throw new Error('menu/current hujjati topilmadi');

    const data = snap.data();
    // Versiya o'zgarmagan bo'lsa ham fetchedAt yangilanadi — keyingi TTL
    // davomida yana so'rov ketmaydi.
    writeCache(STORAGE_KEYS.menu, { fetchedAt: Date.now(), version: data.version, data });
    return data;
  } catch (e) {
    if (cached) return cached.data;
    throw e;
  }
}

/**
 * Menyuning `version` maydonini o'qiydi — kesh eskirganini tekshirish uchun.
 * @returns {Promise<?number>}
 */
export async function getMenuVersion() {
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDoc(sdk.doc(dbx, 'menu', 'current'));
  return snap.exists() ? snap.data().version : null;
}

/**
 * Keshlangan menyu versiyasi (tarmoqsiz).
 * @returns {?number}
 */
export function getCachedMenuVersion() {
  const cached = readCache(STORAGE_KEYS.menu);
  return cached ? cached.version ?? null : null;
}

/* ------------------------------------------------------------------ filial */

/**
 * Faol filiallar ro'yxati (zona polygonlari, ish vaqti, stop-list bilan).
 * @returns {Promise<object[]>}
 */
export async function getBranches() {
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDocs(
    sdk.query(sdk.collection(dbx, 'branches'), sdk.where('active', '==', true))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Bitta filial hujjati.
 * @param {string} branchId
 * @returns {Promise<?object>}
 */
export async function getBranch(branchId) {
  if (!branchId) return null;
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDoc(sdk.doc(dbx, 'branches', branchId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Filialdagi stop-list (tugagan mahsulot va variantlar ro'yxati).
 * Filial tanlanmagan bo'lsa bo'sh ro'yxat qaytadi.
 * @param {?string} branchId
 * @returns {Promise<string[]>}
 */
export async function getStopList(branchId) {
  if (!branchId) return [];
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDoc(sdk.doc(dbx, 'branches', branchId));
  if (!snap.exists()) return [];
  const list = snap.data().stopList;
  return Array.isArray(list) ? list : [];
}

/* ----------------------------------------------------------------- banner */

/**
 * Amal qilish muddati o'tmagan faol bannerlar, `order` bo'yicha saralangan.
 * @returns {Promise<object[]>}
 */
export async function getBanners() {}

/* ---------------------------------------------------------- foydalanuvchi */

/**
 * `users/{uid}` hujjatini o'qiydi.
 * @param {string} uid
 * @returns {Promise<?object>}
 */
export async function getUser(uid) {
  if (!uid) return null;
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDoc(sdk.doc(dbx, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/**
 * `users/{uid}` hujjatini yaratadi yoki mavjudini yangilaydi (kirish paytida).
 *
 * Faqat XAVFSIZ maydonlar yoziladi: `bonusBalance`, `tier`, `totalSpent`,
 * `blocked` — Security Rules bo'yicha client ularga tegmaydi, ularni
 * Node servis boshqaradi.
 *
 * @param {string} uid
 * @param {{phone?: string, name?: string, lang?: string}} [data]
 * @returns {Promise<object>} hujjatning joriy holati
 */
export async function ensureUserDoc(uid, data = {}) {
  const { dbx, sdk } = await getFirebase();
  const ref = sdk.doc(dbx, 'users', uid);
  const snap = await sdk.getDoc(ref);

  const safe = {};
  if (data.phone) safe.phone = data.phone;
  if (data.name) safe.name = data.name;
  if (data.lang) safe.lang = data.lang;

  if (!snap.exists()) {
    const fresh = { name: '', ...safe };
    await sdk.setDoc(ref, {
      ...fresh,
      createdAt: sdk.serverTimestamp(),
      lastLoginAt: sdk.serverTimestamp()
    });
    return { uid, ...fresh };
  }

  await sdk.updateDoc(ref, { ...safe, lastLoginAt: sdk.serverTimestamp() });
  return { uid, ...snap.data(), ...safe };
}

/**
 * Profil maydonlarini yangilaydi (ism, tug'ilgan kun, til).
 * `bonusBalance`, `tier`, `totalSpent`, `blocked` — Security Rules taqiqlaydi.
 * @param {string} uid
 * @param {{name?: string, birthday?: string, lang?: string}} patch
 * @returns {Promise<void>}
 */
export async function updateUserProfile(uid, patch) {
  const { dbx, sdk } = await getFirebase();
  await sdk.updateDoc(sdk.doc(dbx, 'users', uid), patch);
}

/**
 * Bonus tarixi (yig'ilgan / sarflangan / kuygan), yangisi birinchi.
 * @param {string} uid
 * @param {number} [limit=50]
 * @returns {Promise<object[]>}
 */
export async function getBonusHistory(uid, limit = 50) {
  if (!uid) return [];
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDocs(sdk.collection(dbx, 'users', uid, 'bonusHistory'));
  return byNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() }))).slice(0, limit);
}

/* --------------------------------------------------------------- manzillar */

/**
 * Foydalanuvchining saqlangan manzillari.
 * Mehmon rejimida bu chaqirilmaydi — manzillar `state.addresses` da turadi.
 * @param {string} uid
 * @returns {Promise<object[]>}
 */
export async function getAddresses(uid) {
  if (!uid) return [];
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDocs(sdk.collection(dbx, 'users', uid, 'addresses'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Yangi manzil qo'shadi.
 * @param {string} uid
 * @param {object} address - {label, address, lat, lng, apartment, entrance,
 *                            floor, intercom, comment, zone}
 * @returns {Promise<string>} yaratilgan hujjat id'si
 */
export async function addAddress(uid, address) {
  const { dbx, sdk } = await getFirebase();
  const ref = await sdk.addDoc(sdk.collection(dbx, 'users', uid, 'addresses'), {
    ...address,
    createdAt: sdk.serverTimestamp()
  });
  return ref.id;
}

/**
 * Manzilni tahrirlaydi.
 * @param {string} uid
 * @param {string} addressId
 * @param {object} patch
 * @returns {Promise<void>}
 */
export async function updateAddress(uid, addressId, patch) {
  const { dbx, sdk } = await getFirebase();
  await sdk.updateDoc(sdk.doc(dbx, 'users', uid, 'addresses', addressId), patch);
}

/**
 * Manzilni o'chiradi.
 * @param {string} uid
 * @param {string} addressId
 * @returns {Promise<void>}
 */
export async function deleteAddress(uid, addressId) {
  const { dbx, sdk } = await getFirebase();
  await sdk.deleteDoc(sdk.doc(dbx, 'users', uid, 'addresses', addressId));
}

/* --------------------------------------------------------------- buyurtma */

/** Yetkazilgan yoki bekor qilingan — bular "faol" hisoblanmaydi. */
const FINAL_STATUSES = ['delivered', 'canceled'];

/**
 * Buyurtmalarni yangisi birinchi bo'lib saralaydi.
 * @param {object[]} list
 * @returns {object[]}
 */
function byNewest(list) {
  return list.sort((a, b) => {
    const at = toMillis(a.createdAt);
    const bt = toMillis(b.createdAt);
    return bt - at;
  });
}

/**
 * Firestore Timestamp yoki ISO satrini millisekundga aylantiradi.
 * @param {*} value
 * @returns {number}
 */
function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Foydalanuvchining buyurtmalari tarixi, yangisi birinchi.
 *
 * Saralash CLIENT tomonda: `where('uid')` + `orderBy('createdAt')` Firestore'da
 * kompozit indeks talab qiladi, bitta foydalanuvchining buyurtmalari esa oz.
 *
 * @param {string} uid
 * @param {number} [limit=20]
 * @returns {Promise<object[]>}
 */
export async function getOrders(uid, limit = 20) {
  if (!uid) return [];
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDocs(
    sdk.query(sdk.collection(dbx, 'orders'), sdk.where('uid', '==', uid))
  );
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return byNewest(list).slice(0, limit);
}

/**
 * Bitta buyurtma.
 * @param {string} orderId
 * @returns {Promise<?object>}
 */
export async function getOrder(orderId) {
  if (!orderId) return null;
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDoc(sdk.doc(dbx, 'orders', orderId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Buyurtmani real-time kuzatadi (`onSnapshot`) — status stepper uchun.
 *
 * @param {string} orderId
 * @param {(order: ?object) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} obunani to'xtatuvchi funksiya
 */
export function watchOrder(orderId, onChange, onError) {
  let stop = null;
  let cancelled = false;

  getFirebase().then(({ dbx, sdk }) => {
    if (cancelled) return;
    stop = sdk.onSnapshot(
      sdk.doc(dbx, 'orders', orderId),
      (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      (error) => {
        console.error('[db] watchOrder xatosi:', error);
        if (onError) onError(error);
      }
    );
  }).catch((error) => {
    console.error('[db] watchOrder ulanmadi:', error);
    if (onError) onError(error);
  });

  return () => {
    cancelled = true;
    if (stop) stop();
  };
}

/**
 * Faol (yetkazilmagan) buyurtmalarni kuzatadi.
 * @param {string} uid
 * @param {(orders: object[]) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {() => void}
 */
export function watchActiveOrders(uid, onChange, onError) {
  let stop = null;
  let cancelled = false;

  getFirebase().then(({ dbx, sdk }) => {
    if (cancelled || !uid) return;
    stop = sdk.onSnapshot(
      sdk.query(sdk.collection(dbx, 'orders'), sdk.where('uid', '==', uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((o) => !FINAL_STATUSES.includes(o.status));
        onChange(byNewest(list));
      },
      (error) => {
        console.error('[db] watchActiveOrders xatosi:', error);
        if (onError) onError(error);
      }
    );
  }).catch((error) => {
    console.error('[db] watchActiveOrders ulanmadi:', error);
    if (onError) onError(error);
  });

  return () => {
    cancelled = true;
    if (stop) stop();
  };
}

/**
 * Kuryer joylashuvini real-time kuzatadi.
 * @param {string} courierId
 * @param {(courier: ?object) => void} onChange
 * @returns {() => void}
 */
export function watchCourier(courierId, onChange) {
  let stop = null;
  let cancelled = false;

  getFirebase().then(({ dbx, sdk }) => {
    if (cancelled || !courierId) return;
    stop = sdk.onSnapshot(
      sdk.doc(dbx, 'couriers', courierId),
      (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      (error) => console.error('[db] watchCourier xatosi:', error)
    );
  }).catch((error) => console.error('[db] watchCourier ulanmadi:', error));

  return () => {
    cancelled = true;
    if (stop) stop();
  };
}

/* ---------------------------------------------------------------- baholash */

/**
 * Buyurtmaga baho yozadi (taom va kuryer alohida).
 * @param {string} orderId
 * @param {{food: number, courier: number, text?: string, photo?: string}} rating
 * @returns {Promise<void>}
 */
export async function saveRating(orderId, rating) {
  const { dbx, sdk } = await getFirebase();
  await sdk.updateDoc(sdk.doc(dbx, 'orders', orderId), {
    rating: { ...rating, at: sdk.serverTimestamp() }
  });
}

/**
 * Baholash rasmini Storage'ga yuklaydi va URL qaytaradi.
 * @param {File} file
 * @param {string} path - masalan `ratings/{orderId}/{fileName}`
 * @returns {Promise<string>} yuklab olish URL'i
 */
export async function uploadImage(file, path) {}
