/**
 * Mahsulot oynasi — pastdan chiqadigan bottom-sheet.
 *
 * Ichida: rasm galereyasi (swipe), tavsif, o'lcham, xamir turi,
 * qo'shimcha ingredientlar, olib tashlanadigan ingredientlar, miqdor
 * va real vaqtda hisoblanadigan yakuniy narx.
 *
 * Bu modul router sahifasi emas — `menu.js` uni bevosita chaqiradi.
 */

import { t, pick } from '../i18n.js';
import { el, bottomSheet, toast } from '../ui.js';
import { formatPrice, haptic, clamp } from '../utils.js';
import { addToCart } from '../state.js';

/**
 * Ro'yxatdagi takrorlanmas qiymatlar (tartibi saqlanadi).
 * @param {Array<string>} values
 * @returns {Array<string>}
 */
function unique(values) {
  return [...new Set(values.filter((v) => v !== undefined && v !== null && v !== ''))];
}

/**
 * Xamir turining tarjimasi. Noma'lum qiymat bo'lsa o'zi qaytadi.
 * @param {string} dough
 * @returns {string}
 */
function doughLabel(dough) {
  const key = `product.dough.${dough}`;
  const label = t(key);
  return label === key ? dough : label;
}

/**
 * O'lcham yorlig'i: pitsada "30 sm", ichimlikda "0.5 l" kabi o'z matni.
 * @param {string} size
 * @returns {string}
 */
function sizeLabel(size) {
  return /^\d+$/.test(String(size)) ? `${size} ${t('unit.cm')}` : String(size);
}

/**
 * Rasm galereyasi — gorizontal scroll-snap va nuqtalar.
 * @param {string[]} images
 * @param {string} fallbackIcon
 * @param {string} alt
 * @returns {HTMLElement}
 */
function gallery(images, fallbackIcon, alt) {
  const list = (images || []).filter(Boolean);
  const wrap = el('div.gallery');

  if (!list.length) {
    wrap.append(el('div.gallery__ph', { text: fallbackIcon, attrs: { 'aria-hidden': 'true' } }));
    return wrap;
  }

  const track = el('div.gallery__track');
  list.forEach((src, i) => {
    const slide = el('div.gallery__slide');
    const placeholder = () => slide.replaceChildren(
      el('div.gallery__ph', { text: fallbackIcon, attrs: { 'aria-hidden': 'true' } })
    );
    slide.append(el('img.gallery__img', {
      attrs: { src, alt: `${alt} ${i + 1}`, loading: i ? 'lazy' : 'eager', decoding: 'async' },
      on: { error: placeholder }
    }));
    track.append(slide);
  });
  wrap.append(track);

  if (list.length > 1) {
    const dots = el('div.gallery__dots', { attrs: { 'aria-hidden': 'true' } });
    list.forEach((_, i) => dots.append(el(`span.gallery__dot${i === 0 ? '.is-active' : ''}`)));
    wrap.append(dots);
    track.addEventListener('scroll', () => {
      const index = Math.round(track.scrollLeft / track.clientWidth);
      [...dots.children].forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    }, { passive: true });
  }
  return wrap;
}

/**
 * Tanlov tugmalari qatori (o'lcham / xamir).
 * @param {Array<{value: string, label: string, disabled?: boolean}>} options
 * @param {string} value - tanlangan qiymat
 * @param {(value: string) => void} onChange
 * @returns {HTMLElement}
 */
function segmented(options, value, onChange) {
  const box = el('div.seg', { attrs: { role: 'radiogroup' } });
  options.forEach((opt) => {
    box.append(el(`button.seg__btn${opt.value === value ? '.is-active' : ''}`, {
      text: opt.label,
      attrs: {
        type: 'button',
        role: 'radio',
        'aria-checked': opt.value === value ? 'true' : 'false',
        disabled: opt.disabled ? 'disabled' : null
      },
      on: { click: () => onChange(opt.value) }
    }));
  });
  return box;
}

