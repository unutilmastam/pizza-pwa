/**
 * Manzil sahifasi — Yandex Maps JS API 2.1.
 *
 * - xarita skripti FAQAT shu sahifa ochilganda yuklanadi (dangasa);
 * - markerni surish yoki xaritani bosish → reverse geocode;
 * - qidiruv maydonida `SuggestView` (autocomplete);
 * - `pointInPolygon` bilan yetkazish zonasi tekshiriladi, zonadan
 *   yetkazish narxi va minimal summa olinadi;
 * - saqlangan manzillar CRUD.
 *
 * Xarita yuklanmasa (kalit ishlamasa, tarmoq yo'q, skript bloklangan)
 * ilova buzilmaydi: ogohlantirish va oddiy qo'lda kiritish formasi chiqadi.
 */

import { t } from '../i18n.js';
import { el, toast, confirm as confirmDialog, loader } from '../ui.js';
import { debounce, pointInPolygon, formatPrice, uid } from '../utils.js';
import {
  YANDEX_MAPS_KEY, YANDEX_MAPS_VERSION, YANDEX_MAPS_LANG, DEFAULT_CENTER, APP
} from '../config.js';
import { getBranches, getAddresses, addAddress, updateAddress, deleteAddress } from '../db.js';
import {
  getState, setAddress, saveAddress, removeAddress, setAddresses
} from '../state.js';
import { getLang } from '../i18n.js';
import { back } from '../router.js';

/** Xarita skripti necha ms kutiladi. */
const MAP_TIMEOUT = 12000;

/** @type {?Promise<object>} skript bir marta yuklanadi va keshlanadi */
let ymapsPromise = null;
/** @type {?object} joriy xarita namunasi — sahifa yopilganda o'chiriladi */
let mapInstance = null;
/** Sahifa yopilganda tozalanadigan ishlar. */
let cleanup = [];

/**
 * Yandex Maps skriptini dangasa yuklaydi.
 *
 * Skript `<head>` ga faqat shu funksiya chaqirilganda qo'shiladi, ya'ni
 * boshqa sahifalarda xarita umuman so'ralmaydi.
 *
 * @returns {Promise<object>} `ymaps` global obyekti
 */
export function loadYmaps() {
  if (ymapsPromise) return ymapsPromise;

  ymapsPromise = new Promise((resolve, reject) => {
    if (window.ymaps && window.ymaps.ready) {
      window.ymaps.ready(() => resolve(window.ymaps));
      return;
    }

    const lang = YANDEX_MAPS_LANG[getLang()] || 'ru_RU';
    const script = document.createElement('script');
    script.src = `https://api-maps.yandex.ru/${YANDEX_MAPS_VERSION}/` +
      `?apikey=${encodeURIComponent(YANDEX_MAPS_KEY)}&lang=${lang}`;
    script.async = true;

    const timer = setTimeout(() => {
      fail(new Error('Xarita skripti vaqtida yuklanmadi'));
    }, MAP_TIMEOUT);

    /**
     * Xatoni qaytaradi va keshni tozalaydi — keyingi urinish yangidan boshlansin.
     * @param {Error} error
     */
    function fail(error) {
      clearTimeout(timer);
      ymapsPromise = null;
      script.remove();
      reject(error);
    }

    script.onload = () => {
      if (!window.ymaps || !window.ymaps.ready) {
        fail(new Error('ymaps topilmadi'));
        return;
      }
      // `ready` kalit noto'g'ri bo'lsa ham chaqirilishi mumkin —
      // xarita yaratishda xato chiqadi va u yerda ushlanadi.
      window.ymaps.ready(() => {
        clearTimeout(timer);
        resolve(window.ymaps);
      });
    };
    script.onerror = () => fail(new Error('Xarita skripti yuklanmadi'));

    document.head.append(script);
  });

  return ymapsPromise;
}

/**
 * Nuqta qaysi filial zonasiga tushishini topadi.
 * @param {[number, number]} point - [lat, lng]
 * @param {object[]} branches
 * @returns {?{branchId: string, name: string, deliveryPrice: number, minOrder: number}}
 */
export function findZone(point, branches) {
  for (const branch of branches || []) {
    for (const zone of branch.zones || []) {
      if (pointInPolygon(point, zone.polygon || [])) {
        return {
          branchId: branch.id,
          name: zone.name || branch.name || '',
          deliveryPrice: Number(zone.deliveryPrice ?? APP.delivery.price),
          minOrder: Number(zone.minOrder ?? APP.delivery.minOrder)
        };
      }
    }
  }
  return null;
}

/**
 * Manzilni bir qatorga yig'adi.
 * @param {object} address
 * @returns {string}
 */
