/**
 * Admin panelning ma'lumot qatlami.
 *
 * SPEC 5-bo'lim qoidasi: BARCHA Firestore chaqiruvi shu faylda.
 * Sahifalar `getFirebase()` ni ham, `sdk` ni ham ko'rmaydi.
 *
 * Nima to'g'ridan-to'g'ri Firestore'ga yoziladi va nima servis orqali
 * ketadi (SPEC 3-bo'lim):
 *  - `menu`, `branches`, `promocodes`, `banners`, `settings` → xodim
 *    bevosita yozadi;
 *  - `orders` → client YOZA OLMAYDI. Status o'zgarishi, kuryer tayinlash
 *    va rad etish Node servis orqali (`admin/js/api.js`).
 */

import { getFirebase } from './config.js';
import { createCache, withTimeout, watchGuard } from '../../js/cache.js';

/**
 * Admin keshi.
 *
 * NEGA KERAK: o'lchovda (1.5 s/so'rov taqlidi) admin panel bitta
 * seansda `menu/current` ni 4 marta, `branches` ni 3 marta o'qigan —
 * har sahifa o'tishida qaytadan. Har biri 1.2 sekundlik kutish edi.
 * Endi kesh bo'lsa sahifa tarmoqni umuman kutmaydi.
 */
const cache = createCache('pizza.admin.cache.v1');

/** Kesh muddatlari (ms) — xodim ma'lumoti tez o'zgarmaydi. */
const TTL = {
  staff: 5 * 60000,
  menu: 60000,
  branches: 60000,
  couriers: 20000,
  promos: 60000,
  reports: 5 * 60000
};

/** Ma'lumot o'zgargandan keyin keshni tashlaydi. */
export function dropCache(key) {
  cache.drop(key);
}

/** Chiqishda hammasini tozalaydi. */
export function clearCache() {
  cache.clear();
}

/* --------------------------------------------------------------- xodim */

/**
 * `staff/{uid}` hujjatini o'qiydi — kirish huquqi shu bilan aniqlanadi.
 * @param {string} uid
 * @returns {Promise<?object>}
 */
export async function getStaff(uid, onUpdate = null) {
  if (!uid) return null;
  return cache.swr(`staff.${uid}`, TTL.staff, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await withTimeout(sdk.getDoc(sdk.doc(dbx, 'staff', uid)), 'xodim');
    return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
  }, onUpdate);
}

/**
 * Keshdagi xodim hujjati — tarmoqsiz, darhol.
 *
 * Panel karkasini shu bilan ochamiz: rol faqat QAYSI BO'LIM
 * ko'rinishini hal qiladi, haqiqiy huquqni esa `firestore.rules`
 * beradi. Shuning uchun keshdagi rol bilan panelni ko'rsatish
 * xavfsiz — noto'g'ri bo'lsa fon tekshiruvi sessiyani yopadi.
 *
 * @param {string} uid
 * @returns {?object}
 */
export function peekStaff(uid) {
  return uid ? cache.peek(`staff.${uid}`) : null;
}

/* ------------------------------------------------------------ buyurtma */

/**
 * Faol buyurtmalarni real vaqtda kuzatadi (SPEC 106).
 *
 * Firestore'da `in` filtri va `orderBy` birga kompozit indeks talab
 * qiladi, shuning uchun sana bo'yicha oddiy so'rov olinadi va status
 * bo'yicha saralash brauzerda bajariladi — bir kunlik hajm kichik.
 *
 * @param {(orders: object[]) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {Function} obunani uzish
 */
