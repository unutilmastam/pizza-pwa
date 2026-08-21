/**
 * Boshqaruv paneli (SPEC 105): bugungi buyurtma, tushum, o'rtacha chek.
 *
 * Ko'rsatkichlar buyurtmalar oqimining o'sha obunasidan hisoblanadi —
 * qo'shimcha so'rov yo'q, shuning uchun raqamlar real vaqtda o'zgaradi.
 */

import { t } from '../i18n.js';
import { el, skeleton, emptyState } from '../ui.js';
import { ADMIN } from '../config.js';
import { watchActiveOrders } from '../db.js';
import { setCounter } from '../app.js';

/** @type {?Function} */
let stopWatch = null;

/**
 * Summani `125 000` ko'rinishida yozadi.
 * @param {number} value
 * @returns {string}
 */
function money(value) {
  return String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Firestore Timestamp yoki ISO satrni Date ga aylantiradi.
 * @param {*} value
 * @returns {?Date}
 */
function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Bugungi buyurtmalardan ko'rsatkichlarni hisoblaydi.
 * @param {object[]} orders
 * @returns {object}
 */
function computeStats(orders) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const today = orders.filter((o) => {
    const created = toDate(o.createdAt);
    return created && created >= start;
  });

  const delivered = today.filter((o) => o.status === 'delivered');
  const revenue = delivered.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  return {
    orders: today.length,
    revenue,
    average: delivered.length ? Math.round(revenue / delivered.length) : 0,
    active: today.filter((o) => ADMIN.activeStatuses.includes(o.status)).length,
    cancelled: today.filter((o) => o.status === 'cancelled').length,
    guarantee: today.filter((o) => o.guaranteeBroken).length
  };
}

/**
 * Bitta ko'rsatkich kartochkasi.
 * @param {string} label
 * @param {string} value
 * @param {boolean} [small]
 * @returns {HTMLElement}
 */
function stat(label, value, small = false) {
  return el('div.card.stat', {}, [
    el('p.stat__label', { text: label }),
    el(`div.stat__value${small ? '.stat__value--sm' : ''}`, { text: value })
  ]);
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  destroy();

  const root = el('div.dash-page');
  const host = el('div.stats');
  host.append(skeleton('card', 4));
  root.append(
    host,
    el('p.hint', { text: t('dash.hint') })
  );

  stopWatch = watchActiveOrders(
    (orders) => {
      const s = computeStats(orders);

      setCounter('orders', orders.filter((o) => o.status === 'new').length);
      setCounter('kds', orders.filter((o) => ADMIN.kdsStatuses.includes(o.status)).length);

      host.replaceChildren(
        stat(t('dash.orders'), String(s.orders)),
        stat(t('dash.revenue'), `${money(s.revenue)} ${t('common.sum')}`, true),
        stat(t('dash.average'), `${money(s.average)} ${t('common.sum')}`, true),
        stat(t('dash.active'), String(s.active)),
        stat(t('dash.cancelled'), String(s.cancelled)),
        stat(t('dash.guarantee'), String(s.guarantee))
      );
    },
    (error) => {
      console.error('[dashboard] oqim uzildi:', error);
      host.replaceChildren(emptyState({
        icon: '⚠️',
        title: t('app.error'),
        hint: error.message
      }));
    }
  );

  return root;
}

/** Sahifa yopilganda obunani uzadi. */
export function destroy() {
  if (stopWatch) stopWatch();
  stopWatch = null;
}
