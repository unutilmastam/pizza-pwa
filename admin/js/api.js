/**
 * Node servis bilan aloqa (admin).
 *
 * `orders` kolleksiyasiga client YOZA OLMAYDI (SPEC 3-bo'lim), shuning
 * uchun status o'zgarishi, rad etish va kuryer tayinlash faqat shu
 * yerdan — servis orqali ketadi.
 *
 * Render bepul planida servis uxlaydi: birinchi so'rov 30–60 soniya
 * kutishi mumkin, shuning uchun kutish chegarasi uzun va `onSlow`
 * chaqiruvi bor.
 */

import { API_BASE, getFirebase } from './config.js';

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
 * Joriy xodimning Firebase ID tokeni.
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
 * Buyurtma statusini o'zgartiradi.
 *
 * @param {string} orderId
 * @param {string} status
 * @param {{reason?: string, courierId?: string, etaMinutes?: number,
 *          onSlow?: Function}} [extra]
 * @returns {Promise<object>}
 */
export function setOrderStatus(orderId, status, extra = {}) {
  const { onSlow, ...body } = extra;
  return request(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status, ...body },
    onSlow
  });
}

/**
 * Buyurtmaga kuryer tayinlaydi (status o'zgarmaydi).
 * @param {string} orderId
 * @param {string} courierId
 * @returns {Promise<object>}
 */
export function assignCourier(orderId, courierId) {
  return request(`/api/orders/${orderId}/courier`, {
    method: 'PATCH',
    body: { courierId }
  });
}

/** Uyg'otish so'rovi bir marta yuboriladi. */
let wakePromise = null;

/**
 * Servisni fon rejimida uyg'otadi — admin panel ochilganda chaqiriladi.
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

/**
 * Bonusni qo'lda beradi yoki ayiradi (SPEC 118).
 *
 * NEGA SERVIS ORQALI: `firestore.rules` `bonusBalance` ni hech kimga
 * ochmaydi — xodimga ham. Balans faqat servisda, transaction ichida
 * o'zgaradi va har safar audit logga tushadi.
 *
 * @param {{uid: string, amount: number, reason: string}} input
 * @returns {Promise<{bonusBalance: number, amount: number}>}
 */
export function giveBonus({ uid, amount, reason }) {
  return request('/api/admin/bonus', {
    method: 'POST',
    body: { uid, amount, reason }
  });
}

/**
 * Broadcast qabul qiluvchilari sonini oladi (yuborishdan oldin).
 * @param {string} audience - `all` | `active` | `sleeping`
 * @returns {Promise<{audience: string, total: number}>}
 */
export function getAudience(audience) {
  return request(`/api/admin/broadcast/audience?audience=${encodeURIComponent(audience)}`);
}

/**
 * Broadcast yuborishni boshlaydi (SPEC 119).
 *
 * Servis darhol javob qaytaradi va yuborishni FONDA davom ettiradi —
 * 1000 mijozga ~45 sekund ketadi (Telegram limiti). Holatni tarixdan
 * ko'rish mumkin.
 *
 * @param {{text: string, audience: string}} input
 * @returns {Promise<{id: string, total: number}>}
 */
export function sendBroadcast({ text, audience }) {
  return request('/api/admin/broadcast', {
    method: 'POST',
    body: { text, audience }
  });
}
