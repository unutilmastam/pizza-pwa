/**
 * Profil sahifasi.
 *
 * Ichida: foydalanuvchi kartochkasi (ism va tug'ilgan kunni tahrirlash),
 * bonus balansi va tarixi, buyurtmalar tarixiga o'tish, saqlangan
 * manzillar, til va mavzu, chiqish.
 */

import { t, LANGS, getLang } from '../i18n.js';
import { el, emptyState, toast, bottomSheet, skeleton, loader } from '../ui.js';
import { formatPhone, formatPrice, formatDate } from '../utils.js';
import { APP } from '../config.js';
import { getUser, updateUserProfile, getBonusHistory, getOrders } from '../db.js';
import { getState, setLang, setTheme, updateUser } from '../state.js';
import { logout } from '../auth.js';
import { navigate } from '../router.js';

/** Sahifa yopilganda tozalanadigan ishlar. */
let cleanup = [];

/**
 * Daraja nomini beradi.
 * @param {string} tier
 * @returns {string}
 */
function tierLabel(tier) {
  const key = `profile.tier.${tier || 'bronze'}`;
  const label = t(key);
  return label === key ? tier : label;
}

/**
 * Sozlama qatori: chapda nom, o'ngda qiymat.
 * @param {string} label
 * @param {string} value
 * @param {Function} onClick
 * @returns {HTMLElement}
 */
function settingRow(label, value, onClick) {
  return el('button.opt-row.profile-row', {
    attrs: { type: 'button' },
    on: { click: onClick }
  }, [
    el('span.opt-row__name', { text: label }),
    el('span.opt-row__price', { text: value })
  ]);
}

/**
 * Ism va tug'ilgan kunni tahrirlash oynasi (SPEC 80).
 * @param {object} user
 * @param {Function} onSaved
 */
function openProfileEdit(user, onSaved) {
  const name = el('input.input', {
    attrs: { type: 'text', value: user.name || '', placeholder: t('profile.name') }
  });
  const birthday = el('input.input', {
    attrs: { type: 'date', value: user.birthday || '' }
  });

  const save = el('button.btn.btn--primary.btn--lg.btn--block', {
    text: t('common.save'),
    attrs: { type: 'button' },
    on: {
      click: async () => {
        const patch = { name: name.value.trim(), birthday: birthday.value };
        loader.show();
        try {
          await updateUserProfile(user.uid, patch);
          updateUser(patch);
          toast(t('profile.saved'), { type: 'success' });
          sheet.close();
          onSaved();
        } catch (e) {
          console.error('[profile] saqlanmadi:', e);
          toast(t('app.error'), { type: 'error' });
        } finally {
          loader.hide();
        }
      }
    }
  });

  const sheet = bottomSheet({
    title: t('profile.title'),
    content: el('div.form', {}, [
      el('label.field', {}, [
        el('span.field__label', { text: t('profile.name') }),
        name
      ]),
      el('label.field', {}, [
        el('span.field__label', { text: t('profile.birthday') }),
        birthday
      ])
    ]),
    footer: save
  });
}

/**
 * Bonus tarixi oynasi (SPEC 74-75).
 * @param {string} uid
 */
function openBonusHistory(uid) {
  const body = el('div.opt-list', {}, [skeleton('list', 3)]);
  bottomSheet({
    title: t('profile.bonus'),
    content: el('div', {}, [
      el('p.hint', { text: t('profile.bonusExpiry', { days: APP.bonusExpiryDays }) }),
      body
    ])
  });

  getBonusHistory(uid).then((rows) => {
    if (!rows.length) {
      body.replaceChildren(el('p.hint', { text: t('profile.bonusEmpty') }));
      return;
    }
    body.replaceChildren();
    rows.forEach((row) => {
      const amount = Number(row.amount) || 0;
      body.append(el('div.opt-row', {}, [
        el('span.opt-row__name', {}, [
          el('strong', { text: t(`profile.bonus.${row.type}`) }),
          el('span.hint.block', { text: formatDate(row.createdAt) })
        ]),
        el(`span.opt-row__price${amount < 0 ? '.is-negative' : ''}`, {
          text: `${amount > 0 ? '+' : ''}${formatPrice(amount, false)}`
        })
      ]));
    });
  }).catch((e) => {
    console.error('[profile] bonus tarixi:', e);
    body.replaceChildren(el('p.hint', { text: t('app.error') }));
  });
}

/**
 * Til tanlash oynasi.
 */
function openLangSheet() {
  const list = el('div.opt-list');
  LANGS.forEach((lang) => {
    const active = lang.code === getLang();
    list.append(el(`button.opt-row${active ? '.is-active' : ''}`, {
      attrs: { type: 'button' },
      on: {
        click: () => {
          setLang(lang.code);
          location.reload();
        }
      }
    }, [
      el('span.opt-row__check', { text: active ? '✓' : '', attrs: { 'aria-hidden': 'true' } }),
      el('span.opt-row__name', { text: `${lang.flag}  ${lang.label}` })
    ]));
  });
  bottomSheet({ title: t('profile.lang'), content: list });
}

/**
 * Mavzu tanlash oynasi.
 * @param {Function} onChange
 */
