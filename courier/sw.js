/**
 * Kuryer ilovasi service worker'i.
 *
 * Mijoz ilovasidagi SW dan JIDDIY farq qiladi: u "keshdan ber, fonda
 * yangila" (stale-while-revalidate) tamoyilida ishlaydi, bu esa admin
 * uchun XAVFLI bo'lardi — xodim eski menyu yoki eski kod bilan ishlab
 * qolishi mumkin. Shuning uchun bu yerda TARMOQ BIRINCHI: kesh faqat
 * internet uzilganda zaxira sifatida ishlatiladi.
 *
 * Scope: `/pizza-pwa/courier/`. Ildizdagi SW ning scope'i kengroq
 * (`/pizza-pwa/`), lekin brauzer eng aniq mos keladigan ro'yxatdan
 * o'tishni tanlaydi, shuning uchun kuryer sahifalarini aynan shu SW
 * boshqaradi. Ildizdagi SW ham `/courier/` yo'lini chetlab o'tadi.
 */

const VERSION = 'v1';
const SHELL_CACHE = `pizza-courier-${VERSION}`;

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
  './css/courier.css',
  './js/app.js',
  './js/config.js',
  './js/i18n.js',
  './js/ui.js',
  './js/db.js',
  './js/api.js',
  './js/auth.js',
  './js/geo.js',
  './js/pages/login.js',
  './js/pages/orders.js',
  './js/pages/report.js'
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
          .filter((key) => key.startsWith('pizza-courier-') && key !== SHELL_CACHE)
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

  // TARMOQ BIRINCHI: xodim doim eng yangi kodni oladi, kesh esa faqat
  // internet uzilganda ishlaydi
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await caches.match('./index.html', { ignoreSearch: true });
          if (shell) return shell;
        }
        return new Response('', { status: 504, statusText: 'Oflayn' });
      })
  );
});
