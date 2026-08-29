/**
 * Banner CRUD (SPEC 116).
 *
 * Tartib `order` maydoni bilan belgilanadi. Uni surish uchun drag
 * emas, YUQORI/PAST tugmalari qo'yilgan: admin panel sensorli
 * ekranda ham ochiladi va u yerda drag ishonchsiz — tugma esa har
 * joyda bir xil ishlaydi va klaviatura bilan ham yuriydi.
 *
 * Oldindan ko'rish mijoz ilovasidagi karusel bilan BIR XIL nisbatda
 * (16:5) va bir xil radiusda chiziladi — `css/style.css` dagi
 * `.banner` bilan mos.
 */

import { t, pick } from '../i18n.js';
import {
  el, toast, modal, confirm, skeleton, emptyState, field, checkbox
} from '../ui.js';
import { getBanners, saveBanner, deleteBanner } from '../db.js';

/**
 * `Timestamp` yoki `Date` ni `YYYY-MM-DD` ga aylantiradi.
 * @param {*} value
 * @returns {string}
 */
function toDateInput(value) {
  if (!value) return '';
  const ms = typeof value.toMillis === 'function' ? value.toMillis()
    : typeof value.seconds === 'number' ? value.seconds * 1000
      : new Date(value).getTime();
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
}

/**
 * `YYYY-MM-DD` ni `Date` ga aylantiradi.
 * @param {string} text
 * @param {boolean} [endOfDay] - `validTo` uchun kun oxiri
 * @returns {?Date}
 */