export function watchActiveOrders(onChange, onError) {
  let stop = () => {};
  let cancelled = false;

  (async () => {
    try {
      const { dbx, sdk } = await getFirebase();
      // Bugungi va kechagi buyurtmalar yetarli — eskisi oqimda kerak emas
      const since = new Date(Date.now() - 36 * 3600000);
      const q = sdk.query(
        sdk.collection(dbx, 'orders'),
        sdk.where('createdAt', '>=', since),
        sdk.orderBy('createdAt', 'desc')
      );
      // `watchGuard` — birinchi snapshot kelmasa sahifa abadiy
      // kutmasin. Obuna uzilmaydi, kechikkan javob baribir ishlaydi.
      const off = watchGuard(
        (data, err) => sdk.onSnapshot(
          q,
          (snap) => data(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
          err
        ),
        onChange,
        (e) => onError && onError(e)
      );
      if (cancelled) off();
      else stop = off;
    } catch (e) {
      if (onError) onError(e);
    }
  })();

  return () => {
    cancelled = true;
    stop();
  };
}

/**
 * Berilgan kun oralig'idagi buyurtmalar (hisobot va dashboard uchun).
 * @param {Date} from
 * @param {Date} to
 * @returns {Promise<object[]>}
 */
export async function getOrdersBetween(from, to) {
  const { dbx, sdk } = await getFirebase();
  const snap = await withTimeout(sdk.getDocs(sdk.query(
    sdk.collection(dbx, 'orders'),
    sdk.where('createdAt', '>=', from),
    sdk.where('createdAt', '<', to)
  )), 'buyurtmalar');
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* -------------------------------------------------------------- kuryer */

/**
 * Barcha kuryerlar (kutilayotganlar bilan birga).
 * @returns {Promise<object[]>}
 */
export async function getCouriers(onUpdate = null) {
  return cache.swr('couriers', TTL.couriers, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await withTimeout(sdk.getDocs(sdk.collection(dbx, 'couriers')), 'kuryerlar');
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, onUpdate);
}

/**
 * Hali ilovaga kirmagan kuryerning vaqtinchalik hujjat ID si.
 *
 * Servisdagi `pendingId()` bilan BIR XIL bo'lishi shart
 * (`server/src/couriers.js`) — kuryer birinchi kirganda servis aynan
 * shu ID bo'yicha hujjatni topib `couriers/{uid}` ga ko'chiradi.
 *
 * @param {string} phone
 * @returns {string}
 */
export function courierPendingId(phone) {
  return `pending_${String(phone || '').replace(/\D/g, '')}`;
}

/**
 * Kuryerni yozadi.
 *
 * ID har doim tashqaridan beriladi: yangi kuryerda `pending_<telefon>`,
 * kirganida esa uning `uid` si. Shuning uchun bu yerda avtomatik ID
 * yaratilmaydi (filiallardan farqi shunda).
 *
 * @param {string} id
 * @param {object} data
 * @returns {Promise<string>}
 */
export async function saveCourier(id, data) {
  const { dbx, sdk } = await getFirebase();
  const ref = sdk.doc(dbx, 'couriers', id);
  await withTimeout(
    sdk.setDoc(ref, { ...data, updatedAt: sdk.serverTimestamp() }, { merge: true }),
    'kuryer'
  );
  cache.drop('couriers');
  writeAudit({ action: 'courier.save', target: `couriers/${ref.id}`, after: data });
  return ref.id;
}

/**
 * Kuryerni o'chiradi.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteCourier(id) {
  const { dbx, sdk } = await getFirebase();
  await withTimeout(sdk.deleteDoc(sdk.doc(dbx, 'couriers', id)), 'kuryer');
  cache.drop('couriers');
  writeAudit({ action: 'courier.delete', target: `couriers/${id}` });
}

/* ---------------------------------------------------------------- menyu */

/**
 * `menu/current` — bitta hujjat.
 * @returns {Promise<object>}
 */
export async function getMenu(onUpdate = null) {
  return cache.swr('menu', TTL.menu, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await withTimeout(sdk.getDoc(sdk.doc(dbx, 'menu', 'current')), 'menyu');
    return snap.exists()
      ? snap.data()
      : { version: 0, categories: [], products: [] };
  }, onUpdate);
}

/**
 * Menyuni chop etadi — versiya bir pog'ona oshadi.
 *
 * Mijoz ilovasi `version` o'zgarmasa Firestore'ga umuman murojaat
 * qilmaydi, shuning uchun versiyani oshirish MAJBURIY.
 *
 * @param {object} menu - {categories, products}
 * @returns {Promise<number>} yangi versiya
 */
export async function publishMenu(menu) {
  const { dbx, sdk } = await getFirebase();
  const version = Number(menu.version || 0) + 1;
  await withTimeout(sdk.setDoc(sdk.doc(dbx, 'menu', 'current'), {
    version,
    categories: menu.categories || [],
    products: menu.products || [],
    updatedAt: sdk.serverTimestamp()
  }), 'menyu');
  cache.drop('menu');
  writeAudit({
    action: 'menu.publish',
    target: 'menu/current',
    before: { version: Number(menu.version || 0) },
    after: {
      version,
      categories: (menu.categories || []).length,
      products: (menu.products || []).length
    }
  });
  return version;
}

/* -------------------------------------------------------------- filial */

/**
 * Barcha filiallar.
 * @returns {Promise<object[]>}
 */
export async function getBranches(onUpdate = null) {
  return cache.swr('branches', TTL.branches, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await withTimeout(sdk.getDocs(sdk.collection(dbx, 'branches')), 'filiallar');
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, onUpdate);
}

/**
 * Filialni yozadi (yangi bo'lsa yaratadi).
 * @param {?string} id - null bo'lsa yangi hujjat
 * @param {object} data
 * @returns {Promise<string>} filial id
 */
export async function saveBranch(id, data) {
  const { dbx, sdk } = await getFirebase();
  const ref = id
    ? sdk.doc(dbx, 'branches', id)
    : sdk.doc(sdk.collection(dbx, 'branches'));
  await withTimeout(
    sdk.setDoc(ref, { ...data, updatedAt: sdk.serverTimestamp() }, { merge: true }),
    'filial'
  );
  cache.drop('branches');
  writeAudit({ action: 'branch.save', target: `branches/${ref.id}`, after: data });
  return ref.id;
}

/**
 * Filialni o'chiradi.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteBranch(id) {
  const { dbx, sdk } = await getFirebase();
  await withTimeout(sdk.deleteDoc(sdk.doc(dbx, 'branches', id)), 'filial');
  cache.drop('branches');
  writeAudit({ action: 'branch.delete', target: `branches/${id}` });
}

/* ----------------------------------------------------------- promokod */

/**
 * Barcha promokodlar.
 * @returns {Promise<object[]>}
 */
export async function getPromos(onUpdate = null) {
  return cache.swr('promos', TTL.promos, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await withTimeout(sdk.getDocs(sdk.collection(dbx, 'promocodes')), 'promokodlar');
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }, onUpdate);
}

