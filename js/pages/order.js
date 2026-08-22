/**
 * Buyurtmalar: ro'yxat (`#/orders`) va treking (`#/order/:id`).
 *
 * Treking `onSnapshot` bilan real vaqtda ishlaydi: status o'zgarsa stepper
 * o'zi yangilanadi, kuryer koordinatasi ko'chsa xaritadagi marker suriladi.
 * Kafolat taymeri har soniyada sanaydi.
 */

import { t, pick } from '../i18n.js';
import { el, emptyState, skeleton, toast, bottomSheet, confirm as confirmDialog, loader } from '../ui.js';
import { formatPrice, formatDate, formatCountdown, formatPhone, toDate, haptic } from '../utils.js';
import { APP, DEFAULT_CENTER } from '../config.js';
import {
  getOrders, watchOrder, watchCourierLocation, saveRating, invalidateOrders
} from '../db.js';
import { cancelOrder } from '../api.js';
import { getState, addToCart } from '../state.js';
import { navigate, back } from '../router.js';

/** Sahifa yopilganda to'xtatiladigan ishlar. */
let cleanup = [];
/** Xarita namunasi (treking sahifasida). */
let mapInstance = null;

/** Statuslar ketma-ketligi — SPEC 66. */
const FLOW = APP.orderStatuses;

/**
 * Buyurtma bekor qilinganmi.
 *
 * Node servis `cancelled` (ikki L) yozadi, eski hujjatlarda esa
 * `canceled` uchraydi — ikkalasi ham qabul qilinadi.
 *
 * @param {string} status
 * @returns {boolean}
 */
function isCanceled(status) {
  return status === 'cancelled' || status === 'canceled';
}

/**
 * Statusning oqimdagi o'rni.
 * @param {string} status
 * @returns {number} topilmasa -1
 */
function stepIndex(status) {
  return FLOW.indexOf(status);
}

/**
 * `statusHistory` dan status vaqtini topadi.
 * @param {object} order
 * @param {string} status
 * @returns {?Date}
 */
function statusTime(order, status) {
  const row = (order.statusHistory || []).find((h) => h.status === status);
  return row ? toDate(row.at) : null;
}

/**
 * Buyurtma raqami ko'rinishi.
 * @param {object} order
 * @returns {string}
 */
function orderTitle(order) {
  return t('order.number', { n: order.orderNumber || order.id });
}

/* ------------------------------------------------------------- ro'yxat */

/**
 * Bitta buyurtma kartochkasi.
 * @param {object} order
 * @returns {HTMLElement}
 */
