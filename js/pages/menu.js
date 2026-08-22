/**
 * Menyu sahifasi.
 *
 * - `menu/current` bitta hujjat sifatida `db.getMenu()` orqali olinadi
 *   (localStorage keshi bilan — tafsilot `js/db.js` da);
 * - sticky kategoriya chiplari + scroll-spy;
 * - qidiruv nom va tavsif bo'yicha, 300 ms debounce;
 * - stop-listdagi mahsulot kulrang va bosilmaydi;
 * - kartochka bosilsa mahsulot bottom-sheet ochiladi (`product.js`).
 */

import { getMenu, getStopList } from '../db.js';
import { t, pick } from '../i18n.js';
import { el, skeleton, emptyState, toast } from '../ui.js';
import { formatPrice, debounce, throttle, normalize } from '../utils.js';
import { getState } from '../state.js';
import { APP } from '../config.js';

/** Sahifa yopilganda tozalanadigan ishlar. */
let cleanup = [];
/** Qidiruv debounce'ini bekor qilish uchun. */
let searchDebounced = null;

/**
 * Mahsulotning eng arzon variant narxi ("dan" narxi).
 * @param {object} product
 * @returns {number}
 */
function minPrice(product) {
  return product.variants.reduce(
    (min, v) => (v.price < min ? v.price : min),
    product.variants[0] ? product.variants[0].price : 0
  );
}

/**
 * Mahsulot yoki uning barcha variantlari stop-listdami.
 * @param {object} product
 * @param {Set<string>} stop
 * @returns {boolean}
 */
function isStopped(product, stop) {
  if (product.active === false) return true;
  if (stop.has(product.id)) return true;
  return product.variants.length > 0 && product.variants.every((v) => stop.has(v.id));
}

/**
 * Rasm yuklanmasa o'rniga kategoriya emojisi ko'rsatiladi
 * (rasmlar hali `images/` papkasiga qo'yilmagan).
 * @param {?string} src
 * @param {string} fallbackIcon
 * @param {string} alt
 * @returns {HTMLElement}
 */
function productImage(src, fallbackIcon, alt) {
  const wrap = el('div.prod-card__media');
  const placeholder = () => {
    wrap.replaceChildren(el('span.prod-card__ph', {
      text: fallbackIcon,
      attrs: { 'aria-hidden': 'true' }
    }));
  };
  if (!src) {
    placeholder();
    return wrap;
  }
  wrap.append(el('img.prod-card__img', {
    attrs: { src, alt, loading: 'lazy', decoding: 'async' },
    on: { error: placeholder }
  }));
  return wrap;
}

/**
 * Mahsulot kartochkasi.
 * @param {object} product
 * @param {{icon: string, stopped: boolean, onOpen: Function}} cfg
 * @returns {HTMLElement}
 */
function productCard(product, cfg) {
  const card = el(`article.card.prod-card${cfg.stopped ? '.is-disabled' : ''}`, {
    attrs: {
      tabindex: cfg.stopped ? '-1' : '0',
      role: 'button',
      'aria-disabled': cfg.stopped ? 'true' : null
    },
    dataset: { id: product.id }
  });

  card.append(productImage(product.images && product.images[0], cfg.icon, pick(product.name)));

  const badges = el('div.prod-card__badges');
  (product.badges || []).forEach((badge) => {
    badges.append(el(`span.badge.badge--${badge}`, { text: t(`badge.${badge}`) }));
  });

  card.append(el('div.card__body', {}, [
    badges.children.length ? badges : null,
    el('h3.card__title', { text: pick(product.name) }),
    el('p.card__desc', { text: pick(product.description) }),
    el('div.card__foot', {}, [
      el('div.prod-card__price', {}, [
        el('span.prod-card__from', { text: t('common.from') }),
        el('span.price', { text: formatPrice(minPrice(product)) })
      ]),
      cfg.stopped
        ? el('span.hint', { text: t('menu.stopList') })
        : el('button.btn.btn--primary.prod-card__btn', {
          text: '+',
          attrs: { type: 'button', 'aria-label': t('menu.addToCart') }
        })
    ])
  ]));

  if (!cfg.stopped) {
    const open = () => cfg.onOpen(product);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  }
  return card;
}