/**
 * Promokod mavjudmi — yangi kod yaratishdan oldin tekshiriladi.
 * @param {string} code
 * @returns {Promise<boolean>}
 */
export async function promoExists(code) {
  const { dbx, sdk } = await getFirebase();
  const snap = await withTimeout(sdk.getDoc(sdk.doc(dbx, 'promocodes', code)), 'promokod');
  return snap.exists();
}

/**
 * Promokodni yozadi. Hujjat ID = kodning o'zi (servis shunday o'qiydi).
 * @param {string} code
 * @param {object} data
 * @returns {Promise<void>}
 */
export async function savePromo(code, data) {
  const { dbx, sdk } = await getFirebase();
  await withTimeout(sdk.setDoc(sdk.doc(dbx, 'promocodes', code), data, { merge: true }), 'promokod');
  cache.drop('promos');
  writeAudit({ action: 'promo.save', target: `promocodes/${code}`, after: data });
}

/**
 * Promokodni o'chiradi.
 * @param {string} code
 * @returns {Promise<void>}
 */
export async function deletePromo(code) {
  const { dbx, sdk } = await getFirebase();
  await withTimeout(sdk.deleteDoc(sdk.doc(dbx, 'promocodes', code)), 'promokod');
  cache.drop('promos');
  writeAudit({ action: 'promo.delete', target: `promocodes/${code}` });
}

/* ------------------------------------------------------------- hisobot */

/**
 * Kunlik hisobotlar — ularni Node servis cron'i yozadi.
 * @param {number} [days=14]
 * @returns {Promise<object[]>} eskidan yangiga
 */
export async function getReports(days = 14, onUpdate = null) {
  return cache.swr(`reports.${days}`, TTL.reports, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await withTimeout(sdk.getDocs(sdk.collection(dbx, 'reports')), 'hisobotlar');
    const list = snap.docs.map((d) => ({ date: d.id, ...d.data() }));
    return list
      .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-days);
  }, onUpdate);
}

/* ---------------------------------------------------------- audit log */

/**
 * Audit yozuvini qo'shadi (SPEC 121).
 *
 * NEGA CLIENT YOZADI: menyu, filial, promokod, banner va stop-list ni
 * admin panel BEVOSITA Firestore'ga yozadi (SPEC 3-bo'lim), servis
 * orqali emas. Shuning uchun ular uchun yozuvni ham shu yer qo'shadi.
 * Servis bajaradigan amallar (bonus, broadcast) o'z yozuvini
 * `server/src/audit.js` orqali qo'yadi.
 *
 * `firestore.rules` faqat QO'SHISHGA ruxsat beradi va `uid` o'z
 * uid'iga teng bo'lishini talab qiladi — boshqa xodim nomidan yozib
 * bo'lmaydi, mavjud yozuvni esa hech kim o'zgartira olmaydi.
 *
 * Audit yozilmagani uchun ASOSIY amal buzilmasin — xato faqat logga.
 *
 * @param {{action: string, target?: string, before?: *, after?: *}} entry
 * @returns {Promise<void>}
 */
