/**
 * Reklama karuseli (SPEC 116, 10-bosqich).
 *
 * NEGA GORIZONTAL SLAYD, FADE EMAS.
 * Ikkalasi ham o'lchandi (`scratchpad/prof/anim-bench.*`): mobil
 * o'lchamda, CPU 1× / 4× / 6× sekinlashtirilgan holda kadr vaqtining
 * medianasi ikkalasida ham 16.7 ms — farq shovqin ichida. Ikkalasi
 * ham kompozitorda ketadi (`opacity` va `transform` — ikkalasi ham
 * layout va paint talab qilmaydi), shuning uchun tezlik tanlovni hal
 * qilmadi.
 *
 * Tanlov FUNKSIYA bo'yicha: talabda swipe bor. Slaydda barmoq
 * yo'lakni 1:1 tortadi — foydalanuvchi harakat davomida qayerda
 * ekanini ko'radi. Fade da bunday tabiiy moslik yo'q: surish faqat
 * "bo'ldi/bo'lmadi" bo'lib qolardi. Shuning uchun slayd.
 *
 * Muhim texnik jihatlar:
 *  - taymer sahifadan chiqilganda VA tab fonga o'tganda to'xtaydi;
 *  - `prefers-reduced-motion` da animatsiya umuman yo'q — nuqtalar
 *    bilan qo'lda almashtiriladi;
 *  - faqat joriy va keyingi rasm yuklanadi.
 */

import { el } from './ui.js';
import { t, pick } from './i18n.js';
import { navigate } from './router.js';

/** Avtomatik almashish oralig'i (ms). */
const INTERVAL = 5000;

/** Foydalanuvchi surgandan keyin avto-almashish shuncha to'xtaydi (ms). */
const PAUSE_AFTER_TOUCH = 10000;

/** Shundan ortiq surilsa slayd almashadi (px). */
const SWIPE_THRESHOLD = 40;

/**
 * Foydalanuvchi animatsiyani kamaytirishni so'raganmi.
 * @returns {boolean}
 */
function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    return false;
  }
}

/**
 * Karusel yasaydi.
 *
 * Banner bo'lmasa `null` qaytadi — chaqiruvchi hech narsa qo'shmaydi
 * va ekranda bo'sh joy qolmaydi.
 *
 * @param {object[]} banners
 * @returns {?{node: HTMLElement, destroy: Function}}
 */
