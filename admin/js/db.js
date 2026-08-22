/**
 * Admin panelning ma'lumot qatlami.
 *
 * SPEC 5-bo'lim qoidasi: BARCHA Firestore chaqiruvi shu faylda.
 * Sahifalar `getFirebase()` ni ham, `sdk` ni ham ko'rmaydi.
 *
 * Nima to'g'ridan-to'g'ri Firestore'ga yoziladi va nima servis orqali
 * ketadi (SPEC 3-bo'lim):
 *  - `menu`, `branches`, `promocodes`, `banners`, `settings` → xodim
 *    bevosita yozadi;
 *  - `orders` → client YOZA OLMAYDI. Status o'zgarishi, kuryer tayinlash
 *    va rad etish Node servis orqali (`admin/js/api.js`).
 */

import { getFirebase } from './config.js';
import { createCache, withTimeout, watchGuard } from '../../js/cache.js';

/**
 * Admin keshi.
 *
 * NEGA KERAK: o'lchovda (1.5 s/so'rov taqlidi) admin panel bitta
 * seansda `menu/current` ni 4 marta, `branches` ni 3 marta o'qigan —
 * har sahifa o'tishida qaytadan. Har biri 1.2 sekundlik kutish edi.
 * Endi kesh bo'lsa sahifa tarmoqni umuman kutmaydi.
 */
const cache = createCache('pizza.admin.cache.v1');

/** Kesh muddatlari (ms) — xodim ma'lumoti tez o'zgarmaydi. */
const TTL = {
  staff: 5 * 60000,
  menu: 60000,
  branches: 60000,
  couriers: 20000,
  promos: 60000,
  reports: 5 * 60000
};

/** Ma'lumot o'zgargandan keyin keshni tashlaydi. */
export function dropCache(key) {
  cache.drop(key);
}

/** Chiqishda hammasini tozalaydi. */
export function clearCache() {
  cache.clear();
}

/* --------------------------------------------------------------- xodim */

/**
 * `staff/{uid}` hujjatini o'qiydi — kirish huquqi shu bilan aniqlanadi.
 * @param {string} uid
 * @returns {Promise<?object>}
 */
export async function getStaff(uid, onUpdate = null) {
  if (!uid) return null;
  return cache.swr(`staff.${uid}`, TTL.staff, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await withTimeout(sdk.getDoc(sdk.doc(dbx, 'staff', uid)), 'xodim');
    return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
  }, onUpdate);
}

/**
 * Keshdagi xodim hujjati — tarmoqsiz, darhol.
 *
 * Panel karkasini shu bilan ochamiz: rol faqat QAYSI BO'LIM
 * ko'rinishini hal qiladi, haqiqiy huquqni esa `firestore.rules`
 * beradi. Shuning uchun keshdagi rol bilan panelni ko'rsatish
 * xavfsiz — noto'g'ri bo'lsa fon tekshiruvi sessiyani yopadi.
 *
 * @param {string} uid
 * @returns {?object}
 */
export function peekStaff(uid) {
  return uid ? cache.peek(`staff.${uid}`) : null;
}

/* ------------------------------------------------------------ buyurtma */

/**
 * Faol buyurtmalarni real vaqtda kuzatadi (SPEC 106).
 *
 * Firestore'da `in` filtri va `orderBy` birga kompozit indeks talab
 * qiladi, shuning uchun sana bo'yicha oddiy so'rov olinadi va status
 * bo'yicha saralash brauzerda bajariladi — bir kunlik hajm kichik.
 *
 * @param {(orders: object[]) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {Function} obunani uzish
 */
