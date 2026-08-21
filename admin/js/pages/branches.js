/**
 * Filial CRUD, zona polygonlari, stop-list va filial narxlari
 * (SPEC 112–114).
 *
 * DIQQAT: Firestore ichma-ich massivni qabul qilmaydi ("Nested arrays
 * are not supported"), shuning uchun polygon nuqtalari OBYEKT bo'ladi:
 * `[{lat, lng}, ...]`. Tahrirda ular `lat, lng` qatorlari ko'rinishida
 * ko'rsatiladi va saqlashdan oldin qaytadan obyektga aylantiriladi.
 */

import { t, pick } from '../i18n.js';
import {
  el, toast, modal, confirm, skeleton, emptyState, field, checkbox
} from '../ui.js';
import { getBranches, saveBranch, deleteBranch, getMenu } from '../db.js';

/**
 * Polygon nuqtalarini matnga aylantiradi.
 * @param {Array<object|number[]>} polygon
 * @returns {string}
 */
function polygonToText(polygon) {
  return (polygon || []).map((point) => {
    if (Array.isArray(point)) return `${point[0]}, ${point[1]}`;
    return `${point.lat}, ${point.lng}`;
  }).join('\n');
}

/**
 * Matndan polygon nuqtalarini o'qiydi.
 * @param {string} text
 * @returns {?Array<{lat: number, lng: number}>} noto'g'ri bo'lsa null
 */
