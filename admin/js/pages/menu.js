/**
 * Menyu CRUD (SPEC 111).
 *
 * `menu/current` — BITTA hujjat, shuning uchun tahrirlash xotirada
 * bajariladi va "Chop etish" bosilganda bir marta yoziladi. Har bir
 * o'zgarish alohida yozilsa mijozlar yarim tayyor menyuni ko'rib qolardi.
 *
 * Rasm yuklash YO'Q: Firebase Storage bepul planda mavjud emas, shuning
 * uchun rasm manzillari qo'lda kiritiladi va fayllar GitHub Pages'dagi
 * `images/` papkasida yotadi.
 */

import { t, pick } from '../i18n.js';
import {
  el, toast, modal, confirm, skeleton, emptyState, field, selectField, checkbox
} from '../ui.js';
import { getMenu, publishMenu } from '../db.js';

/** Qisqa noyob ID. */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Saqlanmagan o'zgarish bormi — `beforeunload` shundan o'qiydi.
 * Modul darajasida turadi, shunda kuzatuvchi BIR MARTA ulanadi va har
 * chizishda yangisi qo'shilib ketmaydi.
 */
let dirty = false;

window.addEventListener('beforeunload', (e) => {
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = '';
});

/**
 * Ko'p tilli maydonni normallashtiradi.
 * @param {*} value
 * @returns {{uz: string, ru: string, en: string}}
 */
function multi(value) {
  if (!value) return { uz: '', ru: '', en: '' };
  if (typeof value === 'string') return { uz: value, ru: value, en: value };
  return { uz: value.uz || '', ru: value.ru || '', en: value.en || '' };
}

/**
 * Sahifani chizadi.
 * @returns {HTMLElement}
 */
