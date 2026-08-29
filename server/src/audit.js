/**
 * Audit log — kim nima o'zgartirganining yozuvi (SPEC 121).
 *
 * Bu yerda SERVIS yozadigan amallar: bonus berish, broadcast. Menyu,
 * filial, promokod va stop-list ni admin panel bevosita Firestore'ga
 * yozadi (SPEC 3-bo'lim), shuning uchun ular uchun yozuvni admin panel
 * o'zi qo'shadi (`admin/js/db.js` dagi `writeAudit()`).
 *
 * Yozuv O'ZGARMAS: `firestore.rules` da `update` va `delete` hech
 * kimga ochiq emas.
 */

import { getDb, getFieldTypes } from './firebase.js';

/** Qiymat qanchalik uzun saqlanadi — hujjat shishib ketmasin. */
const MAX_SNAPSHOT = 2000;

/**
 * Katta obyektni yozuvga sig'adigan holga keltiradi.
 *
 * `before`/`after` butun menyu bo'lishi mumkin (yuzlab mahsulot).
 * Uni to'liq saqlash hujjat chegarasini (1 MB) yorib yuborardi.
 *
 * @param {*} value
 * @returns {*}
 */
function trim(value) {
  if (value === null || value === undefined) return null;
  const text = JSON.stringify(value);
  if (text === undefined) return null;
  if (text.length <= MAX_SNAPSHOT) return value;
  return { truncated: true, preview: text.slice(0, MAX_SNAPSHOT) };
}

/**
 * Audit yozuvini qo'shadi.
 *
 * Xato bo'lsa ASOSIY amalni buzmaydi — audit yozilmagani uchun bonus
 * berish bekor qilinmasligi kerak. Xato faqat logga chiqadi.
 *
 * @param {{uid: string, staffName?: string, action: string,
 *          target?: string, before?: *, after?: *}} entry
 * @returns {Promise<void>}
 */
export async function writeAudit(entry) {
  try {
    const db = await getDb();
    const { Timestamp } = await getFieldTypes();
    await db.collection('auditLog').add({
      uid: entry.uid,
      staffName: entry.staffName || null,
      action: entry.action,
      target: entry.target || null,
      before: trim(entry.before),
      after: trim(entry.after),
      at: Timestamp.now(),
      source: 'server'
    });
  } catch (e) {
    console.error('[audit] yozilmadi:', e.message);
  }
}
