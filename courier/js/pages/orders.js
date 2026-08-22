/**
 * Tayinlangan buyurtmalar va "Oldim → Yo'ldaman → Yetkazdim"
 * (SPEC 123–126).
 *
 * Buyurtmalar `onSnapshot` bilan real vaqtda keladi. Status o'zgarishi
 * Firestore'ga BEVOSITA yozilmaydi — servis orqali ketadi, u egalikni
 * va ruxsat etilgan statusni qayta tekshiradi.
 *
 * "Oldim" va "Yo'ldaman" — bitta qadam: ikkalasi ham `on_way` ga
 * o'tkazadi. Kuryer oshxonadan buyurtmani olganda bosadi.
 */

import { t, pick } from '../i18n.js';
import { el, toast, modal, confirm, skeleton } from '../ui.js';
import { COURIER } from '../config.js';
import { watchMyOrders, peekMyOrders } from '../db.js';
import { setOrderStatus } from '../api.js';
import { getCurrentCourier } from '../auth.js';
import { updateGeoState } from '../geo.js';

/** @type {?Function} obunani uzish */
let stopWatch = null;

/** Faol buyurtmalar sonini tashqariga bildiruvchi. */
let onCount = () => {};

/**
 * Summani `125 000` ko'rinishida yozadi.
 * @param {number} value
 * @returns {string}
 */
