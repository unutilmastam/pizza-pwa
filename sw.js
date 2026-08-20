/**
 * Service worker — app shell keshi va oflayn rejim.
 *
 * Strategiya:
 *  - navigatsiya (HTML): tarmoq birinchi, uzilsa keshdagi app shell;
 *  - o'z statikamiz (css/js/icons): keshdan, orqa fonda yangilanadi;
 *  - Firebase / API / xarita so'rovlari: keshlanmaydi.
 */

const VERSION = 'v1';
const SHELL_CACHE = `pizza-shell-${VERSION}`;
const RUNTIME_CACHE = `pizza-runtime-${VERSION}`;

/** Birinchi o'rnatishda keshlanadigan app shell. */
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/config.js',
  './js/i18n.js',
  './js/state.js',
  './js/router.js',
  './js/utils.js',
  './js/ui.js',
  './js/db.js',
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
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Tashqi xizmatlar (Firebase, Node servis, Yandex Maps) — to'g'ridan-to'g'ri
  if (url.origin !== self.location.origin) return;

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