function orderCard(order) {
  const canceled = isCanceled(order.status);
  const done = order.status === 'delivered';

  return el('article.card.card--pad.order-card', {
    attrs: { role: 'button', tabindex: '0' },
    dataset: { id: order.id },
    on: {
      click: () => navigate(`/order/${order.id}`),
      keydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/order/${order.id}`);
        }
      }
    }
  }, [
    el('div.row.row--between', {}, [
      el('strong', { text: orderTitle(order) }),
      el(`span.badge${canceled ? '.badge--canceled' : done ? '.badge--done' : ''}`, {
        text: t(`status.${order.status}`)
      })
    ]),
    el('p.hint', { text: formatDate(order.createdAt) }),
    el('p.order-card__items', {
      // Servis nomni `{uz,ru,en}` obyekt qilib saqlaydi — `pick()` ikkala
      // shaklni ham tushunadi (eski buyurtmalarda oddiy satr bo'lishi mumkin)
      text: (order.items || []).map((i) => `${pick(i.name)} × ${i.qty}`).join(', ')
    }),
    el('div.row.row--between.order-card__foot', {}, [
      el('span.price', { text: formatPrice(order.total) }),
      el('button.btn.btn--outline.order-card__repeat', {
        text: t('order.repeat'),
        attrs: { type: 'button' },
        on: {
          click: (e) => {
            e.stopPropagation();
            repeatOrder(order);
          }
        }
      })
    ])
  ]);
}

/**
 * Bekor qilish xatosini foydalanuvchi matniga aylantiradi.
 * @param {*} error
 * @returns {string}
 */
function cancelErrorText(error) {
  const code = String((error && error.code) || '');
  if (code === 'too-late') return t('order.cancelTooLate');
  if (code === 'not-yours') return t('order.cancelNotYours');
  if (code === 'no-order') return t('order.notFound');
  if (code === 'timeout' || code === 'network') return t('order.cancelNoServer');
  if (code === 'no-session' || error?.status === 401) return t('auth.required');
  return t('app.error');
}

/**
 * Buyurtma tarkibini savatga qaytaradi (SPEC 81).
 * @param {object} order
 */
function repeatOrder(order) {
  const items = order.items || [];
  if (!items.length) return;
  items.forEach((item) => {
    // Savat elementida nom har doim SATR (`product.js` shunday yasaydi),
    // buyurtmada esa `{uz,ru,en}` obyekt bo'lishi mumkin — shu yerda
    // joriy tilga keltiriladi.
    addToCart({
      productId: item.productId,
      variantId: item.variantId,
      name: pick(item.name),
      size: item.size,
      dough: item.dough,
      addons: (item.addons || []).map((a) => ({ ...a, name: pick(a.name) })),
      removed: item.removed || [],
      qty: item.qty,
      unitPrice: item.unitPrice,
      image: item.image || ''
    });
  });
  haptic([10, 30, 10]);
  toast(t('order.repeated'), { type: 'success' });
  navigate('/cart');
}

/**
 * Buyurtmalar ro'yxatini chizadi.
 * @param {HTMLElement} body
 */
async function renderList(body) {
  const user = getState().user;
  if (!user) {
    body.replaceChildren(emptyState({
      icon: '🧾',
      title: t('order.empty'),
      hint: t('auth.required'),
      action: el('button.btn.btn--primary', {
        text: t('auth.login'),
        attrs: { type: 'button' },
        on: { click: () => navigate('/auth?next=/orders') }
      })
    }));
    return;
  }

  /**
   * Ro'yxatni chizadi. Fonda yangi ma'lumot kelganda ham chaqiriladi.
   * @param {object[]} orders
   */
  function draw(orders) {
    if (!orders.length) {
      body.replaceChildren(emptyState({
        icon: '🧾',
        title: t('order.empty'),
        hint: t('cart.emptyHint'),
        action: el('button.btn.btn--primary', {
          text: t('cart.goToMenu'),
          attrs: { type: 'button' },
          on: { click: () => navigate('/menu') }
        })
      }));
      return;
    }
    const list = el('div.order-list');
    orders.forEach((order) => list.append(orderCard(order)));
    body.replaceChildren(list);
  }

  body.replaceChildren(skeleton('list', 3));
  try {
    // Kesh bo'lsa ro'yxat darhol chiqadi, yangisi fonda kelib
    // `draw()` ni qayta chaqiradi — sahifa tarmoqni kutmaydi.
    draw(await getOrders(user.uid, 20, draw));
  } catch (e) {
    console.error('[order] tarix yuklanmadi:', e);
    body.replaceChildren(emptyState({
      icon: '⚠️',
      title: t('app.error'),
      hint: e.message,
      action: el('button.btn.btn--primary', {
        text: t('app.retry'),
        attrs: { type: 'button' },
        on: { click: () => renderList(body) }
      })
    }));
  }
}

/* ------------------------------------------------------------- treking */

/**
 * 7 bosqichli status stepper.
 * @param {object} order
 * @returns {HTMLElement}
 */
function stepper(order) {
  const current = stepIndex(order.status);
  const box = el('ol.stepper-list');

  if (isCanceled(order.status)) {
    return el('div.zone-info__box.zone-info__box--bad', {}, [
      el('p', { text: t(`status.${order.status}`) })
    ]);
  }

  FLOW.forEach((status, i) => {
    const at = statusTime(order, status);
    const state = i < current ? 'is-done' : i === current ? 'is-current' : '';
    box.append(el(`li.step${state ? `.${state}` : ''}`, {}, [
      el('span.step__dot', { attrs: { 'aria-hidden': 'true' } }),
      el('span.step__label', { text: t(`status.${status}`) }),
      at ? el('span.step__time', { text: formatDate(at).split(', ').pop() }) : null
    ]));
  });
  return box;
}

/**
 * Kafolat taymeri — har soniyada yangilanadi.
 * @param {object} order
 * @returns {?HTMLElement}
 */
function guaranteeTimer(order) {
  const deadline = toDate(order.guaranteeDeadline);
  if (!deadline || order.status === 'delivered' || order.status === 'canceled') return null;

  const value = el('strong.guarantee__value');
  const box = el('div.guarantee', {}, [
    el('span.guarantee__label', { text: t('order.guarantee', { min: APP.guaranteeMinutes }) }),
    value
  ]);

  const tick = () => {
    const left = deadline.getTime() - Date.now();
    if (left <= 0) {
      value.textContent = t('order.guaranteeBroken');
      box.classList.add('guarantee--broken');
      return false;
    }
    value.textContent = formatCountdown(left);
    return true;
  };

  if (tick()) {
    const timer = setInterval(() => {
      if (!tick()) clearInterval(timer);
    }, 1000);
    // `isTimer` belgisi: sahifa qayta chizilganda faqat taymer to'xtatiladi,
    // `onSnapshot` obunasi esa tirik qoladi.
    const stopTick = () => clearInterval(timer);
    stopTick.isTimer = true;
    cleanup.push(stopTick);
  }
  return box;
}

/**
 * Kuryer bloki: ism, telefon, qo'ng'iroq (SPEC 69).
 * @param {object} order
 * @returns {?HTMLElement}
 */
function courierBlock(order) {
  if (!order.courierId && !order.courierName) return null;
  const phone = order.courierPhone;
  return el('div.card.card--pad.courier', {}, [
    el('div.row.row--between', {}, [
      el('div', {}, [
        el('p.hint', { text: t('order.courier') }),
        el('strong', { text: order.courierName || order.courierId })
      ]),
      phone
        ? el('a.btn.btn--outline', {
          text: t('order.call'),
          attrs: { href: `tel:${phone}` }
        })
        : null
    ]),
    phone ? el('p.hint', { text: formatPhone(phone) }) : null
  ]);
}

/**
 * Kuryer xaritasi (SPEC 70). Xarita skripti faqat shu yerda yuklanadi.
 * @param {object} order
 * @returns {?HTMLElement}
 */
function courierMap(order) {
  const start = order.courierLocation || null;
  if (!order.courierId && !start) return null;

  const box = el('div.map.map--courier', {}, [
    el('div.map__loading', { text: t('app.loading') })
  ]);

  (async () => {
    let ymaps;
    try {
      const mod = await import('./address.js');
      ymaps = await mod.loadYmaps();
    } catch (e) {
      console.warn('[order] xarita yuklanmadi:', e);
      box.classList.add('map--failed');
      box.replaceChildren(el('div.map__fallback', {}, [
        el('p.map__fallback-title', { text: t('order.mapError') })
      ]));
      return;
    }

    try {
      const center = start && start.lat
        ? [start.lat, start.lng]
        : (order.lat ? [order.lat, order.lng] : DEFAULT_CENTER);
      box.replaceChildren();

      const map = new ymaps.Map(box, { center, zoom: 14, controls: ['zoomControl'] },
        { suppressMapOpenBlock: true });
      mapInstance = map;

      // Yetkazish manzili
      if (order.lat && order.lng) {
        map.geoObjects.add(new ymaps.Placemark([order.lat, order.lng], {
          balloonContent: t('checkout.address')
        }, { preset: 'islands#redHomeIcon' }));
      }

      const pin = new ymaps.Placemark(center, {}, { preset: 'islands#blueDeliveryIcon' });
      map.geoObjects.add(pin);

      // Kuryer koordinatasi real vaqtda ko'chadi
      if (order.courierId) {
        const stop = watchCourierLocation(order.courierId, (loc) => {
          if (!loc || typeof loc.lat !== 'number') return;
          console.log('[order] kuryer ko\'chdi:', loc.lat, loc.lng);
          pin.geometry.setCoordinates([loc.lat, loc.lng]);
          const zoom = typeof map.getZoom === 'function' ? map.getZoom() : 14;
          map.setCenter([loc.lat, loc.lng], zoom);
        });
        cleanup.push(stop);
      }
    } catch (e) {
      console.warn('[order] xarita yaratilmadi:', e);
      box.classList.add('map--failed');
      box.replaceChildren(el('div.map__fallback', {}, [
        el('p.map__fallback-title', { text: t('order.mapError') })
      ]));
    }
  })();

  return box;
}

/**
 * Baholash oynasi (SPEC 86-88). Rasm yuklash Storage'siz mumkin emas.
 * @param {object} order
 */
function openRating(order) {
  const scores = { food: 0, courier: 0 };

  /**
   * Yulduzlar qatori.
   * @param {'food'|'courier'} key
   * @param {string} label
   * @returns {HTMLElement}
   */
  const stars = (key, label) => {
    const row = el('div.stars', { attrs: { role: 'radiogroup', 'aria-label': label } });
    for (let i = 1; i <= 5; i += 1) {
      row.append(el('button.stars__item', {
        text: '☆',
        attrs: { type: 'button', 'aria-label': String(i) },
        dataset: { score: String(i) },
        on: {
          click: () => {
            scores[key] = i;
            [...row.children].forEach((star, idx) => {
              star.textContent = idx < i ? '★' : '☆';
              star.classList.toggle('is-active', idx < i);
            });
            haptic();
          }
        }
      }));
    }
    return el('div.opt-group', {}, [
      el('span.field__label', { text: label }),
      row
    ]);
  };

  const text = el('textarea.textarea', {
    attrs: { rows: '3', placeholder: t('order.ratingComment') }
  });

  const send = el('button.btn.btn--primary.btn--lg.btn--block', {
    text: t('common.save'),
    attrs: { type: 'button' },
    on: {
      click: async () => {
        if (!scores.food && !scores.courier) {
          toast(t('order.ratingRequired'), { type: 'error' });
          return;
        }
        loader.show();
        try {
          await saveRating(order.id, {
            food: scores.food,
            courier: scores.courier,
            text: text.value.trim()
          });
          toast(t('order.ratingThanks'), { type: 'success' });
          sheet.close();
        } catch (e) {
          console.error('[order] baho saqlanmadi:', e);
          toast(t('app.error'), { type: 'error' });
        } finally {
          loader.hide();
        }
      }
    }
  });

  const sheet = bottomSheet({
    title: t('order.rate'),
    content: el('div.opts', {}, [
      stars('food', t('order.rateFood')),
      stars('courier', t('order.rateCourier')),
      text
    ]),
    footer: send
  });
}

/**
 * Treking sahifasini chizadi.
 * @param {HTMLElement} body
 * @param {string} orderId
 */
function renderTracking(body, orderId) {
  body.replaceChildren(skeleton('card', 1));
  let mapDrawn = false;

  const stop = watchOrder(orderId, (order) => {
    if (!order) {
      body.replaceChildren(emptyState({ icon: '🤷', title: t('order.notFound') }));
      return;
    }
    console.log('[order] holat yangilandi:', order.status);

    // Taymerlar qayta chizishda ikkilanmasin
    cleanup.filter((fn) => fn.isTimer).forEach((fn) => fn());
    cleanup = cleanup.filter((fn) => !fn.isTimer);

    const timer = guaranteeTimer(order);
    const canCancel = ['new', 'accepted'].includes(order.status);

    const parts = [
      el('div.row.row--between.order-head', {}, [
        el('h2', { text: orderTitle(order) }),
        el('span.badge', { text: t(`status.${order.status}`) })
      ]),
      el('p.hint', { text: formatDate(order.createdAt) }),
      timer,
      stepper(order),
      courierBlock(order)
    ];

    // Xarita bir marta chiziladi — har snapshot'da qayta yaratilmaydi
    if (!mapDrawn) {
      const map = courierMap(order);
      if (map) {
        parts.push(map);
        mapDrawn = true;
      }
    }

    const items = el('div.sums');
    (order.items || []).forEach((item) => {
      items.append(el('div.sum-row', {}, [
        el('span', { text: `${pick(item.name)} × ${item.qty}` }),
        el('span', { text: formatPrice(item.total ?? item.unitPrice * item.qty) })
      ]));
    });
    items.append(
      el('div.sum-row', {}, [
        el('span', { text: t('cart.delivery') }),
        el('span', {
          text: order.deliveryPrice ? formatPrice(order.deliveryPrice) : t('common.free')
        })
      ]),
      el('div.sum-row.sum-row--total', {}, [
        el('span', { text: t('common.total') }),
        el('span', { text: formatPrice(order.total) })
      ])
    );
    parts.push(el('div.card.card--pad', {}, [items]));

    if (order.address && order.address.address) {
      parts.push(el('p.hint', { text: `${t('checkout.address')}: ${order.address.address}` }));
    }

    if (order.status === 'delivered' && !order.rating) {
      parts.push(el('button.btn.btn--primary.btn--block', {
        text: t('order.rate'),
        attrs: { type: 'button' },
        on: { click: () => openRating(order) }
      }));
    }
    parts.push(el('button.btn.btn--outline.btn--block', {
      text: t('order.repeat'),
      attrs: { type: 'button' },
      on: { click: () => repeatOrder(order) }
    }));
    // Bekor qilish faqat `new` va `accepted` bosqichlarida — oshxona
    // tayyorlashni boshlagach mijoz o'zi bekor qila olmaydi.
    if (canCancel) {
      const cancelBtn = el('button.btn.btn--ghost.btn--block', {
        text: t('order.cancel'),
        attrs: { type: 'button' },
        on: {
          click: async () => {
            const yes = await confirmDialog({
              title: t('order.cancel'),
              text: t('order.cancelHint'),
              okText: t('common.yes'),
              danger: true
            });
            if (!yes) return;

            // Client `orders` ga yoza olmaydi (SPEC 3-bo'lim) — bekor
            // qilishni Node servis bajaradi.
            cancelBtn.disabled = true;
            cancelBtn.textContent = t('app.loading');
            try {
              await cancelOrder(orderId, () => {
                cancelBtn.textContent = t('order.cancelWaking');
              });
              // Ro'yxat keshi eskirdi — buyurtmalar sahifasi yangisini olsin
              invalidateOrders(getState().user && getState().user.uid);
              toast(t('order.cancelled'), { type: 'success' });
              // Yangi status `onSnapshot` orqali o'zi keladi
            } catch (e) {
              console.error('[order] bekor qilinmadi:', e);
              toast(cancelErrorText(e), { type: 'error' });
              cancelBtn.disabled = false;
              cancelBtn.textContent = t('order.cancel');
            }
          }
        }
      });
      parts.push(cancelBtn);
    }

    body.replaceChildren(...parts.filter(Boolean));
  }, (error) => {
    body.replaceChildren(emptyState({
      icon: '⚠️',
      title: t('app.error'),
      hint: error.message
    }));
  });

  cleanup.push(stop);
}

/**
 * Sahifani chizadi: id bo'lsa treking, bo'lmasa ro'yxat.
 * @param {{params: object}} ctx
 * @returns {HTMLElement}
 */
export function render(ctx) {
  destroy();

  const id = ctx && ctx.params ? ctx.params.id : null;
  const root = el('div.page.orders');
  const body = el('div.order-body');

  root.append(
    el('div.page__head', {}, [
      id
        ? el('button.icon-btn', {
          text: '‹',
          attrs: { type: 'button', 'aria-label': t('common.back') },
          on: { click: () => back() }
        })
        : null,
      el('h1.page__title', { text: id ? t('order.title') : t('nav.orders') })
    ].filter(Boolean)),
    body
  );

  if (id) renderTracking(body, id);
  else renderList(body);

  return root;
}

/** Obunalar, taymerlar va xaritani tozalaydi. */
export function destroy() {
  cleanup.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      /* tozalash xatosi sahifani buzmasin */
    }
  });
  cleanup = [];
  if (mapInstance) {
    try {
      mapInstance.destroy();
    } catch (e) {
      /* xarita allaqachon yo'q bo'lishi mumkin */
    }
    mapInstance = null;
  }
}
