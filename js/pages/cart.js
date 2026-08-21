/**
 * Savat sahifasi.
 *
 * - miqdorni o'zgartirish va o'chirish (undo bilan);
 * - promokod (kod SERVERDA tekshiriladi — client `promocodes` ni o'qiy
 *   olmaydi, SPEC 3-bo'lim);
 * - minimal summa / bepul yetkazish progress-bari;
 * - upsell bloki;
 * - narx breakdown va rasmiylashtirish tugmasi.
 */

import { t, pick } from '../i18n.js';
import { el, emptyState, toast, skeleton } from '../ui.js';
import { formatPrice, clamp, haptic } from '../utils.js';
import { APP } from '../config.js';
import { getMenu } from '../db.js';
import { navigate } from '../router.js';
import {
  getState, subscribe, setQty, removeFromCart, undoRemove, setPromoCode
} from '../state.js';

/** Obunani to'xtatish uchun. */
let unsubscribe = null;

/**
 * Buyurtma summalarini hisoblaydi.
 *
 * Diqqat: bu — FAQAT ko'rsatish uchun. Yakuniy narxni Node servis
 * `menu/current` dan qayta hisoblaydi (SPEC 4-bo'lim), promokod chegirmasi
 * ham o'sha yerda qo'llanadi.
 *
 * @param {object} [state] - `getState()` natijasi (berilmasa o'qiladi)
 * @returns {{subtotal: number, delivery: number, discount: number,
 *            total: number, minOrder: number, freeFrom: number,
 *            minOrderMet: boolean, freeDelivery: boolean}}
 */
export function calcTotals(state = getState()) {
  // Manzil zonasi aniqlangan bo'lsa narx va minimal summa o'shandan olinadi
  // (3-bosqich), aks holda config.js dagi zaxira qiymatlar ishlatiladi.
  const zone = state.address && state.address.zone;
  const price = zone && Number.isFinite(zone.deliveryPrice)
    ? zone.deliveryPrice
    : APP.delivery.price;
  const minOrder = zone && Number.isFinite(zone.minOrder)
    ? zone.minOrder
    : APP.delivery.minOrder;
  const { freeFrom } = APP.delivery;
  const subtotal = state.cart.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
  const isPickup = state.orderType === 'pickup';
  const freeDelivery = isPickup || subtotal >= freeFrom;
  const delivery = subtotal === 0 || freeDelivery ? 0 : price;

  return {
    subtotal,
    delivery,
    discount: 0, // promokod chegirmasi serverda hisoblanadi
    total: subtotal + delivery,
    zone: zone || null,
    minOrder: isPickup ? 0 : minOrder,
    freeFrom,
    minOrderMet: isPickup || subtotal >= minOrder,
    freeDelivery
  };
}

/**
 * Savat elementining konfiguratsiya matni: o'lcham, xamir, qo'shimchalar.
 * @param {object} item
 * @returns {string}
 */
function itemSummary(item) {
  const parts = [];
  if (item.size) parts.push(/^\d+$/.test(item.size) ? `${item.size} ${t('unit.cm')}` : item.size);
  if (item.dough) {
    const key = `product.dough.${item.dough}`;
    const label = t(key);
    parts.push(label === key ? item.dough : label);
  }
  (item.addons || []).forEach((a) => parts.push(`+ ${a.name}`));
  if ((item.removed || []).length) {
    parts.push(`${t('cart.removed')}: ${item.removed.map((r) => r.name).join(', ')}`);
  }
  return parts.join(' · ');
}

/**
 * Savatdagi bitta qator.
 * @param {object} item
 * @returns {HTMLElement}
 */