/**
 * Mahsulot oynasini ochadi.
 * @param {object} product - `menu/current` dagi mahsulot
 * @param {{stopList?: Set<string>, icon?: string}} [cfg]
 * @returns {{close: Function}}
 */
export function openProduct(product, cfg = {}) {
  const stop = cfg.stopList || new Set();
  const icon = cfg.icon || '🍕';
  const variants = product.variants || [];

  const sizes = unique(variants.map((v) => v.size));
  const state = {
    size: sizes[0],
    dough: null,
    addons: new Set(),
    removed: new Set(),
    qty: 1
  };

  /** Tanlangan o'lchamdagi xamir turlari. */
  const doughsFor = (size) => unique(variants.filter((v) => v.size === size).map((v) => v.dough));

  /** Joriy tanlovga mos variant. */
  const currentVariant = () => variants.find(
    (v) => v.size === state.size && (!state.dough || v.dough === state.dough)
  ) || variants.find((v) => v.size === state.size) || variants[0];

  // Birinchi mavjud (stop-listda bo'lmagan) o'lcham tanlanadi
  const freeSize = sizes.find((size) => variants.some((v) => v.size === size && !stop.has(v.id)));
  if (freeSize) state.size = freeSize;
  state.dough = doughsFor(state.size)[0] || null;

  /* ------------------------------------------------------------- tarkib */

  const optionsBox = el('div.opts');
  const footPrice = el('span.sheet-foot__price');
  const addBtn = el('button.btn.btn--primary.btn--lg.btn--block', {
    attrs: { type: 'button' }
  });
  const meta = el('p.hint.prod-meta');

  /** Bitta dona narxi: variant + tanlangan qo'shimchalar. */
  function unitPrice() {
    const variant = currentVariant();
    const addonsSum = (product.addons || [])
      .filter((a) => state.addons.has(a.id))
      .reduce((sum, a) => sum + (a.price || 0), 0);
    return (variant ? variant.price : 0) + addonsSum;
  }

  /** Narx, meta va tugma holatini yangilaydi. */
  function refresh() {
    const variant = currentVariant();
    const stopped = !variant || stop.has(variant.id);
    const total = unitPrice() * state.qty;

    footPrice.textContent = formatPrice(total);
    addBtn.textContent = stopped ? t('menu.stopList') : t('menu.addToCart');
    addBtn.disabled = stopped;

    const parts = [];
    if (variant && variant.weight) {
      parts.push(`${t('product.weight')}: ${variant.weight} ${t('unit.g')}`);
    }
    if (variant && variant.kcal) parts.push(`${t('product.kcal')}: ${variant.kcal}`);
    meta.textContent = parts.join(' · ');
  }

  /** O'lcham/xamir tanlovlarini qayta chizadi. */
  function renderOptions() {
    optionsBox.replaceChildren();

    if (sizes.length > 1) {
      optionsBox.append(
        el('div.opt-group', {}, [
          el('span.field__label', { text: t('product.size') }),
          segmented(
            sizes.map((size) => ({
              value: size,
              label: sizeLabel(size),
              disabled: variants.filter((v) => v.size === size).every((v) => stop.has(v.id))
            })),
            state.size,
            (size) => {
              state.size = size;
              const doughs = doughsFor(size);
              if (!doughs.includes(state.dough)) state.dough = doughs[0] || null;
              renderOptions();
              refresh();
            }
          )
        ])
      );
    }

    const doughs = doughsFor(state.size);
    if (doughs.length > 1) {
      optionsBox.append(
        el('div.opt-group', {}, [
          el('span.field__label', { text: t('product.dough') }),
          segmented(
            doughs.map((dough) => ({
              value: dough,
              label: doughLabel(dough),
              disabled: stop.has((variants.find((v) => v.size === state.size && v.dough === dough) || {}).id)
            })),
            state.dough,
            (dough) => {
              state.dough = dough;
              renderOptions();
              refresh();
            }
          )
        ])
      );
    }

    if ((product.addons || []).length) {
      const rows = el('div.opt-list');
      product.addons.forEach((addon) => {
        const active = state.addons.has(addon.id);
        rows.append(el(`button.opt-row${active ? '.is-active' : ''}`, {
          attrs: { type: 'button', 'aria-pressed': active ? 'true' : 'false' },
          on: {
            click: () => {
              if (state.addons.has(addon.id)) state.addons.delete(addon.id);
              else state.addons.add(addon.id);
              renderOptions();
              refresh();
            }
          }
        }, [
          el('span.opt-row__check', { text: active ? '✓' : '+', attrs: { 'aria-hidden': 'true' } }),
          el('span.opt-row__name', { text: pick(addon.name) }),
          el('span.opt-row__price', { text: `+${formatPrice(addon.price, false)}` })
        ]));
      });
      optionsBox.append(el('div.opt-group', {}, [
        el('span.field__label', { text: t('product.addons') }),
        rows
      ]));
    }

    if ((product.removable || []).length) {
      const chips = el('div.rem-chips');
      product.removable.forEach((item) => {
        const removed = state.removed.has(item.id);
        chips.append(el(`button.chip${removed ? '.is-removed' : ''}`, {
          text: removed ? `− ${pick(item.name)}` : pick(item.name),
          attrs: { type: 'button', 'aria-pressed': removed ? 'true' : 'false' },
          on: {
            click: () => {
              if (state.removed.has(item.id)) state.removed.delete(item.id);
              else state.removed.add(item.id);
              renderOptions();
              refresh();
            }
          }
        }));
      });
      optionsBox.append(el('div.opt-group', {}, [
        el('span.field__label', { text: t('product.removable') }),
        chips
      ]));
    }
  }

  /* --------------------------------------------------------------- oyna */

  const badges = el('div.prod-card__badges');
  (product.badges || []).forEach((badge) => {
    badges.append(el(`span.badge.badge--${badge}`, { text: t(`badge.${badge}`) }));
  });

  const content = el('div.prod-sheet', {}, [
    gallery(product.images, icon, pick(product.name)),
    badges.children.length ? badges : null,
    el('h3.prod-sheet__title', { text: pick(product.name) }),
    el('p.muted.prod-sheet__desc', { text: pick(product.description) }),
    meta,
    optionsBox
  ]);

  const qtyValue = el('span.stepper__value', { text: '1' });
  const setQty = (next) => {
    state.qty = clamp(next, 1, 99);
    qtyValue.textContent = String(state.qty);
    haptic();
    refresh();
  };

  const footer = el('div.sheet-foot', {}, [
    el('div.stepper', {}, [
      el('button.stepper__btn', {
        text: '−',
        attrs: { type: 'button', 'aria-label': '-1' },
        on: { click: () => setQty(state.qty - 1) }
      }),
      qtyValue,
      el('button.stepper__btn', {
        text: '+',
        attrs: { type: 'button', 'aria-label': '+1' },
        on: { click: () => setQty(state.qty + 1) }
      })
    ]),
    el('div.sheet-foot__main', {}, [footPrice, addBtn])
  ]);

  renderOptions();
  refresh();

  const sheet = bottomSheet({ title: pick(product.name), content, footer });

  addBtn.addEventListener('click', () => {
    const variant = currentVariant();
    if (!variant || stop.has(variant.id)) return;

    addToCart({
      productId: product.id,
      variantId: variant.id,
      name: pick(product.name),
      size: variant.size,
      dough: variant.dough || '',
      addons: (product.addons || [])
        .filter((a) => state.addons.has(a.id))
        .map((a) => ({ id: a.id, name: pick(a.name), price: a.price })),
      removed: (product.removable || [])
        .filter((r) => state.removed.has(r.id))
        .map((r) => ({ id: r.id, name: pick(r.name) })),
      qty: state.qty,
      unitPrice: unitPrice(),
      image: (product.images || [])[0] || ''
    });

    haptic([10, 30, 10]);
    toast(t('product.added'), { type: 'success' });
    sheet.close();
  });

  return sheet;
}
