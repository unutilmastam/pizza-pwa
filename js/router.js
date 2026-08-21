/**
 * Hash asosidagi SPA router.
 *
 * Sahifa ro'yxatdan o'tkaziladi:
 *   register('/product/:id', () => import('./pages/product.js'));
 *
 * Sahifa moduli `render(ctx)` funksiyasini eksport qiladi va HTMLElement
 * (yoki string) qaytaradi. Ixtiyoriy `destroy()` — sahifa yopilganda
 * taymer/obunalarni tozalash uchun chaqiriladi.
 */

/** @typedef {Object} RouteCtx
 * @property {Object<string,string>} params  yo'l parametrlari (`:id`)
 * @property {URLSearchParams} query         `?` dan keyingi parametrlar
 * @property {string} path                   joriy yo'l
 */

/** @type {Array<{pattern: string, keys: string[], regex: RegExp, loader: Function}>} */
const routes = [];

let rootEl = null;
let notFoundLoader = null;
/** @type {?{destroy?: Function}} */
let activePage = null;
let activePath = null;
/** Ilova ichida nechta o'tish bo'lgani — orqaga tugmasi uchun. */
let depth = 0;
/** Renderlar ketma-ketligi — kechikkan javob yangi sahifani bosib ketmasin. */
let renderToken = 0;

/**
 * Yo'l shablonini regexga aylantiradi. `/product/:id` → `^/product/([^/]+)$`
 * @param {string} pattern
 * @returns {{keys: string[], regex: RegExp}}
 */
function compile(pattern) {
  const keys = [];
  // Har bo'lakni alohida ko'rib chiqamiz: `:id` — parametr, qolgani —
  // aynan matn (regex belgilari xavfsizlantiriladi).
  const source = pattern
    .replace(/\/+$/, '')
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { keys, regex: new RegExp(`^${source || '/'}$`) };
}

/**
 * Sahifani ro'yxatdan o'tkazadi.
 * @param {string} pattern - masalan '/menu' yoki '/product/:id'
 * @param {Function} loader - modul yoki `{render, destroy}` qaytaruvchi funksiya
 */
export function register(pattern, loader) {
  const { keys, regex } = compile(pattern);
  routes.push({ pattern, keys, regex, loader });
}

/**
 * 404 sahifasini belgilaydi.
 * @param {Function} loader
 */
export function registerNotFound(loader) {
  notFoundLoader = loader;
}

/**
 * Joriy hash'dan yo'l va query'ni ajratadi.
 * @returns {{path: string, query: URLSearchParams}}
 */
function parseHash() {
  const raw = location.hash.slice(1) || '/';
  const [pathPart, queryPart] = raw.split('?');
  let path = pathPart || '/';
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return { path, query: new URLSearchParams(queryPart || '') };
}

/**
 * Joriy yo'lni qaytaradi.
 * @returns {string}
 */
export function currentPath() {
  return parseHash().path;
}

/**
 * Yo'lga o'tadi.
 * @param {string} path - '/cart' ko'rinishida
 * @param {{replace?: boolean}} [opts] - tarixni almashtirish
 */
export function navigate(path, opts = {}) {
  const target = `#${path.startsWith('/') ? path : `/${path}`}`;
  if (location.hash === target) return;
  if (opts.replace) {
    history.replaceState(history.state, '', target);
    handleRoute();
  } else {
    depth += 1;
    location.hash = target;
  }
}

/**
 * Orqaga qaytadi. Ilova ichida tarix bo'lmasa — menyuga.
 */
export function back() {
  if (depth > 0) {
    depth -= 1;
    history.back();
  } else {
    navigate('/menu', { replace: true });
  }
}

/**
 * Modul yoki obyektdan `render` funksiyasini ajratadi.
 * @param {*} mod
 * @returns {?{render: Function, destroy?: Function}}
 */
function toPage(mod) {
  if (!mod) return null;
  if (typeof mod === 'function') return { render: mod };
  if (typeof mod.render === 'function') return mod;
  if (mod.default) return toPage(mod.default);
  return null;
}

/** Joriy hash bo'yicha sahifani chizadi. */
async function handleRoute() {
  const token = ++renderToken;
  const { path, query } = parseHash();
  const match = routes
    .map((r) => ({ r, m: r.regex.exec(path) }))
    .find((x) => x.m);

  // Eski sahifani tozalaymiz
  if (activePage && typeof activePage.destroy === 'function') {
    try {
      activePage.destroy();
    } catch (e) {
      console.error('destroy xatosi:', e);
    }
  }
  activePage = null;
  activePath = path;

  const params = {};
  if (match) {
    match.r.keys.forEach((key, i) => {
      params[key] = decodeURIComponent(match.m[i + 1]);
    });
  }

  const loader = match ? match.r.loader : notFoundLoader;
  if (!loader) return;

  rootEl.setAttribute('aria-busy', 'true');
  try {
    const page = toPage(await loader());
    if (token !== renderToken) return; // Boshqa sahifaga o'tib bo'lingan
    if (!page) throw new Error(`Sahifa moduli noto'g'ri: ${path}`);

    const output = await page.render({ params, query, path });
    if (token !== renderToken) return;

    rootEl.replaceChildren();
    if (output instanceof Node) rootEl.appendChild(output);
    else if (typeof output === 'string') rootEl.innerHTML = output;
    activePage = page;
  } catch (e) {
    console.error('Sahifa yuklanmadi:', e);
    if (token === renderToken) {
      rootEl.replaceChildren();
      rootEl.innerHTML = '<div class="state state--error"><p></p></div>';
      rootEl.querySelector('p').textContent = e.message || 'Xatolik';
    }
  } finally {
    if (token === renderToken) {
      rootEl.removeAttribute('aria-busy');
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      document.dispatchEvent(
        new CustomEvent('route:change', { detail: { path, params } })
      );
    }
  }
}

/**
 * Routerni ishga tushiradi.
 * @param {HTMLElement} root - sahifa chiziladigan element (`main#app`)
 * @param {{fallback?: string}} [opts] - bo'sh hash uchun boshlang'ich yo'l
 */
export function start(root, opts = {}) {
  rootEl = root;
  window.addEventListener('hashchange', handleRoute);
  if (!location.hash) {
    history.replaceState(null, '', `#${opts.fallback || '/menu'}`);
  }
  handleRoute();
}

/**
 * Joriy chizilgan yo'l (render tugagandan keyin).
 * @returns {?string}
 */
export function activeRoute() {
  return activePath;
}
