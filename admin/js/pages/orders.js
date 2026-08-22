/**
 * Buyurtmalar oqimi (SPEC 106–110).
 *
 * `onSnapshot` orqali real vaqtda yangilanadi. Yangi buyurtma kelganda
 * ovoz signali beriladi — operator ekranga qaramay ham eshitadi.
 *
 * Status o'zgarishi client'dan Firestore'ga YOZILMAYDI: SPEC 3-bo'lim
 * bo'yicha `orders` ga faqat Node servis yozadi, shuning uchun har bir
 * amal `admin/js/api.js` orqali servisga boradi.
 */

import { t, pick } from '../i18n.js';
import { el, toast, modal, confirm, skeleton, emptyState, selectField } from '../ui.js';
import { ADMIN } from '../config.js';
import { watchActiveOrders, getCouriers } from '../db.js';
import { setOrderStatus, assignCourier } from '../api.js';
import { setCounter } from '../app.js';

/** @type {?Function} obunani uzish */
let stopWatch = null;

/** @type {?number} taymerlarni yangilab turuvchi interval */
let ticker = null;

/** @type {?AudioContext} ovoz signali uchun */
let audioCtx = null;

/** Oldingi chizishdagi buyurtma ID lari — yangisini topish uchun. */
let knownIds = new Set();

/** Birinchi yuklashda ovoz chalinmasin. */
let firstLoad = true;

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
 * Buyurtma qancha vaqt kutayotganini daqiqada beradi.
 * @param {object} order
 * @returns {number}
 */
function waitingMinutes(order) {
  const created = toDate(order.createdAt);
  return created ? Math.floor((Date.now() - created.getTime()) / 60000) : 0;
}

/**
 * Kafolat muddati o'tganmi.
 * @param {object} order
 * @returns {boolean}
 */
function isLate(order) {
  const deadline = toDate(order.guaranteeDeadline);
  return Boolean(deadline) && Date.now() > deadline.getTime();
}

/**
 * Yangi buyurtma signali — qisqa "biq" ovozi.
 *
 * Audio fayl yuklanmaydi: WebAudio bilan generatsiya qilinadi, shunda
 * tarmoq va kesh bilan bog'liq muammo bo'lmaydi. Brauzer foydalanuvchi
 * hech nima bosmagan bo'lsa ovozni to'sadi — bu holat jim o'tadi.
 */
function beep() {
  try {
    const enabled = localStorage.getItem(ADMIN.storage.sound);
    if (enabled === 'off') return;
  } catch (e) {
    // localStorage yopiq — standart bo'yicha ovoz yoqiq
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.36);
  } catch (e) {
    console.warn('[orders] ovoz chalinmadi:', e.message);
  }
}

/**
 * Status bo'yicha keyingi bosqichni beradi.
 * @param {string} status
 * @returns {?string}
 */
