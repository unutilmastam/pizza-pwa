/**
 * Audit log (SPEC 121) — kim nima o'zgartirgani.
 *
 * Yozuvlar O'ZGARMAS: `firestore.rules` da `update` va `delete` hech
 * kimga ochiq emas, hatto superadminga ham. Bu sahifa faqat o'qiydi.
 *
 * FILTR BRAUZERDA: sana va xodim bo'yicha birga so'rash Firestore'da
 * kompozit indeks talab qiladi. Yozuvlar soni kichik (oxirgi 200 ta
 * olinadi), shuning uchun filtr shu yerda bajariladi.
 */

import { t } from '../i18n.js';
import {
  el, skeleton, emptyState, modal, selectField
} from '../ui.js';
import { getAuditLog } from '../db.js';

/**
 * Amal nomini tarjima qiladi.
 *
 * `t()` topilmagan kalitni O'ZINI qaytaradi. Yangi amal qo'shilib,
 * tarjimasi hali yozilmagan bo'lsa ekranda `audit.action.foo.bar`
 * ko'rinib qolmasin — prefiks olib tashlanadi.
 *
 * @param {string} action
 * @returns {string}
 */
function actionLabel(action) {
  const key = `audit.action.${action}`;
  const text = t(key);
  return text === key ? action : text;
}

/**
 * Firestore sanasini o'qiladigan ko'rinishga keltiradi.
 * @param {*} value
 * @returns {string}
 */
function when(value) {
  const ms = millis(value);
  if (ms === null) return '—';
  return new Date(ms).toLocaleString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Sanani millisekundga aylantiradi.
 * @param {*} value
 * @returns {?number}
 */
function millis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * `YYYY-MM-DD` ni kun boshiga aylantiradi.
 * @param {string} text
 * @returns {?number}
 */
function dayStart(text) {
  const value = String(text || '').trim();
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  const root = el('div.audit-page');
  const body = el('div.list');
  body.append(skeleton('row', 5));

  /** @type {object[]} */
  let entries = [];
  let filterFrom = '';
  let filterTo = '';
  let filterStaff = '';

  const fromInput = el('input.input', {
    attrs: { type: 'date', 'aria-label': t('audit.from') },
    on: { change: (e) => { filterFrom = e.target.value; draw(); } }
  });
  const toInput = el('input.input', {
    attrs: { type: 'date', 'aria-label': t('audit.to') },
    on: { change: (e) => { filterTo = e.target.value; draw(); } }
  });
  const staffHost = el('span');

  root.append(
    el('div.toolbar', {}, [
      fromInput,
      toInput,
      staffHost,
      el('span.toolbar__spacer'),
      el('button.btn.btn--ghost.btn--sm', {
        text: t('common.refresh'),
        attrs: { type: 'button' },
        on: { click: () => load() }
      })
    ]),
    el('p.hint', { text: t('audit.hint') }),
    body
  );

  /** Xodim tanlash ro'yxatini qayta quradi. */
  function drawStaffFilter() {
    const names = [...new Set(entries.map((e) => e.staffName || e.uid))].sort();
    const { node, select } = selectField({
      label: t('audit.staff'),
      value: filterStaff,
      options: [{ value: '', label: t('common.all') }]
        .concat(names.map((n) => ({ value: n, label: n }))),
      onChange: (value) => { filterStaff = value; draw(); }
    });
    node.classList.add('field--inline');
    select.setAttribute('aria-label', t('audit.staff'));
    staffHost.replaceChildren(node);
  }

  /**
   * Yozuvning to'liq mazmunini ko'rsatadi.
   * @param {object} entry
   */
  function openEntry(entry) {
    /**
     * Obyektni o'qiladigan matnga aylantiradi.
     * @param {*} value
     * @returns {HTMLElement}
     */
    const dump = (value) => el('pre.audit__dump', {
      text: value === null || value === undefined
        ? '—'
        : JSON.stringify(value, null, 2)
    });

    modal({
      title: actionLabel(entry.action),
      content: el('div', {}, [
        el('dl.order__line', {}, [
          el('dt', { text: t('audit.staff') }),
          el('dd', { text: `${entry.staffName || '—'} (${entry.uid})` })
        ]),
        el('dl.order__line', {}, [
          el('dt', { text: t('audit.target') }),
          el('dd', { text: entry.target || '—' })
        ]),
        el('dl.order__line', {}, [
          el('dt', { text: t('audit.at') }),
          el('dd', { text: when(entry.at) })
        ]),
        el('h3', { text: t('audit.before'), attrs: { style: 'font-size:14px;margin-top:12px' } }),
        dump(entry.before),
        el('h3', { text: t('audit.after'), attrs: { style: 'font-size:14px;margin-top:12px' } }),
        dump(entry.after)
      ]),
      actions: [{ label: t('common.close') }]
    });
  }

  /** Ro'yxatni chizadi. */
  function draw() {
    const from = dayStart(filterFrom);
    // `validTo` kuni ham kirsin — kun oxirigacha
    const to = dayStart(filterTo);
    const toEnd = to === null ? null : to + 86400000;

    const list = entries.filter((e) => {
      const at = millis(e.at);
      if (from !== null && (at === null || at < from)) return false;
      if (toEnd !== null && (at === null || at >= toEnd)) return false;
      if (filterStaff && (e.staffName || e.uid) !== filterStaff) return false;
      return true;
    });

    if (!list.length) {
      body.replaceChildren(emptyState({
        icon: '📋',
        title: t('app.empty'),
        hint: t('audit.emptyHint')
      }));
      return;
    }

    body.replaceChildren(...list.map((entry) => el('div.list-row', {
      attrs: { role: 'button', tabindex: '0' },
      on: {
        click: () => openEntry(entry),
        keydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openEntry(entry);
          }
        }
      }
    }, [
      el('div.list-row__main', {}, [
        el('div.list-row__name', { text: actionLabel(entry.action) }),
        el('div.list-row__sub', {
          text: [entry.staffName || entry.uid, entry.target, when(entry.at)]
            .filter(Boolean).join(' · ')
        })
      ]),
      entry.source === 'server'
        ? el('span.badge', { text: t('audit.server') })
        : null
    ])));
  }

  /** Yozuvlarni yuklaydi. */
  async function load() {
    try {
      entries = await getAuditLog({ limit: 200 });
      drawStaffFilter();
      draw();
    } catch (e) {
      console.error('[audit] yuklanmadi:', e);
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
