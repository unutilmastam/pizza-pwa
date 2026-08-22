/**
 * Kuryer ilovasi konfiguratsiyasi (SPEC 122–128).
 *
 * Firebase sozlamalari va servis manzili MIJOZ ILOVASIDAN olinadi —
 * ikkita joyda saqlansa ular ajralib ketadi.
 */

export { FIREBASE_CONFIG, API_BASE, getFirebase } from '../../js/config.js';

export const COURIER = {
  /** Kuryer o'zi qo'ya oladigan statuslar (SPEC 124). */
  statuses: ['on_way', 'delivered'],

  /**
   * Kuryerga ko'rinadigan faol statuslar. `packing` — buyurtma hali
   * oshxonada, lekin kuryer uni ko'rib turishi kerak (yo'lga chiqishga
   * tayyorlanadi).
   */
  activeStatuses: ['packing', 'on_way'],

  /* ------------------------------------------------- geolokatsiya */

  /**
   * GEOLOKATSIYA QOIDASI (foydalanuvchi qarori).
   *
   * Firestore'ga yozish UCHALA shart birga bajarilgandagina bo'ladi:
   *   1. smena ochiq;
   *   2. oxirgi yozuvdan `minDistanceMeters` dan ortiq siljigan;
   *   3. ilova old planda (`visibilitychange` bilan to'xtaydi);
   * va qo'shimcha — kuryerda `on_way` statusidagi buyurtma bo'lishi shart.
   *
   * NEGA: har 15 sekundda so'zsiz yozilsa, bitta kuryer 8 soatlik
   * smenada ~2000 yozuv beradi. Bepul Firestore kvotasi 20 000
   * yozuv/kun — 8–10 kuryerda kvota tugab qolardi. Bu shartlar bilan
   * kuryer to'xtab turganda yoki yo'lda bo'lmaganda yozuv ketmaydi.
   */
  geo: {
    /** Koordinatani tekshirish oralig'i (ms). */
    intervalMs: 15000,
    /** Shundan kam siljishda yozilmaydi (metr). */
    minDistanceMeters: 50,
    /** `getCurrentPosition` kutish chegarasi (ms). */
    timeoutMs: 10000,
    /**
     * Yuqori aniqlik batareyani tez yeydi. Yetkazish uchun oddiy
     * aniqlik yetarli — GPS doim yonib turmaydi.
     */
    enableHighAccuracy: false,
    /** Shu yoshdagi koordinata qayta ishlatiladi (ms). */
    maximumAge: 10000
  },

  /* ------------------------------------------------------ xarita */

  /**
   * Yandex Navigator deep link. Ilova o'rnatilmagan bo'lsa hech narsa
   * bo'lmaydi — shuning uchun `mapsFallback` havolasi ham beriladi.
   */
  naviDeepLink: 'yandexnavi://build_route_on_map?lat_to={lat}&lon_to={lng}',
  mapsFallback: 'https://yandex.uz/maps/?rtext=~{lat},{lng}&rtt=auto',

  /** localStorage kalitlari. */
  storage: {
    lang: 'pizza.courier.lang',
    theme: 'pizza.courier.theme',
    lastGeo: 'pizza.courier.lastgeo'
  },

  langs: [
    { code: 'uz', label: "O'zbekcha" },
    { code: 'ru', label: 'Русский' }
  ],
  defaultLang: 'uz'
};