function money(value) {
  return String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Manzilni bir qatorga yig'adi.
 * @param {object} order
 * @returns {string}
 */
function addressLine(order) {
  const a = order.address;
  if (!a) return '';
  const extra = [
    a.apartment && `kv. ${a.apartment}`,
    a.entrance && `pod. ${a.entrance}`,
    a.floor && `${a.floor}-qavat`,
    a.intercom && `domofon ${a.intercom}`
  ].filter(Boolean).join(', ');
  return extra ? `${a.address}, ${extra}` : a.address;
}

/**
 * Navigator havolasini ochadi (SPEC 125).
 *
 * Avval Yandex Navigator deep link'i sinaladi. Ilova o'rnatilmagan
 * bo'lsa hech narsa bo'lmaydi — shuning uchun qisqa vaqtdan keyin
 * brauzerdagi xarita ochiladi.
 *
 * @param {object} order
 */
function openNavigator(order) {
  const lat = Number(order.lat ?? order.address?.lat);
  const lng = Number(order.lng ?? order.address?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    toast(t('orders.address'), { type: 'error' });
    return;
  }

  const fill = (tpl) => tpl.replace('{lat}', String(lat)).replace('{lng}', String(lng));
  const started = Date.now();

  // Deep link — ilova bo'lsa sahifa fonga o'tadi
  window.location.href = fill(COURIER.naviDeepLink);

  setTimeout(() => {
    // Sahifa hamon ko'rinib tursa — Navigator ochilmadi
    if (document.visibilityState === 'visible' && Date.now() - started < 2500) {
      window.open(fill(COURIER.mapsFallback), '_blank', 'noopener');
    }
  }, 1200);
}

/**
 * Sahifani chizadi.
 * @param {{onCount?: Function}} [ctx]
 * @returns {HTMLElement}
 */
export function render(ctx = {}) {
  destroy();
  onCount = ctx.onCount || (() => {});

  const courier = getCurrentCourier();
  const root = el('div.orders-page');
  const host = el('div');
  host.append(skeleton('card', 2));
  root.append(host);

  if (!courier) {
    host.replaceChildren(el('div.state', {}, [el('p', { text: t('app.error') })]));
    return root;
  }

  /** @type {object[]} */
  let orders = [];

  /**
   * Statusni servis orqali o'zgartiradi.
   * @param {object} order
   * @param {string} status
   * @param {HTMLElement} button
   * @param {object} [extra]
   */
  async function move(order, status, button, extra = {}) {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = t('app.loading');
    try {
      await setOrderStatus(order.id, status, {
        ...extra,
        onSlow: () => { button.textContent = t('auth.waking'); }
      });
      toast(status === 'delivered' ? t('orders.delivered') : t('orders.taken'), {
        type: 'success'
      });
      // Ro'yxat `onSnapshot` orqali o'zi yangilanadi
    } catch (e) {
      console.error('[orders] status o\'zgarmadi:', e);
      toast(statusErrorText(e), { type: 'error' });
      button.disabled = false;
      button.textContent = label;
    }
  }

  /**
   * Yetkazish oqimi: naqd bo'lsa avval pul so'raladi (SPEC 126).
   * @param {object} order
   * @param {HTMLElement} button
   */
  async function deliver(order, button) {
    if (order.paymentMethod === 'cash') {
      const collected = await askCash(order);
      if (!collected) return;
      move(order, 'delivered', button, { cashCollected: true });
      return;
    }

    const yes = await confirm({
      title: t('orders.deliver'),
      text: t('orders.deliverConfirm', { n: order.orderNumber })
    });
    if (yes) move(order, 'delivered', button);
  }

  /**
   * Naqd pul olinganini so'raydi.
   * @param {object} order
   * @returns {Promise<boolean>}
   */
  function askCash(order) {
    return new Promise((resolve) => {
      let answered = false;
      const done = (value) => {
        if (answered) return;
        answered = true;
        resolve(value);
      };
      modal({
        title: t('orders.cashQuestion'),
        content: el('div', {}, [
          el('p', { text: t('orders.cashAmount', { sum: `${money(order.total)} ${t('common.sum')}` }) }),
          order.changeFrom
            ? el('p.hint', { text: `${t('orders.change')}: ${money(order.changeFrom)}` })
            : null
        ]),
        actions: [
          { label: t('orders.cashYes'), variant: 'ok', onClick: () => done(true) },
          { label: t('orders.cashNo'), onClick: () => done(false) }
        ]
      });
    });
  }

  /**
   * Bitta buyurtma kartochkasi.
   * @param {object} order
   * @returns {HTMLElement}
   */
  function orderCard(order) {
    const onWay = order.status === 'on_way';
    const cash = order.paymentMethod === 'cash';

    const items = el('ul.order__items');
    (order.items || []).forEach((item) => {
      items.append(el('li', {}, [
        el('span', { text: `${pick(item.name)} × ${item.qty}` }),
        el('span.muted', { text: money(item.total ?? item.unitPrice * item.qty) })
      ]));
    });

    const actions = el('div.order__actions');

    // Qo'ng'iroq va navigator
    const row = el('div.order__row');
    if (order.phone) {
      row.append(el('a.btn.btn--ghost', {
        text: `📞 ${t('orders.call')}`,
        attrs: { href: `tel:${order.phone}` }
      }));
    }
    row.append(el('button.btn.btn--ghost', {
      text: `🧭 ${t('orders.navigate')}`,
      attrs: { type: 'button' },
      on: { click: () => openNavigator(order) }
    }));
    actions.append(row);

    // Asosiy qadam
    if (!onWay) {
      const take = el('button.btn.btn--block', {
        text: t('orders.take'),
        attrs: { type: 'button' },
        on: { click: () => move(order, 'on_way', take) }
      });
      actions.append(take);
    } else {
      const done = el('button.btn.btn--ok.btn--block', {
        text: t('orders.deliver'),
        attrs: { type: 'button' },
        on: { click: () => deliver(order, done) }
      });
      actions.append(done);
    }

    return el(`div.order${onWay ? '.order--onway' : ''}`, {}, [
      el('div.order__head', {}, [
        el('span.order__num', { text: t('orders.number', { n: order.orderNumber || '—' }) }),
        el(`span.badge${onWay ? '.badge--onway' : ''}`, { text: t(`status.${order.status}`) }),
        el('span.order__total', { text: `${money(order.total)}` })
      ]),
      el('span', {}, [
        el(`span.badge${cash ? '.badge--cash' : '.badge--card'}`, {
          text: cash ? t('orders.cash') : t('orders.card')
        })
      ]),
      el('p.order__addr', { text: addressLine(order) }),
      order.name || order.phone
        ? el('dl.order__line', {}, [
          el('dt', { text: t('orders.customer') }),
          el('dd', { text: `${order.name || ''} ${order.phone || ''}`.trim() })
        ])
        : null,
      order.comment
        ? el('dl.order__line', {}, [
          el('dt', { text: t('orders.comment') }),
          el('dd', { text: order.comment })
        ])
        : null,
      cash && order.changeFrom
        ? el('dl.order__line', {}, [
          el('dt', { text: t('orders.change') }),
          el('dd', { text: `${money(order.changeFrom)} ${t('common.sum')}` })
        ])
        : null,
      items,
      actions
    ]);
  }

  /** Ro'yxatni chizadi. */
  function draw() {
    const visible = orders
      .filter((o) => COURIER.activeStatuses.includes(o.status))
      .sort((a, b) => (a.status === 'on_way' ? -1 : 1) - (b.status === 'on_way' ? -1 : 1));

    onCount(visible.length);

    // Geolokatsiya SHARTI: yo'lda buyurtma bormi
    updateGeoState({ hasActiveDelivery: visible.some((o) => o.status === 'on_way') });

    if (!visible.length) {
      host.replaceChildren(el('div.state', {}, [
        el('div', { text: '📦', attrs: { 'aria-hidden': 'true', style: 'font-size:36px' } }),
        el('h2', { text: t('orders.empty'), attrs: { style: 'font-size:17px' } }),
        el('p.hint', { text: t('orders.emptyHint') })
      ]));
      return;
    }
    host.replaceChildren(...visible.map(orderCard));
  }

  // KESHDAGI RO'YXAT DARHOL. Oqim birinchi javobini kutguncha ekran
  // bo'sh turmasin — sekin tarmoqda bu 1–3 sekundlik skeleton edi.
  const cached = peekMyOrders(courier.id);
  if (cached && cached.length) {
    orders = cached;
    draw();
  }

  stopWatch = watchMyOrders(
    courier.id,
    (list) => {
      orders = list;
      draw();
    },
    (error) => {
      console.error('[orders] oqim uzildi:', error);
      // Keshdagi ro'yxat bo'lsa uni qoldiramiz va faqat ogohlantiramiz —
      // kuryer ma'lumotsiz qolmasin
      if (orders.length) {
        toast(t('app.offline'), { type: 'error' });
        return;
      }
      host.replaceChildren(el('div.state', {}, [
        el('div', { text: '⚠️', attrs: { 'aria-hidden': 'true', style: 'font-size:36px' } }),
        el('h2', { text: t('app.error'), attrs: { style: 'font-size:17px' } }),
        el('p.hint', { text: error.message }),
        el('button.btn.btn--ghost', {
          text: t('app.retry'),
          attrs: { type: 'button' },
          on: { click: () => location.reload() }
        })
      ]));
    }
  );

  return root;
}

/**
 * Status xatosini matnga aylantiradi.
 * @param {*} error
 * @returns {string}
 */
function statusErrorText(error) {
  const code = String((error && error.code) || '');
  if (code === 'not-assigned') return t('orders.notAssigned');
  if (code === 'order-closed') return t('orders.tooLate');
  if (code === 'status-forbidden') return t('orders.statusError');
  if (code === 'timeout' || code === 'network') return t('auth.networkError');
  return error.message || t('app.error');
}

/** Sahifa yopilganda obunani uzadi. */
export function destroy() {
  if (stopWatch) stopWatch();
  stopWatch = null;
}
