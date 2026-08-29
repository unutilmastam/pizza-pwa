/**
 * Admin panelga xizmat qiladigan servis amallari (SPEC 118–119).
 *
 * NEGA SERVISDA: `firestore.rules` mijozning pul maydonlarini
 * (`bonusBalance`, `tier`, `totalSpent`) HECH KIMGA ochmaydi — na
 * mijozga, na xodimga. Bu ataylab: bonus faqat servis nazorati ostida
 * o'zgarishi kerak. Shuning uchun qo'lda bonus berish ham shu yerdan
 * o'tadi.
 */

import { getDb, getFieldTypes } from './firebase.js';
import { httpError } from './otp.js';
import { sendMessage } from './telegram.js';
import { writeAudit } from './audit.js';

/** Bir marta berish mumkin bo'lgan eng katta bonus. */
const MAX_GIFT = 1000000;

/** Broadcast auditoriyalari. */
export const AUDIENCES = ['all', 'active', 'sleeping'];

/** "Faol" va "uxlab qolgan" chegaralari (kun). */
const ACTIVE_DAYS = 30;
const SLEEPING_DAYS = 60;

/**
 * Telegram sekundiga ~30 xabar qabul qiladi. Undan tez yuborilsa
 * `429 Too Many Requests` keladi va bot vaqtincha bloklanadi.
 * Xavfsizlik uchun 25 tadan olamiz.
 */
const BATCH_SIZE = 25;
const BATCH_PAUSE = 1100;

/**
 * Bonusni qo'lda beradi yoki ayiradi (SPEC 118).
 *
 * `amount` manfiy ham bo'lishi mumkin (xato berilgan bonusni qaytarib
 * olish uchun), lekin balans MANFIY BO'LMAYDI — transaction ichida
 * tekshiriladi.
 *
 * @param {{uid: string, amount: number, reason: string, by: object}} input
 * @returns {Promise<{bonusBalance: number, amount: number}>}
 */
export async function giveBonus({ uid, amount, reason, by }) {
  const target = String(uid || '').trim();
  const value = Math.round(Number(amount));
  const note = String(reason || '').trim().slice(0, 300);

  if (!target) throw httpError(400, 'no-uid', 'Mijoz tanlanmagan');
  if (!Number.isFinite(value) || value === 0) {
    throw httpError(400, 'bad-amount', 'Summa noto\'g\'ri');
  }
  if (Math.abs(value) > MAX_GIFT) {
    throw httpError(400, 'amount-too-big', 'Summa juda katta');
  }
  if (!note) throw httpError(400, 'no-reason', 'Sabab yozilishi shart');

  const db = await getDb();
  const { Timestamp } = await getFieldTypes();

  const userRef = db.collection('users').doc(target);
  // Yozuv havolasi transaction'dan TASHQARIDA yasaladi: transaction
  // qayta urinishi mumkin, ichida tasodifiy ID hosil qilinmasin
  const entryRef = userRef.collection('bonusHistory').doc();
  const now = Timestamp.now();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) throw httpError(404, 'no-user', 'Mijoz topilmadi');

    const before = Number(snap.data().bonusBalance) || 0;
    const after = before + value;
    if (after < 0) {
      throw httpError(409, 'not-enough-bonus', 'Mijozda yetarli bonus yo\'q');
    }

    tx.set(userRef, { bonusBalance: after }, { merge: true });
    tx.set(entryRef, {
      type: 'gift',
      amount: value,
      reason: note,
      byUid: by.uid,
      byName: by.name || null,
      createdAt: now,
      // Sovg'a bonusi kuymaydi — cron `expiresAt` bo'yicha ishlaydi
      expiresAt: null
    });

    return { before, after };
  });

  await writeAudit({
    uid: by.uid,
    staffName: by.name,
    action: 'bonus.gift',
    target: `users/${target}`,
    before: { bonusBalance: result.before },
    after: { bonusBalance: result.after, amount: value, reason: note }
  });

  console.log(`[admin] bonus ${value > 0 ? '+' : ''}${value} → ${target} (${by.uid})`);
  return { bonusBalance: result.after, amount: value };
}

/**
 * Auditoriya bo'yicha mijozlarni tanlaydi.
 *
 * `telegramId` bo'lmagan mijozga xabar yuborib bo'lmaydi — ular
 * ro'yxatga umuman kirmaydi.
 *
 * @param {string} audience
 * @returns {Promise<object[]>} `{uid, telegramId, name}`
 */