function nextStatus(status) {
  const index = ADMIN.statuses.indexOf(status);
  return index >= 0 && index < ADMIN.statuses.length - 1 ? ADMIN.statuses[index + 1] : null;
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  destroy();
  knownIds = new Set();
  firstLoad = true;

  const root = el('div.orders-page');
  const listHost = el('div.grid.grid--wide');
  listHost.append(skeleton('card', 3));

  /** @type {object[]} oxirgi kelgan buyurtmalar */
  let orders = [];
  /** @type {string} status filtri */
  let filter = 'all';
  /** @type {object[]} kuryerlar keshi */
  let couriers = [];

  /* -------------------------------------------------------- boshqaruv */

  /**
   * Servisga amal yuboradi va natijani ko'rsatadi.
   * @param {HTMLElement} button
   * @param {() => Promise<*>} action
   * @param {string} successKey
   */
  async function run(button, action, successKey) {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = t('app.loading');
    try {
      await action();
      toast(t(successKey), { type: 'success' });
      // Ro'yxat `onSnapshot` orqali o'zi yangilanadi
    } catch (e) {
      console.error('[orders] amal bajarilmadi:', e);
      toast(e.message || t('app.error'), { type: 'error' });
      button.disabled = false;
      button.textContent = label;
    }
  }

  /**
   * Qabul qilish oynasi — tayyorlanish vaqti so'raladi (SPEC 108).
   * @param {object} order
   * @param {HTMLElement} button
   */
  function openAccept(order, button) {
    let minutes = order.etaMinutes || ADMIN.prepMinutes[3];

    const chips = el('div.row.row--tight');
    ADMIN.prepMinutes.forEach((value) => {
      chips.append(el(`button.chip${value === minutes ? '.is-active' : ''}`, {
        text: `${value} ${t('common.minutes')}`,
        attrs: { type: 'button' },
        on: {
          click: (e) => {
            minutes = value;
            chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
            e.target.classList.add('is-active');
          }
        }
      }));
    });

    modal({
      title: t('orders.prepTime'),
      content: el('div', {}, [
        el('p.hint', { text: t('orders.number', { n: order.orderNumber }) }),
        chips
      ]),
      actions: [
        { label: t('common.cancel') },
        {
          label: t('orders.accept'),
          variant: 'ok',
          onClick: () => {
            run(button, () => setOrderStatus(order.id, 'accepted', { etaMinutes: minutes }),
              'orders.accepted');
          }
        }
      ]
    });
  }

  /**
   * Rad etish oynasi — sabab bilan (SPEC 107).
   * @param {object} order
   * @param {HTMLElement} button
   */
  function openReject(order, button) {
    let reason = ADMIN.rejectReasons[0];
    const other = el('input.input', {
      attrs: { type: 'text', placeholder: t('reject.other'), hidden: true }
    });

    const { node } = selectField({
      label: t('orders.rejectTitle'),
      value: reason,
      options: ADMIN.rejectReasons.map((key) => ({ value: key, label: t(key) })),
      onChange: (value) => {
        reason = value;
        other.hidden = value !== 'reject.other';
      }
    });

    modal({
      title: t('orders.rejectTitle'),
      content: el('div', {}, [
        el('p.hint', { text: t('orders.rejectHint') }),
        node,
        other
      ]),
      actions: [
        { label: t('common.cancel') },
        {
          label: t('orders.reject'),
          variant: 'danger',
          onClick: () => {
            const text = reason === 'reject.other' && other.value.trim()
              ? other.value.trim()
              : t(reason);
            run(button, () => setOrderStatus(order.id, 'cancelled', { reason: text }),
              'orders.rejected');
          }
        }
      ]
    });
  }

  /**
   * Kuryer tanlash oynasi (SPEC 110).
   * @param {object} order
   * @param {HTMLElement} button
   */
  async function openAssign(order, button) {
    if (!couriers.length) {
      try {
        couriers = await getCouriers();
      } catch (e) {
        console.error('[orders] kuryerlar yuklanmadi:', e);
        toast(t('app.error'), { type: 'error' });
        return;
      }
    }

    // `pending_` — kuryer hali ilovaga kirmagan, unga tayinlab bo'lmaydi
    // (servis 409 `courier-pending` qaytaradi), shuning uchun ro'yxatda
    // ham ko'rinmaydi
    const onShift = couriers.filter((c) => (
      c.onShift !== false && c.active !== false && !String(c.id).startsWith('pending_')
    ));
    if (!onShift.length) {
      modal({
        title: t('orders.assignTitle'),
        content: t('orders.noCouriers'),
        actions: [{ label: t('common.close'), variant: 'ghost' }]
      });
      return;
    }

    let selected = order.courierId || onShift[0].id;
    const { node } = selectField({
      label: t('orders.courier'),
      value: selected,
      options: onShift.map((c) => ({
        value: c.id,
        label: `${c.name || c.id}${c.phone ? ` · ${c.phone}` : ''}`
      })),
      onChange: (value) => { selected = value; }
    });

    modal({
      title: t('orders.assignTitle'),
      content: node,
      actions: [
        { label: t('common.cancel') },
        {
          label: t('orders.assign'),
          variant: 'primary',
          onClick: () => {
            run(button, () => assignCourier(order.id, selected), 'orders.assigned');
          }
        }
      ]
    });
  }

  /**
   * Keyingi bosqichga o'tkazadi.
   * @param {object} order
   * @param {HTMLElement} button
   */
  async function goNext(order, button) {
    const next = nextStatus(order.status);
    if (!next) return;

    // Yetkazildi — qaytarib bo'lmaydigan qadam, tasdiq so'raymiz
    if (next === 'delivered') {
      const yes = await confirm({
        title: t('status.delivered'),
        text: t('orders.number', { n: order.orderNumber })
      });
      if (!yes) return;
    }
    run(button, () => setOrderStatus(order.id, next), 'orders.statusChanged');
  }

  /* ------------------------------------------------------------ chizish */

  /**
   * Bitta buyurtma kartochkasi.
   * @param {object} order
   * @returns {HTMLElement}
   */
  function orderCard(order) {
    const late = isLate(order);
    const isNew = order.status === 'new';
    const waiting = waitingMinutes(order);

    const card = el(
      `div.card.order${isNew ? '.order--new' : ''}${late ? '.order--late' : ''}`,
      { attrs: { 'data-order': order.id } }
    );

    // Sarlavha
    card.append(el('div.order__head', {}, [
      el('div', {}, [
        el('div.order__num', { text: t('orders.number', { n: order.orderNumber || '—' }) }),
        el('p.order__meta', {
          text: [
            order.type === 'pickup' ? t('orders.pickup') : t('orders.delivery'),
            order.paymentMethod === 'card' ? t('reports.card') : t('reports.cash'),
            t('orders.waiting', { min: waiting })
          ].join(' · ')
        })
      ]),
      el('div.order__side', {}, [
        el(`span.badge${isNew ? '.badge--new' : late ? '.badge--err' : '.badge--info'}`, {
          text: t(`status.${order.status}`)
        }),
        el('div.order__price', { text: `${money(order.total)} ${t('common.sum')}` })
      ])
    ]));

    if (late) card.append(el('span.badge.badge--err', { text: t('orders.late') }));

    // Mijoz va manzil
    const lines = el('div');
    lines.append(el('dl.order__line', {}, [
      el('dt', { text: t('orders.customer') }),
      el('dd', { text: `${order.name || '—'} ${order.phone || ''}`.trim() })
    ]));
    if (order.type === 'delivery' && order.address) {
      const extra = [
        order.address.apartment && `kv. ${order.address.apartment}`,
        order.address.entrance && `pod. ${order.address.entrance}`,
        order.address.floor && `qavat ${order.address.floor}`
      ].filter(Boolean).join(', ');
      lines.append(el('dl.order__line', {}, [
        el('dt', { text: t('orders.address') }),
        el('dd', { text: extra ? `${order.address.address}, ${extra}` : order.address.address })
      ]));
    }
    if (order.comment) {
      lines.append(el('dl.order__line', {}, [
        el('dt', { text: t('orders.comment') }),
        el('dd', { text: order.comment })
      ]));
    }
    if (order.type === 'delivery') {
      lines.append(el('dl.order__line', {}, [
        el('dt', { text: t('orders.courier') }),
        el('dd', { text: order.courierName || order.courierId || t('orders.noCourier') })
      ]));
    }
    if (order.changeFrom) {
      lines.append(el('dl.order__line', {}, [
        el('dt', { text: t('orders.change') }),
        el('dd', { text: `${money(order.changeFrom)} ${t('common.sum')}` })
      ]));
    }
    card.append(lines);

    // Tarkib
    const items = el('ul.order__items');
    (order.items || []).forEach((item) => {
      const addons = (item.addons || []).map((a) => pick(a.name)).filter(Boolean);
      items.append(el('li', {}, [
        el('span', {}, [
          el('span', { text: `${pick(item.name)} × ${item.qty}` }),
          addons.length ? el('span.order__addons', { text: `+ ${addons.join(', ')}` }) : null
        ]),
        el('span.muted', { text: money(item.total ?? item.unitPrice * item.qty) })
      ]));
    });
    if (order.cutlery) {
      items.append(el('li', {}, [
        el('span.muted', { text: `${t('orders.cutlery')} × ${order.cutlery}` }),
        el('span', { text: '' })
      ]));
    }
    card.append(items);

    // Amallar
    const actions = el('div.order__row');
    if (isNew) {
      const accept = el('button.btn.btn--ok', {
        text: t('orders.accept'),
        attrs: { type: 'button' },
        on: { click: () => openAccept(order, accept) }
      });
      const reject = el('button.btn.btn--ghost', {
        text: t('orders.reject'),
        attrs: { type: 'button' },
        on: { click: () => openReject(order, reject) }
      });
      actions.append(accept, reject);
    } else {
      const next = nextStatus(order.status);
      if (next) {
        const btn = el('button.btn', {
          text: t(`status.${next}`),
          attrs: { type: 'button' },
          on: { click: () => goNext(order, btn) }
        });
        actions.append(btn);
      }
      if (order.type === 'delivery') {
        const assign = el('button.btn.btn--ghost', {
          text: order.courierId ? t('orders.courier') : t('orders.assign'),
          attrs: { type: 'button' },
          on: { click: () => openAssign(order, assign) }
        });
        actions.append(assign);
      }
      const cancel = el('button.btn.btn--ghost', {
        text: t('orders.reject'),
        attrs: { type: 'button' },
        on: { click: () => openReject(order, cancel) }
      });
      actions.append(cancel);
    }
    card.append(actions);

    return card;
  }

  /** Filtrga mos buyurtmalarni chizadi. */
  function draw() {
    const visible = orders
      .filter((o) => ADMIN.activeStatuses.includes(o.status))
      .filter((o) => filter === 'all' || o.status === filter);

    if (!visible.length) {
      listHost.replaceChildren(emptyState({ icon: '✅', title: t('orders.empty') }));
      return;
    }
    listHost.replaceChildren(...visible.map(orderCard));
  }

  /* ------------------------------------------------------------ panel */

  const filters = el('div.toolbar');
  const filterOptions = [{ value: 'all', label: t('orders.filterAll') }]
    .concat(ADMIN.activeStatuses.map((s) => ({ value: s, label: t(`status.${s}`) })));

  filterOptions.forEach((opt) => {
    filters.append(el(`button.chip${opt.value === 'all' ? '.is-active' : ''}`, {
      text: opt.label,
      attrs: { type: 'button' },
      on: {
        click: (e) => {
          filter = opt.value;
          filters.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
          e.target.classList.add('is-active');
          draw();
        }
      }
    }));
  });

  let soundOn = true;
  try {
    soundOn = localStorage.getItem(ADMIN.storage.sound) !== 'off';
  } catch (e) {
    // localStorage yopiq — ovoz yoqiq qoladi
  }

  const soundBtn = el('button.btn.btn--ghost.btn--sm.toolbar__spacer', {
    text: `${t('orders.sound')}: ${soundOn ? '🔔' : '🔕'}`,
    attrs: { type: 'button' },
    on: {
      click: () => {
        soundOn = !soundOn;
        try {
          localStorage.setItem(ADMIN.storage.sound, soundOn ? 'on' : 'off');
        } catch (e) {
          // Saqlanmasa ham joriy seansda ishlaydi
        }
        soundBtn.textContent = `${t('orders.sound')}: ${soundOn ? '🔔' : '🔕'}`;
        // Brauzer ovozga ruxsatni foydalanuvchi bosgandan keyin beradi
        if (soundOn) beep();
      }
    }
  });

  filters.append(soundBtn);
  root.append(filters, listHost);

  /* --------------------------------------------------------- obunalar */

  stopWatch = watchActiveOrders(
    (list) => {
      orders = list;

      // Yangi buyurtma kelganini topamiz — ovoz uchun
      const fresh = list.filter((o) => o.status === 'new' && !knownIds.has(o.id));
      knownIds = new Set(list.map((o) => o.id));

      if (!firstLoad && fresh.length) {
        beep();
        toast(t('orders.new'), { type: 'success' });
      }
      firstLoad = false;

      setCounter('orders', list.filter((o) => o.status === 'new').length);
      setCounter('kds', list.filter((o) => ADMIN.kdsStatuses.includes(o.status)).length);
      draw();
    },
    (error) => {
      console.error('[orders] oqim uzildi:', error);
      listHost.replaceChildren(emptyState({
        icon: '⚠️',
        title: t('app.error'),
        hint: error.message
      }));
    }
  );

  // Kutish vaqti va kechikish belgisi har daqiqada yangilanadi
  ticker = setInterval(draw, 30000);

  return root;
}

/** Sahifa yopilganda obunalarni uzadi. */
export function destroy() {
  if (stopWatch) stopWatch();
  stopWatch = null;
  if (ticker) clearInterval(ticker);
  ticker = null;
}