function cartRow(item) {
  const thumb = el('div.cart-row__media');
  if (item.image) {
    thumb.append(el('img.cart-row__img', {
      attrs: { src: item.image, alt: item.name, loading: 'lazy' },
      on: { error: () => thumb.replaceChildren(el('span.cart-row__ph', { text: '🍕' })) }
    }));
  } else {
    thumb.append(el('span.cart-row__ph', { text: '🍕', attrs: { 'aria-hidden': 'true' } }));
  }

  const qtyValue = el('span.stepper__value', { text: String(item.qty) });

  return el('article.card.cart-row', {}, [
    thumb,
    el('div.cart-row__main', {}, [
      el('h3.cart-row__name', { text: item.name }),
      el('p.cart-row__opts', { text: itemSummary(item) }),
      el('div.cart-row__foot', {}, [
        el('div.stepper', {}, [
          el('button.stepper__btn', {
            text: '−',
            attrs: { type: 'button', 'aria-label': '-1' },
            on: {
              click: () => {
                haptic();
                if (item.qty <= 1) removeWithUndo(item);
                else setQty(item.key, item.qty - 1);
              }
            }
          }),
          qtyValue,
          el('button.stepper__btn', {
            text: '+',
            attrs: { type: 'button', 'aria-label': '+1' },
            on: {
              click: () => {
                haptic();
                setQty(item.key, clamp(item.qty + 1, 1, 99));
              }
            }
          })
        ]),
        el('span.price.cart-row__price', { text: formatPrice(item.unitPrice * item.qty) })
      ])
    ]),
    el('button.icon-btn.cart-row__del', {
      html: '&times;',
      attrs: { type: 'button', 'aria-label': t('common.delete') },
      on: { click: () => removeWithUndo(item) }
    })
  ]);
}

/**
 * O'chiradi va "Qaytarish" tugmasi bilan toast ko'rsatadi.
 * @param {object} item
 */
function removeWithUndo(item) {
  removeFromCart(item.key);
  haptic();
  toast(t('cart.itemRemoved'), {
    action: { label: t('common.undo'), onClick: () => undoRemove() }
  });
}

/**
 * Minimal summa / bepul yetkazish progress-bari.
 * @param {object} totals
 * @returns {?HTMLElement}
 */
function progressBlock(totals) {
  if (totals.subtotal === 0) return null;

  let text;
  let ratio;
  if (!totals.minOrderMet) {
    text = t('cart.toMinOrder', { sum: formatPrice(totals.minOrder - totals.subtotal) });
    ratio = totals.subtotal / totals.minOrder;
  } else if (!totals.freeDelivery) {
    text = t('cart.freeDeliveryIn', { sum: formatPrice(totals.freeFrom - totals.subtotal) });
    ratio = totals.subtotal / totals.freeFrom;
  } else {
    text = t('cart.freeDelivery');
    ratio = 1;
  }

  const percent = Math.round(clamp(ratio, 0, 1) * 100);
  return el(`div.progress${totals.minOrderMet ? '' : '.progress--warn'}`, {}, [
    el('p.progress__text', { text }),
    el('div.progress__track', {
      attrs: {
        role: 'progressbar',
        'aria-valuenow': String(percent),
        'aria-valuemin': '0',
        'aria-valuemax': '100'
      }
    }, [
      el('div.progress__fill', { attrs: { style: `width:${percent}%` } })
    ])
  ]);
}

/**
 * Narx breakdown kartochkasi.
 * @param {object} totals
 * @param {?string} promoCode
 * @returns {HTMLElement}
 */
function breakdown(totals, promoCode) {
  const row = (label, value, cls = '') => el(`div.sum-row${cls}`, {}, [
    el('span', { text: label }),
    el('span', { text: value })
  ]);

  const rows = [
    row(t('cart.subtotal'), formatPrice(totals.subtotal)),
    row(
      t('cart.delivery'),
      totals.freeDelivery ? t('common.free') : formatPrice(totals.delivery)
    )
  ];
  if (promoCode) {
    rows.push(row(`${t('cart.promo')} · ${promoCode}`, t('cart.promoPending'), '.sum-row--muted'));
  }
  rows.push(row(t('common.total'), formatPrice(totals.total), '.sum-row--total'));

  return el('div.card.card--pad.sums', {}, rows);
}

/**
 * Promokod bloki.
 * @param {?string} promoCode
 * @returns {HTMLElement}
 */
