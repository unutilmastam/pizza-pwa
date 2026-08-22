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
 * Filial keshining muddati (ms). Stop-list shu hujjatdan olinadi,
 * shuning uchun uzoq bo'lmasligi kerak — lekin har sahifa o'tishida
 * tarmoqqa chiqish ham shart emas.
 */
const BRANCH_TTL = 3 * 60 * 1000;

/** Buyurtmalar ro'yxati keshi (ms) — fonda baribir yangilanadi. */
const ORDERS_TTL = 60 * 1000;

/** Profil keshi (ms). */
const USER_TTL = 60 * 1000;

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

/* ------------------------------------------------- tarmoq va kesh qatlami */

/**
 * Bitta Firestore o'qishiga beriladigan vaqt chegarasi (ms).
 *
 * NEGA KERAK: Firestore SDK bir martalik o'qishga o'z chegarasini
 * QO'YMAYDI. iPhone Safari'da ilova fonga o'tib qaytganda yoki tarmoq
 * almashganda (Wi-Fi ↔ mobil) SDK ulanishi osilib qolishi mumkin —
 * shunda `getDoc()` va'dasi HECH QACHON tugamaydi. Natijada sahifa
 * skeletonda muzlab qoladi va faqat sahifani qayta yuklash yordam
 * beradi. Chegara qo'yilgach xato qaytadi, sahifa esa keshdagi
 * ma'lumotni ko'rsatadi yoki "qayta urinish" taklif qiladi.
 */
const READ_TIMEOUT = 12000;

/** Seans davomidagi xotira keshi — localStorage'dan tez. */
const memory = new Map();

/** Fon rejimida ketayotgan yangilashlar — ikkilanmasin. */
const inflight = new Map();

/**
 * Va'daga vaqt chegarasi qo'yadi.
 * @template T
 * @param {Promise<T>} promise
 * @param {string} label - xato matnida ko'rinadi
 * @param {number} [ms]
 * @returns {Promise<T>}
 */
