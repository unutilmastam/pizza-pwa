/**
 * Kuryer bilan bog'liq servis vazifalari (SPEC 122–128).
 *
 * HUJJAT ID QOIDASI: `couriers/{uid}` — ID Firebase `uid` bo'ladi,
 * chunki `firestore.rules` dagi `isOwner(courierId)` aynan shunga
 * tayanadi (kuryer o'z joylashuvini yozishi uchun).
 *
 * Lekin admin kuryerni qo'shayotganda uning `uid` si HALI YO'Q — u
 * birinchi marta kirgandan keyin paydo bo'ladi. Shuning uchun:
 *   1. admin `couriers/pending_<telefon>` hujjatini yaratadi;
 *   2. kuryer birinchi marta kirganda `claimCourier()` shu hujjatni
 *      telefon bo'yicha topib `couriers/{uid}` ga KO'CHIRADI va
 *      `pending_` hujjatini o'chiradi.
 * Shundan keyin kuryer o'z hujjatining egasi bo'ladi.
 */

import { getDb, getFieldTypes } from './firebase.js';
import { httpError } from './otp.js';
import { updateStatus } from './orders.js';

/** Kuryer o'zi qo'ya oladigan statuslar (SPEC 124). */
export const COURIER_STATUSES = ['on_way', 'delivered'];

/** Hali kirmagan kuryer hujjatining ID prefiksi. */
export const PENDING_PREFIX = 'pending_';

/**
 * Telefon raqamdan `pending_` hujjat ID yasaydi.
 * Faqat raqamlar qoladi — `+998 90 …` va `99890…` bir xil ID beradi.
 *
 * @param {string} phone
 * @returns {string}
 */
export function pendingId(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return `${PENDING_PREFIX}${digits}`;
}

/**
 * Telefonni `+998901234567` ko'rinishiga keltiradi.
 * @param {string} phone
 * @returns {?string}
 */
function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  const full = digits.startsWith('998') ? digits : `998${digits}`;
  return /^998\d{9}$/.test(full) ? `+${full}` : null;
}

/**
 * Kuryer kirganda hujjatini topadi yoki `pending_` dan ko'chiradi.
 *
 * @param {{uid: string, phone: string}} input
 * @returns {Promise<object>} kuryer hujjati (`id` bilan)
 */
export async function claimCourier({ uid, phone }) {
  const db = await getDb();
  const { Timestamp } = await getFieldTypes();

  const ref = db.collection('couriers').doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    const data = snap.data();
    if (data.active === false) {
      throw httpError(403, 'courier-disabled', 'Hisobingiz o\'chirilgan');
    }
    return { id: uid, ...data };
  }

  const e164 = normalizePhone(phone);
  if (!e164) throw httpError(400, 'invalid-phone', 'Telefon raqam noto\'g\'ri');

  // `pending_` hujjatini avval ID bo'yicha, topilmasa telefon bo'yicha izlaymiz
  const pendingRef = db.collection('couriers').doc(pendingId(e164));
  let pendingSnap = await pendingRef.get();

  if (!pendingSnap.exists) {
    const found = await db.collection('couriers')
      .where('phone', '==', e164)
      .limit(2)
      .get();
    // Faqat hali ko'chirilmagan (pending) hujjat qabul qilinadi
    const doc = found.docs.find((d) => d.id.startsWith(PENDING_PREFIX));
    if (!doc) throw httpError(403, 'not-courier', 'Bu raqam kuryer sifatida qo\'shilmagan');
    pendingSnap = doc;
  }

  const data = pendingSnap.data();
  if (data.active === false) {
    throw httpError(403, 'courier-disabled', 'Hisobingiz o\'chirilgan');
  }

  const courier = {
    name: data.name || '',
    phone: e164,
    branchId: data.branchId || null,
    // Kirish paytida smena YOPIQ — kuryer o'zi ochadi
    onShift: false,
    // Joylashuv bu hujjatda saqlanmaydi — u `courierLocations/{uid}` da
    // (mijoz trekingi o'sha yerni o'qiydi, ism va telefonni emas).
    activeOrders: [],
    active: true,
    createdAt: data.createdAt || Timestamp.now(),
    claimedAt: Timestamp.now()
  };

  // Ko'chirish va eskisini o'chirish — bitta batch'da
  const batch = db.batch();
  batch.set(ref, courier);
  batch.delete(pendingSnap.ref);
  await batch.commit();

  console.log(`[courier] ${e164} → couriers/${uid} (pending ko'chirildi)`);
  return { id: uid, ...courier };
}