export async function audienceUsers(audience) {
  if (!AUDIENCES.includes(audience)) {
    throw httpError(400, 'bad-audience', 'Auditoriya noto\'g\'ri');
  }

  const db = await getDb();
  const snap = await db.collection('users').get();
  const now = Date.now();

  return snap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .filter((u) => u.telegramId && u.blocked !== true)
    .filter((u) => {
      if (audience === 'all') return true;
      const last = toMillis(u.lastOrderAt);
      const days = last ? (now - last) / 86400000 : Infinity;
      if (audience === 'active') return days <= ACTIVE_DAYS;
      // `sleeping`: hech qachon buyurtma bermaganlar ham kiradi
      return days > SLEEPING_DAYS;
    })
    .map((u) => ({ uid: u.uid, telegramId: u.telegramId, name: u.name || null }));
}

/**
 * Sanani millisekundga aylantiradi.
 * @param {*} value
 * @returns {?number}
 */
function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Broadcast yuboradi (SPEC 119).
 *
 * NAVBAT BILAN: Telegram sekundiga ~30 xabarni qabul qiladi, undan
 * tez yuborilsa bot bloklanadi. Shuning uchun `BATCH_SIZE` tadan
 * yuborib, orasida `BATCH_PAUSE` kutamiz.
 *
 * Yuborish UZOQ davom etadi (1000 mijoz ≈ 45 sekund), shuning uchun
 * so'rov javobini KUTMAYDI: hujjat darhol `sending` holatida
 * yaratiladi, yuborish esa fonda ketadi. Admin panel tarixdan
 * holatni ko'radi.
 *
 * @param {{text: string, audience: string, by: object}} input
 * @returns {Promise<{id: string, total: number}>}
 */
export async function startBroadcast({ text, audience, by }) {
  const message = String(text || '').trim();
  if (!message) throw httpError(400, 'no-text', 'Matn bo\'sh');
  if (message.length > 3500) throw httpError(400, 'text-too-long', 'Matn juda uzun');

  const users = await audienceUsers(audience);
  if (!users.length) throw httpError(409, 'no-recipients', 'Bu guruhda qabul qiluvchi yo\'q');

  const db = await getDb();
  const { Timestamp } = await getFieldTypes();

  const ref = db.collection('broadcasts').doc();
  await ref.set({
    text: message,
    audience,
    total: users.length,
    sent: 0,
    failed: 0,
    status: 'sending',
    byUid: by.uid,
    byName: by.name || null,
    createdAt: Timestamp.now(),
    finishedAt: null
  });

  await writeAudit({
    uid: by.uid,
    staffName: by.name,
    action: 'broadcast.send',
    target: `broadcasts/${ref.id}`,
    before: null,
    after: { audience, total: users.length, text: message.slice(0, 200) }
  });

  // Fonda yuboriladi — so'rov javobini kutib turmaydi
  deliver(ref, users, message).catch((e) => {
    console.error('[broadcast] yiqildi:', e.message);
  });

  return { id: ref.id, total: users.length };
}

/**
 * Xabarlarni navbat bilan yuboradi va hisobni yangilab boradi.
 *
 * @param {object} ref - `broadcasts/{id}` havolasi
 * @param {object[]} users
 * @param {string} message
 * @returns {Promise<void>}
 */
async function deliver(ref, users, message) {
  const { Timestamp } = await getFieldTypes();
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const batch = users.slice(i, i + BATCH_SIZE);

    // Bitta paket ichida parallel — chegara paketlar orasida ushlanadi
    /* eslint-disable no-await-in-loop */
    const results = await Promise.allSettled(
      batch.map((u) => sendMessage(u.telegramId, message))
    );
    results.forEach((r) => {
      if (r.status === 'fulfilled') sent += 1;
      else failed += 1;
    });

    await ref.set({ sent, failed }, { merge: true });

    if (i + BATCH_SIZE < users.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE));
    }
    /* eslint-enable no-await-in-loop */
  }

  await ref.set({
    sent,
    failed,
    status: 'done',
    finishedAt: Timestamp.now()
  }, { merge: true });

  console.log(`[broadcast] tugadi: ${sent} yuborildi, ${failed} yiqildi`);
}
