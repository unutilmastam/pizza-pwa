/**
 * Global holat: savat, foydalanuvchi, til, mavzu, tanlangan manzil/filial.
 *
 * Qoidalar:
 *  - holat faqat shu fayldagi funksiyalar orqali o'zgaradi;
 *  - har o'zgarishda localStorage'ga yoziladi va obunachilar xabardor bo'ladi;
 *  - obunachi: `subscribe(fn)` → o'chirish uchun qaytgan funksiyani chaqir.
 */

import { STORAGE_KEYS, APP } from './config.js';
import { setLang as applyLang, detectLang } from './i18n.js';
import { uid, deepClone } from './utils.js';

/** @typedef {Object} CartItem
 * @property {string} key       savatdagi noyob kalit
 * @property {string} productId
 * @property {string} variantId
 * @property {string} name      tanlangan tildagi nom (ko'rsatish uchun)
 * @property {string} size
 * @property {string} dough
 * @property {Array<{id:string,name:string,price:number}>} addons
 * @property {Array<{id:string,name:string}>} removed
 * @property {number} qty
 * @property {number} unitPrice bitta dona narxi (addonlar bilan)
 * @property {string} [image]
 */

/** Boshlang'ich holat. */
function emptyState() {
  return {
    lang: APP.defaultLang,
    theme: 'system', // system | dark | light
    /** @type {CartItem[]} */
    cart: [],
    /** @type {?{uid:string, phone:string, name:string, bonusBalance:number, tier:string}} */
    user: null,
    /** Mehmon rejimi — auth'siz savat to'ldirish. */
    guest: true,
    /** @type {?object} tanlangan yetkazish manzili */
    address: null,
    /** @type {?string} tanlangan filial (pickup yoki zona bo'yicha) */
    branchId: null,
    /** delivery | pickup */
    orderType: 'delivery',
    /** @type {?string} qo'llangan promokod */
    promoCode: null,
    /** Checkout maydonlari — keyingi buyurtmada ham eslab qolinadi. */
    checkout: {
      paymentMethod: 'cash',
      changeFrom: null,
      cutlery: 1,
      comment: ''
    },
    /**
     * @type {?object} rasmiylashtirilgan, lekin hali yuborilmagan buyurtma.
     * Node servis 6-bosqichda ulanadi — shu paytgacha draft saqlanib turadi.
     */
    orderDraft: null
  };
}

let state = emptyState();
/** @type {Set<Function>} */
const listeners = new Set();
/** @type {?{item: CartItem, index: number}} oxirgi o'chirilgan element (undo uchun) */
let lastRemoved = null;

/**
 * Holatni localStorage'dan tiklaydi va tilni qo'llaydi.
 * Ilova ishga tushganda BIR MARTA chaqiriladi.
 * @returns {object} joriy holat
 */
export function initState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.state);
    if (raw) state = { ...emptyState(), ...JSON.parse(raw) };
  } catch (e) {
    // Buzilgan ma'lumot — toza holatdan boshlaymiz
    state = emptyState();
  }
  if (!APP.langs.includes(state.lang)) state.lang = detectLang();
  applyLang(state.lang);
  applyTheme(state.theme);
  return state;
}

/**
 * Joriy holat nusxasini qaytaradi (tashqaridan o'zgartirib bo'lmasin).
 * @returns {object}
 */
export function getState() {
  return deepClone(state);
}

/**
 * Holat o'zgarishiga obuna bo'ladi. Obuna paytida darhol bir marta chaqiriladi.
 * @param {(state: object) => void} fn
 * @returns {() => void} obunani bekor qiluvchi funksiya
 */
export function subscribe(fn) {
  listeners.add(fn);
  fn(getState());
  return () => listeners.delete(fn);
}

/** Holatni saqlaydi va obunachilarni xabardor qiladi. */
function commit() {
  try {
    localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(state));
  } catch (e) {
    // Xotira to'lgan bo'lishi mumkin — ilova ishlashda davom etadi
  }
  const snapshot = getState();
  listeners.forEach((fn) => fn(snapshot));
}

/* ------------------------------------------------------------------ til va mavzu */

/**
 * Interfeys tilini almashtiradi.
 * @param {string} lang - uz | ru | en
 */
export function setLang(lang) {
  state.lang = applyLang(lang);
  commit();
}

/**
 * Mavzuni belgilaydi.
 * @param {'system'|'dark'|'light'} theme
 */
export function setTheme(theme) {
  state.theme = ['system', 'dark', 'light'].includes(theme) ? theme : 'system';
  applyTheme(state.theme);
  commit();
}

/**
 * Mavzuni DOM'ga qo'llaydi (`data-theme` atributi).
 * @param {string} theme
 */
function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

/* ------------------------------------------------------------ foydalanuvchi */

/**
 * Foydalanuvchini o'rnatadi (login) yoki tozalaydi (logout).
 * @param {?object} user
 */