function textToPolygon(text) {
  const points = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [lat, lng] = line.split(/[,;\s]+/).map(Number);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    });

  if (points.some((p) => p === null) || points.length < 3) return null;
  return points;
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  const root = el('div.branches-page');
  const body = el('div.list');
  body.append(skeleton('row', 2));

  /** @type {object[]} */
  let branches = [];
  /** @type {object[]} stop-list uchun mahsulotlar ro'yxati */
  let products = [];

  root.append(
    el('div.toolbar', {}, [
      el('button.btn', {
        text: t('branches.add'),
        attrs: { type: 'button' },
        on: { click: () => editBranch(null) }
      })
    ]),
    body
  );

  /**
   * Filial tahriri.
   * @param {?object} branch - null bo'lsa yangi
   */
  function editBranch(branch) {
    const draft = branch
      ? JSON.parse(JSON.stringify(branch))
      : {
        name: '',
        address: '',
        phone: '',
        lat: 41.311,
        lng: 69.24,
        workHours: { open: '10:00', close: '23:00' },
        zones: [],
        stopList: [],
        priceOverrides: {},
        active: true
      };

    const name = field({ label: t('branches.name'), value: draft.name });
    const address = field({ label: t('branches.address'), value: draft.address });
    const phone = field({ label: t('branches.phone'), value: draft.phone || '' });
    const lat = field({ label: 'lat', value: draft.lat, type: 'number', attrs: { step: 'any' } });
    const lng = field({ label: 'lng', value: draft.lng, type: 'number', attrs: { step: 'any' } });
    const open = field({ label: t('branches.open'), value: draft.workHours?.open || '10:00', type: 'time' });
    const close = field({ label: t('branches.close'), value: draft.workHours?.close || '23:00', type: 'time' });
    const active = checkbox({ label: t('common.active'), checked: draft.active !== false });

    // --- zonalar
    const zonesHost = el('div.list');
    /** Zonalar ro'yxatini chizadi. */
    function drawZones() {
      zonesHost.replaceChildren();
      draft.zones.forEach((zone, index) => {
        const zName = field({ label: t('branches.zoneName'), value: zone.name || '' });
        const price = field({ label: t('branches.deliveryPrice'), value: zone.deliveryPrice || 0, type: 'number' });
        const minOrder = field({ label: t('branches.minOrder'), value: zone.minOrder || 0, type: 'number' });
        const eta = field({ label: t('branches.eta'), value: zone.etaMinutes || 30, type: 'number' });
        const polygon = field({
          label: t('branches.polygon'),
          value: polygonToText(zone.polygon),
          type: 'textarea'
        });

        [zName, price, minOrder, eta, polygon].forEach((f) => {
          f.input.addEventListener('input', () => {
            zone.name = zName.input.value.trim();
            zone.deliveryPrice = Number(price.input.value) || 0;
            zone.minOrder = Number(minOrder.input.value) || 0;
            zone.etaMinutes = Number(eta.input.value) || 0;
            zone.polygonText = polygon.input.value;
          });
        });

        zonesHost.append(el('div.card.card--pad', {}, [
          el('div.row.row--tight', {}, [zName.node, price.node, minOrder.node, eta.node]),
          polygon.node,
          el('p.hint', { text: t('branches.polygonHint') }),
          el('button.btn.btn--ghost.btn--sm', {
            text: t('common.delete'),
            attrs: { type: 'button' },
            on: {
              click: () => {
                draft.zones.splice(index, 1);
                drawZones();
              }
            }
          })
        ]));
      });
    }
    drawZones();

    // --- stop-list
    const stopHost = el('div');
    const stopSet = new Set(draft.stopList || []);
    products.forEach((product) => {
      stopHost.append(checkbox({
        label: pick(product.name),
        checked: stopSet.has(product.id),
        onChange: (checked) => {
          if (checked) stopSet.add(product.id);
          else stopSet.delete(product.id);
        }
      }).node);
    });

    modal({
      title: branch ? draft.name : t('branches.newBranch'),
      content: el('div', {}, [
        name.node,
        address.node,
        el('div.row', {}, [phone.node]),
        el('div.row', {}, [lat.node, lng.node]),
        el('div.row', {}, [open.node, close.node]),
        active.node,

        el('h3.section-title', { text: t('branches.zones') }),
        zonesHost,
        el('button.btn.btn--ghost.btn--sm', {
          text: t('branches.addZone'),
          attrs: { type: 'button' },
          on: {
            click: () => {
              draft.zones.push({
                name: '', deliveryPrice: 0, minOrder: 0, etaMinutes: 30, polygon: []
              });
              drawZones();
            }
          }
        }),

        el('h3.section-title', { text: t('branches.stopList') }),
        el('p.hint', { text: t('branches.stopListHint') }),
        products.length ? stopHost : el('p.hint', { text: t('app.empty') })
      ]),
      actions: [
        { label: t('common.cancel') },
        {
          label: t('common.save'),
          variant: 'primary',
          onClick: () => {
            if (!name.input.value.trim()) {
              toast(t('branches.name'), { type: 'error' });
              return false;
            }

            // Polygonlarni tekshiramiz — noto'g'ri bo'lsa saqlamaymiz
            const zones = [];
            for (const zone of draft.zones) {
              const text = zone.polygonText !== undefined
                ? zone.polygonText
                : polygonToText(zone.polygon);
              const points = textToPolygon(text);
              if (!points) {
                toast(`${zone.name || t('branches.zoneName')}: ${t('branches.polygonBad')}`, {
                  type: 'error'
                });
                return false;
              }
              zones.push({
                name: zone.name,
                deliveryPrice: zone.deliveryPrice,
                minOrder: zone.minOrder,
                etaMinutes: zone.etaMinutes,
                polygon: points
              });
            }

            save({
              name: name.input.value.trim(),
              address: address.input.value.trim(),
              phone: phone.input.value.trim(),
              lat: Number(lat.input.value) || 0,
              lng: Number(lng.input.value) || 0,
              workHours: { open: open.input.value, close: close.input.value },
              zones,
              stopList: [...stopSet],
              priceOverrides: draft.priceOverrides || {},
              active: active.input.checked
            }, branch ? branch.id : null);
            return true;
          }
        }
      ]
    });
  }

  /**
   * Filialni yozadi.
   * @param {object} data
   * @param {?string} id
   */
  async function save(data, id) {
    try {
      await saveBranch(id, data);
      toast(t('app.saved'), { type: 'success' });
      await load();
    } catch (e) {
      console.error('[branches] saqlanmadi:', e);
      toast(e.message || t('app.error'), { type: 'error' });
    }
  }

  /**
   * Filialni o'chiradi.
   * @param {object} branch
   */
  async function remove(branch) {
    const yes = await confirm({
      title: branch.name,
      text: t('branches.deleteBranch'),
      danger: true
    });
    if (!yes) return;
    try {
      await deleteBranch(branch.id);
      toast(t('app.deleted'), { type: 'success' });
      await load();
    } catch (e) {
      console.error('[branches] o\'chirilmadi:', e);
      toast(e.message || t('app.error'), { type: 'error' });
    }
  }

  /** Ro'yxatni chizadi. */
  function draw() {
    if (!branches.length) {
      body.replaceChildren(emptyState({ icon: '📍', title: t('app.empty') }));
      return;
    }

    body.replaceChildren(...branches.map((branch) => el('div.list-row', {}, [
      el('div.list-row__main', {}, [
        el('div.list-row__name', { text: branch.name || branch.id }),
        el('div.list-row__sub', {
          text: [
            branch.address,
            branch.workHours ? `${branch.workHours.open}–${branch.workHours.close}` : null,
            `${(branch.zones || []).length} ${t('branches.zones').toLowerCase()}`,
            (branch.stopList || []).length
              ? `${t('branches.stopList')}: ${branch.stopList.length}`
              : null
          ].filter(Boolean).join(' · ')
        })
      ]),
      branch.active === false
        ? el('span.badge.badge--warn', { text: t('common.inactive') })
        : el('span.badge.badge--ok', { text: t('common.active') }),
      el('div.list-row__actions', {}, [
        el('button.btn.btn--ghost.btn--sm', {
          text: t('common.edit'),
          attrs: { type: 'button' },
          on: { click: () => editBranch(branch) }
        }),
        el('button.btn.btn--ghost.btn--sm', {
          text: '✕',
          attrs: { type: 'button', 'aria-label': t('common.delete') },
          on: { click: () => remove(branch) }
        })
      ])
    ])));
  }

  /** Filiallar va menyuni yuklaydi. */
  async function load() {
    try {
      const [list, menu] = await Promise.all([getBranches(), getMenu()]);
      branches = list;
      products = menu.products || [];
      draw();
    } catch (e) {
      console.error('[branches] yuklanmadi:', e);
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
