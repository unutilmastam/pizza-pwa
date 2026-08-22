/**
 * Kuryer ilovasining ma'lumot qatlami.
 *
 * SPEC 5-bo'lim qoidasi: BARCHA Firestore chaqiruvi shu faylda.
 *
 * Nimani kuryer O'ZI yozadi va nimani servis yozadi (SPEC 3-bo'lim va
 * `firestore.rules`):
 *  - `couriers/{uid}` → kuryer FAQAT `location`, `onShift`,
 *    `activeOrders`, `shiftStartedAt`, `shiftEndedAt` maydonlarini
 *    yozadi. Ism, telefon, filial — admin panelidan.
 *  - `orders` → kuryer FAQAT O'QIYDI (`courierId == uid` bo'lganini).
 *    Status o'zgarishi Node servis orqali (`courier/js/api.js`).
 */

import { getFirebase } from './config.js';

/** Bitta Firestore o'qishiga vaqt chegarasi (ms). */
const READ_TIMEOUT = 12000;

/**
 * Va'daga vaqt chegarasi qo'yadi.
 *
 * Firestore SDK bir martalik o'qishga o'z chegarasini qo'ymaydi —
 * ulanish osilib qolsa va'da hech qachon tugamaydi va ekran
 * skeletonda muzlab qoladi (mijoz ilovasida shu bilan uchrashilgan).
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {string} label
 * @returns {Promise<T>}
 */
function withTimeout(promise, label) {
  let timer = null;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label}: server javob bermadi`);
      error.code = 'timeout';
      reject(error);
    }, READ_TIMEOUT);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

/* ------------------------------------------------------------- kuryer */

/**
 * `couriers/{uid}` hujjatini o'qiydi.
 * @param {string} uid
 * @returns {Promise<?object>}
 */
export async function getCourier(uid) {
  if (!uid) return null;
  const { dbx, sdk } = await getFirebase();
  const snap = await withTimeout(sdk.getDoc(sdk.doc(dbx, 'couriers', uid)), 'kuryer');
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Kuryer hujjatini real vaqtda kuzatadi — smena va faol buyurtmalar
 * boshqa qurilmadan yoki operator tomonidan o'zgarishi mumkin.
 *
 * @param {string} uid
 * @param {(courier: ?object) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {Function} obunani uzish
 */
export function watchCourier(uid, onChange, onError) {
  let stop = () => {};
  let cancelled = false;

  getFirebase().then(({ dbx, sdk }) => {
    if (cancelled || !uid) return;
    stop = sdk.onSnapshot(
      sdk.doc(dbx, 'couriers', uid),
      (snap) => onChange(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      (error) => {
        console.error('[db] watchCourier xatosi:', error);
        if (onError) onError(error);
      }
    );
  }).catch((error) => {
    console.error('[db] watchCourier ulanmadi:', error);
    if (onError) onError(error);
  });

  return () => {
    cancelled = true;
    stop();
  };
}

/**
 * Smenani ochadi yoki yopadi (SPEC 122).
 * @param {string} uid
 * @param {boolean} open
 * @returns {Promise<void>}
 */
export async function setShift(uid, open) {
  const { dbx, sdk } = await getFirebase();
  const patch = open
    ? { onShift: true, shiftStartedAt: sdk.serverTimestamp() }
    : { onShift: false, shiftEndedAt: sdk.serverTimestamp() };
  await withTimeout(
    sdk.setDoc(sdk.doc(dbx, 'couriers', uid), patch, { merge: true }),
    'smena'
  );
}

/**
 * Joylashuvni yozadi (SPEC 127).
 *
 * Chaqiruv shartlarini `courier/js/geo.js` hal qiladi — bu yerda faqat
 * yozuv. `merge: true` bilan boshqa maydonlarga tegilmaydi.
 *
 * @param {string} uid
 * @param {{lat: number, lng: number}} point
 * @returns {Promise<void>}
 */
export async function saveLocation(uid, point) {
  const { dbx, sdk } = await getFirebase();
  await withTimeout(sdk.setDoc(sdk.doc(dbx, 'couriers', uid), {
    location: { lat: point.lat, lng: point.lng, at: sdk.serverTimestamp() }
  }, { merge: true }), 'joylashuv');
}

/* ----------------------------------------------------------- buyurtma */

/**
 * Kuryerga tayinlangan buyurtmalarni real vaqtda kuzatadi.
 *
 * `where('courierId','==',uid)` — `firestore.rules` aynan shu shartga
 * ruxsat beradi (`isMyDelivery()`), shuning uchun filtrsiz so'rov
 * rad etiladi.
 *
 * @param {string} uid
 * @param {(orders: object[]) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {Function} obunani uzish
 */
export function watchMyOrders(uid, onChange, onError) {
  let stop = () => {};
  let cancelled = false;

  getFirebase().then(({ dbx, sdk }) => {
    if (cancelled || !uid) return;
    stop = sdk.onSnapshot(
      sdk.query(sdk.collection(dbx, 'orders'), sdk.where('courierId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        onChange(list);
      },
      (error) => {
        console.error('[db] watchMyOrders xatosi:', error);
        if (onError) onError(error);
      }
    );
  }).catch((error) => {
    console.error('[db] watchMyOrders ulanmadi:', error);
    if (onError) onError(error);
  });

  return () => {
    cancelled = true;
    stop();
  };
}