function addressLine(address) {
  const extra = [
    address.apartment && `${t('address.apartment')} ${address.apartment}`,
    address.entrance && `${t('address.entrance')} ${address.entrance}`,
    address.floor && `${t('address.floor')} ${address.floor}`
  ].filter(Boolean).join(', ');
  return extra ? `${address.address}, ${extra}` : address.address || '';
}

/**
 * Tafsilot maydonlari (kvartira, podyezd, qavat, domofon, mo'ljal, nom).
 * @param {object} values
 * @returns {{node: HTMLElement, read: () => object}}
 */
function detailsForm(values) {
  const make = (key, label, opts = {}) => el('label.field', {}, [
    el('span.field__label', { text: label }),
    el('input.input', {
      attrs: {
        type: 'text',
        inputmode: opts.numeric ? 'numeric' : null,
        placeholder: opts.placeholder || '',
        value: values[key] || ''
      },
      dataset: { key }
    })
  ]);

  const node = el('div.form', {}, [
    el('div.form__row', {}, [
      make('apartment', t('address.apartment'), { numeric: true }),
      make('entrance', t('address.entrance'), { numeric: true })
    ]),
    el('div.form__row', {}, [
      make('floor', t('address.floor'), { numeric: true }),
      make('intercom', t('address.intercom'))
    ]),
    make('comment', t('address.landmark')),
    make('label', t('address.label'), { placeholder: 'Uy' })
  ]);

  return {
    node,
    read() {
      const out = {};
      node.querySelectorAll('input').forEach((input) => {
        out[input.dataset.key] = input.value.trim();
      });
      return out;
    }
  };
}

/**
 * Sahifani chizadi. Karkas darhol qaytadi, xarita fonda yuklanadi.
 * @returns {HTMLElement}
 */
