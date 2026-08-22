/**
 * Kuryer ilovasining kirish nuqtasi.
 *
 * Router YO'Q — ikkita ekran bor (buyurtmalar va hisob), ular pastki
 * tab bilan almashadi. Hash router qo'shish ortiqcha murakkablik
 * bo'lardi va kuryerga "orqaga" tugmasi kerak emas.
 *
 * Bu yerda uchta narsa boshqariladi: smena, geolokatsiya shartlari va
 * tab almashuvi.
 */

import { COURIER } from './config.js';
import { t, initLang, setLang, getLang } from './i18n.js';
import { el, toast, confirm } from './ui.js';
import { initAuth, subscribe, getCurrentCourier, signOut, patchCourier } from './auth.js';
import { watchCourier, setShift } from './db.js';
import { wakeUp } from './api.js';
import { startGeo, stopGeo, updateGeoState } from './geo.js';
import { renderLogin } from './pages/login.js';
import * as ordersPage from './pages/orders.js';
import * as reportPage from './pages/report.js';

const bootEl = document.getElementById('boot');
const appEl = document.getElementById('app');
const contentEl = document.getElementById('content');
const shiftBtn = document.getElementById('shiftBtn');
const shiftState = document.getElementById('shiftState');
const geoStatus = document.getElementById('geoStatus');
const countEl = document.getElementById('ordersCount');

/** @type {?Function} kuryer hujjati obunasi */
let stopCourierWatch = null;

/** @type {?object} joriy ochiq sahifa moduli */
let activePage = null;

/** Joriy tab. */
let tab = 'orders';

/** Faol buyurtmalar soni — smenani yopishdan oldin tekshiriladi. */
let activeCount = 0;

/* ---------------------------------------------------------------- mavzu */

/** Saqlangan mavzuni qo'llaydi. */
function initTheme() {
  try {
    const saved = localStorage.getItem(COURIER.storage.theme);
    if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved;
  } catch (e) {
    // Shaxsiy rejim — tizim mavzusi qoladi
  }
}

/* ---------------------------------------------------------------- smena */

/**
 * Smena holatini ekranga chizadi.
 * @param {boolean} open
 */
function drawShift(open) {
  shiftState.textContent = open ? t('shift.isOpen') : t('shift.isClosed');
  shiftState.className = `shift__state ${open ? 'is-open' : 'is-closed'}`;
  shiftBtn.textContent = open ? t('shift.close') : t('shift.open');
  shiftBtn.className = `btn btn--sm${open ? ' btn--ghost' : ''}`;
}

/** Smenani ochadi yoki yopadi. */
async function toggleShift() {
  const courier = getCurrentCourier();
  if (!courier) return;
  const open = !courier.onShift;

  // Faol buyurtma bilan smenani yopib bo'lmaydi
  if (!open && activeCount > 0) {
    toast(t('shift.closeBlocked'), { type: 'error' });
    return;
  }
  if (!open) {
    const yes = await confirm({ title: t('shift.close'), text: t('shift.closeConfirm') });
    if (!yes) return;
  }

  shiftBtn.disabled = true;
  try {
    await setShift(courier.id, open);
    patchCourier({ onShift: open });
    toast(open ? t('shift.opened') : t('shift.closed'), { type: 'success' });
    applyShift(open);
  } catch (e) {
    console.error('[shift] o\'zgarmadi:', e);
    toast(e.message || t('app.error'), { type: 'error' });
  } finally {
    shiftBtn.disabled = false;
  }
}

/**
 * Smena holatiga qarab geolokatsiyani yoqadi/o'chiradi.
 * @param {boolean} open
 */
function applyShift(open) {
  drawShift(open);
  updateGeoState({ onShift: open });
  if (!open) geoStatus.textContent = t('geo.off');
}

/* ------------------------------------------------------------ geo holati */

/**
 * Geolokatsiya holatini yuqorida ko'rsatadi.
 * @param {string} key - i18n kaliti
 */
