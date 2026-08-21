/**
 * OTP: kod yaratish, yuborish va tekshirish.
 *
 * Kod Firestore'da (`otps/{phone}`) saqlanadi, xotirada emas — Render
 * bepul planida servis uxlab qolganda process qayta ishga tushadi va
 * xotiradagi hamma narsa yo'qoladi. Firestore esa uyquni "eslab qoladi".
 *
 * Kodning o'zi ochiq saqlanmaydi — faqat SHA-256 xesh yoziladi.
 */

import { createHash, randomInt } from 'node:crypto';
import { config } from './config.js';
import { getDb, getAuth, getFieldTypes } from './firebase.js';
import { sendTelegramLog } from './telegram.js';

/** Bir soatdagi urinishlarni sanash oynasi (ms). */
const HOUR_MS = 3600000;

/**
 * Telefon raqamni `998901234567` ko'rinishiga keltiradi.
 * @param {string} input
 * @returns {?string} noto'g'ri bo'lsa null
 */
export function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  const full = digits.startsWith('998') ? digits : `998${digits}`;
  return /^998\d{9}$/.test(full) ? full : null;
}

/**
 * Kodni xeshlaydi — bazada ochiq kod yotmasligi uchun.
 * @param {string} phone
 * @param {string} code
 * @returns {string}
 */
function hash(phone, code) {
  return createHash('sha256').update(`${phone}:${code}`).digest('hex');
}

/**
 * 6 xonali tasodifiy kod.
 * @returns {string}
 */
function generateCode() {
  return String(randomInt(0, 1000000)).padStart(6, '0');
}

/**
 * Eskiz.uz tokeni — muddati bor, shuning uchun keshlanadi.
 * @type {{value: string, expiresAt: number}}
 */
let eskizToken = { value: '', expiresAt: 0 };

/**
 * Eskiz.uz uchun token oladi.
 * @returns {Promise<string>}
 */
async function getEskizToken() {
  if (eskizToken.value && eskizToken.expiresAt > Date.now()) return eskizToken.value;

  const body = new FormData();
  body.append('email', config.eskiz.email);
  body.append('password', config.eskiz.password);

  const res = await fetch('https://notify.eskiz.uz/api/auth/login', { method: 'POST', body });
  if (!res.ok) throw new Error(`Eskiz login xatosi: ${res.status}`);

  const data = await res.json();
  const token = data?.data?.token;
  if (!token) throw new Error('Eskiz tokeni kelmadi');

  // Token 30 kun amal qiladi, biz 24 soatda yangilaymiz
  eskizToken = { value: token, expiresAt: Date.now() + 86400000 };
  return token;
}

/**
 * SMS yuboradi. `console` provayderi hech qayerga yubormaydi —
 * kodni faqat logga yozadi (dev uchun).
 *
 * @param {string} phone - `998901234567`
 * @param {string} code
 * @returns {Promise<void>}
 */
async function sendSms(phone, code) {
  const text = `Pizza: tasdiqlash kodi ${code}. Hech kimga aytmang.`;

  if (config.otp.provider === 'eskiz') {
    const token = await getEskizToken();
    const body = new FormData();
    body.append('mobile_phone', phone);
    body.append('message', text);
    body.append('from', config.eskiz.from);

    const res = await fetch('https://notify.eskiz.uz/api/message/sms/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Eskiz SMS xatosi: ${res.status} ${detail.slice(0, 200)}`);
    }
    return;
  }

  // console provayderi: kod logga tushadi, admin guruhga ham yuboriladi
  console.log(`[otp] ${phone} → ${code}`);
  await sendTelegramLog(`OTP ${phone}: <b>${code}</b>`);
}

/**
 * Kod yuboradi (yoki test raqami uchun soxta yuborish).
 *
 * @param {string} rawPhone
 * @returns {Promise<{ok: true, resendAfter: number, devCode?: string}>}
 * @throws {Error & {status?: number, code?: string}}
 */
