/**
 * Promokod CRUD (SPEC 115).
 *
 * Hujjat ID = kodning O'ZI: Node servis promokodni aynan shu bo'yicha
 * o'qiydi (`promocodes/{code}`), shuning uchun kod yaratilgandan keyin
 * o'zgartirilmaydi — faqat o'chirib, yangisini yaratish mumkin.
 */

import { t } from '../i18n.js';
import {
  el, toast, modal, confirm, skeleton, emptyState, field, selectField, checkbox
} from '../ui.js';
import { getPromos, savePromo, deletePromo, promoExists } from '../db.js';

/**
 * Summani `125 000` ko'rinishida yozadi.
 * @param {number} value
 * @returns {string}
 */
function money(value) {
  return String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Firestore Timestamp yoki ISO satrni `YYYY-MM-DD` ga aylantiradi.
 * @param {*} value
 * @returns {string}
 */
function toDateInput(value) {
  if (!value) return '';
  const date = typeof value.toDate === 'function'
    ? value.toDate()
    : typeof value.seconds === 'number'
      ? new Date(value.seconds * 1000)
      : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

/**
 * Promokod turi bo'yicha qiymatni matnga aylantiradi.
 * @param {object} promo
 * @returns {string}
 */
function valueLabel(promo) {
  if (promo.type === 'percent') return `${promo.value}%`;
  if (promo.type === 'amount') return `${money(promo.value)}`;
  return t('promos.freeDelivery');
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  const root = el('div.promos-page');
  const body = el('div.list');
  body.append(skeleton('row', 3));

  /** @type {object[]} */
  let promos = [];

  root.append(
    el('div.toolbar', {}, [
      el('button.btn', {
        text: t('promos.add'),
        attrs: { type: 'button' },
        on: { click: () => editPromo(null) }
      })
    ]),
    body
  );

  /**
   * Promokod tahriri.
   * @param {?object} promo - null bo'lsa yangi
   */
  function editPromo(promo) {
    const draft = promo ? { ...promo } : {
      type: 'percent',
      value: 10,
      minOrder: 0,
      maxDiscount: 0,
      usageLimit: 0,
      perUserLimit: 1,
      firstOrderOnly: false,
      usedCount: 0,
      branchIds: [],
      active: true
    };

    const code = field({
      label: t('promos.code'),
      value: promo ? promo.id : '',
      attrs: promo ? { readonly: true } : {},
      placeholder: 'YANGI10'
    });
    const value = field({ label: t('promos.value'), value: draft.value, type: 'number' });
    const minOrder = field({ label: t('promos.minOrder'), value: draft.minOrder || 0, type: 'number' });
    const maxDiscount = field({ label: t('promos.maxDiscount'), value: draft.maxDiscount || 0, type: 'number' });
    const usageLimit = field({ label: t('promos.usageLimit'), value: draft.usageLimit || 0, type: 'number' });
    const perUserLimit = field({ label: t('promos.perUserLimit'), value: draft.perUserLimit || 0, type: 'number' });
    const validFrom = field({ label: t('promos.validFrom'), value: toDateInput(draft.validFrom), type: 'date' });
    const validTo = field({ label: t('promos.validTo'), value: toDateInput(draft.validTo), type: 'date' });
    const firstOnly = checkbox({ label: t('promos.firstOrderOnly'), checked: Boolean(draft.firstOrderOnly) });
    const active = checkbox({ label: t('common.active'), checked: draft.active !== false });

    const type = selectField({
      label: t('promos.type'),
      value: draft.type,
      options: [
        { value: 'percent', label: t('promos.percent') },
        { value: 'amount', label: t('promos.amount') },
        { value: 'freeDelivery', label: t('promos.freeDelivery') }
      ],
      onChange: (next) => {
        // Bepul yetkazishda qiymat kerak emas
        value.node.hidden = next === 'freeDelivery';
        maxDiscount.node.hidden = next !== 'percent';
      }
    });
    value.node.hidden = draft.type === 'freeDelivery';
    maxDiscount.node.hidden = draft.type !== 'percent';

    modal({
      title: promo ? promo.id : t('promos.add'),
      content: el('div', {}, [
        code.node,
        el('div.row', {}, [type.node, value.node]),
        el('div.row', {}, [minOrder.node, maxDiscount.node]),
        el('div.row', {}, [usageLimit.node, perUserLimit.node]),
        el('p.hint', { text: `0 — ${t('promos.unlimited').toLowerCase()}` }),
        el('div.row', {}, [validFrom.node, validTo.node]),
        firstOnly.node,
        active.node
      ]),
      actions: [
        { label: t('common.cancel') },
        {
          label: t('common.save'),
          variant: 'primary',
          onClick: () => {
            const id = code.input.value.trim().toUpperCase();
            if (!id) {
              toast(t('promos.codeRequired'), { type: 'error' });
              return false;
            }

            const data = {
              type: type.select.value,
              value: type.select.value === 'freeDelivery' ? 0 : Number(value.input.value) || 0,
              minOrder: Number(minOrder.input.value) || 0,
              maxDiscount: Number(maxDiscount.input.value) || 0,
              usageLimit: Number(usageLimit.input.value) || 0,
              perUserLimit: Number(perUserLimit.input.value) || 0,
              firstOrderOnly: firstOnly.input.checked,
              branchIds: draft.branchIds || [],
              usedCount: draft.usedCount || 0,
              active: active.input.checked
            };
            if (validFrom.input.value) data.validFrom = new Date(validFrom.input.value);
            if (validTo.input.value) {
              // Tugash sanasi shu kunning oxirigacha amal qilsin
              const end = new Date(validTo.input.value);
              end.setHours(23, 59, 59, 999);
              data.validTo = end;
            }

            save(id, data, !promo);
            return true;
          }
        }
      ]
    });
  }

  /**
   * Promokodni yozadi.
   * @param {string} id
   * @param {object} data
   * @param {boolean} isNew
   */
  async function save(id, data, isNew) {
    try {
      if (isNew && await promoExists(id)) {
        toast(t('promos.codeExists'), { type: 'error' });
        return;
      }
      await savePromo(id, data);
      toast(t('app.saved'), { type: 'success' });
      await load();
    } catch (e) {
      console.error('[promos] saqlanmadi:', e);
      toast(e.message || t('app.error'), { type: 'error' });
    }
  }

  /**
   * Promokodni o'chiradi.
   * @param {object} promo
   */
  async function remove(promo) {
    const yes = await confirm({ title: promo.id, text: t('promos.deletePromo'), danger: true });
    if (!yes) return;
    try {
      await deletePromo(promo.id);
      toast(t('app.deleted'), { type: 'success' });
      await load();
    } catch (e) {
      console.error('[promos] o\'chirilmadi:', e);
      toast(e.message || t('app.error'), { type: 'error' });
    }
  }

  /** Ro'yxatni chizadi. */
  function draw() {
    if (!promos.length) {
      body.replaceChildren(emptyState({ icon: '🎟', title: t('app.empty') }));
      return;
    }

    const sorted = [...promos].sort((a, b) => a.id.localeCompare(b.id));
    body.replaceChildren(...sorted.map((promo) => {
      const expired = promo.validTo && toDateInput(promo.validTo) < new Date().toISOString().slice(0, 10);
      const usedUp = promo.usageLimit > 0 && (promo.usedCount || 0) >= promo.usageLimit;

      return el('div.list-row', {}, [
        el('div.list-row__main', {}, [
          el('div.list-row__name', { text: `${promo.id} · ${valueLabel(promo)}` }),
          el('div.list-row__sub', {
            text: [
              promo.minOrder ? `${t('promos.minOrder')} ${money(promo.minOrder)}` : null,
              `${t('promos.used')}: ${promo.usedCount || 0}${promo.usageLimit ? ` / ${promo.usageLimit}` : ''}`,
              promo.firstOrderOnly ? t('promos.firstOrderOnly') : null,
              promo.validTo ? `→ ${toDateInput(promo.validTo)}` : null
            ].filter(Boolean).join(' · ')
          })
        ]),
        promo.active === false
          ? el('span.badge.badge--warn', { text: t('common.inactive') })
          : expired || usedUp
            ? el('span.badge.badge--err', { text: expired ? t('promos.validTo') : t('promos.usageLimit') })
            : el('span.badge.badge--ok', { text: t('common.active') }),
        el('div.list-row__actions', {}, [
          el('button.btn.btn--ghost.btn--sm', {
            text: t('common.edit'),
            attrs: { type: 'button' },
            on: { click: () => editPromo(promo) }
          }),
          el('button.btn.btn--ghost.btn--sm', {
            text: '✕',
            attrs: { type: 'button', 'aria-label': t('common.delete') },
            on: { click: () => remove(promo) }
          })
        ])
      ]);
    }));
  }

  /** Promokodlarni yuklaydi. */
  async function load() {
    try {
      promos = await getPromos();
      draw();
    } catch (e) {
      console.error('[promos] yuklanmadi:', e);
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