function promoBlock(promoCode) {
  if (promoCode) {
    return el('div.card.card--pad.promo', {}, [
      el('div.row.row--between', {}, [
        el('div', {}, [
          el('strong', { text: promoCode }),
          el('p.hint', { text: t('cart.promoPending') })
        ]),
        el('button.btn.btn--ghost', {
          text: t('common.delete'),
          attrs: { type: 'button' },
          on: {
            click: () => {
              setPromoCode(null);
              toast(t('cart.promoRemoved'));
            }
          }
        })
      ])
    ]);
  }

  const input = el('input.input', {
    attrs: {
      type: 'text',
      autocapitalize: 'characters',
      autocomplete: 'off',
      placeholder: t('cart.promoPlaceholder'),
      'aria-label': t('cart.promo')
    }
  });
  const apply = () => {
    const code = input.value.trim();
    if (!code) return;
    setPromoCode(code);
    toast(t('cart.promoSaved'), { type: 'success' });
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') apply();
  });

  return el('div.card.card--pad.promo', {}, [
    el('div.promo__row', {}, [
      input,
      el('button.btn.btn--outline', {
        text: t('cart.promoApply'),
        attrs: { type: 'button' },
        on: { click: apply }
      })
    ])
  ]);
}

/**
 * Upsell bloki — savatda yo'q mahsulotlar (ichimlik/zakuska birinchi).
 * @param {HTMLElement} host
 */
async function loadUpsell(host) {
  try {
    const menu = await getMenu();
    const inCart = new Set(getState().cart.map((i) => i.productId));
    const candidates = (menu.products || [])
      .filter((p) => p.active !== false && !inCart.has(p.id) && p.variants.length)
      .sort((a, b) => {
        // Ichimlik va zakuska oldinroq — ular ko'proq qo'shiladi
        const weight = (p) => (p.categoryId === 'cat-pizza' ? 1 : 0);
        return weight(a) - weight(b) || (a.order || 0) - (b.order || 0);
      })
      .slice(0, 6);

    if (!candidates.length) {
      host.remove();
      return;
    }

    const strip = el('div.upsell__strip');
    candidates.forEach((product) => {
      const price = product.variants.reduce((m, v) => Math.min(m, v.price), Infinity);
      strip.append(el('button.upsell__card', {
        attrs: { type: 'button' },
        on: {
          click: async () => {
            const mod = await import('./product.js');
            mod.openProduct(product, { icon: '🍽' });
          }
        }
      }, [
        el('span.upsell__name', { text: pick(product.name) }),
        el('span.upsell__price', { text: formatPrice(price) })
      ]));
    });

    host.replaceChildren(
      el('h2.section-title', { text: t('cart.upsell') }),
      strip
    );
  } catch (e) {
    // Upsell ikkinchi darajali — yuklanmasa blok olib tashlanadi
    console.warn('Upsell yuklanmadi:', e);
    host.remove();
  }
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  destroy();

  const root = el('div.page.cart');
  const body = el('div.cart-body');
  root.append(body);

  /** Savat holati o'zgarganda qayta chiziladi. */
  const rebuild = (state) => {
    const totals = calcTotals(state);
    body.replaceChildren();

    if (!state.cart.length) {
      body.append(emptyState({
        icon: '🛒',
        title: t('cart.empty'),
        hint: t('cart.emptyHint'),
        action: el('button.btn.btn--primary', {
          text: t('cart.goToMenu'),
          attrs: { type: 'button' },
          on: { click: () => navigate('/menu') }
        })
      }));
      return;
    }

    const list = el('div.cart-list');
    state.cart.forEach((item) => list.append(cartRow(item)));

    const progress = progressBlock(totals);
    const upsell = el('section.upsell', {}, [skeleton('line', 2)]);

    body.append(
      list,
      progress || document.createComment(''),
      promoBlock(state.promoCode),
      upsell,
      breakdown(totals, state.promoCode),
      el('div.cart-cta', {}, [
        el('button.btn.btn--primary.btn--lg.btn--block', {
          text: `${t('cart.checkout')} · ${formatPrice(totals.total)}`,
          attrs: { type: 'button', disabled: totals.minOrderMet ? null : 'disabled' },
          on: { click: () => navigate('/checkout') }
        }),
        totals.minOrderMet
          ? null
          : el('p.hint.cart-cta__hint', {
            text: t('checkout.minOrderNotMet', { sum: formatPrice(totals.minOrder) })
          })
      ])
    );

    loadUpsell(upsell);
  };

  unsubscribe = subscribe(rebuild);
  return root;
}

/** Sahifa yopilganda obunani to'xtatadi. */
export function destroy() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
}