export function render() {
  destroy();

  const state = getState();
  const current = state.address;

  const root = el('div.page.address');
  const head = el('div.page__head', {}, [
    el('button.icon-btn', {
      text: '‹',
      attrs: { type: 'button', 'aria-label': t('common.back') },
      on: { click: () => back() }
    }),
    el('h1.page__title', { text: t('address.title') })
  ]);

  const searchInput = el('input.input', {
    attrs: {
      type: 'text',
      placeholder: t('address.searchPlaceholder'),
      'aria-label': t('address.searchPlaceholder'),
      value: current ? current.address || '' : ''
    }
  });
  const searchBox = el('div.search.addr-search', {}, [searchInput]);

  const mapBox = el('div.map', { attrs: { 'aria-label': t('address.title') } }, [
    el('div.map__loading', { text: t('app.loading') })
  ]);

  const zoneBox = el('div.zone-info');
  const details = detailsForm(current || {});
  const savedBox = el('section.saved-addr');

  const confirmBtn = el('button.btn.btn--primary.btn--lg.btn--block', {
    text: t('address.confirm'),
    attrs: { type: 'button' }
  });
  const cta = el('div.cart-cta', {}, [confirmBtn]);

  root.append(head, searchBox, mapBox, zoneBox, details.node, savedBox, cta);

  /** Tanlangan nuqta va aniqlangan ma'lumot. */
  const picked = {
    lat: current && current.lat ? current.lat : null,
    lng: current && current.lng ? current.lng : null,
    address: current ? current.address || '' : '',
    zone: current ? current.zone || null : null,
    id: current ? current.id : null
  };

  /** @type {object[]} yetkazish zonalari uchun filiallar */
  let branches = [];

  /**
   * Zona holatini ekranda ko'rsatadi va tugmani boshqaradi.
   */
  function renderZone() {
    zoneBox.replaceChildren();
    if (!picked.lat || !branches.length) {
      // Filiallar/zonalar hali yo'q — zaxira qiymatlar bilan davom etamiz
      confirmBtn.disabled = !picked.address;
      return;
    }
    if (!picked.zone) {
      zoneBox.append(el('div.zone-info__box.zone-info__box--bad', {}, [
        el('p', { text: t('address.outOfZone') })
      ]));
      confirmBtn.disabled = true;
      return;
    }
    zoneBox.append(el('div.zone-info__box', {}, [
      el('p.zone-info__name', { text: `${t('address.zone')}: ${picked.zone.name}` }),
      el('p.hint', {
        text: `${t('cart.delivery')}: ${formatPrice(picked.zone.deliveryPrice)} · ` +
          `${t('cart.minOrder')}: ${formatPrice(picked.zone.minOrder)}`
      })
    ]));
    confirmBtn.disabled = !picked.address;
  }

  /**
   * Nuqta o'zgarganda: zona tekshiruvi va ekranni yangilash.
   * @param {number} lat
   * @param {number} lng
   * @param {string} [address]
   */
  function setPoint(lat, lng, address) {
    picked.lat = lat;
    picked.lng = lng;
    if (address !== undefined) {
      picked.address = address;
      searchInput.value = address;
    }
    picked.zone = findZone([lat, lng], branches);
    renderZone();
  }

  /** Saqlangan manzillar ro'yxati. */
  function renderSaved() {
    const list = getState().addresses;
    savedBox.replaceChildren(el('h2.section-title', { text: t('address.saveTitle') }));
    if (!list.length) {
      savedBox.append(el('p.hint', { text: t('address.empty') }));
      return;
    }
    const rows = el('div.opt-list');
    list.forEach((item) => {
      rows.append(el('div.opt-row.saved-row', {}, [
        el('button.saved-row__pick', {
          attrs: { type: 'button' },
          on: { click: () => pickSaved(item) }
        }, [
          el('strong', { text: item.label || t('address.title') }),
          el('span.hint.block', { text: addressLine(item) })
        ]),
        el('button.icon-btn', {
          html: '&times;',
          attrs: { type: 'button', 'aria-label': t('common.delete') },
          on: { click: () => askDelete(item) }
        })
      ]));
    });
    savedBox.append(rows);
  }

  /**
   * Saqlangan manzilni tanlaydi.
   * @param {object} item
   */
  function pickSaved(item) {
    picked.id = item.id;
    setPoint(item.lat || null, item.lng || null, item.address || '');
    details.node.querySelectorAll('input').forEach((input) => {
      input.value = item[input.dataset.key] || '';
    });
    if (item.lat && item.lng && mapInstance) {
      mapInstance.setCenter([item.lat, item.lng], 17);
      if (mapInstance.__pin) mapInstance.__pin.geometry.setCoordinates([item.lat, item.lng]);
    }
    renderZone();
  }

  /**
   * O'chirishni tasdiqlaydi.
   * @param {object} item
   */
  async function askDelete(item) {
    const yes = await confirmDialog({
      title: t('common.delete'),
      text: addressLine(item),
      okText: t('common.delete'),
      danger: true
    });
    if (!yes) return;

    const user = getState().user;
    try {
      if (user) await deleteAddress(user.uid, item.id);
    } catch (e) {
      console.error('Manzil o\'chirilmadi:', e);
      toast(t('app.error'), { type: 'error' });
      return;
    }
    removeAddress(item.id);
    renderSaved();
    toast(t('address.deleted'));
  }

  // --- saqlangan manzillarni yuklash
  (async () => {
    const user = getState().user;
    if (user) {
      try {
        setAddresses(await getAddresses(user.uid));
      } catch (e) {
        console.warn('Saqlangan manzillar yuklanmadi:', e);
      }
    }
    renderSaved();
  })();

  // --- zonalar uchun filiallar
  (async () => {
    try {
      branches = await getBranches();
    } catch (e) {
      // Zonalarsiz ham manzil kiritish mumkin — zaxira narx ishlatiladi
      console.warn('Filiallar yuklanmadi, zona tekshiruvisiz davom etamiz:', e);
      branches = [];
    }
    if (picked.lat) setPoint(picked.lat, picked.lng);
    else renderZone();
  })();

  // --- xarita (dangasa)
  initMap({ mapBox, searchInput, picked, setPoint, root });

  // --- saqlash
  confirmBtn.addEventListener('click', async () => {
    if (!picked.address) {
      toast(t('checkout.addressRequired'), { type: 'error' });
      return;
    }
    const address = {
      ...details.read(),
      id: picked.id || uid(),
      address: picked.address,
      lat: picked.lat,
      lng: picked.lng,
      zone: picked.zone
    };
    if (!address.label) address.label = t('address.title');

    const user = getState().user;
    if (user) {
      loader.show();
      try {
        const { id, ...payload } = address;
        if (getState().addresses.some((a) => a.id === id)) {
          await updateAddress(user.uid, id, payload);
        } else {
          address.id = await addAddress(user.uid, payload);
        }
      } catch (e) {
        console.error('Manzil saqlanmadi:', e);
        toast(t('app.error'), { type: 'error' });
        return;
      } finally {
        loader.hide();
      }
    }

    saveAddress(address);
    setAddress(address);
    toast(t('address.saved'), { type: 'success' });
    back();
  });

  return root;
}

/**
 * Xaritani yuklaydi va ishga tushiradi. Xato bo'lsa qo'lda kiritish rejimi.
 * @param {{mapBox: HTMLElement, searchInput: HTMLElement, picked: object,
 *          setPoint: Function, root: HTMLElement}} ctx
 */
