/**
 * Kuryerlar CRUD (9-bosqich).
 *
 * HUJJAT ID QOIDASI. `couriers/{uid}` — ID Firebase `uid` bo'ladi,
 * chunki `firestore.rules` dagi `isOwner(courierId)` shunga tayanadi.
 * Lekin admin kuryerni qo'shayotganda uning `uid` si HALI YO'Q, u
 * birinchi kirishdan keyin paydo bo'ladi. Shuning uchun:
 *
 *   admin → `couriers/pending_<telefon>` yaratadi
 *   kuryer birinchi kirganda → servis uni `couriers/{uid}` ga
 *   KO'CHIRADI va `pending_` hujjatini o'chiradi.
 *
 * Shu sababli ro'yxatda ikki xil holat bor: "kutilmoqda" (hali
 * kirmagan) va oddiy kuryer. Kutilayotgan kuryerga buyurtma
 * tayinlab bo'lmaydi — servis buni rad etadi.
 */

import { t } from '../i18n.js';
import {
  el, toast, confirm, skeleton, emptyState, field, selectField, checkbox, modal
} from '../ui.js';
import {
  getCouriers, saveCourier, deleteCourier, courierPendingId, getBranches
} from '../db.js';

/**
 * Telefonni `+998901234567` ko'rinishiga keltiradi.
 * @param {string} input
 * @returns {?string}
 */
function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '').replace(/^998/, '');
  return digits.length === 9 ? `+998${digits}` : null;
}

/**
 * Kuryer hali ilovaga kirmaganmi.
 * @param {object} courier
 * @returns {boolean}
 */
function isPending(courier) {
  return String(courier.id || '').startsWith('pending_');
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  const root = el('div.couriers-page');
  const body = el('div.list');
  body.append(skeleton('row', 3));

  /** @type {object[]} */
  let couriers = [];
  /** @type {object[]} */
  let branches = [];

  root.append(
    el('div.toolbar', {}, [
      el('button.btn', {
        text: t('couriers.add'),
        attrs: { type: 'button' },
        on: { click: () => editCourier(null) }
      }),
      el('span.toolbar__spacer'),
      el('span.hint', { text: t('couriers.pendingHint') })
    ]),
    body
  );

  /**
   * Kuryer tahriri.
   * @param {?object} courier - null bo'lsa yangi
   */
  function editCourier(courier) {
    const pending = courier ? isPending(courier) : true;

    const name = field({ label: t('couriers.name'), value: courier?.name || '' });
    const phone = field({
      label: t('couriers.phone'),
      value: courier?.phone || '+998 ',
      type: 'tel',
      // Telefon — hujjat ID sining asosi, shuning uchun kirgan
      // kuryerda uni o'zgartirib bo'lmaydi
      attrs: courier && !pending ? { readonly: true } : {}
    });
    const active = checkbox({ label: t('common.active'), checked: courier?.active !== false });

    const branch = selectField({
      label: t('couriers.branch'),
      value: courier?.branchId || '',
      options: [{ value: '', label: t('common.all') }]
        .concat(branches.map((b) => ({ value: b.id, label: b.name || b.id })))
    });

    modal({
      title: courier ? (courier.name || courier.phone) : t('couriers.newCourier'),
      content: el('div', {}, [
        name.node,
        phone.node,
        courier && !pending
          ? el('p.hint', { text: t('couriers.phoneLocked') })
          : el('p.hint', { text: t('couriers.phoneHint') }),
        branch.node,
        active.node
      ]),
      actions: [
        { label: t('common.cancel') },
        {
          label: t('common.save'),
          variant: 'primary',
          onClick: () => {
            const e164 = normalizePhone(phone.input.value);
            if (!name.input.value.trim()) {
              toast(t('couriers.nameRequired'), { type: 'error' });
              return false;
            }
            if (!e164) {
              toast(t('couriers.phoneInvalid'), { type: 'error' });
              return false;
            }

            save({
              id: courier ? courier.id : courierPendingId(e164),
              data: {
                name: name.input.value.trim(),
                phone: e164,
                branchId: branch.select.value || null,
                active: active.input.checked
              },
              isNew: !courier
            });
            return true;
          }
        }
      ]
    });
  }

  /**
   * Kuryerni yozadi.
   * @param {{id: string, data: object, isNew: boolean}} input
   */
  async function save({ id, data, isNew }) {
    try {
      if (isNew && couriers.some((c) => c.phone === data.phone)) {
        toast(t('couriers.phoneExists'), { type: 'error' });
        return;
      }
      await saveCourier(id, isNew ? { ...data, onShift: false, activeOrders: [] } : data);
      toast(t('app.saved'), { type: 'success' });
      await load();
    } catch (e) {
      console.error('[couriers] saqlanmadi:', e);
      toast(e.message || t('app.error'), { type: 'error' });
    }
  }

  /**
   * Kuryerni o'chiradi.
   * @param {object} courier
   */
  async function remove(courier) {
    if ((courier.activeOrders || []).length) {
      toast(t('couriers.hasOrders'), { type: 'error' });
      return;
    }
    const yes = await confirm({
      title: courier.name || courier.phone,
      text: t('couriers.deleteCourier'),
      danger: true
    });
    if (!yes) return;
    try {
      await deleteCourier(courier.id);
      toast(t('app.deleted'), { type: 'success' });
      await load();
    } catch (e) {
      console.error('[couriers] o\'chirilmadi:', e);
      toast(e.message || t('app.error'), { type: 'error' });
    }
  }

  /** Ro'yxatni chizadi. */
  function draw() {
    if (!couriers.length) {
      body.replaceChildren(emptyState({
        icon: '🛵',
        title: t('app.empty'),
        hint: t('couriers.emptyHint')
      }));
      return;
    }

    const sorted = [...couriers].sort((a, b) => {
      // Kutilayotganlar tepada — ular e'tibor talab qiladi
      if (isPending(a) !== isPending(b)) return isPending(a) ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    body.replaceChildren(...sorted.map((courier) => {
      const pending = isPending(courier);
      const active = (courier.activeOrders || []).length;

      return el('div.list-row', {}, [
        el('div.list-row__main', {}, [
          el('div.list-row__name', { text: courier.name || courier.phone }),
          el('div.list-row__sub', {
            text: [
              courier.phone,
              courier.branchId
                ? (branches.find((b) => b.id === courier.branchId)?.name || courier.branchId)
                : t('common.all'),
              active ? `${t('couriers.activeOrders')}: ${active}` : null
            ].filter(Boolean).join(' · ')
          })
        ]),
        pending
          ? el('span.badge.badge--warn', { text: t('couriers.pending') })
          : courier.onShift
            ? el('span.badge.badge--ok', { text: t('couriers.onShift') })
            : el('span.badge', { text: t('couriers.offShift') }),
        courier.active === false
          ? el('span.badge.badge--err', { text: t('common.inactive') })
          : null,
        el('div.list-row__actions', {}, [
          el('button.btn.btn--ghost.btn--sm', {
            text: t('common.edit'),
            attrs: { type: 'button' },
            on: { click: () => editCourier(courier) }
          }),
          el('button.btn.btn--ghost.btn--sm', {
            text: '✕',
            attrs: { type: 'button', 'aria-label': t('common.delete') },
            on: { click: () => remove(courier) }
          })
        ])
      ]);
    }));
  }

  /** Kuryerlar va filiallarni yuklaydi. */
  async function load() {
    try {
      const [list, branchList] = await Promise.all([getCouriers(), getBranches()]);
      couriers = list;
      branches = branchList;
      draw();
    } catch (e) {
      console.error('[couriers] yuklanmadi:', e);
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
