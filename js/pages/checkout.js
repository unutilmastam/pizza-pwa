/**
 * Checkout sahifasi.
 *
 * Bo'limlar: yetkazish turi, manzil yoki filial, vaqt, to'lov usuli,
 * qaytim, idish-tovoq, izoh, oferta va yakuniy narx.
 *
 * Buyurtmani serverga yuborish 6-bosqichda (Node servis) ulanadi:
 * SPEC bo'yicha client `orders` ga yoza olmaydi va narxni o'zi belgilay
 * olmaydi. Shu sababli "Buyurtma berish" tugmasi hozircha to'liq
 * tekshiruvdan o'tkazib, buyurtma draftini saqlaydi.
 */

import { t } from '../i18n.js';
import { el, modal, toast, skeleton } from '../ui.js';
import { formatPrice, clamp, haptic } from '../utils.js';
import { APP } from '../config.js';
import { getBranches } from '../db.js';
import { navigate, back } from '../router.js';
import {
  getState, setOrderType, setBranch, setCheckout, setOrderDraft
} from '../state.js';
import { calcTotals } from './cart.js';

/**
 * Manzilni bir qatorga yig'adi.
 * @param {object} address
 * @returns {string}
 */
function addressLine(address) {
  if (!address) return '';
  const extra = [
    address.apartment && `${t('address.apartment')} ${address.apartment}`,
    address.entrance && `${t('address.entrance')} ${address.entrance}`,
    address.floor && `${t('address.floor')} ${address.floor}`
  ].filter(Boolean).join(', ');
  return extra ? `${address.address}, ${extra}` : address.address;
}

/**
 * Filial tanlash ro'yxati.
 * @param {HTMLElement} host
 * @param {?string} selectedId
 */
async function loadBranches(host, selectedId) {
  host.replaceChildren(skeleton('list', 2));
  try {
    const branches = await getBranches();
    if (!branches.length) {
      host.replaceChildren(el('p.hint', { text: t('checkout.branchEmpty') }));
      return;
    }
    const list = el('div.opt-list');
    branches.forEach((branch) => {
      const active = branch.id === selectedId;
      list.append(el(`button.opt-row${active ? '.is-active' : ''}`, {
        attrs: { type: 'button', 'aria-pressed': active ? 'true' : 'false' },
        on: {
          click: () => {
            setBranch(branch.id);
            loadBranches(host, branch.id);
          }
        }
      }, [
        el('span.opt-row__check', { text: active ? '✓' : '', attrs: { 'aria-hidden': 'true' } }),
        el('span.opt-row__name', {}, [
          el('strong', { text: branch.name || branch.id }),
          branch.address ? el('span.hint.block', { text: branch.address }) : null,
          branch.workHours
            ? el('span.hint.block', { text: `${branch.workHours.open} – ${branch.workHours.close}` })
            : null
        ])
      ]));
    });
    host.replaceChildren(list);
  } catch (e) {
    console.error('Filiallar yuklanmadi:', e);
    host.replaceChildren(el('p.hint', { text: t('checkout.branchError') }));
  }
}

