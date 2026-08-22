/**
 * Kuryer ilovasining ma'lumot qatlami.
 *
 * SPEC 5-bo'lim qoidasi: BARCHA Firestore chaqiruvi shu faylda.
 *
 * Nimani kuryer O'ZI yozadi va nimani servis yozadi (SPEC 3-bo'lim va
 * `firestore.rules`):
 *  - `couriers/{uid}` → kuryer FAQAT `onShift`, `activeOrders`,
 *    `shiftStartedAt`, `shiftEndedAt` maydonlarini yozadi. Ism,
 *    telefon, filial — admin panelidan.
 *  - `courierLocations/{uid}` → joylashuv ALOHIDA hujjatda (sabab
 *    `saveLocation()` izohida).
 *  - `orders` → kuryer FAQAT O'QIYDI (`courierId == uid` bo'lganini).
 *    Status o'zgarishi Node servis orqali (`courier/js/api.js`).
 */

import { getFirebase } from './config.js';
import { createCache, withTimeout, watchGuard } from '../../js/cache.js';

/**
 * Kuryer keshi — kunlik hisob va buyurtmalar shu yerdan darhol
 * ko'rsatiladi, tarmoq javobi esa fonda keladi.
 */
export const cache = createCache('pizza.courier.cache.v1');

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
    stop = watchGuard(
      (data, err) => sdk.onSnapshot(
        sdk.doc(dbx, 'couriers', uid),
        (snap) => data(snap.exists() ? { id: snap.id, ...snap.data() } : null),
        err
      ),
      onChange,
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
 * ALOHIDA kolleksiya (`courierLocations/{uid}`), `couriers` ichida
 * emas. Sabab: mijoz treking xaritasi koordinatani real vaqtda
 * kuzatishi kerak, ya'ni hujjat kirgan foydalanuvchiga ochiq bo'ladi.
 * Koordinata `couriers` da qolsa, u bilan birga kuryerning ismi va
 * telefoni ham hammaga ochilib ketardi.
 *
 * Hujjatda FAQAT uch maydon bo'ladi — `firestore.rules` boshqasini
 * qabul qilmaydi.
 *
 * Chaqiruv shartlarini `courier/js/geo.js` hal qiladi — bu yerda faqat
 * yozuv.
 *
 * @param {string} uid
 * @param {{lat: number, lng: number}} point
 * @returns {Promise<void>}
 */
export async function saveLocation(uid, point) {
  const { dbx, sdk } = await getFirebase();
  await withTimeout(sdk.setDoc(sdk.doc(dbx, 'courierLocations', uid), {
    lat: point.lat,
    lng: point.lng,
    at: sdk.serverTimestamp()
  }), 'joylashuv');
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
    stop = watchGuard(
      (data, err) => sdk.onSnapshot(
        sdk.query(sdk.collection(dbx, 'orders'), sdk.where('courierId', '==', uid)),
        (snap) => data(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        err
      ),
      (list) => {
        // Keshga yozamiz — keyingi ochilishda ro'yxat darhol chiqadi
        cache.write(`orders.${uid}`, list);
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

/**
 * Keshdagi buyurtmalar — tarmoqsiz, darhol.
 *
 * Oqim birinchi javobni kutayotganda ekran bo'sh turmasin: eski
 * ro'yxat ko'rsatiladi va yangisi kelganda almashadi.
 *
 * @param {string} uid
 * @returns {?object[]}
 */
export function peekMyOrders(uid) {
  return cache.peek(`orders.${uid}`);
}