export function render() {
  dirty = false;

  const root = el('div.menu-page');
  const body = el('div');
  body.append(skeleton('row', 4));

  /** @type {object} tahrirlanayotgan nusxa */
  let menu = { version: 0, categories: [], products: [] };

  const status = el('span.hint');
  const publishBtn = el('button.btn', {
    text: t('menu.publish'),
    attrs: { type: 'button', disabled: true },
    on: { click: () => publish() }
  });

  const toolbar = el('div.toolbar', {}, [
    el('button.btn.btn--ghost', {
      text: t('menu.addCategory'),
      attrs: { type: 'button' },
      on: { click: () => editCategory(null) }
    }),
    el('button.btn.btn--ghost', {
      text: t('menu.addProduct'),
      attrs: { type: 'button' },
      on: { click: () => editProduct(null) }
    }),
    el('span.toolbar__spacer'),
    status,
    publishBtn
  ]);

  root.append(toolbar, body);

  /** O'zgarish borligini belgilaydi. */
  function markDirty() {
    dirty = true;
    publishBtn.disabled = false;
    status.textContent = t('menu.unsaved');
  }

  /** Menyuni Firestore'ga yozadi. */
  async function publish() {
    publishBtn.disabled = true;
    publishBtn.textContent = t('app.loading');
    try {
      const version = await publishMenu(menu);
      menu.version = version;
      dirty = false;
      status.textContent = t('menu.version', { n: version });
      toast(t('menu.published', { n: version }), { type: 'success' });
    } catch (e) {
      console.error('[menu] chop etilmadi:', e);
      toast(e.message || t('app.error'), { type: 'error' });
      publishBtn.disabled = false;
    } finally {
      publishBtn.textContent = t('menu.publish');
    }
  }

  /* ------------------------------------------------------- kategoriya */

  /**
   * Kategoriya tahriri.
   * @param {?object} category - null bo'lsa yangi
   */
  function editCategory(category) {
    const draft = category
      ? { ...category, name: multi(category.name) }
      : { id: uid(), name: multi(''), icon: '🍕', order: menu.categories.length + 1 };

    const nameUz = field({ label: t('menu.nameUz'), value: draft.name.uz });
    const nameRu = field({ label: t('menu.nameRu'), value: draft.name.ru });
    const nameEn = field({ label: t('menu.nameEn'), value: draft.name.en });
    const icon = field({ label: t('menu.icon'), value: draft.icon });
    const order = field({ label: t('menu.order'), value: draft.order, type: 'number' });

    modal({
      title: category ? t('common.edit') : t('menu.newCategory'),
      content: el('div', {}, [
        nameUz.node, nameRu.node, nameEn.node,
        el('div.row', {}, [icon.node, order.node])
      ]),
      actions: [
        { label: t('common.cancel') },
        {
          label: t('common.save'),
          variant: 'primary',
          onClick: () => {
            const name = {
              uz: nameUz.input.value.trim(),
              ru: nameRu.input.value.trim(),
              en: nameEn.input.value.trim()
            };
            if (!name.uz) {
              toast(t('menu.nameUz'), { type: 'error' });
              return false;
            }
            const next = {
              id: draft.id,
              name,
              icon: icon.input.value.trim(),
              order: Number(order.input.value) || 0
            };
            const index = menu.categories.findIndex((c) => c.id === draft.id);
            if (index >= 0) menu.categories[index] = next;
            else menu.categories.push(next);
            markDirty();
            draw();
            return true;
          }
        }
      ]
    });
  }

  /**
   * Kategoriyani o'chiradi (ichidagi mahsulotlar bilan).
   * @param {object} category
   */
  async function removeCategory(category) {
    const yes = await confirm({
      title: pick(category.name),
      text: t('menu.deleteCategory'),
      danger: true
    });
    if (!yes) return;
    menu.categories = menu.categories.filter((c) => c.id !== category.id);
    menu.products = menu.products.filter((p) => p.categoryId !== category.id);
    markDirty();
    draw();
  }

  /* -------------------------------------------------------- mahsulot */

  /**
   * Mahsulot tahriri.
   * @param {?object} product - null bo'lsa yangi
   */
  function editProduct(product) {
    if (!menu.categories.length) {
      toast(t('menu.addCategory'), { type: 'error' });
      return;
    }

    const draft = product
      ? JSON.parse(JSON.stringify(product))
      : {
        id: uid(),
        categoryId: menu.categories[0].id,
        name: multi(''),
        description: multi(''),
        images: [],
        badges: [],
        variants: [{ id: uid(), size: '', dough: '', price: 0, weight: 0, kcal: 0 }],
        addons: [],
        removable: [],
        order: menu.products.length + 1,
        active: true
      };
    draft.name = multi(draft.name);
    draft.description = multi(draft.description);

    const nameUz = field({ label: t('menu.nameUz'), value: draft.name.uz });
    const nameRu = field({ label: t('menu.nameRu'), value: draft.name.ru });
    const descUz = field({ label: t('menu.descUz'), value: draft.description.uz, type: 'textarea' });
    const images = field({
      label: t('menu.images'),
      value: (draft.images || []).join(', '),
      placeholder: '../images/pizza.jpg'
    });
    const badges = field({ label: t('menu.badges'), value: (draft.badges || []).join(', ') });
    const order = field({ label: t('menu.order'), value: draft.order, type: 'number' });
    const category = selectField({
      label: t('menu.category'),
      value: draft.categoryId,
      options: menu.categories.map((c) => ({ value: c.id, label: pick(c.name) }))
    });
    const active = checkbox({ label: t('common.active'), checked: draft.active !== false });

    // Variantlar — kamida bittasi bo'lishi shart
    const variantsHost = el('div.list');
    /** Variantlar ro'yxatini chizadi. */
    function drawVariants() {
      variantsHost.replaceChildren();
      draft.variants.forEach((variant, index) => {
        const size = field({ label: t('menu.size'), value: variant.size || '' });
        const dough = field({ label: t('menu.dough'), value: variant.dough || '' });
        const price = field({ label: t('common.price'), value: variant.price || 0, type: 'number' });
        const weight = field({ label: t('menu.weight'), value: variant.weight || 0, type: 'number' });

        [size, dough, price, weight].forEach((f) => f.input.addEventListener('input', () => {
          variant.size = size.input.value.trim();
          variant.dough = dough.input.value.trim();
          variant.price = Number(price.input.value) || 0;
          variant.weight = Number(weight.input.value) || 0;
        }));

        variantsHost.append(el('div.list-row', {}, [
          el('div.list-row__main.row.row--tight', {}, [
            size.node, dough.node, price.node, weight.node
          ]),
          draft.variants.length > 1
            ? el('button.btn.btn--ghost.btn--sm', {
              text: '✕',
              attrs: { type: 'button', 'aria-label': t('common.delete') },
              on: {
                click: () => {
                  draft.variants.splice(index, 1);
                  drawVariants();
                }
              }
            })
            : null
        ]));
      });
    }
    drawVariants();

    // Qo'shimchalar
    const addonsHost = el('div.list');
    /** Qo'shimchalar ro'yxatini chizadi. */
    function drawAddons() {
      addonsHost.replaceChildren();
      (draft.addons || []).forEach((addon, index) => {
        addon.name = multi(addon.name);
        const name = field({ label: t('common.name'), value: addon.name.uz });
        const price = field({ label: t('common.price'), value: addon.price || 0, type: 'number' });

        [name, price].forEach((f) => f.input.addEventListener('input', () => {
          const text = name.input.value.trim();
          addon.name = { uz: text, ru: text, en: text };
          addon.price = Number(price.input.value) || 0;
        }));

        addonsHost.append(el('div.list-row', {}, [
          el('div.list-row__main.row.row--tight', {}, [name.node, price.node]),
          el('button.btn.btn--ghost.btn--sm', {
            text: '✕',
            attrs: { type: 'button', 'aria-label': t('common.delete') },
            on: {
              click: () => {
                draft.addons.splice(index, 1);
                drawAddons();
              }
            }
          })
        ]));
      });
    }
    drawAddons();

    modal({
      title: product ? pick(draft.name) : t('menu.newProduct'),
      content: el('div', {}, [
        nameUz.node, nameRu.node, descUz.node,
        el('div.row', {}, [category.node, order.node]),
        images.node,
        el('p.hint', { text: t('menu.imagesHint') }),
        badges.node,
        active.node,

        el('h3.section-title', { text: t('menu.variants') }),
        variantsHost,
        el('button.btn.btn--ghost.btn--sm', {
          text: t('menu.addVariant'),
          attrs: { type: 'button' },
          on: {
            click: () => {
              draft.variants.push({ id: uid(), size: '', dough: '', price: 0, weight: 0 });
              drawVariants();
            }
          }
        }),

        el('h3.section-title', { text: t('menu.addons') }),
        addonsHost,
        el('button.btn.btn--ghost.btn--sm', {
          text: t('menu.addAddon'),
          attrs: { type: 'button' },
          on: {
            click: () => {
              draft.addons = draft.addons || [];
              draft.addons.push({ id: uid(), name: multi(''), price: 0 });
              drawAddons();
            }
          }
        })
      ]),
      actions: [
        { label: t('common.cancel') },
        {
          label: t('common.save'),
          variant: 'primary',
          onClick: () => {
            const name = {
              uz: nameUz.input.value.trim(),
              ru: nameRu.input.value.trim(),
              en: nameRu.input.value.trim() || nameUz.input.value.trim()
            };
            if (!name.uz) {
              toast(t('menu.nameUz'), { type: 'error' });
              return false;
            }
            if (!draft.variants.length || draft.variants.every((v) => !v.price)) {
              toast(t('common.price'), { type: 'error' });
              return false;
            }

            const next = {
              ...draft,
              name,
              description: {
                uz: descUz.input.value.trim(),
                ru: descUz.input.value.trim(),
                en: descUz.input.value.trim()
              },
              categoryId: category.select.value,
              images: images.input.value.split(',').map((s) => s.trim()).filter(Boolean),
              badges: badges.input.value.split(',').map((s) => s.trim()).filter(Boolean),
              order: Number(order.input.value) || 0,
              active: active.input.checked
            };

            const index = menu.products.findIndex((p) => p.id === draft.id);
            if (index >= 0) menu.products[index] = next;
            else menu.products.push(next);
            markDirty();
            draw();
            return true;
          }
        }
      ]
    });
  }

  /**
   * Mahsulotni o'chiradi.
   * @param {object} product
   */
  async function removeProduct(product) {
    const yes = await confirm({
      title: pick(product.name),
      text: t('menu.deleteProduct'),
      danger: true
    });
    if (!yes) return;
    menu.products = menu.products.filter((p) => p.id !== product.id);
    markDirty();
    draw();
  }

  /* ---------------------------------------------------------- chizish */

  /** Kategoriyalar va mahsulotlarni chizadi. */
  function draw() {
    body.replaceChildren();

    if (!menu.categories.length && !menu.products.length) {
      body.append(emptyState({
        icon: '🍕',
        title: t('app.empty'),
        hint: t('menu.addCategory')
      }));
      return;
    }

    const sorted = [...menu.categories].sort((a, b) => (a.order || 0) - (b.order || 0));
    sorted.forEach((category) => {
      const products = menu.products
        .filter((p) => p.categoryId === category.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      body.append(el('div.toolbar', {}, [
        el('h2.section-title', { text: `${category.icon || ''} ${pick(category.name)}`.trim() }),
        el('span.toolbar__spacer'),
        el('button.btn.btn--ghost.btn--sm', {
          text: t('common.edit'),
          attrs: { type: 'button' },
          on: { click: () => editCategory(category) }
        }),
        el('button.btn.btn--ghost.btn--sm', {
          text: t('common.delete'),
          attrs: { type: 'button' },
          on: { click: () => removeCategory(category) }
        })
      ]));

      if (!products.length) {
        body.append(el('p.hint', { text: t('app.empty') }));
        return;
      }

      const list = el('div.list');
      products.forEach((product) => {
        const prices = (product.variants || []).map((v) => v.price).filter(Boolean);
        list.append(el('div.list-row', {}, [
          el('div.list-row__main', {}, [
            el('div.list-row__name', { text: pick(product.name) }),
            el('div.list-row__sub', {
              text: [
                prices.length ? `${Math.min(...prices)} – ${Math.max(...prices)}` : '—',
                `${(product.variants || []).length} ${t('menu.variants').toLowerCase()}`
              ].join(' · ')
            })
          ]),
          product.active === false
            ? el('span.badge.badge--warn', { text: t('common.inactive') })
            : null,
          el('div.list-row__actions', {}, [
            el('button.btn.btn--ghost.btn--sm', {
              text: t('common.edit'),
              attrs: { type: 'button' },
              on: { click: () => editProduct(product) }
            }),
            el('button.btn.btn--ghost.btn--sm', {
              text: '✕',
              attrs: { type: 'button', 'aria-label': t('common.delete') },
              on: { click: () => removeProduct(product) }
            })
          ])
        ]));
      });
      body.append(list);
    });
  }

  // Menyuni yuklaymiz — sahifa karkasi darhol qaytadi
  (async () => {
    try {
      const loaded = await getMenu();
      menu = {
        version: loaded.version || 0,
        categories: loaded.categories || [],
        products: loaded.products || []
      };
      status.textContent = t('menu.version', { n: menu.version });
      draw();
    } catch (e) {
      console.error('[menu] yuklanmadi:', e);
      body.replaceChildren(emptyState({
        icon: '⚠️',
        title: t('app.error'),
        hint: e.message
      }));
    }
  })();

  return root;
}

/** Sahifa yopilganda ogohlantirish bayrog'ini tushiradi. */
export function destroy() {
  dirty = false;
}