export function watchActiveOrders(onChange, onError) {
  let stop = () => {};
  let cancelled = false;

  (async () => {
    try {
      const { dbx, sdk } = await getFirebase();
      // Bugungi va kechagi buyurtmalar yetarli — eskisi oqimda kerak emas
      const since = new Date(Date.now() - 36 * 3600000);
      const q = sdk.query(
        sdk.collection(dbx, 'orders'),
        sdk.where('createdAt', '>=', since),
        sdk.orderBy('createdAt', 'desc')
      );
      // `watchGuard` — birinchi snapshot kelmasa sahifa abadiy
      // kutmasin. Obuna uzilmaydi, kechikkan javob baribir ishlaydi.
      const off = watchGuard(
        (data, err) => sdk.onSnapshot(
          q,
          (snap) => data(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
          err
        ),
        onChange,
        (e) => onError && onError(e)
      );
      if (cancelled) off();
      else stop = off;
    } catch (e) {
      if (onError) onError(e);
    }
  })();

  return () => {
    cancelled = true;
    stop();
  };
}

/**
 * Berilgan kun oralig'idagi buyurtmalar (hisobot va dashboard uchun).
 * @param {Date} from
 * @param {Date} to
 * @returns {Promise<object[]>}
 */
export async function getOrdersBetween(from, to) {
  const { dbx, sdk } = await getFirebase();
  const snap = await withTimeout(sdk.getDocs(sdk.query(
    sdk.collection(dbx, 'orders'),
    sdk.where('createdAt', '>=', from),
    sdk.where('createdAt', '<', to)
  )), 'buyurtmalar');
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* -------------------------------------------------------------- kuryer */

/**
 * Barcha kuryerlar (kutilayotganlar bilan birga).
 * @returns {Promise<object[]>}
 */
export async function getCouriers(onUpdate = null) {
  return cache.swr('couriers', TTL.couriers, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await withTimeout(sdk.getDocs(sdk.collection(dbx, 'couriers')), 'kuryerlar');
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, onUpdate);
}

/**
 * Hali ilovaga kirmagan kuryerning vaqtinchalik hujjat ID si.
 *
 * Servisdagi `pendingId()` bilan BIR XIL bo'lishi shart
 * (`server/src/couriers.js`) — kuryer birinchi kirganda servis aynan
 * shu ID bo'yicha hujjatni topib `couriers/{uid}` ga ko'chiradi.
 *
 * @param {string} phone
 * @returns {string}
 */
export function courierPendingId(phone) {
  return `pending_${String(phone || '').replace(/\D/g, '')}`;
}

/**
 * Kuryerni yozadi.
 *
 * ID har doim tashqaridan beriladi: yangi kuryerda `pending_<telefon>`,
 * kirganida esa uning `uid` si. Shuning uchun bu yerda avtomatik ID
 * yaratilmaydi (filiallardan farqi shunda).
 *
 * @param {string} id
 * @param {object} data
 * @returns {Promise<string>}
 */
export async function saveCourier(id, data) {
  const { dbx, sdk } = await getFirebase();
  const ref = sdk.doc(dbx, 'couriers', id);
  await withTimeout(
    sdk.setDoc(ref, { ...data, updatedAt: sdk.serverTimestamp() }, { merge: true }),
    'kuryer'
  );
  cache.drop('couriers');
  return ref.id;
}

/**
 * Kuryerni o'chiradi.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteCourier(id) {
  const { dbx, sdk } = await getFirebase();
  await withTimeout(sdk.deleteDoc(sdk.doc(dbx, 'couriers', id)), 'kuryer');
  cache.drop('couriers');
}

/* ---------------------------------------------------------------- menyu */

/**
 * `menu/current` — bitta hujjat.
 * @returns {Promise<object>}
 */
export async function getMenu(onUpdate = null) {
  return cache.swr('menu', TTL.menu, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await withTimeout(sdk.getDoc(sdk.doc(dbx, 'menu', 'current')), 'menyu');
    return snap.exists()
      ? snap.data()
      : { version: 0, categories: [], products: [] };
  }, onUpdate);
}

/**
 * Menyuni chop etadi — versiya bir pog'ona oshadi.
 *
 * Mijoz ilovasi `version` o'zgarmasa Firestore'ga umuman murojaat
 * qilmaydi, shuning uchun versiyani oshirish MAJBURIY.
 *
 * @param {object} menu - {categories, products}
 * @returns {Promise<number>} yangi versiya
 */
export async function publishMenu(menu) {
  const { dbx, sdk } = await getFirebase();
  const version = Number(menu.version || 0) + 1;
  await withTimeout(sdk.setDoc(sdk.doc(dbx, 'menu', 'current'), {
    version,
    categories: menu.categories || [],
    products: menu.products || [],
    updatedAt: sdk.serverTimestamp()
  }), 'menyu');
  cache.drop('menu');
  return version;
}

/* -------------------------------------------------------------- filial */

/**
 * Barcha filiallar.
 * @returns {Promise<object[]>}
 */
export async function getBranches(onUpdate = null) {
  return cache.swr('branches', TTL.branches, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await withTimeout(sdk.getDocs(sdk.collection(dbx, 'branches')), 'filiallar');
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, onUpdate);
}

/**
 * Filialni yozadi (yangi bo'lsa yaratadi).
 * @param {?string} id - null bo'lsa yangi hujjat
 * @param {object} data
 * @returns {Promise<string>} filial id
 */
export async function saveBranch(id, data) {
  const { dbx, sdk } = await getFirebase();
  const ref = id
    ? sdk.doc(dbx, 'branches', id)
    : sdk.doc(sdk.collection(dbx, 'branches'));
  await withTimeout(
    sdk.setDoc(ref, { ...data, updatedAt: sdk.serverTimestamp() }, { merge: true }),
    'filial'
  );
  cache.drop('branches');
  return ref.id;
}

/**
 * Filialni o'chiradi.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteBranch(id) {
  const { dbx, sdk } = await getFirebase();
  await withTimeout(sdk.deleteDoc(sdk.doc(dbx, 'branches', id)), 'filial');
  cache.drop('branches');
}

/* ----------------------------------------------------------- promokod */

/**
 * Barcha promokodlar.
 * @returns {Promise<object[]>}
 */
export async function getPromos(onUpdate = null) {
  return cache.swr('promos', TTL.promos, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await withTimeout(sdk.getDocs(sdk.collection(dbx, 'promocodes')), 'promokodlar');
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, onUpdate);
}

/**
 * Promokod mavjudmi — yangi kod yaratishdan oldin tekshiriladi.
 * @param {string} code
 * @returns {Promise<boolean>}
 */
export async function promoExists(code) {
  const { dbx, sdk } = await getFirebase();
  const snap = await withTimeout(sdk.getDoc(sdk.doc(dbx, 'promocodes', code)), 'promokod');
  return snap.exists();
}

/**
 * Promokodni yozadi. Hujjat ID = kodning o'zi (servis shunday o'qiydi).
 * @param {string} code
 * @param {object} data
 * @returns {Promise<void>}
 */
export async function savePromo(code, data) {
  const { dbx, sdk } = await getFirebase();
  await withTimeout(sdk.setDoc(sdk.doc(dbx, 'promocodes', code), data, { merge: true }), 'promokod');
  cache.drop('promos');
}

/**
 * Promokodni o'chiradi.
 * @param {string} code
 * @returns {Promise<void>}
 */
export async function deletePromo(code) {
  const { dbx, sdk } = await getFirebase();
  await withTimeout(sdk.deleteDoc(sdk.doc(dbx, 'promocodes', code)), 'promokod');
  cache.drop('promos');
}

/* ------------------------------------------------------------- hisobot */

/**
 * Kunlik hisobotlar — ularni Node servis cron'i yozadi.
 * @param {number} [days=14]
 * @returns {Promise<object[]>} eskidan yangiga
 */
export async function getReports(days = 14, onUpdate = null) {
  return cache.swr(`reports.${days}`, TTL.reports, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await withTimeout(sdk.getDocs(sdk.collection(dbx, 'reports')), 'hisobotlar');
    const list = snap.docs.map((d) => ({ date: d.id, ...d.data() }));
    return list
      .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-days);
  }, onUpdate);
}
