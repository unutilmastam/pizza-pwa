/**
 * Autentifikatsiya qatlami.
 *
 * Ikki rejim bor, `config.js` dagi `AUTH_MODE` tanlaydi:
 *
 *  test        — Node servis hali yo'q (6-bosqichda yoziladi). SMS
 *                yuborilmaydi, kod `TEST_OTP_CODE` bilan solishtiriladi,
 *                sessiya `signInAnonymously()` bilan ochiladi va telefon
 *                `users/{uid}` hujjatiga yoziladi.
 *  production   — `/api/auth/send-otp` va `/api/auth/verify-otp` chaqiriladi,
 *                servis qaytargan custom token bilan `signInWithCustomToken()`.
 *
 * Sahifalar faqat shu fayldagi funksiyalarni ishlatadi — Firebase Auth
 * chaqiruvlari boshqa joyda yo'q.
 */

import { AUTH_MODE, TEST_OTP_CODE, API_BASE, getFirebase } from './config.js';
import { ensureUserDoc, getUser } from './db.js';
import { setUser, getState } from './state.js';
import { getLang } from './i18n.js';

/** Tarmoq so'rovlari uchun kutish chegarasi (ms). */
const REQUEST_TIMEOUT = 15000;

/** Auth kuzatuvchisi bir marta ulanadi. */
let authWatcher = null;

/**
 * Test rejimidamizmi.
 * @returns {boolean}
 */
export function isTestMode() {
  return AUTH_MODE === 'test';
}

/**
 * Telefon raqamni `+998901234567` ko'rinishiga keltiradi.
 * @param {string} input - foydalanuvchi kiritgan matn
 * @returns {?string} to'g'ri bo'lsa raqam, aks holda null
 */
export function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '').replace(/^998/, '');
  return digits.length === 9 ? `+998${digits}` : null;
}

/**
 * Node servisga so'rov (faqat production rejimida).
 * @param {string} path
 * @param {object} body
 * @returns {Promise<object>}
 */
async function apiPost(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.message || `HTTP ${res.status}`);
      error.code = data.code || `http-${res.status}`;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OTP kodini so'raydi.
 *
 * Test rejimida hech qayerga so'rov ketmaydi — kod har doim
 * `TEST_OTP_CODE`. Production rejimida `/api/auth/send-otp` chaqiriladi.
 *
 * @param {string} phone - `+998901234567`
 * @returns {Promise<{mode: string, testCode?: string}>}
 */
export async function sendOtp(phone) {
  if (!normalizePhone(phone)) {
    const error = new Error('Telefon raqam noto\'g\'ri');
    error.code = 'phone-invalid';
    throw error;
  }

  if (isTestMode()) {
    console.log('[auth] test rejimi — SMS yuborilmadi, kod:', TEST_OTP_CODE);
    return { mode: 'test', testCode: TEST_OTP_CODE };
  }

  await apiPost('/api/auth/send-otp', { phone });
  return { mode: 'production' };
}

/**
 * OTP kodini tekshiradi va sessiyani ochadi.
 *
 * @param {string} phone
 * @param {string} code - 6 xonali kod
 * @returns {Promise<object>} foydalanuvchi ma'lumoti
 */
export async function verifyOtp(phone, code) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    const error = new Error('Telefon raqam noto\'g\'ri');
    error.code = 'phone-invalid';
    throw error;
  }
  if (!/^\d{6}$/.test(String(code))) {
    const error = new Error('Kod 6 xonali bo\'lsin');
    error.code = 'code-invalid';
    throw error;
  }

  const { auth, sdk } = await getFirebase();
  let credential;

  if (isTestMode()) {
    if (String(code) !== TEST_OTP_CODE) {
      const error = new Error('Kod noto\'g\'ri');
      error.code = 'code-wrong';
      throw error;
    }
    // Test rejimi: haqiqiy Firebase sessiya, lekin anonim.
    // 6-bosqichda bu signInWithCustomToken() ga almashadi.
    credential = await sdk.signInAnonymously(auth);
    console.log('[auth] anonim sessiya ochildi:', credential.user.uid);
  } else {
    const { token } = await apiPost('/api/auth/verify-otp', { phone: normalized, code });
    credential = await sdk.signInWithCustomToken(auth, token);
    console.log('[auth] custom token bilan kirildi:', credential.user.uid);
  }

  const uid = credential.user.uid;
  const profile = await ensureUserDoc(uid, { phone: normalized, lang: getLang() });
  const user = toStateUser(uid, profile, normalized);
  setUser(user);
  return user;
}

/**
 * Firestore hujjatidan ilova holatiga mos foydalanuvchi yasaydi.
 * @param {string} uid
 * @param {?object} profile
 * @param {?string} [phone]
 * @returns {object}
 */
function toStateUser(uid, profile, phone) {
  return {
    uid,
    phone: (profile && profile.phone) || phone || '',
    name: (profile && profile.name) || '',
    bonusBalance: (profile && profile.bonusBalance) || 0,
    tier: (profile && profile.tier) || 'bronze'
  };
}

/**
 * Sessiyani yopadi.
 * @returns {Promise<void>}
 */
export async function logout() {
  try {
    const { auth, sdk } = await getFirebase();
    await sdk.signOut(auth);
  } catch (e) {
    // Sessiya baribir mahalliy holatdan olib tashlanadi
    console.warn('[auth] signOut xatosi:', e);
  }
  setUser(null);
}

/**
 * Firebase sessiyasini kuzatadi va ilova holatini u bilan moslaydi.
 *
 * Sahifa qayta yuklanganda Firebase sessiyani o'zi tiklaydi; shu paytda
 * `users/{uid}` dan yangi profil (bonus, daraja) o'qib olinadi.
 *
 * @returns {Promise<void>}
 */
export async function watchAuth() {
  if (authWatcher) return;
  const { auth, sdk } = await getFirebase();

  authWatcher = sdk.onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) {
      if (getState().user) setUser(null);
      return;
    }
    try {
      const profile = await getUser(fbUser.uid);
      const known = getState().user;
      setUser(toStateUser(fbUser.uid, profile, known && known.phone));
    } catch (e) {
      console.warn('[auth] profil o\'qilmadi:', e);
    }
  });
}

/**
 * Ilova ishga tushganda chaqiriladi.
 *
 * Firebase FAQAT ilgari kirgan foydalanuvchi uchun yuklanadi — mehmon
 * uchun bosh sahifa ortiqcha so'rovsiz ochiladi.
 *
 * @returns {Promise<void>}
 */
export async function initAuth() {
  if (!getState().user) return;
  try {
    await watchAuth();
  } catch (e) {
    console.warn('[auth] kuzatuvchi ulanmadi:', e);
  }
}

/**
 * Firebase xatosini odam o'qiydigan sababga aylantiradi.
 * @param {*} error
 * @returns {string} i18n kaliti
 */
export function authErrorKey(error) {
  const code = String((error && error.code) || '');
  if (code === 'phone-invalid') return 'auth.phoneInvalid';
  if (code === 'code-invalid' || code === 'code-wrong') return 'auth.codeWrong';
  if (code.includes('operation-not-allowed')) return 'auth.anonDisabled';
  if (code.includes('network') || code.includes('unavailable')) return 'auth.networkError';
  if (code.includes('too-many-requests')) return 'auth.tooMany';
  return 'app.error';
}