export function createBanner(banners) {
  const list = (banners || []).filter((b) => b && pick(b.image));
  if (!list.length) return null;

  const reduce = reducedMotion();
  const single = list.length === 1;

  const track = el('div.banner__track');
  const root = el('div.banner', {
    attrs: {
      role: 'region',
      'aria-label': t('banner.label'),
      'aria-roledescription': 'carousel'
    }
  }, [track]);
  if (reduce) root.classList.add('banner--still');

  /** @type {HTMLElement[]} */
  const slides = [];
  /** @type {HTMLImageElement[]} */
  const images = [];

  list.forEach((banner, i) => {
    const img = el('img.banner__img', {
      attrs: {
        alt: pick(banner.alt) || t('banner.label'),
        loading: 'lazy',
        decoding: 'async',
        // Manba KEYIN qo'yiladi: faqat joriy va keyingisi yuklanadi
        'aria-hidden': i === 0 ? null : 'true'
      }
    });
    images.push(img);

    const slide = el('div.banner__slide', {
      attrs: {
        role: 'group',
        'aria-roledescription': 'slide',
        'aria-label': `${i + 1} / ${list.length}`
      }
    }, [img]);
    slides.push(slide);
    track.append(slide);
  });

  /* ------------------------------------------------------------ nuqtalar */

  const dots = el('div.banner__dots', { attrs: { role: 'tablist' } });
  const dotEls = list.map((_, i) => {
    const dot = el('button.banner__dot', {
      attrs: {
        type: 'button',
        role: 'tab',
        'aria-label': t('banner.goTo', { n: i + 1 }),
        'aria-selected': i === 0 ? 'true' : 'false'
      },
      on: {
        click: (e) => {
          e.stopPropagation();
          go(i);
          hold();
        }
      }
    });
    dots.append(dot);
    return dot;
  });
  if (!single) root.append(dots);

  /* --------------------------------------------------------------- holat */

  let index = 0;
  let timer = null;
  let holdTimer = null;

  /**
   * Rasm manbasini kerak bo'lgandagina qo'yadi.
   *
   * Talab: "faqat joriy va keyingisi yuklansin". Shuning uchun `src`
   * boshidan yozilmaydi — `loading="lazy"` yetarli emas, chunki
   * yo'lakdagi barcha slaydlar texnik jihatdan ko'rinish maydonida
   * hisoblanishi mumkin.
   *
   * @param {number} i
   */
  function preload(i) {
    const img = images[i];
    const src = pick(list[i].image);
    if (img && src && !img.getAttribute('src')) img.setAttribute('src', src);
  }

  /**
   * Slaydga o'tadi.
   * @param {number} next
   */
  function go(next) {
    index = (next + list.length) % list.length;

    preload(index);
    preload((index + 1) % list.length);

    track.style.transform = `translate3d(${-index * 100}%, 0, 0)`;

    dotEls.forEach((dot, i) => {
      dot.classList.toggle('is-on', i === index);
      dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
    slides.forEach((slide, i) => {
      slide.setAttribute('aria-hidden', i === index ? 'false' : 'true');
    });
  }

  /** Avto-almashishni boshlaydi (shartlar bajarilsa). */
  function play() {
    stop();
    // Bitta banner, kamaytirilgan animatsiya yoki fon tab — taymer yo'q
    if (single || reduce || document.visibilityState !== 'visible') return;
    timer = setInterval(() => go(index + 1), INTERVAL);
  }

  /** Taymerni to'xtatadi. */
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  /** Foydalanuvchi aralashdi — avto-almashish vaqtincha to'xtaydi. */
  function hold() {
    stop();
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
      holdTimer = null;
      play();
    }, PAUSE_AFTER_TOUCH);
  }

  /* --------------------------------------------------------------- swipe */

  let startX = 0;
  let startY = 0;
  let dragging = false;
  let moved = 0;

  /**
   * Surish boshlandi.
   * @param {TouchEvent} e
   */
  function onStart(e) {
    if (single) return;
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    moved = 0;
    dragging = true;
    stop();
    track.classList.add('is-dragging');
  }

  /**
   * Barmoq harakati — yo'lak 1:1 ergashadi.
   * @param {TouchEvent} e
   */
  function onMove(e) {
    if (!dragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    // Vertikal harakat — bu sahifani aylantirish, biz aralashmaymiz
    if (Math.abs(dy) > Math.abs(dx)) {
      dragging = false;
      track.classList.remove('is-dragging');
      return;
    }

    moved = dx;
    const width = root.offsetWidth || 1;
    const shift = (dx / width) * 100;
    track.style.transform = `translate3d(${-index * 100 + shift}%, 0, 0)`;
  }

  /** Surish tugadi. */
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('is-dragging');

    if (Math.abs(moved) > SWIPE_THRESHOLD) go(moved < 0 ? index + 1 : index - 1);
    else go(index);

    hold();
    moved = 0;
  }

  root.addEventListener('touchstart', onStart, { passive: true });
  root.addEventListener('touchmove', onMove, { passive: true });
  root.addEventListener('touchend', onEnd);
  root.addEventListener('touchcancel', onEnd);

  /* ---------------------------------------------------------------- bosish */

  root.addEventListener('click', () => {
    // Surish edi, bosish emas
    if (Math.abs(moved) > 6) return;
    const link = String(list[index].link || '').trim();
    if (!link) return;

    if (link.startsWith('#/')) navigate(link.slice(1));
    else if (link.startsWith('/')) navigate(link);
    else window.open(link, '_blank', 'noopener,noreferrer');
  });

  /* ------------------------------------------------------------ ko'rinish */

  /** Fon tabda taymer ishlamasin — batareya va ortiqcha ish. */
  function onVisibility() {
    if (document.visibilityState === 'visible') play();
    else stop();
  }
  document.addEventListener('visibilitychange', onVisibility);

  go(0);
  play();

  return {
    node: root,
    /** Sahifadan chiqilganda — taymer ham, hodisalar ham qolmasin. */
    destroy() {
      stop();
      if (holdTimer) clearTimeout(holdTimer);
      holdTimer = null;
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}
