/**
 * KDS — oshxona ekrani (SPEC 109).
 *
 * Kartochka + taymer + "Tayyor". Ekran oshxonada doim ochiq turadi,
 * shuning uchun:
 *  - kartochkalar katta va kam matnli (mahsulot nomi va soni);
 *  - taymer har soniyada yangilanadi, kechikkani qizil bo'ladi;
 *  - buyurtma yopilgach ro'yxatdan o'zi tushadi (`onSnapshot`).
 */

import { t, pick } from '../i18n.js';
import { el, toast, skeleton, emptyState } from '../ui.js';
import { ADMIN } from '../config.js';
import { watchActiveOrders } from '../db.js';
import { setOrderStatus } from '../api.js';
import { setCounter } from '../app.js';

/** @type {?Function} */
let stopWatch = null;
/** @type {?number} */
let ticker = null;

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
 * Buyurtma qabul qilingandan beri o'tgan vaqt.
 * @param {object} order
 * @returns {number} millisekund
 */
function elapsedMs(order) {
  const accepted = (order.statusHistory || []).find((h) => h.status === 'accepted');
  const from = toDate(accepted?.at) || toDate(order.createdAt);
  return from ? Date.now() - from.getTime() : 0;
}

/**
 * `12:05` ko'rinishidagi taymer.
 * @param {number} ms
 * @returns {string}
 */
function clock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return t('kds.elapsed', {
    min: String(Math.floor(total / 60)).padStart(2, '0'),
    sec: String(total % 60).padStart(2, '0')
  });
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  destroy();

  const root = el('div.kds-page');
  const host = el('div.kds');
  host.append(skeleton('card', 4));
  root.append(host);

  /** @type {object[]} */
  let orders = [];

  /**
   * Statusni o'zgartiradi.
   * @param {object} order
   * @param {string} status
   * @param {HTMLElement} button
   */
  async function move(order, status, button) {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = '…';
    try {
      await setOrderStatus(order.id, status);
      // Ro'yxat obuna orqali o'zi yangilanadi
    } catch (e) {
      console.error('[kds] status o\'zgarmadi:', e);
      toast(e.message || t('app.error'), { type: 'error' });
      button.disabled = false;
      button.textContent = label;
    }
  }

  /**
   * Bitta kartochka.
   * @param {object} order
   * @returns {HTMLElement}
   */
  function card(order) {
    const ms = elapsedMs(order);
    const limit = (order.etaMinutes || 0) * 60000;
    const overdue = limit > 0 && ms > limit;

    const list = el('ul.kds-card__list');
    (order.items || []).forEach((item) => {
      const addons = (item.addons || []).map((a) => pick(a.name)).filter(Boolean);
      const removed = (item.removed || []).length;
      list.append(el('li', {}, [
        el('span.kds-card__qty', { text: `${item.qty}×` }),
        el('span', { text: pick(item.name) }),
        item.size ? el('span.order__addons', { text: `${item.size} · ${item.dough || ''}`.trim() }) : null,
        addons.length ? el('span.order__addons', { text: `+ ${addons.join(', ')}` }) : null,
        removed ? el('span.order__addons', { text: `− ${removed}` }) : null
      ]));
    });

    // Keyingi qadam statusga qarab
    const next = order.status === 'accepted'
      ? { status: 'cooking', label: t('kds.start') }
      : order.status === 'cooking'
        ? { status: 'in_oven', label: t('kds.oven') }
        : { status: 'packing', label: t('kds.ready') };

    const button = el('button.btn.btn--lg.btn--block', {
      text: next.label,
      attrs: { type: 'button' },
      on: { click: () => move(order, next.status, button) }
    });

    return el(`div.card.kds-card${overdue ? '.kds-card--overdue' : ''}`, {
      attrs: { 'data-order': order.id }
    }, [
      el('div.kds-card__top', {}, [
        el('span.kds-card__num', { text: `#${order.orderNumber || '—'}` }),
        el('span.badge', { text: t(`status.${order.status}`) }),
        el('span.kds-card__timer', {
          text: clock(ms),
          attrs: { 'data-timer': order.id }
        })
      ]),
      overdue ? el('span.badge.badge--err', { text: t('kds.overdue') }) : null,
      list,
      order.comment ? el('p.hint', { text: order.comment }) : null,
      button
    ]);
  }

  /** Ro'yxatni chizadi. */
  function draw() {
    const visible = orders
      .filter((o) => ADMIN.kdsStatuses.includes(o.status))
      .sort((a, b) => elapsedMs(b) - elapsedMs(a));

    if (!visible.length) {
      host.replaceChildren(emptyState({ icon: '🍳', title: t('kds.empty') }));
      return;
    }
    host.replaceChildren(...visible.map(card));
  }

  /**
   * Faqat taymerlarni yangilaydi — butun ro'yxatni qayta chizmaymiz,
   * aks holda har soniyada tugmalar "sakraydi".
   */
  function tick() {
    orders
      .filter((o) => ADMIN.kdsStatuses.includes(o.status))
      .forEach((order) => {
        const node = host.querySelector(`[data-timer="${order.id}"]`);
        if (!node) return;
        const ms = elapsedMs(order);
        node.textContent = clock(ms);

        const limit = (order.etaMinutes || 0) * 60000;
        const cardNode = node.closest('.kds-card');
        if (cardNode && limit > 0) {
          cardNode.classList.toggle('kds-card--overdue', ms > limit);
        }
      });
  }

  stopWatch = watchActiveOrders(
    (list) => {
      orders = list;
      setCounter('kds', list.filter((o) => ADMIN.kdsStatuses.includes(o.status)).length);
      draw();
    },
    (error) => {
      console.error('[kds] oqim uzildi:', error);
      host.replaceChildren(emptyState({
        icon: '⚠️',
        title: t('app.error'),
        hint: error.message
      }));
    }
  );

  ticker = setInterval(tick, 1000);
  return root;
}

/** Sahifa yopilganda obunalarni uzadi. */
export function destroy() {
  if (stopWatch) stopWatch();
  stopWatch = null;
  if (ticker) clearInterval(ticker);
  ticker = null;
}
