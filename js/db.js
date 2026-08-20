/**
 * Firestore bilan ishlaydigan YAGONA fayl.
 * Boshqa hech qaysi modulda `getDoc`, `setDoc`, `collection` chaqirilmaydi —
 * sahifalar faqat shu yerdagi funksiyalarni ishlatadi.
 *
 * 0-bosqichda bu fayl — shartnoma (kontrakt): funksiya nomlari, parametrlari
 * va qaytish qiymatlari belgilangan, tanasi keyingi bosqichlarda yoziladi:
 *   menyu → 1-bosqich, savat/checkout → 2, manzil/filial → 3,
 *   auth/foydalanuvchi → 4, buyurtma va treking → 5.
 */

/* eslint-disable no-unused-vars */

/* ------------------------------------------------------------- sozlamalar */

/**
 * `settings/global` hujjatini o'qiydi (kafolat daqiqasi, cashback foizi,
 * support telefoni). Natija localStorage'ga keshlanadi.
 * @returns {Promise<object>}
 */
export async function getSettings() {}

/* -------------------------------------------------------------------- menyu */

/**
 * `menu/current` — bitta hujjat, butun katalog.
 * Avval localStorage keshidagi `version` bilan solishtiriladi; versiya
 * o'zgarmagan bo'lsa Firestore'ga umuman murojaat qilinmaydi.
 * @param {{force?: boolean}} [opts] - keshni chetlab o'tish
 * @returns {Promise<{version: number, categories: object[], products: object[]}>}
 */
export async function getMenu(opts) {}

/**
 * Menyuning faqat `version` maydonini o'qiydi — kesh eskirganini tekshirish uchun.
 * @returns {Promise<number>}
 */
export async function getMenuVersion() {}

/* ------------------------------------------------------------------ filial */

/**
 * Faol filiallar ro'yxati (zona polygonlari, ish vaqti, stop-list bilan).
 * @returns {Promise<object[]>}
 */
export async function getBranches() {}

/**
 * Bitta filial hujjati.
 * @param {string} branchId
 * @returns {Promise<?object>}
 */
export async function getBranch(branchId) {}

/**
 * Filialdagi stop-list (tugagan mahsulot va variantlar ro'yxati).
 * @param {string} branchId
 * @returns {Promise<string[]>}
 */
export async function getStopList(branchId) {}

/* ----------------------------------------------------------------- banner */

/**
 * Amal qilish muddati o'tmagan faol bannerlar, `order` bo'yicha saralangan.
 * @returns {Promise<object[]>}
 */
export async function getBanners() {}

/* ---------------------------------------------------------- foydalanuvchi */

/**
 * `users/{uid}` hujjatini o'qiydi.
 * @param {string} uid
 * @returns {Promise<?object>}
 */
export async function getUser(uid) {}

/**
 * Profil maydonlarini yangilaydi (ism, tug'ilgan kun, til).
 * `bonusBalance`, `tier`, `totalSpent`, `blocked` — Security Rules taqiqlaydi.
 * @param {string} uid
 * @param {{name?: string, birthday?: string, lang?: string}} patch
 * @returns {Promise<void>}
 */
export async function updateUserProfile(uid, patch) {}

/**
 * Bonus tarixi (yig'ilgan / sarflangan / kuygan), yangisi birinchi.
 * @param {string} uid
 * @param {number} [limit=50]
 * @returns {Promise<object[]>}
 */
export async function getBonusHistory(uid, limit) {}

/* --------------------------------------------------------------- manzillar */

/**
 * Foydalanuvchining saqlangan manzillari.
 * @param {string} uid
 * @returns {Promise<object[]>}
 */
export async function getAddresses(uid) {}

/**
 * Yangi manzil qo'shadi.
 * @param {string} uid
 * @param {object} address - {label, address, lat, lng, apartment, entrance,
 *                            floor, intercom, comment}
 * @returns {Promise<string>} yaratilgan hujjat id'si
 */
export async function addAddress(uid, address) {}

/**
 * Manzilni tahrirlaydi.
 * @param {string} uid
 * @param {string} addressId
 * @param {object} patch
 * @returns {Promise<void>}
 */
export async function updateAddress(uid, addressId, patch) {}

/**
 * Manzilni o'chiradi.
 * @param {string} uid
 * @param {string} addressId
 * @returns {Promise<void>}
 */
export async function deleteAddress(uid, addressId) {}

/* --------------------------------------------------------------- buyurtma */

/**
 * Foydalanuvchining buyurtmalari tarixi, yangisi birinchi.
 * @param {string} uid
 * @param {number} [limit=20]
 * @returns {Promise<object[]>}
 */
export async function getOrders(uid, limit) {}

/**
 * Bitta buyurtma.
 * @param {string} orderId
 * @returns {Promise<?object>}
 */
export async function getOrder(orderId) {}

/**
 * Buyurtmani real-time kuzatadi (`onSnapshot`) — status stepper uchun.
 * @param {string} orderId
 * @param {(order: object) => void} onChange
 * @returns {() => void} obunani to'xtatuvchi funksiya
 */
export function watchOrder(orderId, onChange) {}

/**
 * Faol (yetkazilmagan) buyurtmani kuzatadi — bosh sahifadagi holat plashkasi.
 * @param {string} uid
 * @param {(orders: object[]) => void} onChange
 * @returns {() => void}
 */
export function watchActiveOrders(uid, onChange) {}

/**
 * Kuryer joylashuvini real-time kuzatadi.
 * @param {string} courierId
 * @param {(location: {lat: number, lng: number, at: *}) => void} onChange
 * @returns {() => void}
 */
export function watchCourier(courierId, onChange) {}

/* ---------------------------------------------------------------- baholash */

/**
 * Buyurtmaga baho yozadi (taom va kuryer alohida).
 * @param {string} orderId
 * @param {{food: number, courier: number, text?: string, photo?: string}} rating
 * @returns {Promise<void>}
 */
export async function saveRating(orderId, rating) {}

/**
 * Baholash rasmini Storage'ga yuklaydi va URL qaytaradi.
 * @param {File} file
 * @param {string} path - masalan `ratings/{orderId}/{fileName}`
 * @returns {Promise<string>} yuklab olish URL'i
 */
export async function uploadImage(file, path) {}
