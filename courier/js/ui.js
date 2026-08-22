/**
 * Kuryer ilovasi komponentlari: element yasash, toast, modal, skeleton.
 * Bu yerda biznes-mantiq yo'q — faqat DOM.
 *
 * Admin paneldagi `admin/js/ui.js` bilan bir xil shaklda — `el()`,
 * `toast()`, `modal()`, `confirm()` uchala ilovada bir xil ishlaydi.
 */

import { t } from './i18n.js';

/** Ochiq qatlamlar — Escape tugmasi uchun. */
const layers = [];

/**
 * Element yasashning qisqa yo'li.
 * @param {string} tag - 'div.card.card--pad' ko'rinishida sinflar bilan
 * @param {{text?: string, attrs?: object, on?: object}} [props]
 * @param {Array<?Node|string>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, children = []) {
  const [name, ...classes] = String(tag).split('.');
  const node = document.createElement(name || 'div');
  if (classes.length) node.className = classes.join(' ');

  if (props.text !== undefined) node.textContent = props.text;

  if (props.attrs) {
    Object.entries(props.attrs).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      node.setAttribute(key, value === true ? '' : String(value));
    });
  }
  if (props.on) {
    Object.entries(props.on).forEach(([event, fn]) => node.addEventListener(event, fn));
  }

  children.filter(Boolean).forEach((child) => {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  });
  return node;
}

/**
 * Qisqa xabar.
 * @param {string} text
 * @param {{type?: 'info'|'success'|'error', duration?: number}} [opts]
 */
export function toast(text, opts = {}) {
  const host = document.getElementById('toasts');
  if (!host) return;

  const node = el(`div.toast${opts.type ? `.toast--${opts.type}` : ''}`, { text });
  host.append(node);
  setTimeout(() => node.remove(), opts.duration || 3500);
}

/**
 * Modal oyna.
 * @param {{title?: string, content?: Node|string,
 *          actions?: Array<{label: string, variant?: string,
 *                           onClick?: Function, close?: boolean}>}} cfg
 * @returns {{close: Function, panel: HTMLElement}}
 */
export function modal(cfg = {}) {
  const body = el('div.layer__body');
  if (cfg.content instanceof Node) body.append(cfg.content);
  else if (typeof cfg.content === 'string') body.textContent = cfg.content;

  const panel = el('div.layer__panel', { attrs: { tabindex: '-1', role: 'dialog', 'aria-modal': 'true' } });
  if (cfg.title) panel.append(el('div.layer__head', { text: cfg.title }));
  panel.append(body);

  const layer = el('div.layer', {}, [panel]);
  const handle = {
    panel,
    close: () => {
      layer.remove();
      const index = layers.indexOf(handle);
      if (index >= 0) layers.splice(index, 1);
      if (!layers.length) document.body.style.removeProperty('overflow');
    }
  };

  if (cfg.actions && cfg.actions.length) {
    const foot = el('div.layer__foot');
    cfg.actions.forEach((action) => {
      foot.append(el(`button.btn${action.variant ? `.btn--${action.variant}` : '.btn--ghost'}`, {
        text: action.label,
        attrs: { type: 'button' },
        on: {
          click: () => {
            if (action.onClick && action.onClick() === false) return;
            if (action.close !== false) handle.close();
          }
        }
      }));
    });
    panel.append(foot);
  }

  // Fon bosilganda yopiladi
  layer.addEventListener('click', (e) => {
    if (e.target === layer) handle.close();
  });

  document.body.append(layer);
  document.body.style.overflow = 'hidden';
  layers.push(handle);
  panel.focus();
  return handle;
}

/**
 * Ha/yo'q so'rovi.
 * @param {{title?: string, text?: string, danger?: boolean}} cfg
 * @returns {Promise<boolean>}
 */
export function confirm(cfg = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const done = (value) => {
      if (answered) return;
      answered = true;
      resolve(value);
    };
    modal({
      title: cfg.title || t('common.confirm'),
      content: cfg.text || '',
      actions: [
        { label: t('common.cancel'), onClick: () => done(false) },
        {
          label: t('common.confirm'),
          variant: cfg.danger ? 'danger' : 'primary',
          onClick: () => done(true)
        }
      ]
    });
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && layers.length) layers[layers.length - 1].close();
});

/**
 * Yuklanish karkasi.
 * @param {'row'|'card'} [kind='row']
 * @param {number} [count=3]
 * @returns {DocumentFragment}
 */
export function skeleton(kind = 'row', count = 3) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    frag.append(el(`div.skeleton.skeleton--${kind}`, { attrs: { 'aria-hidden': 'true' } }));
  }
  return frag;
}

/**
 * Bo'sh holat.
 * @param {{icon?: string, title: string, hint?: string, action?: HTMLElement}} cfg
 * @returns {HTMLElement}
 */
export function emptyState(cfg) {
  return el('div.state', {}, [
    cfg.icon ? el('div', { text: cfg.icon, attrs: { 'aria-hidden': 'true', style: 'font-size:34px' } }) : null,
    el('h2', { text: cfg.title, attrs: { style: 'font-size:16px' } }),
    cfg.hint ? el('p.hint', { text: cfg.hint }) : null,
    cfg.action || null
  ]);
}

/**
 * Matn maydoni (label + input).
 * @param {{label: string, value?: *, type?: string, placeholder?: string,
 *          onInput?: Function, attrs?: object}} cfg
 * @returns {{node: HTMLElement, input: HTMLElement}}
 */
export function field(cfg) {
  const input = el(cfg.type === 'textarea' ? 'textarea.textarea' : 'input.input', {
    attrs: {
      ...(cfg.type && cfg.type !== 'textarea' ? { type: cfg.type } : {}),
      placeholder: cfg.placeholder || null,
      'aria-label': cfg.label,
      ...(cfg.attrs || {})
    },
    on: cfg.onInput ? { input: (e) => cfg.onInput(e.target.value, e) } : {}
  });
  // textarea qiymati atribut orqali emas, xossa orqali qo'yiladi
  if (cfg.value !== undefined && cfg.value !== null) input.value = String(cfg.value);

  const node = el('label.field', {}, [
    el('span.field__label', { text: cfg.label }),
    input
  ]);
  return { node, input };
}

/**
 * Tanlov ro'yxati.
 * @param {{label: string, value?: string,
 *          options: Array<{value: string, label: string}>,
 *          onChange?: Function}} cfg
 * @returns {{node: HTMLElement, select: HTMLElement}}
 */
export function selectField(cfg) {
  const select = el('select.select', {
    attrs: { 'aria-label': cfg.label },
    on: cfg.onChange ? { change: (e) => cfg.onChange(e.target.value, e) } : {}
  }, cfg.options.map((opt) => el('option', {
    text: opt.label,
    attrs: { value: opt.value, ...(opt.value === cfg.value ? { selected: true } : {}) }
  })));

  return {
    node: el('label.field', {}, [el('span.field__label', { text: cfg.label }), select]),
    select
  };
}

/**
 * Belgilash katakchasi.
 * @param {{label: string, checked?: boolean, onChange?: Function}} cfg
 * @returns {{node: HTMLElement, input: HTMLElement}}
 */
export function checkbox(cfg) {
  const input = el('input', {
    attrs: { type: 'checkbox', ...(cfg.checked ? { checked: true } : {}) },
    on: cfg.onChange ? { change: (e) => cfg.onChange(e.target.checked) } : {}
  });
  return {
    node: el('label.check', {}, [input, el('span', { text: cfg.label })]),
    input
  };
}
