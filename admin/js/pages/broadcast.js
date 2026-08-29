/**
 * Telegram broadcast (SPEC 119).
 *
 * Yuborish SERVISDA va FONDA ketadi: Telegram sekundiga ~30 xabar
 * qabul qiladi, shuning uchun 1000 mijozga ~45 sekund kerak — so'rovni
 * shuncha ushlab turib bo'lmaydi. Servis darhol javob qaytaradi,
 * hujjatni `sending` holatida yaratadi va yuborib borgani sari
 * `sent`/`failed` ni yangilaydi. Bu sahifa tarixdan holatni ko'radi.
 *
 * Faqat Telegram ulagan (`telegramId` bor) va bloklanmagan mijozlarga
 * ketadi — qabul qiluvchilar soni yuborishdan OLDIN ko'rsatiladi.
 */

import { t } from '../i18n.js';
import { el, toast, confirm, skeleton, emptyState } from '../ui.js';
import { getAudience, sendBroadcast } from '../api.js';
import { getBroadcasts } from '../db.js';

/** Auditoriyalar — servisdagi `AUDIENCES` bilan bir xil. */
const AUDIENCES = ['all', 'active', 'sleeping'];

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
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  const root = el('div.broadcast-page');

  let audience = 'all';
  /** @type {?number} qabul qiluvchilar soni (null — hali hisoblanmagan) */
  let total = null;

  const text = el('textarea.input.broadcast__text', {
    attrs: {
      rows: '6',
      placeholder: t('broadcast.placeholder'),
      'aria-label': t('broadcast.text')
    },
    on: { input: () => drawPreview() }
  });

  const countLine = el('p.hint', { text: t('broadcast.counting') });
  const preview = el('div.broadcast__preview');
  const sendBtn = el('button.btn', {
    text: t('broadcast.send'),
    attrs: { type: 'button' },
    on: { click: () => askAndSend() }
  });

  const chips = el('div.chips', {}, AUDIENCES.map((key) => el('button.chip', {
    text: t(`broadcast.audience.${key}`),
    attrs: { type: 'button', 'aria-pressed': key === audience ? 'true' : 'false' },
    on: {
      click: (e) => {
        audience = key;
        [...chips.children].forEach((c) => c.setAttribute('aria-pressed', 'false'));
        e.currentTarget.setAttribute('aria-pressed', 'true');
        [...chips.children].forEach((c) => c.classList.remove('is-active'));
        e.currentTarget.classList.add('is-active');
        loadAudience();
      }
    }
  })));
  chips.children[0].classList.add('is-active');

  const history = el('div.list');
  history.append(skeleton('row', 2));

  root.append(
    el('div.card.card--pad', {}, [
      el('h2', { text: t('broadcast.title'), attrs: { style: 'font-size:17px' } }),
      el('p.hint', { text: t('broadcast.hint') }),
      chips,
      countLine,
      text,
      el('p.hint', { text: t('broadcast.previewLabel') }),
      preview,
      sendBtn
    ]),
    el('h2', { text: t('broadcast.history'), attrs: { style: 'font-size:17px;margin-top:24px' } }),
    history
  );

  /** Xabar ko'rinishini chizadi. */
  function drawPreview() {
    const value = text.value.trim();
    preview.replaceChildren(value
      ? el('div.broadcast__bubble', { text: value })
      : el('p.hint', { text: t('broadcast.empty') }));
  }
  drawPreview();

  /** Tanlangan guruh bo'yicha qabul qiluvchilar sonini oladi. */
  async function loadAudience() {
    total = null;
    countLine.textContent = t('broadcast.counting');
    try {
      const result = await getAudience(audience);
      total = result.total;
      countLine.textContent = t('broadcast.count', { n: total });
    } catch (e) {
      console.error('[broadcast] auditoriya:', e);
      countLine.textContent = e.message || t('app.error');
    }
  }

  /** Tasdiq so'raydi va yuboradi. */
  async function askAndSend() {
    const value = text.value.trim();
    if (!value) {
      toast(t('broadcast.empty'), { type: 'error' });
      return;
    }
    if (total === 0) {
      toast(t('broadcast.noRecipients'), { type: 'error' });
      return;
    }

    const yes = await confirm({
      title: t('broadcast.confirmTitle'),
      text: t('broadcast.confirmText', {
        n: total === null ? '?' : total,
        group: t(`broadcast.audience.${audience}`)
      })
    });
    if (!yes) return;

    sendBtn.disabled = true;
    sendBtn.textContent = t('app.loading');
    try {
      const result = await sendBroadcast({ text: value, audience });
      toast(t('broadcast.started', { n: result.total }), { type: 'success' });
      text.value = '';
      drawPreview();
      await loadHistory();
    } catch (e) {
      console.error('[broadcast] yuborilmadi:', e);
      toast(e.code === 'no-recipients' ? t('broadcast.noRecipients') : (e.message || t('app.error')), {
        type: 'error'
      });
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = t('broadcast.send');
    }
  }

  /** Yuborilganlar tarixini yuklaydi. */
  async function loadHistory() {
    try {
      const list = await getBroadcasts();
      if (!list.length) {
        history.replaceChildren(emptyState({ icon: '📣', title: t('broadcast.noHistory') }));
        return;
      }
      history.replaceChildren(...list.map((b) => el('div.list-row', {}, [
        el('div.list-row__main', {}, [
          el('div.list-row__name', { text: String(b.text || '').slice(0, 80) }),
          el('div.list-row__sub', {
            text: [
              when(b.createdAt),
              t(`broadcast.audience.${b.audience}`),
              `${b.sent || 0}/${b.total || 0}`,
              b.failed ? `${t('broadcast.failed')}: ${b.failed}` : null,
              b.byName
            ].filter(Boolean).join(' · ')
          })
        ]),
        b.status === 'sending'
          ? el('span.badge.badge--warn', { text: t('broadcast.sending') })
          : el('span.badge.badge--ok', { text: t('broadcast.done') })
      ])));
    } catch (e) {
      console.error('[broadcast] tarix yuklanmadi:', e);
      history.replaceChildren(emptyState({ icon: '⚠️', title: t('app.error'), hint: e.message }));
    }
  }

  loadAudience();
  loadHistory();
  return root;
}

/** Bu sahifada doimiy obuna yo'q. */
export function destroy() {}
