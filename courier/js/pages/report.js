/**
 * Kunlik hisob (SPEC 128).
 *
 * Hisob SERVISDAN olinadi (`GET /api/courier/report`): kuryer barcha
 * buyurtmalarni o'qiy olmaydi (`firestore.rules` faqat o'ziga
 * tayinlanganini beradi), lekin yig'indini serverda hisoblash
 * ishonchliroq va bir so'rovda tugaydi.
 */

import { t } from '../i18n.js';
import { el, skeleton } from '../ui.js';
import { getReport } from '../api.js';
import { cache } from '../db.js';

/** Kunlik hisob kesh kaliti. */
const CACHE_KEY = 'report.today';

/**
 * Summani `125 000` ko'rinishida yozadi.
 * @param {number} value
 * @returns {string}
 */
function money(value) {
  return String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Bitta ko'rsatkich.
 * @param {string} label
 * @param {string} value
 * @returns {HTMLElement}
 */
function stat(label, value) {
  return el('div.stat', {}, [
    el('p.stat__label', { text: label }),
    el('div.stat__value', { text: value })
  ]);
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  const root = el('div.report-page');
  const host = el('div');
  host.append(skeleton('row', 2));
  root.append(host);

  /**
   * Hisobni chizadi.
   * @param {object} r
   * @param {boolean} [stale] - keshdan olingan, yangisi fonda kelmoqda
   */
  function draw(r, stale = false) {
    host.replaceChildren(
      el('h2', {
        text: `${t('report.title')} · ${r.date}`,
        attrs: { style: 'font-size:18px;margin-bottom:16px' }
      }),
      el('div.stats', {}, [
        stat(t('report.delivered'), String(r.delivered || 0)),
        stat(t('report.active'), String(r.active || 0)),
        stat(t('report.deliveryTotal'), money(r.deliveryTotal)),
        stat(t('report.cashTotal'), money(r.cashTotal)),
        stat(t('report.cardTotal'), money(r.cardTotal)),
        stat(t('report.orderTotal'), money(r.orderTotal))
      ]),
      el('p.hint', {
        text: stale ? t('app.updating') : t('report.hint'),
        attrs: { style: 'margin-top:16px' }
      }),
      el('button.btn.btn--ghost.btn--block', {
        text: t('common.refresh'),
        attrs: { type: 'button', style: 'margin-top:16px' },
        on: { click: () => load(true) }
      })
    );
  }

  /**
   * Xato holatini chizadi.
   * @param {Error} e
   */
  function drawError(e) {
    host.replaceChildren(el('div.state', {}, [
      el('div', { text: '⚠️', attrs: { 'aria-hidden': 'true', style: 'font-size:36px' } }),
      el('h2', { text: t('app.error'), attrs: { style: 'font-size:17px' } }),
      el('p.hint', { text: e.message }),
      el('button.btn.btn--ghost', {
        text: t('app.retry'),
        attrs: { type: 'button' },
        on: { click: () => load(true) }
      })
    ]));
  }

  /**
   * Hisobni yuklaydi.
   *
   * KESHDAN DARHOL: o'lchovda har tab almashuvida `GET /api/courier/report`
   * qaytadan chaqirilar va 1.5 sekundlik skeleton chiqardi (Render
   * uyqudan uyg'onayotgan bo'lsa — 50 sekundgacha). Endi eski hisob
   * darhol ko'rinadi, yangisi fonda keladi.
   *
   * @param {boolean} [force] - keshni chetlab o'tib qayta so'rash
   */
  async function load(force = false) {
    const cached = force ? null : cache.peek(CACHE_KEY);
    if (cached) draw(cached, true);
    else host.replaceChildren(skeleton('row', 2));

    try {
      const r = await getReport();
      cache.write(CACHE_KEY, r);
      draw(r);
    } catch (e) {
      console.error('[report] yuklanmadi:', e);
      // Keshdagi hisob bo'lsa uni qoldiramiz — kuryer raqamsiz qolmasin
      if (cached) return;
      drawError(e);
    }
  }

  load();
  return root;
}

/** Bu sahifada doimiy obuna yo'q. */
export function destroy() {}
