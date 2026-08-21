/**
 * Geometriya — yetkazish zonasini tekshirish.
 *
 * Client'dagi `js/utils.js` bilan bir xil algoritm (ray casting), lekin
 * servis brauzer kodiga bog'liq bo'lmasligi uchun alohida yozilgan.
 *
 * DIQQAT: polygon nuqtalari OBYEKT ko'rinishida — `{lat, lng}`.
 * Firestore ichma-ich massivni qabul qilmaydi.
 */

/**
 * Nuqtani `[lat, lng]` juftligiga keltiradi.
 * @param {*} value
 * @returns {?[number, number]}
 */
function toLatLng(value) {
  if (Array.isArray(value)) {
    const [lat, lng] = value;
    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? [Number(lat), Number(lng)]
      : null;
  }
  if (value && typeof value === 'object') {
    const lat = value.lat ?? value.latitude;
    const lng = value.lng ?? value.lon ?? value.longitude;
    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? [Number(lat), Number(lng)]
      : null;
  }
  return null;
}

/**
 * Nuqta ko'pburchak ichidami.
 * @param {*} point
 * @param {Array<*>} polygon
 * @returns {boolean}
 */
export function pointInPolygon(point, polygon) {
  const target = toLatLng(point);
  if (!target || !Array.isArray(polygon) || polygon.length < 3) return false;

  const ring = polygon.map(toLatLng);
  if (ring.some((p) => p === null)) return false;

  const [x, y] = target;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Ikki koordinata orasidagi masofa (km).
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number}
 */
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Nuqta uchun mos filial va zonani topadi.
 *
 * @param {{lat: number, lng: number}} point
 * @param {Array<object>} branches
 * @param {?string} [preferredBranchId] - client tanlagan filial
 * @returns {?{branch: object, zone: object}}
 */
export function findZone(point, branches, preferredBranchId = null) {
  const candidates = branches.filter((b) => b.active !== false);
  const ordered = preferredBranchId
    ? [...candidates].sort((a, b) => (b.id === preferredBranchId ? 1 : 0) - (a.id === preferredBranchId ? 1 : 0))
    : candidates;

  for (const branch of ordered) {
    for (const zone of branch.zones || []) {
      if (pointInPolygon(point, zone.polygon)) return { branch, zone };
    }
  }
  return null;
}
