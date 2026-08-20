/**
 * Umumiy yordamchi funksiyalar: narx, sana, debounce, geometriya.
 * Bu faylda DOM ham, Firestore ham yo'q — faqat sof funksiyalar.
 */

import { t, getLang } from './i18n.js';

/**
 * Narxni `125 000 so'm` ko'rinishida formatlaydi.
 * @param {number} value - summa (UZS)
 * @param {boolean} [withUnit=true] - valyuta qo'shilsinmi
 * @returns {string}
 */
export function formatPrice(value, withUnit = true) {
  const n = Math.round(Number(value) || 0);
  const text = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const signed = (n < 0 ? '−' : '') + text;
  return withUnit ? `${signed} ${t('unit.sum')}` : signed;
}

/**
 * Sanani odam o'qiydigan ko'rinishga keltiradi.
 * Bugun/kecha bo'lsa — faqat vaqt bilan.
 * @param {Date|number|string|{seconds:number}} input - Date, ms, ISO yoki Firestore Timestamp
 * @param {{withTime?: boolean}} [opts]
 * @returns {string}
 */
export function formatDate(input, opts = {}) {
  const withTime = opts.withTime !== false;
  const date = toDate(input);
  if (!date) return '';

  const locale = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' }[getLang()] || 'uz-UZ';
  const time = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  });

  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (isSameDay(date, today)) return withTime ? `${t('common.today')}, ${time}` : t('common.today');
  if (isSameDay(date, yesterday)) {
    return withTime ? `${t('common.yesterday')}, ${time}` : t('common.yesterday');
  }

  const day = date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric'
  });
  return withTime ? `${day}, ${time}` : day;
}

/**
 * Turli formatdagi sanani Date obyektiga aylantiradi.
 * @param {Date|number|string|{seconds:number}|{toDate:Function}} input
 * @returns {Date|null}
 */
export function toDate(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input) ? null : input;
  if (typeof input === 'object' && typeof input.toDate === 'function') return input.toDate();
  if (typeof input === 'object' && typeof input.seconds === 'number') {
    return new Date(input.seconds * 1000);
  }
  const d = new Date(input);
  return isNaN(d) ? null : d;
}

/**
 * Ikki sana bir kunga tegishlimi.
 * @param {Date} a
 * @param {Date} b
 * @returns {boolean}
 */
export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/**
 * Qolgan vaqtni `12:05` ko'rinishida qaytaradi (kafolat taymeri uchun).
 * @param {number} ms - millisekund
 * @returns {string}
 */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const min = String(Math.floor(total / 60)).padStart(2, '0');
  const sec = String(total % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

/**
 * Funksiyani kechiktiradi — oxirgi chaqiruvdan `wait` ms o'tgach ishlaydi.
 * Qidiruv inputi uchun.
 * @param {Function} fn
 * @param {number} [wait=300]
 * @returns {Function & {cancel: Function}}
 */
export function debounce(fn, wait = 300) {
  let timer = null;
  const wrapped = function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

/**
 * Funksiyani chastotasini cheklaydi — `wait` ms ichida bir marta ishlaydi.
 * Scroll-spy uchun.
 * @param {Function} fn
 * @param {number} [wait=100]
 * @returns {Function}
 */
export function throttle(fn, wait = 100) {
  let last = 0;
  let timer = null;
  return function (...args) {
    const now = Date.now();
    const rest = wait - (now - last);
    if (rest <= 0) {
      clearTimeout(timer);
      timer = null;
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, rest);
    }
  };
}

/**
 * Nuqta ko'pburchak ichidami — ray casting algoritmi.
 * Yetkazish zonasini tekshirish uchun.
 * @param {[number, number]} point - [lat, lng]
 * @param {Array<[number, number]>} polygon - [[lat, lng], ...]
 * @returns {boolean}
 */
export function pointInPolygon(point, polygon) {
  if (!Array.isArray(point) || !Array.isArray(polygon) || polygon.length < 3) return false;
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect = (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Ikki koordinata orasidagi masofa (km) — haversine formulasi.
 * Filiallarni masofa bo'yicha saralash uchun.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} kilometr
 */
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371; // Yer radiusi, km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Telefon raqamni `+998 90 123 45 67` ko'rinishida formatlaydi.
 * @param {string} phone - raqamlar yoki +998... ko'rinishida
 * @returns {string}
 */
export function formatPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '').replace(/^998/, '');
  const p = d.slice(0, 9);
  const parts = [p.slice(0, 2), p.slice(2, 5), p.slice(5, 7), p.slice(7, 9)].filter(Boolean);
  return parts.length ? `+998 ${parts.join(' ')}` : '+998 ';
}

/**
 * HTML maxsus belgilarini xavfsizlantiradi.
 * Foydalanuvchi matnini innerHTML ichiga qo'yishdan oldin majburiy.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

/**
 * Qisqa noyob ID (savat elementlari, mahalliy obyektlar uchun).
 * @returns {string}
 */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Sonni chegara ichida ushlaydi.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Qidiruv uchun matnni normallashtiradi (kichik harf, ortiqcha bo'shliqsiz).
 * @param {string} text
 * @returns {string}
 */
export function normalize(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Chuqur nusxa — savat elementini o'zgartirishdan oldin.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function deepClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

/**
 * Haptic feedback — iPhone'da qo'llab-quvvatlanmasa jim o'tadi.
 * @param {number|number[]} [pattern=12]
 */
export function haptic(pattern = 12) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}
