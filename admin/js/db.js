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

/* --------------------------------------------------------------- xodim */

/**
 * `staff/{uid}` hujjatini o'qiydi — kirish huquqi shu bilan aniqlanadi.
 * @param {string} uid
 * @returns {Promise<?object>}
 */
export async function getStaff(uid) {
  if (!uid) return null;
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDoc(sdk.doc(dbx, 'staff', uid));
  return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
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
      const off = sdk.onSnapshot(
        q,
        (snap) => onChange(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
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
  const snap = await sdk.getDocs(sdk.query(
    sdk.collection(dbx, 'orders'),
    sdk.where('createdAt', '>=', from),
    sdk.where('createdAt', '<', to)
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* -------------------------------------------------------------- kuryer */

/**
 * Barcha kuryerlar (kutilayotganlar bilan birga).
 * @returns {Promise<object[]>}
 */
export async function getCouriers() {
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDocs(sdk.collection(dbx, 'couriers'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
  await sdk.setDoc(ref, { ...data, updatedAt: sdk.serverTimestamp() }, { merge: true });
  return ref.id;
}

/**
 * Kuryerni o'chiradi.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteCourier(id) {
  const { dbx, sdk } = await getFirebase();
  await sdk.deleteDoc(sdk.doc(dbx, 'couriers', id));
}

/* ---------------------------------------------------------------- menyu */

/**
 * `menu/current` — bitta hujjat.
 * @returns {Promise<object>}
 */
export async function getMenu() {
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDoc(sdk.doc(dbx, 'menu', 'current'));
  return snap.exists()
    ? snap.data()
    : { version: 0, categories: [], products: [] };
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
  await sdk.setDoc(sdk.doc(dbx, 'menu', 'current'), {
    version,
    categories: menu.categories || [],
    products: menu.products || [],
    updatedAt: sdk.serverTimestamp()
  });
  return version;
}

/* -------------------------------------------------------------- filial */

/**
 * Barcha filiallar.
 * @returns {Promise<object[]>}
 */
export async function getBranches() {
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDocs(sdk.collection(dbx, 'branches'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
  await sdk.setDoc(ref, { ...data, updatedAt: sdk.serverTimestamp() }, { merge: true });
  return ref.id;
}

/**
 * Filialni o'chiradi.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteBranch(id) {
  const { dbx, sdk } = await getFirebase();
  await sdk.deleteDoc(sdk.doc(dbx, 'branches', id));
}

/* ----------------------------------------------------------- promokod */

/**
 * Barcha promokodlar.
 * @returns {Promise<object[]>}
 */
export async function getPromos() {
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDocs(sdk.collection(dbx, 'promocodes'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Promokod mavjudmi — yangi kod yaratishdan oldin tekshiriladi.
 * @param {string} code
 * @returns {Promise<boolean>}
 */
export async function promoExists(code) {
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDoc(sdk.doc(dbx, 'promocodes', code));
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
  await sdk.setDoc(sdk.doc(dbx, 'promocodes', code), data, { merge: true });
}

/**
 * Promokodni o'chiradi.
 * @param {string} code
 * @returns {Promise<void>}
 */
export async function deletePromo(code) {
  const { dbx, sdk } = await getFirebase();
  await sdk.deleteDoc(sdk.doc(dbx, 'promocodes', code));
}

/* ------------------------------------------------------------- hisobot */

/**
 * Kunlik hisobotlar — ularni Node servis cron'i yozadi.
 * @param {number} [days=14]
 * @returns {Promise<object[]>} eskidan yangiga
 */
export async function getReports(days = 14) {
  const { dbx, sdk } = await getFirebase();
  const snap = await sdk.getDocs(sdk.collection(dbx, 'reports'));
  const list = snap.docs.map((d) => ({ date: d.id, ...d.data() }));
  return list
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
}