function showGeo(key) {
  geoStatus.textContent = t(key);
  geoStatus.className = 'topbar__geo' +
    (key === 'geo.on' ? ' is-ok' : key === 'geo.denied' || key === 'geo.unavailable' ? ' is-bad' : '');
}

/* --------------------------------------------------------------- ekranlar */

/**
 * Tabni almashtiradi.
 * @param {string} next
 */
function openTab(next) {
  tab = next;
  document.querySelectorAll('.tabs__btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.tab === next);
  });

  if (activePage && typeof activePage.destroy === 'function') activePage.destroy();

  activePage = next === 'report' ? reportPage : ordersPage;
  const node = activePage.render({
    onCount: (n) => {
      activeCount = n;
      countEl.textContent = String(n);
      countEl.hidden = n <= 0;
    }
  });
  contentEl.replaceChildren(node);
  contentEl.scrollTo?.(0, 0);
}

/** Kirish ekranini ko'rsatadi. */
function showLogin() {
  stopGeo();
  if (stopCourierWatch) stopCourierWatch();
  stopCourierWatch = null;
  if (activePage && typeof activePage.destroy === 'function') activePage.destroy();
  activePage = null;

  appEl.hidden = true;
  bootEl.hidden = true;

  let host = document.getElementById('loginHost');
  if (!host) {
    host = el('div', { attrs: { id: 'loginHost' } });
    document.body.append(host);
  }
  host.replaceChildren(renderLogin({
    onSuccess: () => {
      host.remove();
      showApp();
    }
  }));
}

/** Asosiy ekranni ko'rsatadi. */
function showApp() {
  const host = document.getElementById('loginHost');
  if (host) host.remove();

  const courier = getCurrentCourier();
  if (!courier) {
    showLogin();
    return;
  }

  bootEl.hidden = true;
  appEl.hidden = false;

  document.getElementById('courierName').textContent = courier.name || courier.phone || '';
  applyShift(Boolean(courier.onShift));

  // Geolokatsiya kuzatuvi doim ishlaydi, lekin YOZUV faqat shartlar
  // bajarilganda bo'ladi (`courier/js/geo.js`).
  startGeo({ uid: courier.id, onStatus: showGeo });
  updateGeoState({ onShift: Boolean(courier.onShift) });

  // Smena boshqa qurilmadan o'zgarishi mumkin — kuzatib turamiz
  if (stopCourierWatch) stopCourierWatch();
  stopCourierWatch = watchCourier(courier.id, (doc) => {
    if (!doc) return;
    if (doc.active === false) {
      toast(t('auth.disabled'), { type: 'error' });
      signOut();
      return;
    }
    if (Boolean(doc.onShift) !== Boolean(getCurrentCourier()?.onShift)) {
      patchCourier({ onShift: doc.onShift });
      applyShift(Boolean(doc.onShift));
    }
  });

  openTab(tab);
  wakeUp();
}

/* ------------------------------------------------------------ hodisalar */

document.querySelectorAll('.tabs__btn').forEach((btn) => {
  btn.addEventListener('click', () => openTab(btn.dataset.tab));
});

shiftBtn.addEventListener('click', toggleShift);

document.getElementById('langBtn').addEventListener('click', () => {
  const index = COURIER.langs.findIndex((l) => l.code === getLang());
  const next = COURIER.langs[(index + 1) % COURIER.langs.length];
  setLang(next.code);
  location.reload();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await signOut();
  location.reload();
});

// Hujjat o'chirilsa yoki sessiya yopilsa — kirish ekraniga
subscribe((courier) => {
  if (!courier && !appEl.hidden) showLogin();
});

/** Boshlanish. */
(async () => {
  initLang();
  initTheme();
  document.getElementById('langBtn').textContent = getLang().toUpperCase();
  document.getElementById('logoutBtn').textContent = t('auth.logout');
  document.title = t('app.title');

  const courier = await initAuth();
  if (courier) showApp();
  else showLogin();
})();