function fromDateInput(text, endOfDay = false) {
  const value = String(text || '').trim();
  if (!value) return null;
  const d = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  const root = el('div.banners-page');
  const body = el('div.list');
  body.append(skeleton('row', 3));

  /** @type {object[]} */
  let banners = [];

  root.append(
    el('div.toolbar', {}, [
      el('button.btn', {
        text: t('banners.add'),
        attrs: { type: 'button' },
        on: { click: () => edit(null) }
      }),
      el('span.toolbar__spacer'),
      el('span.hint', { text: t('banners.hint') })
    ]),
    body
  );

  /**
   * Banner tahriri.
   * @param {?object} banner - null bo'lsa yangi
   */
  function edit(banner) {
    const imageUz = field({
      label: t('banners.imageUz'),
      value: banner?.image?.uz || '',
      placeholder: 'https://…'
    });
    const imageRu = field({
      label: t('banners.imageRu'),
      value: banner?.image?.ru || '',
      placeholder: 'https://…'
    });
    const link = field({
      label: t('banners.link'),
      value: banner?.link || '',
      placeholder: '#/cart'
    });
    const order = field({
      label: t('banners.order'),
      value: banner?.order ?? nextOrder(),
      type: 'number'
    });
    const from = field({
      label: t('banners.validFrom'),
      value: toDateInput(banner?.validFrom),
      type: 'date'
    });
    const to = field({
      label: t('banners.validTo'),
      value: toDateInput(banner?.validTo),
      type: 'date'
    });
    const active = checkbox({
      label: t('common.active'),
      checked: banner?.active !== false
    });

    // Jonli oldindan ko'rish — URL yozilgan sayin yangilanadi
    const preview = el('div.banner-preview');
    const drawPreview = () => {
      const src = imageUz.input.value.trim();
      preview.replaceChildren(src
        ? el('img.banner-preview__img', {
          attrs: { src, alt: '' },
          on: { error: () => preview.replaceChildren(previewEmpty()) }
        })
        : previewEmpty());
    };
    imageUz.input.addEventListener('input', drawPreview);
    drawPreview();

    modal({
      title: banner ? t('banners.edit') : t('banners.newBanner'),
      content: el('div', {}, [
        el('p.hint', { text: t('banners.previewLabel') }),
        preview,
        imageUz.node,
        imageRu.node,
        el('p.hint', { text: t('banners.imageHint') }),
        link.node,
        el('p.hint', { text: t('banners.linkHint') }),
        order.node,
        el('div.row.row--tight', {}, [from.node, to.node]),
        el('p.hint', { text: t('banners.dateHint') }),
        active.node
      ]),
      actions: [
        { label: t('common.cancel') },
        {
          label: t('common.save'),
          variant: 'primary',
          onClick: () => {
            const uz = imageUz.input.value.trim();
            if (!uz) {
              toast(t('banners.imageRequired'), { type: 'error' });
              return false;
            }
            const validFrom = fromDateInput(from.input.value);
            const validTo = fromDateInput(to.input.value, true);
            if (validFrom && validTo && validFrom > validTo) {
              toast(t('banners.dateOrder'), { type: 'error' });
              return false;
            }

            save(banner?.id || null, {
              // `ru` bo'sh bo'lsa `uz` ishlatiladi — mijoz ilovasidagi
              // `pick()` shunday qulab tushadi
              image: { uz, ru: imageRu.input.value.trim() || uz },
              link: link.input.value.trim(),
              order: Number(order.input.value) || 0,
              validFrom,
              validTo,
              active: active.input.checked
            });
            return true;
          }
        }
      ]
    });
  }

  /** Bo'sh oldindan ko'rish. */
  function previewEmpty() {
    return el('div.banner-preview__empty', { text: t('banners.noImage') });
  }

  /** Keyingi bo'sh tartib raqami. */
  function nextOrder() {
    return banners.reduce((max, b) => Math.max(max, Number(b.order) || 0), 0) + 1;
  }

  /**
   * Bannerni yozadi.
   * @param {?string} id
   * @param {object} data
   */
  async function save(id, data) {
    try {
      await saveBanner(id, data);
      toast(t('app.saved'), { type: 'success' });
      await load();
    } catch (e) {
      console.error('[banners] saqlanmadi:', e);
      toast(e.message || t('app.error'), { type: 'error' });
    }
  }

  /**
   * Bannerni o'chiradi.
   * @param {object} banner
   */
  async function remove(banner) {
    const yes = await confirm({
      title: t('banners.deleteBanner'),
      text: t('banners.deleteHint'),
      danger: true
    });
    if (!yes) return;
    try {
      await deleteBanner(banner.id);
      toast(t('app.deleted'), { type: 'success' });
      await load();
    } catch (e) {
      console.error('[banners] o\'chirilmadi:', e);
      toast(e.message || t('app.error'), { type: 'error' });
    }
  }

  /**
   * Bannerni yuqoriga yoki pastga suradi.
   *
   * Ikkita qo'shni bannerning `order` qiymati ALMASHTIRILADI —
   * qolganlariga tegilmaydi, shuning uchun ikkita yozuv yetadi.
   *
   * @param {number} index
   * @param {number} delta - -1 yuqoriga, +1 pastga
   */
  async function move(index, delta) {
    const next = index + delta;
    if (next < 0 || next >= banners.length) return;

    const a = banners[index];
    const b = banners[next];
    // Tartib raqamlari teng bo'lsa (masalan hammasi 0) almashtirish
    // hech nima bermaydi — shuning uchun o'rin raqamidan foydalanamiz
    const orderA = Number(a.order) || 0;
    const orderB = Number(b.order) || 0;
    const [newA, newB] = orderA === orderB ? [next, index] : [orderB, orderA];

    try {
      await Promise.all([
        saveBanner(a.id, { order: newA }),
        saveBanner(b.id, { order: newB })
      ]);
      await load();
    } catch (e) {
      console.error('[banners] tartib o\'zgarmadi:', e);
      toast(e.message || t('app.error'), { type: 'error' });
    }
  }

  /** Ro'yxatni chizadi. */
  function draw() {
    if (!banners.length) {
      body.replaceChildren(emptyState({
        icon: '🖼',
        title: t('app.empty'),
        hint: t('banners.emptyHint')
      }));
      return;
    }

    body.replaceChildren(...banners.map((banner, i) => {
      const src = pick(banner.image);
      const thumb = el('div.banner-row__thumb');
      if (src) {
        thumb.append(el('img', {
          attrs: { src, alt: '', loading: 'lazy' },
          on: { error: () => thumb.replaceChildren(el('span', { text: '🖼' })) }
        }));
      } else {
        thumb.append(el('span', { text: '🖼' }));
      }

      const period = [
        toDateInput(banner.validFrom) || '…',
        toDateInput(banner.validTo) || '…'
      ].join(' → ');

      return el('div.list-row.banner-row', {}, [
        el('div.banner-row__ord', {}, [
          el('button.btn.btn--ghost.btn--sm', {
            text: '↑',
            attrs: { type: 'button', 'aria-label': t('banners.up'), disabled: i === 0 },
            on: { click: () => move(i, -1) }
          }),
          el('button.btn.btn--ghost.btn--sm', {
            text: '↓',
            attrs: {
              type: 'button',
              'aria-label': t('banners.down'),
              disabled: i === banners.length - 1
            },
            on: { click: () => move(i, 1) }
          })
        ]),
        thumb,
        el('div.list-row__main', {}, [
          el('div.list-row__name', { text: banner.link || t('banners.noLink') }),
          el('div.list-row__sub', { text: `#${banner.order ?? 0} · ${period}` })
        ]),
        banner.active === false
          ? el('span.badge.badge--err', { text: t('common.inactive') })
          : el('span.badge.badge--ok', { text: t('common.active') }),
        el('div.list-row__actions', {}, [
          el('button.btn.btn--ghost.btn--sm', {
            text: t('common.edit'),
            attrs: { type: 'button' },
            on: { click: () => edit(banner) }
          }),
          el('button.btn.btn--ghost.btn--sm', {
            text: '✕',
            attrs: { type: 'button', 'aria-label': t('common.delete') },
            on: { click: () => remove(banner) }
          })
        ])
      ]);
    }));
  }

  /** Bannerlarni yuklaydi. */
  async function load() {
    try {
      banners = await getBanners();
      draw();
    } catch (e) {
      console.error('[banners] yuklanmadi:', e);
      body.replaceChildren(emptyState({
        icon: '⚠️',
        title: t('app.error'),
        hint: e.message
      }));
    }
  }

  load();
  return root;
}

/** Bu sahifada doimiy obuna yo'q. */
export function destroy() {}