export async function requestOtp(rawPhone) {
  const phone = normalizePhone(rawPhone);
  if (!phone) throw httpError(400, 'invalid-phone', 'Telefon raqam noto\'g\'ri');

  const db = await getDb();
  const { Timestamp } = await getFieldTypes();
  const ref = db.collection('otps').doc(phone);
  const now = Date.now();

  const snap = await ref.get();
  const prev = snap.exists ? snap.data() : null;

  // Qayta yuborish taymeri
  const lastSentAt = prev?.sentAt?.toMillis?.() ?? 0;
  const waitMs = config.otp.resendSeconds * 1000 - (now - lastSentAt);
  if (prev && waitMs > 0) {
    throw httpError(429, 'too-soon', 'Kod yaqinda yuborilgan', {
      resendAfter: Math.ceil(waitMs / 1000)
    });
  }

  // Soatlik limit
  const windowStart = prev?.windowStart?.toMillis?.() ?? 0;
  const inWindow = now - windowStart < HOUR_MS;
  const sentInHour = inWindow ? (prev?.sentInHour ?? 0) : 0;
  if (sentInHour >= config.otp.hourlyLimit) {
    throw httpError(429, 'rate-limited', 'Soatlik limit tugadi');
  }

  // Test raqami uchun doimiy kod — SMS yuborilmaydi
  const isTestPhone = Boolean(config.otp.testPhone) && phone === normalizePhone(config.otp.testPhone);
  const code = isTestPhone && config.otp.testCode ? config.otp.testCode : generateCode();

  if (!isTestPhone) await sendSms(phone, code);

  await ref.set({
    phone,
    codeHash: hash(phone, code),
    attempts: 0,
    sentAt: Timestamp.fromMillis(now),
    expiresAt: Timestamp.fromMillis(now + config.otp.ttlSeconds * 1000),
    windowStart: Timestamp.fromMillis(inWindow ? windowStart : now),
    sentInHour: sentInHour + 1
  });

  const result = { ok: true, resendAfter: config.otp.resendSeconds };
  // Dev rejimida kodni javobda ham qaytaramiz — SMS provayderi yo'q paytda
  if (!config.isProduction && config.otp.provider === 'console') result.devCode = code;
  return result;
}

/**
 * Kodni tekshiradi va Firebase custom token qaytaradi.
 *
 * @param {string} rawPhone
 * @param {string} rawCode
 * @returns {Promise<{token: string, uid: string, phone: string}>}
 */
export async function verifyOtp(rawPhone, rawCode) {
  const phone = normalizePhone(rawPhone);
  const code = String(rawCode || '').replace(/\D/g, '');
  if (!phone) throw httpError(400, 'invalid-phone', 'Telefon raqam noto\'g\'ri');
  if (code.length !== 6) throw httpError(400, 'invalid-code', 'Kod 6 xonali bo\'lishi kerak');

  const db = await getDb();
  const { FieldValue, Timestamp } = await getFieldTypes();
  const ref = db.collection('otps').doc(phone);
  const snap = await ref.get();

  if (!snap.exists) throw httpError(400, 'no-code', 'Kod so\'ralmagan');
  const data = snap.data();

  if ((data.expiresAt?.toMillis?.() ?? 0) < Date.now()) {
    await ref.delete();
    throw httpError(400, 'expired', 'Kod muddati tugagan');
  }
  if ((data.attempts ?? 0) >= config.otp.maxAttempts) {
    await ref.delete();
    throw httpError(429, 'too-many-attempts', 'Urinishlar tugadi, kodni qayta so\'rang');
  }
  if (data.codeHash !== hash(phone, code)) {
    await ref.update({ attempts: FieldValue.increment(1) });
    throw httpError(400, 'wrong-code', 'Kod noto\'g\'ri');
  }

  await ref.delete();

  // Telefon bo'yicha barqaror uid — bir raqam bir foydalanuvchi
  const auth = await getAuth();
  const uid = await ensureUser(auth, phone);

  // users/{uid} hujjati bo'lmasa yaratiladi (client ham qiladi, lekin
  // servis birinchi bo'lib bajarsa telefon ishonchli manbadan yoziladi)
  await db.collection('users').doc(uid).set({
    phone: `+${phone}`,
    updatedAt: Timestamp.now()
  }, { merge: true });

  const token = await auth.createCustomToken(uid, { phone: `+${phone}` });
  return { token, uid, phone: `+${phone}` };
}

/**
 * Telefon bo'yicha Firebase foydalanuvchisini topadi yoki yaratadi.
 * @param {import('firebase-admin/auth').Auth} auth
 * @param {string} phone - `998901234567`
 * @returns {Promise<string>} uid
 */
async function ensureUser(auth, phone) {
  const e164 = `+${phone}`;
  try {
    const user = await auth.getUserByPhoneNumber(e164);
    if (user.disabled) throw httpError(403, 'blocked', 'Foydalanuvchi bloklangan');
    return user.uid;
  } catch (e) {
    if (e.status) throw e;
    if (e.code !== 'auth/user-not-found') throw e;
    const created = await auth.createUser({ phoneNumber: e164 });
    return created.uid;
  }
}

/**
 * HTTP xatosi — `status` va `code` bilan.
 * @param {number} status
 * @param {string} code
 * @param {string} message
 * @param {object} [extra]
 * @returns {Error & {status: number, code: string}}
 */
export function httpError(status, code, message, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  Object.assign(error, extra);
  return error;
}
