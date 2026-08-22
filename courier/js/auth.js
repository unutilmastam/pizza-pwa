/**
 * Kuryer autentifikatsiyasi (SPEC 122).
 *
 * Kirish mijoz ilovasidagi OTP yo'lidan ketadi, keyin YANA BIR qadam:
 * `POST /api/courier/claim`. Servis `couriers/{uid}` hujjatini topadi,
 * topolmasa `pending_<telefon>` ni shu uid ga KO'CHIRADI. Ikkalasi ham
 * bo'lmasa — bu raqam kuryer emas va sessiya darhol yopiladi.
 */

import { getFirebase } from './config.js';
import { request, claimCourier } from './api.js';
import { cache } from './db.js';

/** Kuryer hujjati kesh kaliti. */
const CACHE_KEY = 'me';

/** @type {?object} joriy kuryer hujjati */
let courier = null;

/** @type {Set<Function>} */
const listeners = new Set();

/** @type {?Function} */
let unwatch = null;

/**
 * Telefon raqamni `+998901234567` ko'rinishiga keltiradi.
 * @param {string} input
 * @returns {?string}
 */
export function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '').replace(/^998/, '');
  return digits.length === 9 ? `+998${digits}` : null;
}

/** @returns {?object} */
export function getCurrentCourier() {
  return courier;
}

/**
 * Holat o'zgarishiga obuna.
 * @param {(courier: ?object) => void} fn
 * @returns {Function}
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Kuzatuvchilarga xabar beradi. */
function emit() {
  listeners.forEach((fn) => fn(courier));
}

/**
 * OTP kodini so'raydi.
 * @param {string} phone
 * @param {?Function} [onSlow]
 * @returns {Promise<{resendAfter?: number}>}
 */
export async function sendOtp(phone, onSlow = null) {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    const error = new Error('Telefon raqam noto\'g\'ri');
    error.code = 'phone-invalid';
    throw error;
  }
  return request('/api/auth/send-otp', {
    method: 'POST',
    body: { phone: normalized },
    auth: false,
    onSlow
  });
}

/**
 * Kodni tekshiradi, sessiyani ochadi va kuryer hujjatini egallaydi.
 *
 * @param {string} phone
 * @param {string} code
 * @returns {Promise<object>} kuryer hujjati
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

  const { token } = await request('/api/auth/verify-otp', {
    method: 'POST',
    body: { phone: normalized, code: String(code) },
    auth: false
  });

  const { auth, sdk } = await getFirebase();
  await sdk.signInWithCustomToken(auth, token);
  return loadCourier();
}

/**
 * Kuryer hujjatini servisdan oladi. Topilmasa sessiyani yopadi.
 * @returns {Promise<object>}
 */
async function loadCourier() {
  try {
    courier = await claimCourier();
    cache.write(CACHE_KEY, courier);
    emit();
    return courier;
  } catch (e) {
    // Tarmoq yo'qligi sessiyani yopish uchun asos emas — faqat
    // servis "sen kuryer emassan" desa chiqaramiz
    if (e.code === 'timeout' || e.code === 'network') throw e;
    await signOut();
    throw e;
  }
}

/**
 * Sessiyani yopadi.
 * @returns {Promise<void>}
 */
export async function signOut() {
  try {
    const { auth, sdk } = await getFirebase();
    await sdk.signOut(auth);
  } catch (e) {
    console.warn('[auth] signOut xatosi:', e);
  }
  cache.clear();
  courier = null;
  emit();
}

/**
 * Ilova ochilganda sessiyani tiklaydi.
 *
 * Kuryer hujjati HAR SAFAR qaytadan tekshiriladi: administrator uni
 * o'chirgan bo'lsa kuryer darhol chiqib qoladi.
 *
 * @returns {Promise<?object>}
 */
export function initAuth() {
  return new Promise((resolve) => {
    getFirebase().then(({ auth, sdk }) => {
      let settled = false;

      unwatch = sdk.onAuthStateChanged(auth, async (user) => {
        if (!user) {
          if (courier) {
            courier = null;
            emit();
          }
          if (!settled) {
            settled = true;
            resolve(null);
          }
          return;
        }
        // KESHDAGI HUJJAT BILAN DARHOL OCHAMIZ.
        //
        // O'lchovda (1.5 s/so'rov) `POST /api/courier/claim` ilovani
        // 1.5 sekund ushlab turardi — Render bepul planda uyqudan
        // uyg'onayotgan bo'lsa 50 sekundgacha. Kuryer esa ekranga
        // qarab turardi. Endi eski hujjat bilan ekran darhol ochiladi,
        // `claim` fonda ketadi.
        //
        // Xavfsizlik: hujjat faqat QAYSI BO'LIM ko'rinishini belgilaydi,
        // har bir amalni servis va `firestore.rules` qaytadan tekshiradi.
        const cached = cache.peek(CACHE_KEY);
        if (cached && !settled) {
          courier = cached;
          settled = true;
          emit();
          resolve(cached);
          loadCourier().catch((e) => {
            console.warn('[auth] fon tekshiruvi:', e.code || e.message);
          });
          return;
        }

        try {
          const doc = await loadCourier();
          if (!settled) {
            settled = true;
            resolve(doc);
          }
        } catch (e) {
          console.warn('[auth] kuryer yuklanmadi:', e.code || e.message);
          if (!settled) {
            settled = true;
            resolve(null);
          }
        }
      });
    }).catch((e) => {
      console.error('[auth] Firebase yuklanmadi:', e);
      resolve(null);
    });
  });
}

/** Kuzatuvchini uzadi (sinovlarda kerak). */
export function stopAuthWatch() {
  if (unwatch) unwatch();
  unwatch = null;
}

/**
 * Kuryer hujjatini mahalliy holatda yangilaydi (smena o'zgarganda).
 * @param {object} patch
 */
export function patchCourier(patch) {
  if (!courier) return;
  courier = { ...courier, ...patch };
  emit();
}

/**
 * Xatoni i18n kalitiga aylantiradi.
 * @param {*} error
 * @returns {string}
 */
export function authErrorKey(error) {
  const code = String((error && error.code) || '');
  if (code === 'phone-invalid' || code === 'invalid-phone') return 'auth.phoneInvalid';
  if (code === 'code-invalid' || code === 'wrong-code' || code === 'no-code') return 'auth.codeWrong';
  if (code === 'expired') return 'auth.codeExpired';
  if (code === 'too-soon' || code === 'rate-limited' || code === 'too-many-attempts') {
    return 'auth.tooMany';
  }
  if (code === 'not-courier') return 'auth.notCourier';
  if (code === 'courier-disabled') return 'auth.disabled';
  if (code === 'timeout' || code === 'network') return 'auth.networkError';
  return 'app.error';
}