export function setUser(user) {
  state.user = user || null;
  state.guest = !user;
  commit();
}

/**
 * Foydalanuvchi maydonlarini qisman yangilaydi (ism, bonus, daraja).
 * @param {object} patch
 */
export function updateUser(patch) {
  if (!state.user) return;
  state.user = { ...state.user, ...patch };
  commit();
}

/* ------------------------------------------------------------ manzil va filial */

/**
 * Yetkazish manzilini tanlaydi.
 * @param {?object} address
 */
export function setAddress(address) {
  state.address = address || null;
  commit();
}

/**
 * Filialni tanlaydi.
 * @param {?string} branchId
 */
export function setBranch(branchId) {
  state.branchId = branchId || null;
  commit();
}

/**
 * Buyurtma turini belgilaydi.
 * @param {'delivery'|'pickup'} type
 */
export function setOrderType(type) {
  state.orderType = type === 'pickup' ? 'pickup' : 'delivery';
  commit();
}

/**
 * Promokodni saqlaydi yoki olib tashlaydi.
 * Kod bu yerda TEKSHIRILMAYDI — `promocodes` kolleksiyasini client o'qiy
 * olmaydi, uni buyurtma yaratishda Node servis tekshiradi (SPEC 3-bo'lim).
 * @param {?string} code
 */
export function setPromoCode(code) {
  state.promoCode = code ? String(code).trim().toUpperCase() : null;
  commit();
}

/**
 * Checkout maydonlarini qisman yangilaydi.
 * @param {{paymentMethod?: string, changeFrom?: ?number, cutlery?: number,
 *          comment?: string}} patch
 */
export function setCheckout(patch) {
  state.checkout = { ...state.checkout, ...patch };
  commit();
}

/**
 * Rasmiylashtirilgan buyurtma draftini saqlaydi.
 * @param {?object} draft
 */
export function setOrderDraft(draft) {
  state.orderDraft = draft || null;
  commit();
}

/* ------------------------------------------------------------------- savat */

/**
 * Savat elementining o'ziga xos kalitini yasaydi — bir xil konfiguratsiya
 * qayta qo'shilganda yangi qator emas, miqdor oshadi.
 * @param {CartItem} item
 * @returns {string}
 */
function signature(item) {
  const addons = (item.addons || []).map((a) => a.id).sort().join('.');
  const removed = (item.removed || []).map((r) => r.id).sort().join('.');
  return `${item.productId}|${item.variantId}|${addons}|${removed}`;
}

/**
 * Savatga mahsulot qo'shadi. Bir xil konfiguratsiya bo'lsa miqdorni oshiradi.
 * @param {Omit<CartItem,'key'>} item
 * @returns {CartItem} savatdagi yakuniy element
 */
export function addToCart(item) {
  const incoming = { qty: 1, addons: [], removed: [], ...deepClone(item) };
  const sig = signature(incoming);
  const existing = state.cart.find((c) => signature(c) === sig);
  if (existing) {
    existing.qty += incoming.qty;
  } else {
    incoming.key = uid();
    state.cart.push(incoming);
  }
  commit();
  return deepClone(existing || incoming);
}

/**
 * Savat elementi miqdorini o'zgartiradi. 0 va undan past bo'lsa o'chiradi.
 * @param {string} key
 * @param {number} qty
 */
export function setQty(key, qty) {
  const item = state.cart.find((c) => c.key === key);
  if (!item) return;
  if (qty <= 0) {
    removeFromCart(key);
    return;
  }
  item.qty = Math.min(99, Math.floor(qty));
  commit();
}

/**
 * Savatdan o'chiradi. Undo uchun oxirgi o'chirilgan element saqlanadi.
 * @param {string} key
 */
export function removeFromCart(key) {
  const index = state.cart.findIndex((c) => c.key === key);
  if (index === -1) return;
  lastRemoved = { item: deepClone(state.cart[index]), index };
  state.cart.splice(index, 1);
  commit();
}

/**
 * Oxirgi o'chirilgan elementni o'z o'rniga qaytaradi.
 * @returns {boolean} qaytarish bajarildimi
 */
export function undoRemove() {
  if (!lastRemoved) return false;
  state.cart.splice(Math.min(lastRemoved.index, state.cart.length), 0, lastRemoved.item);
  lastRemoved = null;
  commit();
  return true;
}

/** Savatni butunlay bo'shatadi (buyurtma yaratilgach). */
export function clearCart() {
  state.cart = [];
  state.promoCode = null;
  lastRemoved = null;
  commit();
}

/**
 * Savatdagi umumiy dona soni — pastki navdagi badge uchun.
 * @returns {number}
 */
export function cartCount() {
  return state.cart.reduce((sum, i) => sum + i.qty, 0);
}

/**
 * Savatdagi mahsulotlar summasi (yetkazish va chegirmasiz).
 * @returns {number}
 */
export function cartSubtotal() {
  return state.cart.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
}