function withTimeout(promise, label, ms = READ_TIMEOUT) {
  let timer = null;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label}: server javob bermadi`);
      error.code = 'timeout';
      reject(error);
    }, ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

/**
 * Keshdagi yozuvni oladi (avval xotira, keyin localStorage).
 * @param {string} key
 * @returns {?{value: *, at: number}}
 */
function cacheRead(key) {
  if (memory.has(key)) return memory.get(key);
  const stored = readCache(key);
  if (stored && stored.at) memory.set(key, stored);
  return stored && stored.at ? stored : null;
}

/**
 * Keshga yozadi.
 * @param {string} key
 * @param {*} value
 */
function cacheWrite(key, value) {
  const entry = { value, at: Date.now() };
  memory.set(key, entry);
  writeCache(key, entry);
}

/**
 * "Keshdan darhol ber, fonda yangila" (stale-while-revalidate).
 *
 * Sahifalar tarmoqni KUTMAYDI: kesh bo'lsa ma'lumot shu zahoti
 * qaytadi, yangisi esa fonda keladi va `onUpdate` orqali beriladi.
 * Shu tufayli sahifalar orasida o'tish darhol bo'ladi.
 *
 * @template T
 * @param {string} key - kesh kaliti
 * @param {number} ttl - kesh yangi hisoblanadigan muddat (ms)
 * @param {() => Promise<T>} fetcher - tarmoq so'rovi
 * @param {?(value: T) => void} [onUpdate] - fonda yangi ma'lumot kelganda
 * @returns {Promise<T>}
 */
async function swr(key, ttl, fetcher, onUpdate = null) {
  const entry = cacheRead(key);
  const fresh = entry && Date.now() - entry.at < ttl;

  /** Tarmoqdan olib, keshni yangilaydi. */
  const refresh = () => {
    if (inflight.has(key)) return inflight.get(key);
    const task = withTimeout(fetcher(), key)
      .then((value) => {
        cacheWrite(key, value);
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, task);
    return task;
  };

  // Kesh yangi — tarmoqqa umuman chiqmaymiz
  if (fresh) return entry.value;

  // Kesh bor, lekin eskirgan: darhol beramiz, yangisini fonda olamiz
  if (entry) {
    refresh()
      .then((value) => {
        if (onUpdate && JSON.stringify(value) !== JSON.stringify(entry.value)) {
          onUpdate(value);
        }
      })
      .catch((e) => console.warn(`[db] fon yangilash: ${e.message}`));
    return entry.value;
  }

  // Kesh yo'q — kutishdan boshqa iloj yo'q, lekin chegara bilan
  return refresh();
}

/**
 * Kesh yozuvini o'chiradi (ma'lumot o'zgargandan keyin).
 * @param {string} key
 */
function cacheDrop(key) {
  memory.delete(key);
  try {
    localStorage.removeItem(key);
  } catch (e) {
    /* kesh ixtiyoriy */
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
    // Chegarasiz `getDoc()` osilib qolsa menyu abadiy skeletonda qolardi
    const snap = await withTimeout(sdk.getDoc(sdk.doc(dbx, 'menu', 'current')), 'menu');
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
export async function getBranches(onUpdate = null) {
  return swr(`${STORAGE_KEYS.cache}.branches`, BRANCH_TTL, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await sdk.getDocs(
      sdk.query(sdk.collection(dbx, 'branches'), sdk.where('active', '==', true))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, onUpdate);
}

/**
 * Bitta filial hujjati.
 * @param {string} branchId
 * @returns {Promise<?object>}
 */
export async function getBranch(branchId) {
  if (!branchId) return null;
  const { dbx, sdk } = await getFirebase();
  const snap = await withTimeout(sdk.getDoc(sdk.doc(dbx, 'branches', branchId)), 'branch');
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Filialdagi stop-list (tugagan mahsulot va variantlar ro'yxati).
 * Filial tanlanmagan bo'lsa bo'sh ro'yxat qaytadi.
 * @param {?string} branchId
 * @returns {Promise<string[]>}
 */
export async function getStopList(branchId, onUpdate = null) {
  if (!branchId) return [];
  return swr(`${STORAGE_KEYS.cache}.stop.${branchId}`, BRANCH_TTL, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await sdk.getDoc(sdk.doc(dbx, 'branches', branchId));
    if (!snap.exists()) return [];
    const list = snap.data().stopList;
    return Array.isArray(list) ? list : [];
  }, onUpdate);
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
export async function getUser(uid, onUpdate = null) {
  if (!uid) return null;
  return swr(`${STORAGE_KEYS.cache}.user.${uid}`, USER_TTL, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await sdk.getDoc(sdk.doc(dbx, 'users', uid));
    return snap.exists() ? { uid, ...snap.data() } : null;
  }, onUpdate);
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
  const snap = await withTimeout(sdk.getDoc(ref), 'user');

  const safe = {};
  if (data.phone) safe.phone = data.phone;
  if (data.name) safe.name = data.name;
  if (data.lang) safe.lang = data.lang;

  if (!snap.exists()) {
    const fresh = { name: '', ...safe };
    await withTimeout(sdk.setDoc(ref, {
      ...fresh,
      createdAt: sdk.serverTimestamp(),
      lastLoginAt: sdk.serverTimestamp()
    }), 'user');
    return { uid, ...fresh };
  }

  await withTimeout(sdk.updateDoc(ref, { ...safe, lastLoginAt: sdk.serverTimestamp() }), 'user');
  cacheDrop(`${STORAGE_KEYS.cache}.user.${uid}`);
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
  await withTimeout(sdk.updateDoc(sdk.doc(dbx, 'users', uid), patch), 'profil');
  // Kesh eskirdi — keyingi o'qishda yangisi olinsin
  cacheDrop(`${STORAGE_KEYS.cache}.user.${uid}`);
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
  const snap = await withTimeout(sdk.getDocs(sdk.collection(dbx, 'users', uid, 'bonusHistory')), 'bonus');
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
  const snap = await withTimeout(sdk.getDocs(sdk.collection(dbx, 'users', uid, 'addresses')), 'manzillar');
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
  const ref = await withTimeout(sdk.addDoc(sdk.collection(dbx, 'users', uid, 'addresses'), {
    ...address,
    createdAt: sdk.serverTimestamp()
  }), 'manzil');
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
  await withTimeout(sdk.updateDoc(sdk.doc(dbx, 'users', uid, 'addresses', addressId), patch), 'manzil');
}

/**
 * Manzilni o'chiradi.
 * @param {string} uid
 * @param {string} addressId
 * @returns {Promise<void>}
 */
export async function deleteAddress(uid, addressId) {
  const { dbx, sdk } = await getFirebase();
  await withTimeout(sdk.deleteDoc(sdk.doc(dbx, 'users', uid, 'addresses', addressId)), 'manzil');
}

/* --------------------------------------------------------------- buyurtma */

/** Yetkazilgan yoki bekor qilingan — bular "faol" hisoblanmaydi. */
// Servis `cancelled` (ikki L) yozadi; eski hujjatlarda `canceled`
// uchraydi — ikkalasi ham yakuniy hisoblanadi.
const FINAL_STATUSES = ['delivered', 'canceled', 'cancelled'];

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
export async function getOrders(uid, limit = 20, onUpdate = null) {
  if (!uid) return [];
  const all = await swr(`${STORAGE_KEYS.cache}.orders.${uid}`, ORDERS_TTL, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await sdk.getDocs(
      sdk.query(sdk.collection(dbx, 'orders'), sdk.where('uid', '==', uid))
    );
    return byNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, onUpdate ? (list) => onUpdate(list.slice(0, limit)) : null);

  return all.slice(0, limit);
}

/**
 * Buyurtmalar keshini bo'shatadi — yangi buyurtma berilganda yoki
 * status o'zgarganda chaqiriladi, aks holda ro'yxat eskicha qoladi.
 * @param {string} uid
 */
export function invalidateOrders(uid) {
  if (uid) cacheDrop(`${STORAGE_KEYS.cache}.orders.${uid}`);
}

/**
 * Bitta buyurtma.
 * @param {string} orderId
 * @returns {Promise<?object>}
 */
export async function getOrder(orderId) {
  if (!orderId) return null;
  const { dbx, sdk } = await getFirebase();
  const snap = await withTimeout(sdk.getDoc(sdk.doc(dbx, 'orders', orderId)), 'buyurtma');
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
 *
 * `courierLocations/{uid}` — ATAYLAB alohida kolleksiya. Unda faqat
 * `{lat, lng, at}` bor. Kuryerning ismi va telefoni `couriers` da
 * qoladi va mijozga ochiq emas — treking uchun ular buyurtma
 * hujjatidan olinadi (`courierName`, `courierPhone`).
 *
 * @param {string} courierId
 * @param {(location: ?{lat: number, lng: number, at: *}) => void} onChange
 * @returns {() => void}
 */
export function watchCourierLocation(courierId, onChange) {
  let stop = null;
  let cancelled = false;

  getFirebase().then(({ dbx, sdk }) => {
    if (cancelled || !courierId) return;
    stop = sdk.onSnapshot(
      sdk.doc(dbx, 'courierLocations', courierId),
      (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      (error) => console.error('[db] watchCourierLocation xatosi:', error)
    );
  }).catch((error) => console.error('[db] watchCourierLocation ulanmadi:', error));

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
