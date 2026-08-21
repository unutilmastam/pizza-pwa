/**
 * Node servis bilan aloqa qatlami.
 *
 * Barcha `fetch` chaqiruvlari shu yerda — sahifalar servis manzilini
 * bilmaydi, faqat shu funksiyalarni chaqiradi. Bazaviy manzil
 * `config.js` dagi `API_BASE`.
 *
 * RENDER BEPUL PLANI: servis 15 daqiqa so'rovsiz qolsa uxlaydi va
 * birinchi so'rov 30–60 soniya kutishi mumkin. Shuning uchun:
 *  - kutish chegarasi uzun (`SLOW_TIMEOUT`);
 *  - `onSlow` chaqiruvi ~4 soniyadan keyin ishlaydi, sahifa
 *    "server uyg'onmoqda" xabarini ko'rsatadi;
 *  - ilova ochilganda `wakeUp()` fon rejimida servisni uyg'otadi,
 *    shunda buyurtma berish payti kutish bo'lmaydi.
 */

import { API_BASE, getFirebase } from './config.js';

/** Uzun kutish chegarasi (ms) — uyqudan uyg'onish uchun. */
const SLOW_TIMEOUT = 60000;

/** Shundan keyin "sekin" deb hisoblanadi (ms). */
const SLOW_AFTER = 4000;

/**
 * Servis xatosi — `code` maydoni serverdagi `error` bilan bir xil.
 */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {number} status
   * @param {object} [data]
   */
  constructor(message, code, status, data = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

/**
 * Joriy foydalanuvchining Firebase ID tokeni.
 * @returns {Promise<?string>}
 */
async function idToken() {
  const { auth } = await getFirebase();
  const user = auth.currentUser;
  return user ? user.getIdToken() : null;
}

/**
 * Servisga so'rov yuboradi.
 *
 * @param {string} path - `/api/...`
 * @param {{method?: string, body?: object, auth?: boolean,
 *          timeout?: number, onSlow?: Function}} [opts]
 * @returns {Promise<object>}
 * @throws {ApiError}
 */
export async function request(path, opts = {}) {
  const {
    method = 'GET',
    body = null,
    auth = false,
    timeout = SLOW_TIMEOUT,
    onSlow = null
  } = opts;

  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = await idToken();
    if (!token) throw new ApiError('Sessiya yo\'q', 'no-session', 401);
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), timeout);
  const slowTimer = onSlow ? setTimeout(onSlow, SLOW_AFTER) : null;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(data.message || `HTTP ${res.status}`, data.error || `http-${res.status}`, res.status, data);
    }
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e.name === 'AbortError') {
      throw new ApiError('Server javob bermadi', 'timeout', 0);
    }
    throw new ApiError(e.message || 'Tarmoq xatosi', 'network', 0);
  } finally {
    clearTimeout(abortTimer);
    if (slowTimer) clearTimeout(slowTimer);
  }
}

/**
 * OTP kodini so'raydi.
 * @param {string} phone - `+998901234567`
 * @param {?Function} [onSlow]
 * @returns {Promise<{ok: boolean, resendAfter: number}>}
 */
export function sendOtpRequest(phone, onSlow = null) {
  return request('/api/auth/send-otp', { method: 'POST', body: { phone }, onSlow });
}

/**
 * Kodni tekshirtiradi, custom token oladi.
 * @param {string} phone
 * @param {string} code
 * @returns {Promise<{token: string, uid: string, phone: string}>}
 */
export function verifyOtpRequest(phone, code) {
  return request('/api/auth/verify-otp', { method: 'POST', body: { phone, code } });
}

/**
 * Buyurtma yaratadi. Narxni servis qayta hisoblaydi — bu yerdagi
 * summalar faqat ma'lumot uchun yuboriladi.
 *
 * @param {object} draft - checkout yig'gan buyurtma
 * @param {?Function} [onSlow]
 * @returns {Promise<{id: string, orderNumber: number, total: number}>}
 */
export function createOrder(draft, onSlow = null) {
  return request('/api/orders', { method: 'POST', body: draft, auth: true, onSlow });
}

/** Uyg'otish so'rovi bir marta yuboriladi. */
let wakePromise = null;

/**
 * Servisni fon rejimida uyg'otadi — javob kutilmaydi, xato ham jim o'tadi.
 * Ilova ochilganda chaqiriladi, buyurtma paytida kutish qisqaradi.
 * @returns {Promise<boolean>} servis tayyormi
 */
export function wakeUp() {
  if (!wakePromise) {
    wakePromise = request('/api/health', { timeout: SLOW_TIMEOUT })
      .then((data) => {
        if (data.problems?.length) console.warn('[api] servis sozlamalari:', data.problems);
        return Boolean(data.ok);
      })
      .catch((e) => {
        console.warn('[api] servis uyg\'onmadi:', e.code);
        return false;
      });
  }
  return wakePromise;
}
