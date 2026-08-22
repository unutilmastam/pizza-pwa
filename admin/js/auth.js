/**
 * Admin autentifikatsiyasi: Firebase Auth + `staff` kolleksiyasida rol.
 *
 * Kirish mijoz ilovasidagi bilan bir xil OTP yo'lidan ketadi
 * (`/api/auth/send-otp` → `/api/auth/verify-otp` → `signInWithCustomToken`),
 * lekin undan keyin YANA BIR tekshiruv bor: `staff/{uid}` hujjati bo'lishi
 * va `active !== false` bo'lishi shart. Hujjat yo'q bo'lsa sessiya
 * darhol yopiladi — mijoz raqami bilan admin panelga kirib bo'lmaydi.
 *
 * DIQQAT: bu tekshiruv INTERFEYSNI yopadi, ma'lumotni emas. Haqiqiy
 * himoya Firestore qoidalari va servisdagi rol tekshiruvi bilan
 * qo'yiladi (8-bosqich).
 */

import { getFirebase } from './config.js';
import { ROLE_SECTIONS } from './config.js';
import { getStaff, peekStaff, clearCache } from './db.js';
import { request } from './api.js';

/** @type {?object} joriy xodim: {uid, role, name, branchIds, active} */
let staff = null;

/** @type {Set<Function>} holat o'zgarishini kuzatuvchilar */
const listeners = new Set();

/** @type {?Function} Firebase kuzatuvchisini uzish */
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

/**
 * Joriy xodim.
 * @returns {?object}
 */
export function getCurrentStaff() {
  return staff;
}

/**
 * Xodim shu bo'limni ko'ra oladimi.
 * @param {string} section
 * @returns {boolean}
 */
export function canSee(section) {
  if (!staff) return false;
  const allowed = ROLE_SECTIONS[staff.role] || [];
  return allowed.includes(section);
}

/**
 * Rol uchun ochiq bo'limlar ro'yxati.
 * @returns {string[]}
 */
export function allowedSections() {
  return staff ? (ROLE_SECTIONS[staff.role] || []) : [];
}

/**
 * Holat o'zgarishiga obuna.
 * @param {(staff: ?object) => void} fn
 * @returns {Function} obunani uzish
 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Kuzatuvchilarga xabar beradi. */
function emit() {
  listeners.forEach((fn) => fn(staff));
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
 * Kodni tekshiradi, sessiyani ochadi va rolni yuklaydi.
 *
 * Rol topilmasa sessiya yopiladi va `no-staff` xatosi tashlanadi —
 * ekranda "bu raqam xodim emas" deb ko'rsatiladi.
 *
 * @param {string} phone
 * @param {string} code
 * @returns {Promise<object>} xodim hujjati
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
  const credential = await sdk.signInWithCustomToken(auth, token);
  return loadStaff(credential.user.uid, normalized);
}

/**
 * `staff/{uid}` ni o'qiydi. Huquq bo'lmasa sessiyani yopadi.
 * @param {string} uid
 * @param {?string} [phone]
 * @returns {Promise<object>}
 */
async function loadStaff(uid, phone = null) {
  const doc = await getStaff(uid);

  if (!doc) {
    await signOut();
    const error = new Error('Xodim topilmadi');
    error.code = 'no-staff';
    throw error;
  }
  if (doc.active === false) {
    await signOut();
    const error = new Error('Hisob o\'chirilgan');
    error.code = 'staff-disabled';
    throw error;
  }
  if (!(ROLE_SECTIONS[doc.role] || []).length) {
    // Masalan kuryer: roli bor, lekin admin panelda ko'radigan bo'limi yo'q
    await signOut();
    const error = new Error('Bu rol uchun panel yopiq');
    error.code = 'role-no-access';
    throw error;
  }

  staff = { ...doc, uid, phone: phone || doc.phone || '' };
  emit();
  return staff;
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
  // Keshdagi rol qolib ketmasin — boshqa xodim shu qurilmadan kirsa
  // eski bo'limlarni ko'rib qolardi
  clearCache();
  staff = null;
  emit();
}

/**
 * Ilova ochilganda sessiyani tiklaydi.
 *
 * Firebase sessiyani o'zi eslab qoladi; shu paytda rol qaytadan
 * o'qiladi — administrator rolni bekor qilgan bo'lsa xodim darhol
 * chiqib qoladi.
 *
 * @returns {Promise<?object>} xodim yoki null
 */
export function initAuth() {
  return new Promise((resolve) => {
    getFirebase().then(({ auth, sdk }) => {
      let settled = false;

      unwatch = sdk.onAuthStateChanged(auth, async (user) => {
        if (!user) {
          if (staff) {
            staff = null;
            emit();
          }
          if (!settled) {
            settled = true;
            resolve(null);
          }
          return;
        }
        // KESHDAGI ROL BILAN DARHOL OCHAMIZ.
        //
        // O'lchovda (1.5 s/so'rov) `getDoc(staff)` panelni 3 sekund
        // ushlab turardi — foydalanuvchi bo'sh ekranga qarardi.
        // Rol faqat QAYSI BO'LIM ko'rinishini hal qiladi; haqiqiy
        // huquqni `firestore.rules` beradi, shuning uchun keshdagi
        // rol bilan panelni ochish xavfsiz. Tekshiruv fonda ketadi
        // va rol o'zgargan bo'lsa sessiya yopiladi.
        const cached = peekStaff(user.uid);
        if (cached && !settled) {
          staff = cached;
          settled = true;
          emit();
          resolve(cached);
          loadStaff(user.uid, user.phoneNumber).catch((e) => {
            console.warn('[auth] fon tekshiruvi:', e.code || e.message);
          });
          return;
        }

        try {
          const doc = await loadStaff(user.uid, user.phoneNumber);
          if (!settled) {
            settled = true;
            resolve(doc);
          }
        } catch (e) {
          console.warn('[auth] rol yuklanmadi:', e.code || e.message);
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
  if (code === 'no-staff') return 'auth.noStaff';
  if (code === 'staff-disabled') return 'auth.staffDisabled';
  if (code === 'role-no-access') return 'auth.roleCourier';
  if (code === 'timeout' || code === 'network') return 'auth.networkError';
  return 'app.error';
}