/**
 * Sahifani chizadi.
 *
 * Muhim: karkas DARHOL qaytariladi, ma'lumot fon rejimida yuklanadi.
 * Aks holda router `render()` ni kutib turadi va skeleton ko'rinmaydi —
 * foydalanuvchi bo'sh ekranga qaraydi.
 *
 * @returns {HTMLElement}
 */
export function render() {
  destroy(); // oldingi chizishdan qolgan obunalar bo'lmasin

  const root = el('div.page.menu');
  const search = el('div.search.menu-search', {}, [
    el('span.search__icon', { text: '⌕', attrs: { 'aria-hidden': 'true' } }),
    el('input.input', {
      attrs: {
        type: 'search',
        inputmode: 'search',
        placeholder: t('menu.searchPlaceholder'),
        'aria-label': t('common.search')
      }
    })
  ]);
  const chipBar = el('div.chips.cat-bar', { attrs: { role: 'tablist' } });
  const stickyBar = el('div.sticky-bar.menu-bar', {}, [search, chipBar]);
  const body = el('div.menu-body');
  root.append(stickyBar, body);

  // Yuklanayotgan paytda skeleton (spinner emas)
  body.append(el('div.grid', {}, [skeleton('product', 6)]));

  load();
  return root;

  /** Menyuni yuklaydi; xato bo'lsa o'zi ekranda ko'rsatadi. */
  async function load() {
    try {
      const branchId = getState().branchId;
      // Ikkalasi ham keshdan darhol keladi; stop-list fonda yangilansa
      // ro'yxat o'zi qayta chiziladi (tarmoq kutilmaydi).
      let current = null;
      const [menu, stopList] = await Promise.all([
        getMenu(),
        getStopList(branchId, (fresh) => {
          if (current) fill(current, fresh);
        })
      ]);
      current = menu;
      fill(menu, stopList);
    } catch (e) {
      console.error('Menyu yuklanmadi:', e);
      body.replaceChildren(emptyState({
        icon: '⚠️',
        title: t('menu.loadError'),
        hint: e.message,
        action: el('button.btn.btn--primary', {
          text: t('app.retry'),
          attrs: { type: 'button' },
          on: { click: () => window.location.reload() }
        })
      }));
    }
  }

  /**
   * Yuklangan menyuni chizadi: bo'limlar, chiplar, scroll-spy, qidiruv.
   * @param {object} menu
   * @param {string[]} stopList
   */
  function fill(menu, stopList) {
    const stop = new Set(stopList);
    const categories = [...(menu.categories || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const products = [...(menu.products || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const iconOf = Object.fromEntries(categories.map((c) => [c.id, c.icon || '🍽']));

    /** Mahsulot oynasi — moduli faqat kerak bo'lganda yuklanadi. */
    const openProduct = async (product) => {
      try {
        const mod = await import('./product.js');
        mod.openProduct(product, { stopList: stop, icon: iconOf[product.categoryId] });
      } catch (e) {
        console.error('Mahsulot oynasi ochilmadi:', e);
        toast(t('app.error'), { type: 'error' });
      }
    };

    /** Sticky panel ostidagi "ko'rinish chegarasi" (px). */
    const barOffset = () => stickyBar.getBoundingClientRect().height + 56 + 8;
    /** Chip bosilganda scroll-spy shu vaqtgacha jim turadi. */
    let spyLockUntil = 0;

    /** Chipni faollashtiradi va ko'rinadigan joyga suradi. */
    const setActiveChip = (catId) => {
      [...chipBar.children].forEach((chip) => {
        const active = chip.dataset.cat === catId;
        chip.classList.toggle('is-active', active);
        if (active) chip.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      });
    };

    // --- kategoriya bo'limlari
    body.replaceChildren();
    const sections = [];
    categories.forEach((cat) => {
      const inCat = products.filter((p) => p.categoryId === cat.id);
      if (!inCat.length) return;

      const grid = el('div.grid');
      inCat.forEach((product) => {
        grid.append(productCard(product, {
          icon: iconOf[cat.id],
          stopped: isStopped(product, stop),
          onOpen: openProduct
        }));
      });

      const section = el('section.menu-section', {
        attrs: { id: `cat-${cat.id}` },
        dataset: { cat: cat.id }
      }, [
        el('h2.section-title', { text: `${cat.icon || ''} ${pick(cat.name)}`.trim() }),
        grid
      ]);
      body.append(section);
      sections.push({ id: cat.id, node: section });

      chipBar.append(el('button.chip', {
        text: pick(cat.name),
        attrs: { type: 'button', role: 'tab' },
        dataset: { cat: cat.id },
        on: {
          click: () => {
            // Oxirgi bo'lim ekranni to'ldirmasligi mumkin — scroll u yerga
            // yetib bormaydi. Shuning uchun chip darhol faollashtiriladi va
            // silliq scroll tugagunicha scroll-spy jim turadi.
            setActiveChip(cat.id);
            spyLockUntil = Date.now() + 800;
            const top = section.getBoundingClientRect().top + window.scrollY - barOffset();
            window.scrollTo({ top, behavior: 'smooth' });
          }
        }
      }));
    });

    if (!sections.length) {
      body.replaceChildren(emptyState({ icon: '🍕', title: t('menu.nothingFound') }));
      return;
    }
    setActiveChip(sections[0].id);

    // --- scroll-spy
    const onScroll = throttle(() => {
      if (root.classList.contains('is-searching')) return;
      if (Date.now() < spyLockUntil) return;

      const line = barOffset() + 4;
      let current = sections[0].id;
      sections.forEach((s) => {
        if (s.node.getBoundingClientRect().top <= line) current = s.id;
      });
      // Sahifa oxiriga yetganda oxirgi bo'lim faol hisoblanadi
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 8;
      if (atBottom) current = sections[sections.length - 1].id;
      setActiveChip(current);
    }, 120);
    window.addEventListener('scroll', onScroll, { passive: true });
    cleanup.push(() => window.removeEventListener('scroll', onScroll));

    // --- qidiruv
    const results = el('div.menu-results');
    const input = search.querySelector('input');
    const clearBtn = el('button.icon-btn.search__clear', {
      html: '&times;',
      attrs: { type: 'button', 'aria-label': t('menu.clear'), hidden: 'hidden' },
      on: {
        click: () => {
          input.value = '';
          applySearch('');
          input.focus();
        }
      }
    });
    search.append(clearBtn);

    /**
     * Qidiruv natijasini chizadi. Bo'sh so'rovda bo'limlar qaytadi.
     * @param {string} query
     */
    function applySearch(query) {
      const q = normalize(query);
      clearBtn.hidden = !q;
      if (!q) {
        root.classList.remove('is-searching');
        results.remove();
        chipBar.hidden = false;
        sections.forEach((s) => { s.node.hidden = false; });
        onScroll();
        return;
      }

      root.classList.add('is-searching');
      chipBar.hidden = true;
      sections.forEach((s) => { s.node.hidden = true; });

      // Nom va tavsif bo'yicha (SPEC: "nom va tarkib bo'yicha").
      // Boshqa tillardagi nom ham qidiriladi — "pizza" deb yozgan
      // foydalanuvchi o'zbekcha menyuda ham topsin.
      const found = products.filter((p) => {
        const haystack = normalize([
          pick(p.name), pick(p.description),
          p.name.uz, p.name.ru, p.name.en
        ].filter(Boolean).join(' '));
        return haystack.includes(q);
      });

      results.replaceChildren();
      if (!found.length) {
        results.append(emptyState({ icon: '🔍', title: t('menu.nothingFound'), hint: query }));
      } else {
        const grid = el('div.grid');
        found.forEach((product) => {
          grid.append(productCard(product, {
            icon: iconOf[product.categoryId],
            stopped: isStopped(product, stop),
            onOpen: openProduct
          }));
        });
        results.append(
          el('h2.section-title', { text: `${t('menu.results')} · ${found.length}` }),
          grid
        );
      }
      if (!results.isConnected) body.append(results);
    }

    searchDebounced = debounce((value) => applySearch(value), APP.searchDebounce);
    input.addEventListener('input', (e) => searchDebounced(e.target.value));
    cleanup.push(() => searchDebounced && searchDebounced.cancel());
  }
}

/** Sahifa yopilganda obunalarni to'xtatadi. */
export function destroy() {
  cleanup.forEach((fn) => fn());
  cleanup = [];
  searchDebounced = null;
}