export async function writeAudit(entry) {
  try {
    const staff = getAuditActor();
    if (!staff) return;
    const { dbx, sdk } = await getFirebase();
    await sdk.addDoc(sdk.collection(dbx, 'auditLog'), {
      uid: staff.uid,
      staffName: staff.name || null,
      action: entry.action,
      target: entry.target || null,
      before: trimSnapshot(entry.before),
      after: trimSnapshot(entry.after),
      at: sdk.serverTimestamp(),
      source: 'admin'
    });
  } catch (e) {
    console.warn('[audit] yozilmadi:', e.message);
  }
}

/**
 * Audit yozuvini kim qoldirayotgani.
 *
 * `auth.js` ni import qilib bo'lmaydi — u `db.js` ni import qiladi va
 * halqa hosil bo'lardi. Shuning uchun joriy xodimni `auth.js` shu
 * yerga BERADI (`setAuditActor()`).
 */
let auditActor = null;

/**
 * Joriy xodimni belgilaydi (`admin/js/auth.js` chaqiradi).
 * @param {?{uid: string, name?: string}} staff
 */
export function setAuditActor(staff) {
  auditActor = staff;
}

/** @returns {?object} */
function getAuditActor() {
  return auditActor;
}

/**
 * Katta obyektni yozuvga sig'adigan holga keltiradi.
 *
 * `before`/`after` butun menyu bo'lishi mumkin (yuzlab mahsulot) —
 * to'liq saqlansa Firestore hujjat chegarasi (1 MB) yorilardi.
 *
 * @param {*} value
 * @returns {*}
 */
function trimSnapshot(value) {
  if (value === null || value === undefined) return null;
  let text;
  try {
    text = JSON.stringify(value);
  } catch (e) {
    return null;
  }
  if (text === undefined) return null;
  if (text.length <= 2000) return value;
  return { truncated: true, preview: text.slice(0, 2000) };
}

/**
 * Audit yozuvlarini oladi, yangisi birinchi.
 *
 * Filtr BRAUZERDA: sana va xodim bo'yicha birga so'rash kompozit
 * indeks talab qiladi, yozuvlar soni esa kichik.
 *
 * @param {{limit?: number}} [opts]
 * @returns {Promise<object[]>}
 */
export async function getAuditLog(opts = {}) {
  const { dbx, sdk } = await getFirebase();
  const snap = await withTimeout(sdk.getDocs(sdk.query(
    sdk.collection(dbx, 'auditLog'),
    sdk.orderBy('at', 'desc'),
    sdk.limit(opts.limit || 200)
  )), 'audit');
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ------------------------------------------------------------- banner */

/**
 * Barcha bannerlar, `order` bo'yicha (nofaollari ham).
 * @param {?Function} [onUpdate]
 * @returns {Promise<object[]>}
 */
export async function getBanners(onUpdate = null) {
  return cache.swr('banners', TTL.branches, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await withTimeout(sdk.getDocs(sdk.collection(dbx, 'banners')), 'bannerlar');
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }, onUpdate);
}

/**
 * Bannerni yozadi (yangi bo'lsa yaratadi).
 * @param {?string} id
 * @param {object} data
 * @returns {Promise<string>}
 */
export async function saveBanner(id, data) {
  const { dbx, sdk } = await getFirebase();
  const ref = id
    ? sdk.doc(dbx, 'banners', id)
    : sdk.doc(sdk.collection(dbx, 'banners'));
  await withTimeout(
    sdk.setDoc(ref, { ...data, updatedAt: sdk.serverTimestamp() }, { merge: true }),
    'banner'
  );
  cache.drop('banners');
  writeAudit({ action: 'banner.save', target: `banners/${ref.id}`, after: data });
  return ref.id;
}

/**
 * Bannerni o'chiradi.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteBanner(id) {
  const { dbx, sdk } = await getFirebase();
  await withTimeout(sdk.deleteDoc(sdk.doc(dbx, 'banners', id)), 'banner');
  cache.drop('banners');
  writeAudit({ action: 'banner.delete', target: `banners/${id}` });
}

/* -------------------------------------------------------------- mijoz */

/**
 * Mijozlar ro'yxati (SPEC 117).
 *
 * Buyurtma soni va summasi `users` hujjatidagi maydonlardan olinadi
 * (`orderCount`, `totalSpent`) — har mijoz uchun buyurtmalarni
 * sanash o'nlab so'rov degani bo'lardi.
 *
 * @param {?Function} [onUpdate]
 * @returns {Promise<object[]>}
 */