async function initMap(ctx) {
  const { mapBox, searchInput, picked, setPoint } = ctx;

  let ymaps;
  try {
    ymaps = await loadYmaps();
  } catch (e) {
    console.warn('Xarita yuklanmadi:', e);
    showManualMode(ctx, e);
    return;
  }

  try {
    const center = picked.lat ? [picked.lat, picked.lng] : DEFAULT_CENTER;
    mapBox.replaceChildren();

    const map = new ymaps.Map(mapBox, {
      center,
      zoom: picked.lat ? 17 : 12,
      controls: ['zoomControl', 'geolocationControl']
    }, { suppressMapOpenBlock: true });
    mapInstance = map;

    const pin = new ymaps.Placemark(center, {}, {
      draggable: true,
      preset: 'islands#redDotIcon'
    });
    map.geoObjects.add(pin);
    map.__pin = pin;

    /**
     * Nuqtani teskari geokodlaydi (koordinata → matn).
     * @param {[number, number]} coords
     */
    const reverse = debounce(async (coords) => {
      try {
        const res = await ymaps.geocode(coords, { results: 1 });
        const first = res.geoObjects.get(0);
        setPoint(coords[0], coords[1], first ? first.getAddressLine() : t('address.notFound'));
      } catch (e) {
        console.warn('Reverse geocode xatosi:', e);
        setPoint(coords[0], coords[1], t('address.notFound'));
      }
    }, 400);

    pin.events.add('dragend', () => {
      const coords = pin.geometry.getCoordinates();
      setPoint(coords[0], coords[1]);
      reverse(coords);
    });

    map.events.add('click', (e) => {
      const coords = e.get('coords');
      pin.geometry.setCoordinates(coords);
      setPoint(coords[0], coords[1]);
      reverse(coords);
    });

    // Autocomplete
    try {
      const suggest = new ymaps.SuggestView(searchInput, { results: 5 });
      suggest.events.add('select', async (e) => {
        const value = e.get('item').value;
        try {
          const res = await ymaps.geocode(value, { results: 1 });
          const first = res.geoObjects.get(0);
          if (!first) return;
          const coords = first.geometry.getCoordinates();
          map.setCenter(coords, 17);
          pin.geometry.setCoordinates(coords);
          setPoint(coords[0], coords[1], first.getAddressLine());
        } catch (err) {
          console.warn('Geokodlash xatosi:', err);
        }
      });
      cleanup.push(() => suggest.destroy && suggest.destroy());
    } catch (e) {
      // Autocomplete bo'lmasa ham xarita ishlayveradi
      console.warn('SuggestView ishga tushmadi:', e);
    }

    // Ochilishda manzil matni bo'lmasa — aniqlab beramiz
    if (!picked.address) reverse(center);

    cleanup.push(() => reverse.cancel());
  } catch (e) {
    console.warn('Xarita yaratilmadi:', e);
    showManualMode(ctx, e);
  }
}

/**
 * Xaritasiz rejim: ogohlantirish va oddiy manzil formasi.
 * @param {{mapBox: HTMLElement, searchInput: HTMLElement, picked: object,
 *          setPoint: Function}} ctx
 * @param {Error} error
 */
function showManualMode(ctx, error) {
  const { mapBox, searchInput, picked, setPoint } = ctx;

  mapBox.classList.add('map--failed');
  mapBox.replaceChildren(el('div.map__fallback', {}, [
    el('p.map__fallback-title', { text: t('address.mapError') }),
    el('p.hint', { text: error && error.message ? error.message : '' })
  ]));

  // Qidiruv maydoni endi oddiy matn maydoni sifatida ishlaydi
  searchInput.placeholder = t('checkout.street');
  searchInput.setAttribute('aria-label', t('checkout.street'));
  const onInput = () => {
    picked.address = searchInput.value.trim();
    // Koordinata yo'q — zona aniqlanmaydi, zaxira narx ishlatiladi
    setPoint(picked.lat, picked.lng, picked.address);
  };
  searchInput.addEventListener('input', onInput);
  cleanup.push(() => searchInput.removeEventListener('input', onInput));
  onInput();
}

/** Sahifa yopilganda xaritani va obunalarni tozalaydi. */
export function destroy() {
  cleanup.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      /* tozalash xatosi sahifani buzmasin */
    }
  });
  cleanup = [];
  if (mapInstance) {
    try {
      mapInstance.destroy();
    } catch (e) {
      /* xarita allaqachon yo'q bo'lishi mumkin */
    }
    mapInstance = null;
  }
}
