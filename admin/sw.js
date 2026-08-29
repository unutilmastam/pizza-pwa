/**
 * Admin panel service worker.
 *
 * Mijoz ilovasidagi SW dan JIDDIY farq qiladi: u "keshdan ber, fonda
 * yangila" (stale-while-revalidate) tamoyilida ishlaydi, bu esa admin
 * uchun XAVFLI bo'lardi — xodim eski menyu yoki eski kod bilan ishlab
 * qolishi mumkin. Shuning uchun bu yerda TARMOQ BIRINCHI: kesh faqat
 * internet uzilganda zaxira sifatida ishlatiladi.
 *
 * Scope: `/pizza-pwa/admin/`. Ildizdagi SW ning scope'i kengroq
 * (`/pizza-pwa/`), lekin brauzer eng aniq mos keladigan ro'yxatdan
 * o'tishni tanlaydi, shuning uchun admin sahifalarini aynan shu SW
 * boshqaradi. Ildizdagi SW ham `/admin/` yo'lini chetlab o'tadi.
 */

const VERSION = 'v4';
const SHELL_CACHE = `pizza-admin-${VERSION}`;

/**
 * Hech qachon keshlanmaydigan fayllar.
 * `config.js` keshlansa Firebase kalitlari va API manzili eski holida
 * qolib ketadi.
 */
const NEVER_CACHE = ['/js/config.js'];

/** Birinchi o'rnatishda keshlanadigan karkas. */
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/admin.css',
  './js/app.js',
  './js/i18n.js',
  './js/ui.js',
  './js/db.js',
  './js/api.js',
  './js/auth.js',
  './js/pages/login.js',
  './js/pages/dashboard.js',
  './js/pages/orders.js',
  './js/pages/kds.js',
  './js/pages/menu.js',
  './js/pages/branches.js',
  './js/pages/couriers.js',
  './js/pages/banners.js',
  './js/pages/customers.js',
  './js/pages/broadcast.js',
  './js/pages/settings.js',
  './js/pages/audit.js',
  './js/pages/promos.js',
  './js/pages/reports.js',
  '../js/router.js',
  '../js/cache.js',
  '../js/config.js',
  '../js/i18n.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      // Bitta fayl yetib kelmasa ham o'rnatish buzilmasin
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('pizza-admin-') && key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/**
 * So'ralgan manzil hech qachon keshlanmaydiganlar ro'yxatidami.
 * @param {URL} url
 * @returns {boolean}
 */
function isNeverCached(url) {
  return NEVER_CACHE.some((path) => url.pathname.endsWith(path));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Tashqi xizmatlar (Firebase, Node servis) — to'g'ridan-to'g'ri
  if (url.origin !== self.location.origin) return;

  // config.js — faqat tarmoqdan
  if (isNeverCached(url)) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  // TARMOQ BIRINCHI, LEKIN CHEGARA BILAN.
  //
  // Maqsad o'zgarmadi: xodim eng yangi kodni olishi kerak. Lekin
  // "tarmoq birinchi" ni chegarasiz qoldirish sekin LTE da har
  // navigatsiyani tarmoq tezligiga bog'lab qo'yardi — o'lchovda
  // (1.5 s/so'rov) ilova qayta ochilishi 1.8 sekund turardi va
  // ulanish uzilganda umuman ochilmasdi.
  //
  // Endi: NET_TIMEOUT ichida javob kelsa u ishlatiladi va keshni
  // yangilaydi (ya'ni yaxshi tarmoqda hech nima o'zgarmadi). Kelmasa
  // keshdagi nusxa beriladi, tarmoq so'rovi esa fonda davom etadi va
  // keshni keyingi ochilish uchun yangilaydi.
  event.respondWith(networkFirst(request));
});

/** Tarmoqni shuncha kutamiz, keyin keshga o'tamiz (ms). */
const NET_TIMEOUT = 2500;

/**
 * Tarmoq birinchi, chegara bilan.
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirst(request) {
  const network = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === 'basic') {
        const copy = response.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    });

  // Fon so'rovi rad etilsa "unhandled rejection" bo'lmasin
  network.catch(() => {});

  const cached = await caches.match(request);

  // Kesh yo'q — tarmoqdan boshqa iloj yo'q
  if (!cached) {
    try {
      return await network;
    } catch (e) {
      if (request.mode === 'navigate') {
        const shell = await caches.match('./index.html', { ignoreSearch: true });
        if (shell) return shell;
      }
      return new Response('', { status: 504, statusText: 'Oflayn' });
    }
  }

  // Kesh bor — tarmoqni CHEGARA bilan kutamiz
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NET_TIMEOUT));
  try {
    const response = await Promise.race([network, timeout]);
    return response || cached;
  } catch (e) {
    return cached;
  }
}
