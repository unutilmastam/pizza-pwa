/**
 * Node servis bilan aloqa (kuryer).
 *
 * `orders` ga client yoza olmaydi (SPEC 3-bo'lim), shuning uchun status
 * o'zgarishi faqat shu yerdan ketadi. Servis ikki narsani tekshiradi:
 * buyurtma AYNAN shu kuryerga tayinlanganmi va status kuryerga ruxsat
 * etilganlardanmi (`on_way` / `delivered`).
 */

import { API_BASE, getFirebase } from './config.js';

/** Render bepul planida servis uxlaydi — kutish uzun. */
const SLOW_TIMEOUT = 60000;
const SLOW_AFTER = 4000;

/** Servis xatosi — `code` serverdagi `error` bilan bir xil. */
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {number} status
   */
  constructor(message, code, status) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Joriy kuryerning Firebase ID tokeni.
 * @returns {Promise<?string>}
 */
async function idToken() {
  const { auth } = await getFirebase();
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}

/**
 * Servisga so'rov.
 * @param {string} path
 * @param {{method?: string, body?: object, auth?: boolean, onSlow?: Function}} [opts]
 * @returns {Promise<object>}
 */
export async function request(path, opts = {}) {
  const { method = 'GET', body = null, auth = true, onSlow = null } = opts;

  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await idToken();
    if (!token) throw new ApiError('Sessiya yo\'q', 'no-session', 401);
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), SLOW_TIMEOUT);
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
      throw new ApiError(data.message || `HTTP ${res.status}`, data.error || `http-${res.status}`, res.status);
    }
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e.name === 'AbortError') throw new ApiError('Server javob bermadi', 'timeout', 0);
    throw new ApiError(e.message || 'Tarmoq xatosi', 'network', 0);
  } finally {
    clearTimeout(abortTimer);
    if (slowTimer) clearTimeout(slowTimer);
  }
}

/**
 * Kuryer hujjatini "egallaydi": birinchi kirishda servis
 * `pending_<telefon>` hujjatini `couriers/{uid}` ga ko'chiradi.
 *
 * @param {?Function} [onSlow]
 * @returns {Promise<object>} kuryer hujjati
 */
export function claimCourier(onSlow = null) {
  return request('/api/courier/claim', { method: 'POST', body: {}, onSlow });
}

/**
 * Buyurtma statusini o'zgartiradi (faqat `on_way` yoki `delivered`).
 *
 * @param {string} orderId
 * @param {string} status
 * @param {{cashCollected?: boolean, onSlow?: Function}} [extra]
 * @returns {Promise<object>}
 */
export function setOrderStatus(orderId, status, extra = {}) {
  const { onSlow, ...body } = extra;
  return request(`/api/orders/${orderId}/courier-status`, {
    method: 'PATCH',
    body: { status, ...body },
    onSlow
  });
}

/**
 * Kunlik hisob (SPEC 128).
 * @param {?string} [date] - `YYYY-MM-DD`, standart — bugun
 * @returns {Promise<object>}
 */
export function getReport(date = null) {
  return request(`/api/courier/report${date ? `?date=${date}` : ''}`);
}

/** Uyg'otish so'rovi bir marta yuboriladi. */
let wakePromise = null;

/**
 * Servisni fon rejimida uyg'otadi — ilova ochilganda chaqiriladi.
 * @returns {Promise<boolean>}
 */
export function wakeUp() {
  if (!wakePromise) {
    wakePromise = request('/api/health', { auth: false })
      .then((data) => Boolean(data.ok))
      .catch((e) => {
        console.warn('[api] servis uyg\'onmadi:', e.code);
        return false;
      });
  }
  return wakePromise;
}
