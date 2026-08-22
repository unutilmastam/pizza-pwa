/**
 * Geolokatsiya (SPEC 127).
 *
 * QOIDA (foydalanuvchi qarori): Firestore'ga yozish UCHALA shart birga
 * bajarilgandagina bo'ladi —
 *   1. smena OCHIQ;
 *   2. oxirgi yozuvdan 50 metrdan ORTIQ siljigan;
 *   3. ilova OLD PLANDA (`visibilitychange` bilan to'xtaydi);
 * va qo'shimcha: kuryerda `on_way` statusidagi buyurtma bo'lishi shart.
 *
 * NEGA SHUNCHA SHART: har 15 sekundda so'zsiz yozilsa bitta kuryer
 * 8 soatlik smenada ~2000 yozuv beradi. Bepul Firestore kvotasi
 * 20 000 yozuv/kun — 8–10 kuryerda kvota tugab qolardi. Shartlar bilan
 * kuryer to'xtab turganda, ilova fonda bo'lganda yoki yo'lda buyurtma
 * bo'lmaganda yozuv umuman ketmaydi.
 *
 * Taymer koordinatani har 15 sekundda TEKSHIRADI, lekin yozuv faqat
 * shartlar bajarilganda bo'ladi.
 */

import { COURIER } from './config.js';
import { saveLocation } from './db.js';

/** @type {?number} tekshiruv taymeri */
let timer = null;

/** @type {?string} joriy kuryer uid */
let courierUid = null;

/** Oxirgi YOZILGAN nuqta — masofa shundan hisoblanadi. */
let lastSaved = null;

/** Tashqaridan beriladigan holat: smena ochiqmi, yo'lda buyurtma bormi. */
let state = { onShift: false, hasActiveDelivery: false };

/** Holat o'zgarishini ekranga yetkazuvchi. */
let report = () => {};

/** Oxirgi holat kaliti — takroriy xabar bermaslik uchun. */
let lastStatus = '';

/**
 * Ikki koordinata orasidagi masofa (metr) — haversine.
 * @param {{lat: number, lng: number}} a
 * @param {{lat: number, lng: number}} b
 * @returns {number}
 */
export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Holatni bir marta xabar qiladi (takrorlanmaydi).
 * @param {string} key - i18n kaliti
 */
function say(key) {
  if (key === lastStatus) return;
  lastStatus = key;
  report(key);
}

/**
 * Joriy koordinatani so'raydi.
 * @returns {Promise<{lat: number, lng: number}>}
 */
function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error('geolocation yo\'q'), { code: 'unavailable' }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (error) => reject(error),
      {
        enableHighAccuracy: COURIER.geo.enableHighAccuracy,
        timeout: COURIER.geo.timeoutMs,
        maximumAge: COURIER.geo.maximumAge
      }
    );
  });
}

/**
 * Bitta tekshiruv: shartlarni ko'radi va kerak bo'lsa yozadi.
 * @returns {Promise<void>}
 */
async function tick() {
  // 1-shart: smena ochiq
  if (!state.onShift) {
    say('geo.off');
    return;
  }
  // Qo'shimcha shart: yo'lda buyurtma bor
  if (!state.hasActiveDelivery) {
    say('geo.idle');
    return;
  }
  // 3-shart: ilova old planda
  if (document.visibilityState !== 'visible') {
    say('geo.background');
    return;
  }

  let point;
  try {
    point = await currentPosition();
  } catch (error) {
    // Ruxsat berilmasa ilova buzilmaydi — faqat ogohlantirish
    const denied = error && (error.code === 1 || error.code === 'denied');
    say(denied ? 'geo.denied' : 'geo.unavailable');
    return;
  }

  // 2-shart: 50 metrdan ortiq siljish
  if (lastSaved && distanceMeters(lastSaved, point) < COURIER.geo.minDistanceMeters) {
    say('geo.on');
    return;
  }

  try {
    await saveLocation(courierUid, point);
    lastSaved = point;
    try {
      localStorage.setItem(COURIER.storage.lastGeo, JSON.stringify(point));
    } catch (e) {
      // Kesh ixtiyoriy
    }
    say('geo.on');
  } catch (e) {
    console.warn('[geo] joylashuv yozilmadi:', e.message);
  }
}

/**
 * Kuzatuvni boshlaydi.
 *
 * @param {{uid: string, onStatus?: (key: string) => void}} cfg
 */
export function startGeo(cfg) {
  stopGeo();
  courierUid = cfg.uid;
  report = cfg.onStatus || (() => {});
  lastStatus = '';

  try {
    const saved = JSON.parse(localStorage.getItem(COURIER.storage.lastGeo) || 'null');
    if (saved && Number.isFinite(saved.lat)) lastSaved = saved;
  } catch (e) {
    lastSaved = null;
  }

  timer = setInterval(() => { tick(); }, COURIER.geo.intervalMs);
  document.addEventListener('visibilitychange', onVisibility);
  tick();
}

/** Ilova old planga qaytganda darhol tekshiramiz. */
function onVisibility() {
  if (document.visibilityState === 'visible') tick();
  else say('geo.background');
}

/**
 * Shartlarni yangilaydi (smena yoki buyurtmalar o'zgarganda).
 * @param {{onShift?: boolean, hasActiveDelivery?: boolean}} patch
 */
export function updateGeoState(patch) {
  const before = `${state.onShift}|${state.hasActiveDelivery}`;
  state = { ...state, ...patch };
  // Shart yangi bajarildi — 15 sekund kutmasdan tekshiramiz
  if (timer && `${state.onShift}|${state.hasActiveDelivery}` !== before) tick();
}

/** Kuzatuvni to'xtatadi. */
export function stopGeo() {
  if (timer) clearInterval(timer);
  timer = null;
  document.removeEventListener('visibilitychange', onVisibility);
  state = { onShift: false, hasActiveDelivery: false };
  lastStatus = '';
}

/**
 * Sinov uchun: oxirgi yozilgan nuqtani tozalaydi.
 * @returns {?object}
 */
export function lastSavedPoint() {
  return lastSaved;
}
