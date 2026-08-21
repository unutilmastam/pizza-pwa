/**
 * Kirish sahifasi: telefon → OTP → sessiya.
 *
 * Ikki qadam: raqam kiritish va kodni tasdiqlash. Test rejimida ekranda
 * kod ochiq ko'rsatiladi (`AUTH_MODE = 'test'`, `js/config.js`).
 *
 * `#/auth?next=/checkout` ko'rinishida ochilsa, kirgandan keyin o'sha
 * sahifaga qaytariladi.
 */

import { t } from '../i18n.js';
import { el, toast, loader } from '../ui.js';
import { formatPhone, haptic } from '../utils.js';
import { TEST_OTP_CODE, OTP_RESEND_SECONDS } from '../config.js';
import {
  sendOtp, verifyOtp, logout, normalizePhone, isTestMode, authErrorKey, watchAuth
} from '../auth.js';
import { getState, setUser } from '../state.js';
import { navigate, back } from '../router.js';

/** Sahifa yopilganda to'xtatiladigan taymer. */
let resendTimer = null;

/**
 * Qayta yuborish taymerini to'xtatadi.
 */
function stopTimer() {
  if (resendTimer) clearInterval(resendTimer);
  resendTimer = null;
}

/**
 * OTP uchun 6 ta katak. Kiritish, o'chirish va paste bilan ishlaydi.
 * @param {(code: string) => void} onComplete - 6 raqam yig'ilganda
 * @returns {{node: HTMLElement, value: () => string, focus: Function, clear: Function}}
 */
function otpBoxes(onComplete) {
  const inputs = [];
  const node = el('div.otp', { attrs: { role: 'group', 'aria-label': t('auth.code') } });

  /** Barcha kataklardagi raqamlar. */
  const value = () => inputs.map((i) => i.value).join('');

  const check = () => {
    const code = value();
    if (code.length === 6) onComplete(code);
  };

  for (let i = 0; i < 6; i += 1) {
    const input = el('input.otp__box', {
      attrs: {
        type: 'text',
        inputmode: 'numeric',
        autocomplete: i === 0 ? 'one-time-code' : 'off',
        maxlength: '1',
        'aria-label': `${i + 1}`
      }
    });

    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 1);
      if (input.value && inputs[i + 1]) inputs[i + 1].focus();
      check();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && inputs[i - 1]) {
        inputs[i - 1].focus();
        inputs[i - 1].value = '';
        e.preventDefault();
      }
    });

    // SMS'dan yoki qo'ldan to'liq kod tashlansa — kataklarga tarqatiladi
    input.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      const digits = String(text || '').replace(/\D/g, '').slice(0, 6);
      if (!digits) return;
      e.preventDefault();
      digits.split('').forEach((ch, idx) => {
        if (inputs[idx]) inputs[idx].value = ch;
      });
      (inputs[Math.min(digits.length, 5)] || input).focus();
      check();
    });

    inputs.push(input);
    node.append(input);
  }

  return {
    node,
    value,
    focus: () => inputs[0].focus(),
    clear: () => {
      inputs.forEach((i) => { i.value = ''; });
      inputs[0].focus();
    }
  };
}

/**
 * Sahifani chizadi.
 * @param {{query: URLSearchParams}} ctx
 * @returns {HTMLElement}
 */
export function render(ctx) {
  destroy();

  const next = (ctx && ctx.query && ctx.query.get('next')) || null;
  const root = el('div.page.auth');
  const body = el('div.auth-body');

  root.append(
    el('div.page__head', {}, [
      el('button.icon-btn', {
        text: '‹',
        attrs: { type: 'button', 'aria-label': t('common.back') },
        on: { click: () => back() }
      }),
      el('h1.page__title', { text: t('auth.title') })
    ]),
    body
  );

  /** Kirilgandan keyin qayerga qaytamiz. */
  const goNext = () => {
    if (next) navigate(next, { replace: true });
    else back();
  };

  // Allaqachon kirgan bo'lsa — sessiya kartochkasi va chiqish
  const current = getState().user;
  if (current) {
    renderSignedIn(body, current, goNext);
    // Profil ma'lumoti fon rejimida yangilanadi
    watchAuth().catch((e) => console.warn('[auth] kuzatuvchi:', e));
    return root;
  }

  renderPhoneStep(body, goNext);
  return root;
}

/**
 * Kirgan foydalanuvchi ko'rinishi.
 * @param {HTMLElement} body
 * @param {object} user
 * @param {Function} goNext
 */
function renderSignedIn(body, user, goNext) {
  body.replaceChildren(
    el('div.card.card--pad.auth-card', {}, [
      el('p.hint', { text: t('auth.signedInAs') }),
      el('h2.auth-phone', { text: formatPhone(user.phone) || t('profile.guest') }),
      user.name ? el('p.muted', { text: user.name }) : null,
      el('p.hint', { text: `uid: ${user.uid}` })
    ]),
    el('button.btn.btn--primary.btn--lg.btn--block', {
      text: t('common.continue'),
      attrs: { type: 'button' },
      on: { click: goNext }
    }),
    el('button.btn.btn--ghost.btn--block', {
      text: t('auth.logout'),
      attrs: { type: 'button' },
      on: {
        click: async () => {
          loader.show();
          try {
            await logout();
            toast(t('auth.loggedOut'));
            renderPhoneStep(body, goNext); // darhol 1-qadamga qaytamiz
          } finally {
            loader.hide();
          }
        }
      }
    })
  );
}

/**
 * 1-qadam: telefon raqam.
 * @param {HTMLElement} body
 * @param {Function} goNext
 */
