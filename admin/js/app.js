/**
 * Admin panelning kirish nuqtasi.
 *
 * Ish tartibi:
 *  1. Til va mavzu tiklanadi;
 *  2. Firebase sessiyasi tekshiriladi va `staff/{uid}` dan rol o'qiladi;
 *  3. Rol bo'lmasa — kirish ekrani, bo'lsa — panel va router.
 *
 * Router mijoz ilovasidan olinadi (`../../js/router.js`) — u hech
 * narsaga bog'liq emas, shuning uchun ikkinchi nusxa yozilmadi.
 */

import { register, registerNotFound, start, navigate } from '../../js/router.js';
import { ADMIN, SECTIONS } from './config.js';
import { t, initLang, setLang, getLang } from './i18n.js';
import { el, toast, emptyState } from './ui.js';
import {
  initAuth, subscribe, getCurrentStaff, canSee, allowedSections, signOut
} from './auth.js';
import { wakeUp } from './api.js';
import { renderLogin } from './pages/login.js';

const bootEl = document.getElementById('boot');
const adminEl = document.getElementById('admin');
const contentEl = document.getElementById('content');
const sideEl = document.getElementById('side');
const sideNavEl = document.getElementById('sideNav');
const backdropEl = document.getElementById('sideBackdrop');

/** Router bir marta ishga tushiriladi. */
let routerStarted = false;

/** Chap menyudagi hisoblagichlar (masalan yangi buyurtmalar soni). */
const counters = new Map();

/* ---------------------------------------------------------------- mavzu */

/** Saqlangan mavzuni qo'llaydi. */
function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem(ADMIN.storage.theme);
  } catch (e) {
    // Shaxsiy rejim — tizim mavzusi qoladi
  }
  if (saved === 'dark' || saved === 'light') {
    document.documentElement.dataset.theme = saved;
  }
}

/** Mavzuni almashtiradi: tizim → yorug' → qorong'i. */
function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  const next = current === 'light' ? 'dark' : current === 'dark' ? '' : 'light';
  if (next) document.documentElement.dataset.theme = next;
  else delete document.documentElement.dataset.theme;
  try {
    if (next) localStorage.setItem(ADMIN.storage.theme, next);
    else localStorage.removeItem(ADMIN.storage.theme);
  } catch (e) {
    // Saqlanmasa ham joriy seansda ishlaydi
  }
}

/* ------------------------------------------------------------ chap menyu */

/**
 * Bo'lim hisoblagichini o'zgartiradi (buyurtmalar sahifasi chaqiradi).
 * @param {string} section
 * @param {number} count
 */
export function setCounter(section, count) {
  counters.set(section, count);
  const badge = sideNavEl.querySelector(`[data-section="${section}"] .count`);
  if (badge) {
    badge.textContent = String(count);
    badge.hidden = count <= 0;
  }
}

/** Chap menyuni rolga qarab chizadi. */
function buildNav() {
  const allowed = allowedSections();
  sideNavEl.replaceChildren();

  SECTIONS.filter((s) => allowed.includes(s.id)).forEach((section) => {
    const count = counters.get(section.id) || 0;
    sideNavEl.append(el('button.side__link', {
      attrs: { type: 'button', 'data-section': section.id, 'data-path': section.path },
      on: {
        click: () => {
          navigate(section.path);
          closeSide();
        }
      }
    }, [
      el('span', { text: section.icon, attrs: { 'aria-hidden': 'true' } }),
      el('span', { text: t(section.key) }),
      el('span.count', { text: String(count), attrs: { hidden: count <= 0 } })
    ]));
  });
}

/**
 * Faol bo'limni belgilaydi va sarlavhani yozadi.
 * @param {string} path
 */
function markActive(path) {
  const normalized = path === '/' ? '/' : path.replace(/\/+$/, '');
  let active = null;

  sideNavEl.querySelectorAll('.side__link').forEach((link) => {
    const linkPath = link.dataset.path;
    const isActive = linkPath === '/'
      ? normalized === '/'
      : normalized === linkPath || normalized.startsWith(`${linkPath}/`);
    link.classList.toggle('is-active', isActive);
    if (isActive) active = link;
  });

  const section = SECTIONS.find((s) => s.id === (active && active.dataset.section));
  document.getElementById('pageTitle').textContent = section ? t(section.key) : '';
  document.getElementById('topbarSlot').replaceChildren();
}