/**
 * Kuryer o'ziga tayinlangan buyurtma statusini o'zgartiradi.
 *
 * Ikki tekshiruv: buyurtma AYNAN shu kuryerga tayinlanganmi va status
 * kuryerga ruxsat etilganlardanmi. Ikkalasi ham serverda — client
 * tekshiruviga tayanilmaydi.
 *
 * @param {{orderId: string, uid: string, status: string,
 *          cashCollected?: boolean}} input
 * @returns {Promise<{status: string}>}
 */
export async function courierUpdateStatus({ orderId, uid, status, cashCollected }) {
  if (!COURIER_STATUSES.includes(status)) {
    throw httpError(403, 'status-forbidden', 'Kuryer bu statusni qo\'ya olmaydi');
  }

  const db = await getDb();
  const { Timestamp } = await getFieldTypes();

  const ref = db.collection('orders').doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) throw httpError(404, 'no-order', 'Buyurtma topilmadi');

  const order = snap.data();
  if (order.courierId !== uid) {
    throw httpError(403, 'not-assigned', 'Bu buyurtma sizga tayinlanmagan');
  }

  const result = await updateStatus({ orderId, status, by: uid });

  // Naqd pul olindi belgisi (SPEC 126) — faqat naqd buyurtmada
  if (status === 'delivered') {
    const patch = { courierClosedAt: Timestamp.now() };
    if (order.paymentMethod === 'cash' && cashCollected) {
      patch.cashCollected = true;
      patch.cashCollectedAt = Timestamp.now();
    }
    await ref.update(patch);

    // Kuryerning faol buyurtmalari ro'yxatidan olib tashlanadi
    const { FieldValue } = await getFieldTypes();
    await db.collection('couriers').doc(uid).set({
      activeOrders: FieldValue.arrayRemove(orderId)
    }, { merge: true });
  }

  return result;
}

/**
 * Buyurtmalar ro'yxatidan kunlik yig'indini hisoblaydi.
 *
 * Firestore'dan ajratilgan sof funksiya — hisob mantig'i shu yerda
 * sinaladi (`server/test/couriers.test.js`).
 *
 * @param {object[]} orders
 * @param {string} dateStr - `YYYY-MM-DD`
 * @returns {object}
 */
export function summarizeOrders(orders, dateStr) {
  const report = {
    date: dateStr,
    delivered: 0,
    active: 0,
    deliveryTotal: 0,
    cashTotal: 0,
    cardTotal: 0,
    orderTotal: 0
  };

  (orders || []).forEach((order) => {
    if (order.status === 'delivered') {
      report.delivered += 1;
      report.deliveryTotal += Number(order.deliveryPrice) || 0;
      report.orderTotal += Number(order.total) || 0;
      if (order.paymentMethod === 'cash') report.cashTotal += Number(order.total) || 0;
      else report.cardTotal += Number(order.total) || 0;
    } else if (order.status !== 'cancelled' && order.status !== 'canceled') {
      // Rad etilgan buyurtma ikki xil yozilishda uchraydi — ikkalasi ham
      // hisobga olinmaydi
      report.active += 1;
    }
  });

  return report;
}

/**
 * Kuryerning kunlik hisobi (SPEC 128).
 *
 * Bugungi yetkazilgan buyurtmalari: soni, yetkazish narxi yig'indisi,
 * olingan naqd pul va umumiy summa.
 *
 * @param {{uid: string, date?: string}} input - `date`: `YYYY-MM-DD`
 * @returns {Promise<object>}
 */
export async function courierReport({ uid, date }) {
  const db = await getDb();
  const { Timestamp } = await getFieldTypes();

  const start = date ? new Date(`${date}T00:00:00`) : new Date();
  if (Number.isNaN(start.getTime())) throw httpError(400, 'bad-date', 'Sana noto\'g\'ri');
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400000);

  const snap = await db.collection('orders')
    .where('courierId', '==', uid)
    .where('createdAt', '>=', Timestamp.fromDate(start))
    .where('createdAt', '<', Timestamp.fromDate(end))
    .get();

  // Mahalliy sana — `toISOString()` UTC ga o'tkazib kunni siljitadi
  const dateStr = [
    start.getFullYear(),
    String(start.getMonth() + 1).padStart(2, '0'),
    String(start.getDate()).padStart(2, '0')
  ].join('-');

  return summarizeOrders(snap.docs.map((doc) => doc.data()), dateStr);
}