function renderPhoneStep(body, goNext) {
  const input = el('input.input.phone-input', {
    attrs: {
      type: 'tel',
      inputmode: 'tel',
      autocomplete: 'tel',
      value: '+998 ',
      'aria-label': t('auth.phone')
    }
  });

  // +998 doim turadi, foydalanuvchi faqat 9 raqam kiritadi
  const applyMask = () => {
    input.value = formatPhone(input.value);
    submit.disabled = !normalizePhone(input.value);
  };
  input.addEventListener('input', applyMask);
  input.addEventListener('focus', () => {
    if (!input.value.startsWith('+998')) input.value = '+998 ';
  });

  const submit = el('button.btn.btn--primary.btn--lg.btn--block', {
    text: t('auth.sendCode'),
    attrs: { type: 'button', disabled: 'disabled' }
  });

  submit.addEventListener('click', async () => {
    const phone = normalizePhone(input.value);
    if (!phone) {
      toast(t('auth.phoneInvalid'), { type: 'error' });
      return;
    }
    submit.disabled = true;
    loader.show();
    try {
      // Render bepul planida birinchi so'rov servisni uyg'otadi — uzoq
      // kutishda foydalanuvchi nima bo'layotganini bilsin
      const result = await sendOtp(phone, () => toast(t('auth.waking')));
      haptic();
      renderCodeStep(body, phone, goNext, result.resendAfter);
    } catch (e) {
      console.error('[auth] kod yuborilmadi:', e);
      toast(t(authErrorKey(e)), { type: 'error' });
      submit.disabled = false;
    } finally {
      loader.hide();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !submit.disabled) submit.click();
  });

  body.replaceChildren(
    isTestMode() ? testBanner() : null,
    el('p.muted.auth-lead', { text: t('auth.phoneLead') }),
    el('label.field', {}, [
      el('span.field__label', { text: t('auth.phone') }),
      input
    ]),
    submit,
    el('button.btn.btn--ghost.btn--block', {
      text: t('auth.guest'),
      attrs: { type: 'button' },
      on: {
        click: () => {
          setUser(null); // mehmon rejimi — savat va manzil ishlayveradi
          toast(t('auth.guestMode'));
          goNext();
        }
      }
    })
  );
  applyMask();
}

/**
 * 2-qadam: OTP kodi.
 * @param {HTMLElement} body
 * @param {string} phone
 * @param {Function} goNext
 * @param {number} [resendAfter] - servis bergan qayta yuborish taymeri (sek)
 */
function renderCodeStep(body, phone, goNext, resendAfter) {
  stopTimer();

  /** Taymer uzunligi: servis aytgani ustun, aks holda config qiymati. */
  let waitSeconds = Number(resendAfter) > 0 ? Number(resendAfter) : OTP_RESEND_SECONDS;

  const boxes = otpBoxes((code) => confirmCode(code));
  const errorLine = el('p.field__error', { attrs: { hidden: 'hidden' } });

  const resend = el('button.btn.btn--ghost.btn--block', {
    attrs: { type: 'button', disabled: 'disabled' }
  });

  const submit = el('button.btn.btn--primary.btn--lg.btn--block', {
    text: t('common.confirm'),
    attrs: { type: 'button' },
    on: { click: () => confirmCode(boxes.value()) }
  });

  /**
   * Kodni tekshiradi.
   * @param {string} code
   */
  async function confirmCode(code) {
    errorLine.hidden = true;
    if (!/^\d{6}$/.test(code)) {
      errorLine.textContent = t('auth.codeWrong');
      errorLine.hidden = false;
      return;
    }
    submit.disabled = true;
    loader.show();
    try {
      await verifyOtp(phone, code);
      haptic([10, 30, 10]);
      toast(t('auth.success'), { type: 'success' });
      stopTimer();
      goNext();
    } catch (e) {
      console.error('[auth] kod tasdiqlanmadi:', e);
      errorLine.textContent = t(authErrorKey(e));
      errorLine.hidden = false;
      boxes.clear();
    } finally {
      submit.disabled = false;
      loader.hide();
    }
  }

  /** Qayta yuborish taymerini boshlaydi. */
  function startTimer() {
    let left = waitSeconds;
    resend.disabled = true;
    resend.textContent = t('auth.resendIn', { sec: left });
    stopTimer();
    resendTimer = setInterval(() => {
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
      const result = await sendOtp(phone, () => toast(t('auth.waking')));
      if (Number(result.resendAfter) > 0) waitSeconds = Number(result.resendAfter);
      toast(t('auth.codeSent'));
      boxes.clear();
      startTimer();
    } catch (e) {
      console.error('[auth] qayta yuborilmadi:', e);
      toast(t(authErrorKey(e)), { type: 'error' });
      resend.disabled = false;
    }
  });

  body.replaceChildren(
    isTestMode() ? testBanner() : null,
    el('p.muted.auth-lead', { text: t('auth.codeLead', { phone: formatPhone(phone) }) }),
    boxes.node,
    errorLine,
    submit,
    resend,
    el('button.btn.btn--ghost.btn--block', {
      text: t('auth.changePhone'),
      attrs: { type: 'button' },
      on: {
        click: () => {
          stopTimer();
          renderPhoneStep(body, goNext);
        }
      }
    })
  );

  boxes.focus();
  startTimer();
}

/**
 * Test rejimi haqidagi plashka.
 * @returns {HTMLElement}
 */
function testBanner() {
  return el('div.test-banner', { attrs: { role: 'note' } }, [
    el('strong', { text: t('auth.testMode', { code: TEST_OTP_CODE }) }),
    el('span.hint.block', { text: t('auth.testModeHint') })
  ]);
}

/** Sahifa yopilganda taymerni to'xtatadi. */
export function destroy() {
  stopTimer();
}
