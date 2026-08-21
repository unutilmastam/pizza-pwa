/**
 * Service worker — app shell keshi va oflayn rejim.
 *
 * Strategiya:
 *  - navigatsiya (HTML): tarmoq birinchi, uzilsa keshdagi app shell;
 *  - o'z statikamiz (css/js/icons): keshdan, orqa fonda yangilanadi;
 *  - `js/config.js`: FAQAT tarmoqdan, hech qachon keshlanmaydi;
 *  - Firebase / API / xarita so'rovlari: keshlanmaydi.
 *
 * VERSION o'zgarganda eski keshlar `activate` da butunlay o'chiriladi.
 * Statik fayl mazmuni o'zgarsa — VERSION ni oshiring.
 */

const VERSION = 'v8';
const SHELL_CACHE = `pizza-shell-${VERSION}`;
const RUNTIME_CACHE = `pizza-runtime-${VERSION}`;

/** Joriy versiyaga tegishli keshlar — qolganlari eskirgan hisoblanadi. */
const CURRENT_CACHES = [SHELL_CACHE, RUNTIME_CACHE];

/**
 * Hech qachon keshlanmaydigan fayllar.
 * config.js keshlansa, Firebase kalitlari eski holida qolib ketadi —
 * bu ilovani noto'g'ri loyihaga ulab qo'yadi.
 */
const NEVER_CACHE = ['/js/config.js'];

/** Birinchi o'rnatishda keshlanadigan app shell. */
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/i18n.js',
  './js/state.js',
  './js/router.js',
  './js/utils.js',
  './js/ui.js',
  './js/db.js',
  './js/auth.js',
  './js/api.js',
  './js/pages/menu.js',
  './js/pages/product.js',
  './js/pages/cart.js',
  './js/pages/checkout.js',
  './js/pages/address.js',
  './js/pages/auth.js',
  './js/pages/order.js',
  './js/pages/profile.js',
  './icons/icon.svg',
  './icons/icon-maskable.svg'
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
      // 1. Boshqa versiyadan qolgan barcha keshlar o'chiriladi
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !CURRENT_CACHES.includes(key))
          .map((key) => caches.delete(key))
      );

      // 2. Eski versiyada keshlanib qolgan config.js tozalanadi
      await Promise.all(CURRENT_CACHES.map(async (name) => {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        await Promise.all(
          requests
            .filter((req) => isNeverCached(new URL(req.url)))
            .map((req) => cache.delete(req))
        );
      }));

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

  // Tashqi xizmatlar (Firebase, Node servis, Yandex Maps) — to'g'ridan-to'g'ri
  if (url.origin !== self.location.origin) return;

  // config.js — faqat tarmoqdan, keshga umuman tegmaydi
  if (isNeverCached(url)) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  // Sahifa ochilishi — tarmoq birinchi, oflaynda app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }

  // Statik fayllar — keshdan, orqa fonda yangilanadi (stale-while-revalidate)
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Yangi versiyani darhol qo'llash uchun ilovadan xabar keladi
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
