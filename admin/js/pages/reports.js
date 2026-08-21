/**
 * Hisobotlar (SPEC 118).
 *
 * Kunlik hisobotlarni Node servis cron'i `reports/{YYYY-MM-DD}` ga
 * yozadi — bu yerda ular o'qiladi va bugungi kun jonli hisoblanadi
 * (cron hali ishlamagan bo'lishi mumkin).
 *
 * Diagramma tashqi kutubxonasiz, inline SVG bilan chiziladi: CDN'ga
 * bog'lanish qo'shimcha ishlamay qolish nuqtasi bo'lardi, holbuki
 * kerak bo'lgani — oddiy ustunlar.
 */

import { t } from '../i18n.js';
import { el, skeleton, emptyState } from '../ui.js';
import { getReports, getOrdersBetween } from '../db.js';

/**
 * Summani `125 000` ko'rinishida yozadi.
 * @param {number} value
 * @returns {string}
 */
function money(value) {
  return String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * SVG element yasaydi.
 * @param {string} name
 * @param {object} attrs
 * @returns {SVGElement}
 */
function svgEl(name, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

/**
 * Ustunli diagramma.
 * @param {Array<{label: string, value: number}>} data
 * @returns {SVGElement}
 */
function barChart(data) {
  const width = 720;
  const height = 220;
  const padLeft = 8;
  const padBottom = 22;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = (width - padLeft * 2) / Math.max(1, data.length);
  const barWidth = Math.max(4, slot * 0.6);

  const svg = svgEl('svg', {
    class: 'chart',
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'none',
    role: 'img'
  });

  // To'rt gorizontal chiziq — o'qishga yordam beradi
  for (let i = 0; i <= 4; i += 1) {
    const y = (height - padBottom) * (i / 4);
    svg.append(svgEl('line', {
      class: 'chart__grid', x1: 0, y1: y, x2: width, y2: y
    }));
  }

  data.forEach((point, index) => {
    const barHeight = ((height - padBottom) * point.value) / max;
    const x = padLeft + slot * index + (slot - barWidth) / 2;

    svg.append(svgEl('rect', {
      class: 'chart__bar',
      x,
      y: height - padBottom - barHeight,
      width: barWidth,
      height: Math.max(0, barHeight),
      rx: 3
    }));

    // Har uchinchi sanani yozamiz — hammasi sig'maydi
    if (index % 3 === 0 || index === data.length - 1) {
      const label = svgEl('text', {
        class: 'chart__label',
        x: x + barWidth / 2,
        y: height - 6,
        'text-anchor': 'middle'
      });
      label.textContent = point.label;
      svg.append(label);
    }
  });

  return svg;
}

/**
 * Bugungi buyurtmalardan hisobot yig'adi.
 * @returns {Promise<object>}
 */
async function todayReport() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400000);

  const orders = await getOrdersBetween(start, end);
  const delivered = orders.filter((o) => o.status === 'delivered');

  return {
    date: start.toISOString().slice(0, 10),
    orders: orders.length,
    delivered: delivered.length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
    revenue: delivered.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    guaranteeBroken: orders.filter((o) => o.guaranteeBroken).length,
    byPayment: {
      cash: orders.filter((o) => o.paymentMethod === 'cash').length,
      card: orders.filter((o) => o.paymentMethod === 'card').length
    },
    live: true
  };
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  const root = el('div.reports-page');
  const body = el('div');
  body.append(skeleton('card', 2));
  root.append(body);

  /**
   * Hisobotlarni chizadi.
   * @param {object[]} reports - eskidan yangiga
   */
  function draw(reports) {
    if (!reports.length) {
      body.replaceChildren(emptyState({
        icon: '📈',
        title: t('reports.empty'),
        hint: t('reports.hint')
      }));
      return;
    }

    const total = reports.reduce((acc, r) => ({
      orders: acc.orders + (r.orders || 0),
      delivered: acc.delivered + (r.delivered || 0),
      cancelled: acc.cancelled + (r.cancelled || 0),
      revenue: acc.revenue + (r.revenue || 0),
      guarantee: acc.guarantee + (r.guaranteeBroken || 0)
    }), { orders: 0, delivered: 0, cancelled: 0, revenue: 0, guarantee: 0 });

    const average = total.delivered ? Math.round(total.revenue / total.delivered) : 0;

    // Umumiy ko'rsatkichlar
    const stats = el('div.stats', {}, [
      ['reports.orders', String(total.orders)],
      ['reports.revenue', `${money(total.revenue)} ${t('common.sum')}`],
      ['reports.average', `${money(average)} ${t('common.sum')}`],
      ['reports.delivered', String(total.delivered)],
      ['reports.cancelled', String(total.cancelled)],
      ['reports.guarantee', String(total.guarantee)]
    ].map(([key, value]) => el('div.card.stat', {}, [
      el('p.stat__label', { text: t(key) }),
      el('div.stat__value.stat__value--sm', { text: value })
    ])));

    // Tushum diagrammasi
    const chart = el('div.card.card--pad', {}, [
      el('h2.section-title', { text: t('reports.revenue') }),
      barChart(reports.map((r) => ({
        label: r.date.slice(5),
        value: r.revenue || 0
      })))
    ]);

    // Kunlar jadvali
    const table = el('table.data', {}, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: t('reports.days', { n: reports.length }) }),
          el('th.num', { text: t('reports.orders') }),
          el('th.num', { text: t('reports.delivered') }),
          el('th.num', { text: t('reports.cancelled') }),
          el('th.num', { text: t('reports.revenue') }),
          el('th.num', { text: t('reports.cash') }),
          el('th.num', { text: t('reports.card') })
        ])
      ]),
      el('tbody', {}, [...reports].reverse().map((r) => el('tr', {}, [
        el('td', {}, [
          el('span', { text: r.date }),
          r.live ? el('span.badge.badge--info', { text: t('reports.today') }) : null
        ]),
        el('td.num', { text: String(r.orders || 0) }),
        el('td.num', { text: String(r.delivered || 0) }),
        el('td.num', { text: String(r.cancelled || 0) }),
        el('td.num', { text: money(r.revenue || 0) }),
        el('td.num', { text: String(r.byPayment?.cash || 0) }),
        el('td.num', { text: String(r.byPayment?.card || 0) })
      ])))
    ]);

    body.replaceChildren(
      stats,
      chart,
      el('div.card.card--pad', {}, [
        el('div.table-wrap', {}, [table]),
        el('p.hint', { text: t('reports.hint') })
      ])
    );
  }

  (async () => {
    try {
      // Cron kechikkan bo'lsa ham bugungi kun ko'rinsin
      const [saved, today] = await Promise.all([
        getReports(14),
        todayReport().catch((e) => {
          console.warn('[reports] bugungi hisobot yig\'ilmadi:', e.message);
          return null;
        })
      ]);

      const list = saved.filter((r) => !today || r.date !== today.date);
      if (today) list.push(today);
      draw(list);
    } catch (e) {
      console.error('[reports] yuklanmadi:', e);
      body.replaceChildren(emptyState({
        icon: '⚠️',
        title: t('app.error'),
        hint: e.message
      }));
    }
  })();

  return root;
}

/** Bu sahifada doimiy obuna yo'q. */
export function destroy() {}
