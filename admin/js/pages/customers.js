/**
 * Mijozlar bazasi va qora ro'yxat (SPEC 117), bonus berish (SPEC 118).
 *
 * PUL MAYDONLARIGA TEGILMAYDI. `bonusBalance`, `tier`, `totalSpent` —
 * `firestore.rules` ularni hech kimga ochmaydi, xodimga ham. Bu
 * sahifadan faqat `blocked` va `notes` yoziladi. Bonus esa servis
 * orqali beriladi (`POST /api/admin/bonus`) — u transaction ichida
 * o'zgartiradi va audit logga yozadi.
 */

import { t } from '../i18n.js';
import {
  el, toast, modal, confirm, skeleton, emptyState, field
} from '../ui.js';
import {
  getCustomers, getCustomerOrders, getBonusHistory, setCustomerFlags
} from '../db.js';
import { giveBonus } from '../api.js';
import { getCurrentStaff } from '../auth.js';

/**
 * Summani `125 000` ko'rinishida yozadi.
 * @param {number} value
 * @returns {string}
 */
function money(value) {
  return String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Firestore sanasini o'qiladigan ko'rinishga keltiradi.
 * @param {*} value
 * @returns {string}
 */
function when(value) {
  if (!value) return '—';
  const ms = typeof value.toMillis === 'function' ? value.toMillis()
    : typeof value.seconds === 'number' ? value.seconds * 1000
      : new Date(value).getTime();
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Qidiruv uchun matnni soddalashtiradi.
 * @param {string} text
 * @returns {string}
 */
function normalize(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, '');
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  const root = el('div.customers-page');
  const body = el('div.list');
  body.append(skeleton('row', 5));

  /** @type {object[]} */
  let customers = [];
  /** @type {string} */
  let query = '';

  const search = el('input.input', {
    attrs: {
      type: 'search',
      inputmode: 'search',
      placeholder: t('customers.search'),
      'aria-label': t('customers.search')
    },
    on: {
      input: (e) => {
        query = e.target.value;
        draw();
      }
    }
  });

  root.append(
    el('div.toolbar', {}, [
      search,
      el('span.toolbar__spacer'),
      el('span.hint', { text: t('customers.hint') })
    ]),
    body
  );

  /**
   * Bonus berish oynasi (SPEC 118).
   * @param {object} customer
   */
  function openBonus(customer) {
    const amount = field({ label: t('customers.bonusAmount'), value: '', type: 'number' });
    const reason = field({ label: t('customers.bonusReason'), value: '' });

    modal({
      title: t('customers.giveBonus'),
      content: el('div', {}, [
        el('p', { text: customer.name || customer.phone || customer.uid }),
        el('p.hint', {
          text: `${t('customers.bonus')}: ${money(customer.bonusBalance)} ${t('common.sum')}`
        }),
        amount.node,
        el('p.hint', { text: t('customers.bonusHint') }),
        reason.node
      ]),
      actions: [
        { label: t('common.cancel') },
        {
          label: t('common.save'),
          variant: 'primary',
          onClick: () => {
            const value = Number(amount.input.value);
            if (!Number.isFinite(value) || value === 0) {
              toast(t('customers.bonusBad'), { type: 'error' });
              return false;
            }
            if (!reason.input.value.trim()) {
              toast(t('customers.reasonRequired'), { type: 'error' });
              return false;
            }
            runBonus(customer, value, reason.input.value.trim());
            return true;
          }
        }
      ]
    });
  }

  /**
   * Bonusni servis orqali beradi.
   * @param {object} customer
   * @param {number} value
   * @param {string} reason
   */
  async function runBonus(customer, value, reason) {
    try {
      const result = await giveBonus({ uid: customer.uid, amount: value, reason });
      // Servis yangi balansni qaytaradi — keshdagi ro'yxatni ham yangilaymiz
      customer.bonusBalance = result.bonusBalance;
      toast(t('customers.bonusDone', { sum: money(result.bonusBalance) }), { type: 'success' });
      draw();
    } catch (e) {
      console.error('[customers] bonus berilmadi:', e);
      toast(bonusError(e), { type: 'error' });
    }
  }

  /**
   * Bonus xatosini matnga aylantiradi.
   * @param {*} error
   * @returns {string}
   */
  function bonusError(error) {
    const code = String((error && error.code) || '');
    if (code === 'not-enough-bonus') return t('customers.notEnough');
    if (code === 'amount-too-big') return t('customers.tooBig');
    if (code === 'no-user') return t('customers.noUser');
    if (code === 'role-forbidden') return t('auth.noSection');
    return error.message || t('app.error');
  }

  /**
   * Qora ro'yxatga qo'shadi yoki chiqaradi.
   * @param {object} customer
   */
  async function toggleBlock(customer) {
    const blocking = customer.blocked !== true;
    const yes = await confirm({
      title: blocking ? t('customers.block') : t('customers.unblock'),
      text: blocking ? t('customers.blockConfirm') : t('customers.unblockConfirm'),
      danger: blocking
    });
    if (!yes) return;

    try {
      await setCustomerFlags(customer.uid, { blocked: blocking });
      customer.blocked = blocking;
      toast(t('app.saved'), { type: 'success' });
      draw();
    } catch (e) {
      console.error('[customers] holat o\'zgarmadi:', e);
      toast(e.message || t('app.error'), { type: 'error' });
    }
  }

  /**
   * Mijoz kartochkasi: profil, buyurtmalar tarixi, bonus.
   * @param {object} customer
   */
  function openCustomer(customer) {
    const orders = el('div');
    orders.append(skeleton('row', 3));
    const bonus = el('div');

    const notes = field({ label: t('customers.notes'), value: customer.notes || '' });

    const handle = modal({
      title: customer.name || customer.phone || customer.uid,
      content: el('div', {}, [
        el('dl.order__line', {}, [
          el('dt', { text: t('customers.phone') }),
          el('dd', { text: customer.phone || '—' })
        ]),
        el('dl.order__line', {}, [
          el('dt', { text: t('customers.bonus') }),
          el('dd', { text: `${money(customer.bonusBalance)} ${t('common.sum')}` })
        ]),
        el('dl.order__line', {}, [
          el('dt', { text: t('customers.totalSpent') }),
          el('dd', { text: `${money(customer.totalSpent)} ${t('common.sum')}` })
        ]),
        el('dl.order__line', {}, [
          el('dt', { text: t('customers.tier') }),
          el('dd', { text: customer.tier || '—' })
        ]),
        notes.node,
        el('div.row.row--tight', {}, [
          el('button.btn.btn--sm', {
            text: t('customers.saveNotes'),
            attrs: { type: 'button' },
            on: {
              click: async () => {
                try {
                  await setCustomerFlags(customer.uid, { notes: notes.input.value });
                  customer.notes = notes.input.value;
                  toast(t('app.saved'), { type: 'success' });
                } catch (e) {
                  toast(e.message || t('app.error'), { type: 'error' });
                }
              }
            }
          }),
          canGiveBonus()
            ? el('button.btn.btn--sm.btn--ghost', {
              text: t('customers.giveBonus'),
              attrs: { type: 'button' },
              on: {
                click: () => {
                  handle.close();
                  openBonus(customer);
                }
              }
            })
            : null,
          el('button.btn.btn--sm.btn--ghost', {
            text: customer.blocked ? t('customers.unblock') : t('customers.block'),
            attrs: { type: 'button' },
            on: {
              click: () => {
                handle.close();
                toggleBlock(customer);
              }
            }
          })
        ]),
        el('h3', { text: t('customers.bonusHistory'), attrs: { style: 'font-size:15px;margin-top:16px' } }),
        bonus,
        el('h3', { text: t('customers.orders'), attrs: { style: 'font-size:15px;margin-top:16px' } }),
        orders
      ]),
      actions: [{ label: t('common.close') }]
    });

    // Tarix fonda keladi — oyna darhol ochiladi
    getCustomerOrders(customer.uid)
      .then((list) => {
        orders.replaceChildren(...(list.length
          ? list.slice(0, 20).map((o) => el('div.list-row', {}, [
            el('div.list-row__main', {}, [
              el('div.list-row__name', { text: t('orders.number', { n: o.orderNumber || '—' }) }),
              el('div.list-row__sub', { text: `${when(o.createdAt)} · ${t(`status.${o.status}`)}` })
            ]),
            el('span', { text: `${money(o.total)} ${t('common.sum')}` })
          ]))
          : [el('p.hint', { text: t('customers.noOrders') })]));
      })
      .catch((e) => orders.replaceChildren(el('p.hint', { text: e.message })));

    getBonusHistory(customer.uid)
      .then((list) => {
        bonus.replaceChildren(...(list.length
          ? list.slice(0, 20).map((b) => el('div.list-row', {}, [
            el('div.list-row__main', {}, [
              el('div.list-row__name', {
                text: `${b.amount > 0 ? '+' : ''}${money(b.amount)} · ${t(`bonus.${b.type}`)}`
              }),
              el('div.list-row__sub', { text: `${when(b.createdAt)}${b.reason ? ` · ${b.reason}` : ''}` })
            ])
          ]))
          : [el('p.hint', { text: t('customers.noBonus') })]));
      })
      .catch((e) => bonus.replaceChildren(el('p.hint', { text: e.message })));
  }

  /** Bonusni faqat superadmin va manager beradi (servis ham tekshiradi). */
  function canGiveBonus() {
    const staff = getCurrentStaff();
    return Boolean(staff) && ['superadmin', 'manager'].includes(staff.role);
  }

  /** Ro'yxatni chizadi. */
  function draw() {
    const needle = normalize(query);
    const list = customers
      .filter((c) => !needle
        || normalize(c.name).includes(needle)
        || normalize(c.phone).includes(needle))
      .sort((a, b) => (Number(b.totalSpent) || 0) - (Number(a.totalSpent) || 0));

    if (!list.length) {
      body.replaceChildren(emptyState({
        icon: '👤',
        title: needle ? t('menu.nothingFound') : t('app.empty'),
        hint: needle ? '' : t('customers.emptyHint')
      }));
      return;
    }

    body.replaceChildren(...list.slice(0, 200).map((c) => el('div.list-row', {
      attrs: { role: 'button', tabindex: '0' },
      on: {
        click: () => openCustomer(c),
        keydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openCustomer(c);
          }
        }
      }
    }, [
      el('div.list-row__main', {}, [
        el('div.list-row__name', { text: c.name || c.phone || c.uid }),
        el('div.list-row__sub', {
          text: [
            c.phone,
            `${t('customers.orderCount')}: ${Number(c.orderCount) || 0}`,
            `${money(c.totalSpent)} ${t('common.sum')}`,
            c.lastOrderAt ? when(c.lastOrderAt) : null
          ].filter(Boolean).join(' · ')
        })
      ]),
      c.blocked ? el('span.badge.badge--err', { text: t('customers.blocked') }) : null,
      Number(c.bonusBalance) > 0
        ? el('span.badge', { text: `${money(c.bonusBalance)} 🎁` })
        : null
    ])));
  }

  /** Mijozlarni yuklaydi. */
  async function load() {
    try {
      customers = await getCustomers((fresh) => {
        customers = fresh;
        draw();
      });
      draw();
    } catch (e) {
      console.error('[customers] yuklanmadi:', e);
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