function openThemeSheet(onChange) {
  const options = [
    { value: 'system', label: t('profile.theme.system') },
    { value: 'light', label: t('profile.theme.light') },
    { value: 'dark', label: t('profile.theme.dark') }
  ];
  const current = getState().theme;
  const list = el('div.opt-list');
  options.forEach((opt) => {
    const active = opt.value === current;
    list.append(el(`button.opt-row${active ? '.is-active' : ''}`, {
      attrs: { type: 'button' },
      on: {
        click: () => {
          setTheme(opt.value);
          sheet.close();
          onChange();
        }
      }
    }, [
      el('span.opt-row__check', { text: active ? '✓' : '', attrs: { 'aria-hidden': 'true' } }),
      el('span.opt-row__name', { text: opt.label })
    ]));
  });
  const sheet = bottomSheet({ title: t('profile.theme'), content: list });
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  destroy();

  const root = el('div.page.profile');
  const body = el('div.profile-body');
  root.append(
    el('div.page__head', {}, [el('h1.page__title', { text: t('profile.title') })]),
    body
  );

  /** Sahifani qaytadan chizadi (til/mavzu/profil o'zgargach). */
  function rebuild() {
    const state = getState();
    const user = state.user;

    const themeLabels = {
      system: t('profile.theme.system'),
      light: t('profile.theme.light'),
      dark: t('profile.theme.dark')
    };

    const settings = el('div.opt-list', {}, [
      settingRow(t('profile.addresses'), String(state.addresses.length), () => navigate('/address')),
      settingRow(t('profile.history'), '', () => navigate('/orders')),
      settingRow(t('profile.lang'), LANGS.find((l) => l.code === getLang()).label, openLangSheet),
      settingRow(t('profile.theme'), themeLabels[state.theme], () => openThemeSheet(rebuild))
    ]);

    if (!user) {
      body.replaceChildren(
        emptyState({
          icon: '👤',
          title: t('profile.guest'),
          hint: t('auth.required'),
          action: el('button.btn.btn--primary', {
            text: t('auth.login'),
            attrs: { type: 'button' },
            on: { click: () => navigate('/auth?next=/profile') }
          })
        }),
        settings
      );
      return;
    }

    const bonusCard = el('button.card.card--pad.bonus-card', {
      attrs: { type: 'button' },
      on: { click: () => openBonusHistory(user.uid) }
    }, [
      el('div', {}, [
        el('p.hint', { text: t('profile.bonus') }),
        el('strong.bonus-card__value', { text: formatPrice(user.bonusBalance || 0) })
      ]),
      el('span.badge', { text: tierLabel(user.tier) })
    ]);

    const recent = el('div.order-list', {}, [skeleton('list', 2)]);

    body.replaceChildren(
      el('div.card.card--pad.profile-card', {}, [
        el('div.row.row--between', {}, [
          el('div', {}, [
            el('h2.auth-phone', { text: formatPhone(user.phone) }),
            el('p.muted', { text: user.name || t('profile.name') })
          ]),
          el('button.btn.btn--ghost', {
            text: t('common.edit'),
            attrs: { type: 'button' },
            on: { click: () => openProfileEdit(user, rebuild) }
          })
        ])
      ]),
      bonusCard,
      el('h2.section-title', { text: t('profile.history') }),
      recent,
      settings,
      el('button.btn.btn--ghost.btn--block', {
        text: t('auth.logout'),
        attrs: { type: 'button' },
        on: {
          click: async () => {
            loader.show();
            try {
              await logout();
              toast(t('auth.loggedOut'));
              rebuild();
            } finally {
              loader.hide();
            }
          }
        }
      })
    );

    // Oxirgi buyurtmalar va yangi profil ma'lumoti fon rejimida
    loadRecent(recent, user.uid);
    refreshProfile(user.uid);
  }

  /**
   * Oxirgi 3 ta buyurtma.
   * @param {HTMLElement} host
   * @param {string} uid
   */
  async function loadRecent(host, uid) {
    try {
      const orders = await getOrders(uid, 3);
      if (!orders.length) {
        host.replaceChildren(el('p.hint', { text: t('order.empty') }));
        return;
      }
      host.replaceChildren();
      orders.forEach((order) => {
        host.append(el('button.card.card--pad.order-card', {
          attrs: { type: 'button' },
          on: { click: () => navigate(`/order/${order.id}`) }
        }, [
          el('div.row.row--between', {}, [
            el('strong', { text: t('order.number', { n: order.orderNumber || order.id }) }),
            el('span.badge', { text: t(`status.${order.status}`) })
          ]),
          el('p.hint', { text: formatDate(order.createdAt) }),
          el('div.row.row--between.order-card__foot', {}, [
            el('span.price', { text: formatPrice(order.total) }),
            el('span.hint', { text: `${(order.items || []).length}` })
          ])
        ]));
      });
    } catch (e) {
      console.error('[profile] buyurtmalar:', e);
      host.replaceChildren(el('p.hint', { text: t('app.error') }));
    }
  }

  /**
   * Bonus va daraja Firestore'dan yangilanadi (client ularni yoza olmaydi).
   * @param {string} uid
   */
  async function refreshProfile(uid) {
    try {
      const fresh = await getUser(uid);
      if (!fresh) return;
      const known = getState().user;
      if (!known) return;
      if (known.bonusBalance !== fresh.bonusBalance || known.tier !== fresh.tier
        || known.name !== fresh.name) {
        updateUser({
          name: fresh.name || '',
          birthday: fresh.birthday || '',
          bonusBalance: fresh.bonusBalance || 0,
          tier: fresh.tier || 'bronze'
        });
        rebuild();
      }
    } catch (e) {
      console.warn('[profile] profil yangilanmadi:', e);
    }
  }

  rebuild();
  return root;
}

/** Sahifa yopilganda tozalaydi. */
export function destroy() {
  cleanup.forEach((fn) => fn());
  cleanup = [];
}