export async function getCustomers(onUpdate = null) {
  return cache.swr('customers', TTL.couriers, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await withTimeout(sdk.getDocs(sdk.collection(dbx, 'users')), 'mijozlar');
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  }, onUpdate);
}

/**
 * Bitta mijozning buyurtmalari, yangisi birinchi.
 * @param {string} uid
 * @returns {Promise<object[]>}
 */
export async function getCustomerOrders(uid) {
  const { dbx, sdk } = await getFirebase();
  const snap = await withTimeout(sdk.getDocs(sdk.query(
    sdk.collection(dbx, 'orders'),
    sdk.where('uid', '==', uid)
  )), 'buyurtmalar');
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => auditMillis(b.createdAt) - auditMillis(a.createdAt));
}

/**
 * Mijozning bonus tarixi, yangisi birinchi.
 * @param {string} uid
 * @returns {Promise<object[]>}
 */
export async function getBonusHistory(uid) {
  const { dbx, sdk } = await getFirebase();
  const snap = await withTimeout(
    sdk.getDocs(sdk.collection(dbx, 'users', uid, 'bonusHistory')),
    'bonus'
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => auditMillis(b.createdAt) - auditMillis(a.createdAt));
}

/**
 * Qora ro'yxatga qo'shadi yoki chiqaradi (SPEC 117).
 *
 * FAQAT `blocked` va `notes` yoziladi — `firestore.rules` xodimga
 * boshqa maydonni bermaydi. `bonusBalance`, `tier`, `totalSpent`
 * faqat servis orqali o'zgaradi (`admin/js/api.js` dagi `giveBonus`).
 *
 * @param {string} uid
 * @param {{blocked?: boolean, notes?: string}} patch
 * @returns {Promise<void>}
 */
export async function setCustomerFlags(uid, patch) {
  const { dbx, sdk } = await getFirebase();
  const safe = {};
  if (typeof patch.blocked === 'boolean') safe.blocked = patch.blocked;
  if (typeof patch.notes === 'string') safe.notes = patch.notes.slice(0, 500);
  safe.updatedAt = sdk.serverTimestamp();

  await withTimeout(sdk.setDoc(sdk.doc(dbx, 'users', uid), safe, { merge: true }), 'mijoz');
  cache.drop('customers');
  writeAudit({
    action: typeof patch.blocked === 'boolean'
      ? (patch.blocked ? 'customer.block' : 'customer.unblock')
      : 'customer.notes',
    target: `users/${uid}`,
    after: { blocked: patch.blocked, notes: patch.notes }
  });
}

/* --------------------------------------------------------- sozlamalar */

/**
 * `settings/global` hujjatini o'qiydi (SPEC 120).
 * @param {?Function} [onUpdate]
 * @returns {Promise<object>}
 */
export async function getSettings(onUpdate = null) {
  return cache.swr('settings', TTL.menu, async () => {
    const { dbx, sdk } = await getFirebase();
    const snap = await withTimeout(sdk.getDoc(sdk.doc(dbx, 'settings', 'global')), 'sozlamalar');
    return snap.exists() ? snap.data() : {};
  }, onUpdate);
}

/**
 * Sozlamalarni yozadi.
 * @param {object} data
 * @returns {Promise<void>}
 */
export async function saveSettings(data) {
  const { dbx, sdk } = await getFirebase();
  await withTimeout(sdk.setDoc(sdk.doc(dbx, 'settings', 'global'), {
    ...data,
    updatedAt: sdk.serverTimestamp()
  }, { merge: true }), 'sozlamalar');
  cache.drop('settings');
  writeAudit({ action: 'settings.save', target: 'settings/global', after: data });
}

/* ---------------------------------------------------------- broadcast */

/**
 * Yuborilgan broadcast xabarlari tarixi, yangisi birinchi (SPEC 119).
 * @returns {Promise<object[]>}
 */
export async function getBroadcasts() {
  const { dbx, sdk } = await getFirebase();
  const snap = await withTimeout(sdk.getDocs(sdk.query(
    sdk.collection(dbx, 'broadcasts'),
    sdk.orderBy('createdAt', 'desc'),
    sdk.limit(50)
  )), 'broadcast');
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Firestore sanasini millisekundga aylantiradi (saralash uchun).
 * @param {*} value
 * @returns {number}
 */
function auditMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}
