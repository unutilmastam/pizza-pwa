/**
 * Kirish ekrani (SPEC 104).
 *
 * Ikki qadam: telefon → OTP. Kod tasdiqlangandan keyin `staff/{uid}`
 * tekshiriladi; hujjat bo'lmasa sessiya yopiladi va ekranda sabab
 * ko'rsatiladi — mijoz raqami bilan panelga kirib bo'lmaydi.
 */

import { t } from '../i18n.js';
import { el, toast } from '../ui.js';
import { sendOtp, verifyOtp, normalizePhone, authErrorKey } from '../auth.js';

/** Qayta yuborish taymeri (standart, servis o'zinikini aytishi mumkin). */
const RESEND_SECONDS = 60;

/** @type {?number} */
let timer = null;

/** Taymerni to'xtatadi. */
function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

/**
 * Telefon raqamni `+998 90 123 45 67` ko'rinishida yozadi.
 * @param {string} phone
 * @returns {string}
 */
function formatPhone(phone) {
  const d = String(phone || '').replace(/\D/g, '').replace(/^998/, '').slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.length ? `+998 ${parts.join(' ')}` : '+998 ';
}

/**
 * Kirish ekranini chizadi.
 * @param {{onSuccess: Function}} cfg
 * @returns {HTMLElement}
 */
export function renderLogin(cfg) {
  stopTimer();

  const box = el('div.card.card--pad.login__box');
  const root = el('div.login', {}, [box]);

  /** 1-qadam: telefon. */
  function phoneStep() {
    stopTimer();

    const input = el('input.input', {
      attrs: {
        type: 'tel',
        inputmode: 'tel',
        autocomplete: 'tel',
        value: '+998 ',
        'aria-label': t('auth.phone')
      }
    });

    const error = el('p.error-text', { attrs: { hidden: true } });
    const note = el('p.hint', { attrs: { 'aria-live': 'polite' } });

    const submit = el('button.btn.btn--lg.btn--block', {
      text: t('auth.sendCode'),
      attrs: { type: 'button', disabled: true }
    });

    input.addEventListener('input', () => {
      input.value = formatPhone(input.value);
      submit.disabled = !normalizePhone(input.value);
      error.hidden = true;
    });
    input.addEventListener('focus', () => {
      if (!input.value.startsWith('+998')) input.value = '+998 ';
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !submit.disabled) submit.click();
    });

    submit.addEventListener('click', async () => {
      const phone = normalizePhone(input.value);
      if (!phone) return;

      submit.disabled = true;
      submit.textContent = t('app.loading');
      error.hidden = true;
      try {
        const result = await sendOtp(phone, () => {
          note.textContent = t('auth.waking');
        });
        codeStep(phone, result.resendAfter);
      } catch (e) {
        console.error('[admin auth] kod yuborilmadi:', e);
        error.textContent = t(authErrorKey(e));
        error.hidden = false;
        submit.disabled = false;
        submit.textContent = t('auth.sendCode');
        note.textContent = '';
      }
    });

    box.replaceChildren(
      el('h1.login__title', { text: t('auth.title') }),
      el('p.login__lead', { text: t('auth.lead') }),
      el('label.field', {}, [
        el('span.field__label', { text: t('auth.phone') }),
        input
      ]),
      error,
      submit,
      note
    );
    input.focus();
  }

  /**
   * 2-qadam: kod.
   * @param {string} phone
   * @param {number} [resendAfter]
   */
  function codeStep(phone, resendAfter) {
    stopTimer();
    let waitSeconds = Number(resendAfter) > 0 ? Number(resendAfter) : RESEND_SECONDS;

    const boxes = [];
    const otp = el('div.otp');
    for (let i = 0; i < 6; i += 1) {
      const cell = el('input', {
        attrs: { type: 'text', inputmode: 'numeric', maxlength: '1', 'aria-label': `${i + 1}` }
      });
      cell.addEventListener('input', () => {
        cell.value = cell.value.replace(/\D/g, '').slice(0, 1);
        if (cell.value && i < 5) boxes[i + 1].focus();
        if (readCode().length === 6) confirmCode();
      });
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !cell.value && i > 0) boxes[i - 1].focus();
      });
      cell.addEventListener('paste', (e) => {
        const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        if (!text) return;
        e.preventDefault();
        text.slice(0, 6).split('').forEach((ch, index) => { boxes[index].value = ch; });
        boxes[Math.min(text.length, 5)].focus();
        if (readCode().length === 6) confirmCode();
      });
      boxes.push(cell);
      otp.append(cell);
    }

    /** @returns {string} */
    const readCode = () => boxes.map((b) => b.value).join('');
    /** Kataklarni tozalaydi. */
    const clearCode = () => {
      boxes.forEach((b) => { b.value = ''; });
      boxes[0].focus();
    };

    const error = el('p.error-text', { attrs: { hidden: true } });

    const submit = el('button.btn.btn--lg.btn--block', {
      text: t('auth.confirm'),
      attrs: { type: 'button' },
      on: { click: () => confirmCode() }
    });

    const resend = el('button.btn.btn--ghost.btn--block', {
      attrs: { type: 'button', disabled: true }
    });

    /** Kodni tekshiradi. */
    async function confirmCode() {
      const code = readCode();
      error.hidden = true;
      if (!/^\d{6}$/.test(code)) {
        error.textContent = t('auth.codeWrong');
        error.hidden = false;
        return;
      }
      submit.disabled = true;
      submit.textContent = t('app.loading');
      try {
        await verifyOtp(phone, code);
        stopTimer();
        cfg.onSuccess();
      } catch (e) {
        console.error('[admin auth] kod tasdiqlanmadi:', e);
        error.textContent = t(authErrorKey(e));
        error.hidden = false;
        clearCode();
        submit.disabled = false;
        submit.textContent = t('auth.confirm');
      }
    }

    /** Qayta yuborish taymerini boshlaydi. */
    function startTimer() {
      let left = waitSeconds;
      resend.disabled = true;
      resend.textContent = t('auth.resendIn', { sec: left });
      stopTimer();
      timer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          stopTimer();
          resend.disabled = false;
          resend.textContent = t('auth.resend');
          return;
        }
        resend.textContent = t('auth.resendIn', { sec: left });
      }, 1000);
    }

    resend.addEventListener('click', async () => {
      resend.disabled = true;
      try {
        const result = await sendOtp(phone);
        if (Number(result.resendAfter) > 0) waitSeconds = Number(result.resendAfter);
        toast(t('auth.resend'));
        clearCode();
        startTimer();
      } catch (e) {
        console.error('[admin auth] qayta yuborilmadi:', e);
        error.textContent = t(authErrorKey(e));
        error.hidden = false;
        resend.disabled = false;
      }
    });

    box.replaceChildren(
      el('h1.login__title', { text: t('auth.code') }),
      el('p.login__lead', { text: formatPhone(phone) }),
      otp,
      error,
      submit,
      el('div.login__foot', {}, [
        resend,
        el('button.btn.btn--ghost.btn--block', {
          text: t('auth.changePhone'),
          attrs: { type: 'button' },
          on: { click: () => phoneStep() }
        })
      ])
    );
    boxes[0].focus();
    startTimer();
  }

  phoneStep();
  return root;
}