/**
 * Tanlov tugmalari qatori.
 * @param {Array<{value: string, label: string}>} options
 * @param {string} value
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
        'aria-checked': opt.value === value ? 'true' : 'false'
      },
      on: { click: () => onChange(opt.value) }
    }));
  });
  return box;
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  destroy();

  const state = getState();
  const root = el('div.page.checkout');

  // Savat bo'sh bo'lsa checkout ma'nosiz
  if (!state.cart.length) {
    root.append(el('div.page__head', {}, [
      el('button.icon-btn', {
        text: '‹',
        attrs: { type: 'button', 'aria-label': t('common.back') },
        on: { click: () => back() }
      }),
      el('h1.page__title', { text: t('checkout.title') })
    ]));
    root.append(el('div.state', {}, [
      el('h2.state__title', { text: t('cart.empty') }),
      el('button.btn.btn--primary', {
        text: t('cart.goToMenu'),
        attrs: { type: 'button' },
        on: { click: () => navigate('/menu') }
      })
    ]));
    return root;
  }

  /** Forma holati — sahifa ichida yashaydi, muhimlari state'ga yoziladi. */
  const form = {
    orderType: state.orderType,
    address: state.address,
    branchId: state.branchId,
    timeMode: 'asap',
    time: '',
    paymentMethod: state.checkout.paymentMethod || 'cash',
    changeFrom: state.checkout.changeFrom || '',
    cutlery: state.checkout.cutlery ?? 1,
    comment: state.checkout.comment || '',
    offerAccepted: false
  };

  const sections = el('div.checkout-body');
  const cta = el('div.cart-cta');
  root.append(
    el('div.page__head', {}, [
      el('button.icon-btn', {
        text: '‹',
        attrs: { type: 'button', 'aria-label': t('common.back') },
        on: { click: () => back() }
      }),
      el('h1.page__title', { text: t('checkout.title') })
    ]),
    sections,
    cta
  );

  /** Bo'limlarni qaytadan chizadi. */
  function rebuild() {
    const totals = calcTotals({ ...getState(), orderType: form.orderType });
    sections.replaceChildren();

    // --- 1. Buyurtma turi
    sections.append(section(t('checkout.type'), [
      segmented(
        [
          { value: 'delivery', label: t('checkout.delivery') },
          { value: 'pickup', label: t('checkout.pickup') }
        ],
        form.orderType,
        (value) => {
          form.orderType = value;
          setOrderType(value);
          rebuild();
        }
      )
    ]));

    // --- 2. Manzil yoki filial
    if (form.orderType === 'delivery') {
      const zone = form.address && form.address.zone;
      sections.append(section(t('checkout.address'), [
        form.address
          ? el('div.row.row--between.addr', {}, [
            el('p.addr__text', { text: addressLine(form.address) }),
            el('button.btn.btn--ghost', {
              text: t('common.edit'),
              attrs: { type: 'button' },
              on: { click: () => navigate('/address') }
            })
          ])
          : el('button.btn.btn--outline.btn--block', {
            text: t('checkout.addressAdd'),
            attrs: { type: 'button' },
            on: { click: () => navigate('/address') }
          }),
        zone
          ? el('p.hint', {
            text: `${t('address.zone')}: ${zone.name} · ` +
              `${t('cart.delivery')} ${formatPrice(totals.delivery)}`
          })
          : null
      ]));
    } else {
      const host = el('div.branches');
      sections.append(section(t('address.branch'), [host]));
      loadBranches(host, form.branchId);
    }

    // --- 3. Vaqt
    const timeInput = el('input.input', {
      attrs: { type: 'time', value: form.time, 'aria-label': t('checkout.time') },
      on: { change: (e) => { form.time = e.target.value; } }
    });
    sections.append(section(t('checkout.time'), [
      segmented(
        [
          { value: 'asap', label: t('checkout.asap') },
          { value: 'scheduled', label: t('checkout.pickTime') }
        ],
        form.timeMode,
        (value) => {
          form.timeMode = value;
          rebuild();
        }
      ),
      form.timeMode === 'scheduled' ? timeInput : null
    ]));

    // --- 4. To'lov usuli
    const payLabels = {
      cash: t('checkout.cash'),
      card: t('checkout.card'),
      payme: t('checkout.payme'),
      click: t('checkout.click'),
      uzum: t('checkout.uzum')
    };
    const payList = el('div.opt-list');
    APP.paymentMethods.forEach((method) => {
      const active = form.paymentMethod === method;
      payList.append(el(`button.opt-row${active ? '.is-active' : ''}`, {
        attrs: { type: 'button', 'aria-pressed': active ? 'true' : 'false' },
        on: {
          click: () => {
            form.paymentMethod = method;
            setCheckout({ paymentMethod: method });
            rebuild();
          }
        }
      }, [
        el('span.opt-row__check', { text: active ? '✓' : '', attrs: { 'aria-hidden': 'true' } }),
        el('span.opt-row__name', { text: payLabels[method] })
      ]));
    });

    const changeInput = el('input.input', {
      attrs: {
        type: 'number',
        inputmode: 'numeric',
        min: '0',
        step: '1000',
        value: form.changeFrom,
        placeholder: t('checkout.changePlaceholder'),
        'aria-label': t('checkout.change')
      },
      on: { input: (e) => { form.changeFrom = e.target.value; } }
    });

    sections.append(section(t('checkout.payment'), [
      payList,
      form.paymentMethod === 'cash'
        ? el('label.field.change-field', {}, [
          el('span.field__label', { text: t('checkout.change') }),
          changeInput
        ])
        : null
    ]));

    // --- 5. Idish-tovoq
    const cutleryValue = el('span.stepper__value', { text: String(form.cutlery) });
    const setCutlery = (next) => {
      form.cutlery = clamp(next, 0, APP.maxCutlery);
      cutleryValue.textContent = String(form.cutlery);
      setCheckout({ cutlery: form.cutlery });
      haptic();
    };
    sections.append(section(t('checkout.cutlery'), [
      el('div.stepper', {}, [
        el('button.stepper__btn', {
          text: '−',
          attrs: { type: 'button', 'aria-label': '-1' },
          on: { click: () => setCutlery(form.cutlery - 1) }
        }),
        cutleryValue,
        el('button.stepper__btn', {
          text: '+',
          attrs: { type: 'button', 'aria-label': '+1' },
          on: { click: () => setCutlery(form.cutlery + 1) }
        })
      ])
    ]));

    // --- 6. Izoh
    sections.append(section(t('checkout.comment'), [
      el('textarea.textarea', {
        text: form.comment,
        attrs: {
          placeholder: t('checkout.commentPlaceholder'),
          rows: '3',
          'aria-label': t('checkout.comment')
        },
        on: {
          input: (e) => {
            form.comment = e.target.value;
            setCheckout({ comment: form.comment });
          }
        }
      })
    ]));

    // --- 7. Buyurtma tarkibi va narx
    const items = el('div.sums');
    getState().cart.forEach((item) => {
      items.append(el('div.sum-row', {}, [
        el('span', { text: `${item.name} × ${item.qty}` }),
        el('span', { text: formatPrice(item.unitPrice * item.qty) })
      ]));
    });
    items.append(
      el('div.sum-row', {}, [
        el('span', { text: t('cart.delivery') }),
        el('span', { text: totals.freeDelivery ? t('common.free') : formatPrice(totals.delivery) })
      ]),
      el('div.sum-row.sum-row--total', {}, [
        el('span', { text: t('common.total') }),
        el('span', { text: formatPrice(totals.total) })
      ])
    );
    sections.append(section(t('checkout.summary'), [items]));

    // --- 8. Oferta
    const offerBox = el('input', {
      attrs: { type: 'checkbox', class: 'checkbox', ...(form.offerAccepted ? { checked: 'checked' } : {}) },
      on: { change: (e) => { form.offerAccepted = e.target.checked; } }
    });
    sections.append(el('label.offer', {}, [
      offerBox,
      el('span', { text: t('checkout.offer') })
    ]));

    // --- yakuniy tugma
    cta.replaceChildren(el('button.btn.btn--primary.btn--lg.btn--block', {
      text: `${t('checkout.submit')} · ${formatPrice(totals.total)}`,
      attrs: { type: 'button' },
      on: { click: () => submit(totals) }
    }));
  }

  /**
   * Bo'lim karkasi.
   * @param {string} title
   * @param {Array<?Node>} children
   * @returns {HTMLElement}
   */
  function section(title, children) {
    return el('section.card.card--pad.co-section', {}, [
      el('h2.co-section__title', { text: title }),
      ...children.filter(Boolean)
    ]);
  }

  /**
   * Tanlangan vaqtni ISO satrga aylantiradi.
   * Vaqt bugun uchun o'tib ketgan bo'lsa — ertaga.
   * @returns {?string}
   */
  function scheduledIso() {
    if (form.timeMode !== 'scheduled' || !form.time) return null;
    const [h, m] = form.time.split(':').map(Number);
    const when = new Date();
    when.setHours(h, m, 0, 0);
    if (when.getTime() < Date.now()) when.setDate(when.getDate() + 1);
    return when.toISOString();
  }

  /**
   * Formani tekshiradi va buyurtma draftini saqlaydi.
   * @param {object} totals
   */
  function submit(totals) {
    const current = getState();

    if (!current.cart.length) {
      toast(t('cart.empty'), { type: 'error' });
      return;
    }
    if (!totals.minOrderMet) {
      toast(t('checkout.minOrderNotMet', { sum: formatPrice(totals.minOrder) }), { type: 'error' });
      return;
    }
    if (form.orderType === 'delivery' && !form.address) {
      toast(t('checkout.addressRequired'), { type: 'error' });
      return;
    }
    if (form.orderType === 'pickup' && !form.branchId) {
      toast(t('checkout.branchRequired'), { type: 'error' });
      return;
    }

    const scheduledFor = scheduledIso();
    if (form.timeMode === 'scheduled') {
      const lead = APP.delivery.minLeadMinutes;
      if (!scheduledFor || new Date(scheduledFor).getTime() - Date.now() < lead * 60000) {
        toast(t('checkout.timeTooSoon', { min: lead }), { type: 'error' });
        return;
      }
    }

    if (form.paymentMethod === 'cash' && form.changeFrom) {
      if (Number(form.changeFrom) < totals.total) {
        toast(t('checkout.changeTooSmall'), { type: 'error' });
        return;
      }
    }
    if (!form.offerAccepted) {
      toast(t('checkout.offerRequired'), { type: 'error' });
      return;
    }

    // Draft `orders` sxemasiga mos yig'iladi (SPEC 2-bo'lim).
    // Narx bu yerda YAKUNIY emas — Node servis uni qayta hisoblaydi.
    const draft = {
      type: form.orderType,
      branchId: form.branchId,
      address: form.orderType === 'delivery' ? form.address : null,
      items: current.cart.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        size: item.size,
        dough: item.dough,
        addons: item.addons,
        removed: item.removed,
        qty: item.qty,
        unitPrice: item.unitPrice,
        total: item.unitPrice * item.qty
      })),
      subtotal: totals.subtotal,
      deliveryPrice: totals.delivery,
      total: totals.total,
      promoCode: current.promoCode,
      paymentMethod: form.paymentMethod,
      changeFrom: form.paymentMethod === 'cash' && form.changeFrom
        ? Number(form.changeFrom)
        : null,
      cutlery: form.cutlery,
      comment: form.comment,
      scheduledFor,
      createdAt: new Date().toISOString()
    };

    setOrderDraft(draft);
    setCheckout({
      paymentMethod: form.paymentMethod,
      changeFrom: draft.changeFrom,
      cutlery: form.cutlery,
      comment: form.comment
    });
    haptic([10, 30, 10]);

    modal({
      title: t('checkout.draftSaved'),
      content: t('checkout.draftHint'),
      actions: [{ label: t('common.close'), variant: 'primary' }]
    });
  }

  rebuild();
  return root;
}

/**
 * Sahifa yopilganda chaqiriladi. Bu sahifada doimiy obuna yoki taymer yo'q —
 * barcha hodisalar chizilgan elementlar bilan birga o'chadi.
 */
export function destroy() {}