/** Mobil menyuni yopadi. */
function closeSide() {
  sideEl.classList.remove('is-open');
  backdropEl.hidden = true;
}

/* -------------------------------------------------------------- ekranlar */

/** Kirish ekranini ko'rsatadi. */
function showLogin() {
  adminEl.hidden = true;
  bootEl.hidden = true;

  let host = document.getElementById('loginHost');
  if (!host) {
    host = el('div', { attrs: { id: 'loginHost' } });
    document.body.append(host);
  }
  host.replaceChildren(renderLogin({
    onSuccess: () => {
      host.remove();
      showPanel();
    }
  }));
}

/** Panelni ko'rsatadi (kirilgandan keyin). */
function showPanel() {
  const host = document.getElementById('loginHost');
  if (host) host.remove();

  bootEl.hidden = true;
  adminEl.hidden = false;

  const staff = getCurrentStaff();
  document.getElementById('staffLine').textContent =
    `${staff.name || staff.phone || ''} · ${t(`role.${staff.role}`)}`;

  buildNav();

  if (!routerStarted) {
    startRouter();
    routerStarted = true;
  } else {
    // Rol o'zgargan bo'lishi mumkin — joriy sahifani qaytadan ochamiz
    navigate(location.hash.slice(1) || '/');
  }

  // Render bepul planida servis uxlaydi — fonda uyg'otamiz, shunda
  // birinchi status o'zgartirish uzoq kutmaydi
  wakeUp();
}

/**
 * Bo'limni ruxsat bilan birga ro'yxatdan o'tkazadi.
 * @param {string} path
 * @param {string} section
 * @param {Function} loader
 */
function registerSection(path, section, loader) {
  register(path, async () => {
    if (!canSee(section)) {
      return {
        render: () => emptyState({ icon: '🔒', title: t('auth.noSection') })
      };
    }
    return loader();
  });
}

/** Router yo'llarini ro'yxatdan o'tkazadi va ishga tushiradi. */
function startRouter() {
  registerSection('/', 'dashboard', () => import('./pages/dashboard.js'));
  registerSection('/orders', 'orders', () => import('./pages/orders.js'));
  registerSection('/kds', 'kds', () => import('./pages/kds.js'));
  registerSection('/menu', 'menu', () => import('./pages/menu.js'));
  registerSection('/branches', 'branches', () => import('./pages/branches.js'));
  registerSection('/promos', 'promos', () => import('./pages/promos.js'));
  registerSection('/reports', 'reports', () => import('./pages/reports.js'));

  registerNotFound(() => ({
    render: () => emptyState({ icon: '🤷', title: t('app.notFound'), hint: location.hash })
  }));

  // Rol dashboard'ni ko'rmasa (masalan oshxona) — birinchi ochiq bo'limga
  const allowed = allowedSections();
  const first = SECTIONS.find((s) => allowed.includes(s.id));
  start(contentEl, { fallback: first ? first.path : '/' });
}

/* ------------------------------------------------------------ ishga tushish */

document.addEventListener('route:change', (e) => {
  markActive(e.detail.path);
  contentEl.scrollTo?.(0, 0);
});

document.getElementById('menuBtn').addEventListener('click', () => {
  const open = sideEl.classList.toggle('is-open');
  backdropEl.hidden = !open;
});

backdropEl.addEventListener('click', closeSide);

document.getElementById('themeBtn').addEventListener('click', toggleTheme);

document.getElementById('langBtn').addEventListener('click', () => {
  const index = ADMIN.langs.findIndex((l) => l.code === getLang());
  const next = ADMIN.langs[(index + 1) % ADMIN.langs.length];
  setLang(next.code);
  location.reload();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await signOut();
  location.reload();
});

// Rol yo'qolsa (administrator o'chirdi) — darhol kirish ekraniga
subscribe((staff) => {
  if (!staff && !adminEl.hidden) {
    toast(t('auth.staffDisabled'), { type: 'error' });
    showLogin();
  }
});

/** Boshlanish. */
(async () => {
  initLang();
  initTheme();
  document.getElementById('langBtn').textContent = getLang().toUpperCase();
  document.title = t('app.title');

  const staff = await initAuth();
  if (staff) showPanel();
  else showLogin();
})();
