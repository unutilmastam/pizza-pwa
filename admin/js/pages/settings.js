/**
 * `settings/global` tahriri (SPEC 120).
 *
 * Bu hujjatni mijoz ilovasi ham, Node servis ham o'qiydi: kafolat
 * daqiqalari, cashback foizi, bonus muddati. Servisda ular uchun
 * zaxira qiymatlar bor (`server/src/config.js`), lekin hujjat bo'lsa
 * u ustun turadi.
 *
 * Yetkazish narxi va minimal buyurtma bu yerda ZAXIRA qiymat: haqiqiy
 * qiymatlar filialning zonasidan olinadi (`branches/{id}.zones[]`).
 * Zona topilmagandagina shu yerdagilar ishlatiladi.
 */

import { t } from '../i18n.js';
import { el, toast, skeleton, field } from '../ui.js';
import { getSettings, saveSettings } from '../db.js';

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  const root = el('div.settings-page');
  const host = el('div');
  host.append(skeleton('row', 4));
  root.append(host);

  /**
   * Formani chizadi.
   * @param {object} settings
   */
  function draw(settings) {
    const guarantee = field({
      label: t('settings.guarantee'),
      value: settings.guaranteeMinutes ?? 35,
      type: 'number'
    });
    const cashback = field({
      label: t('settings.cashback'),
      value: settings.cashbackPercent ?? 2,
      type: 'number'
    });
    const bonusDays = field({
      label: t('settings.bonusDays'),
      value: settings.bonusExpiryDays ?? 90,
      type: 'number'
    });
    const supportPhone = field({
      label: t('settings.supportPhone'),
      value: settings.supportPhone || '',
      type: 'tel'
    });
    const supportTelegram = field({
      label: t('settings.supportTelegram'),
      value: settings.supportTelegram || '',
      placeholder: '@pizza_support'
    });
    const minOrder = field({
      label: t('settings.minOrder'),
      value: settings.minOrder ?? 50000,
      type: 'number'
    });
    const deliveryPrice = field({
      label: t('settings.deliveryPrice'),
      value: settings.deliveryPrice ?? 15000,
      type: 'number'
    });

    const saveBtn = el('button.btn', {
      text: t('common.save'),
      attrs: { type: 'button' },
      on: { click: () => submit() }
    });

    /** Sozlamalarni yozadi. */
    async function submit() {
      const numbers = {
        guaranteeMinutes: Number(guarantee.input.value),
        cashbackPercent: Number(cashback.input.value),
        bonusExpiryDays: Number(bonusDays.input.value),
        minOrder: Number(minOrder.input.value),
        deliveryPrice: Number(deliveryPrice.input.value)
      };

      // Manfiy yoki bo'sh qiymat mijoz ilovasida narxni buzardi
      const bad = Object.entries(numbers).find(
        ([, v]) => !Number.isFinite(v) || v < 0
      );
      if (bad) {
        toast(t('settings.badNumber'), { type: 'error' });
        return;
      }
      if (numbers.cashbackPercent > 100) {
        toast(t('settings.cashbackRange'), { type: 'error' });
        return;
      }

      saveBtn.disabled = true;
      try {
        await saveSettings({
          ...numbers,
          supportPhone: supportPhone.input.value.trim(),
          supportTelegram: supportTelegram.input.value.trim()
        });
        toast(t('app.saved'), { type: 'success' });
      } catch (e) {
        console.error('[settings] saqlanmadi:', e);
        toast(e.message || t('app.error'), { type: 'error' });
      } finally {
        saveBtn.disabled = false;
      }
    }

    host.replaceChildren(
      el('div.card.card--pad', {}, [
        el('h2', { text: t('settings.business'), attrs: { style: 'font-size:17px' } }),
        guarantee.node,
        el('p.hint', { text: t('settings.guaranteeHint') }),
        cashback.node,
        bonusDays.node
      ]),
      el('div.card.card--pad', { attrs: { style: 'margin-top:16px' } }, [
        el('h2', { text: t('settings.support'), attrs: { style: 'font-size:17px' } }),
        supportPhone.node,
        supportTelegram.node
      ]),
      el('div.card.card--pad', { attrs: { style: 'margin-top:16px' } }, [
        el('h2', { text: t('settings.delivery'), attrs: { style: 'font-size:17px' } }),
        el('p.hint', { text: t('settings.deliveryHint') }),
        minOrder.node,
        deliveryPrice.node
      ]),
      el('div', { attrs: { style: 'margin-top:16px' } }, [saveBtn])
    );
  }

  /** Sozlamalarni yuklaydi. */
  async function load() {
    try {
      draw(await getSettings());
    } catch (e) {
      console.error('[settings] yuklanmadi:', e);
      host.replaceChildren(el('div.state', {}, [
        el('h2', { text: t('app.error'), attrs: { style: 'font-size:16px' } }),
        el('p.hint', { text: e.message }),
        el('button.btn.btn--ghost', {
          text: t('app.retry'),
          attrs: { type: 'button' },
          on: { click: () => load() }
        })
      ]));
    }
  }

  load();
  return root;
}

/** Bu sahifada doimiy obuna yo'q. */
export function destroy() {}
