/**
 * Interfeys komponentlari: toast, modal, bottom-sheet, skeleton, loader.
 * Bu yerda biznes-mantiq yo'q — faqat DOM.
 */

import { t } from './i18n.js';
import { APP } from './config.js';
import { haptic } from './utils.js';

/** Ochiq qatlamlar (modal / sheet) — Escape va scroll-lock uchun. */
const layers = [];

/**
 * Element yasashning qisqa yo'li.
 * @param {string} tag - 'div.card.card--wide' ko'rinishida sinflar bilan
 * @param {Object} [props] - {text, html, attrs, dataset, on:{click:fn}}
 * @param {Array<Node|string>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, children = []) {
  const [name, ...classes] = tag.split('.');
  const node = document.createElement(name || 'div');
  if (classes.length) node.className = classes.join(' ');
  if (props.text != null) node.textContent = props.text;
  if (props.html != null) node.innerHTML = props.html;
  if (props.attrs) {
    Object.entries(props.attrs).forEach(([k, v]) => {
      if (v !== null && v !== false && v !== undefined) node.setAttribute(k, v);
    });
  }
  if (props.dataset) Object.assign(node.dataset, props.dataset);
  if (props.on) {
    Object.entries(props.on).forEach(([evt, fn]) => node.addEventListener(evt, fn));
  }
  children.filter(Boolean).forEach((child) => {
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return node;
}

/* ------------------------------------------------------------------- toast */

/**
 * Qisqa xabar. Ixtiyoriy amal tugmasi bilan ("Qaytarish").
 * @param {string} message
 * @param {{type?: 'info'|'success'|'error', duration?: number,
 *          action?: {label: string, onClick: Function}}} [opts]
 * @returns {{close: () => void}}
 */
export function toast(message, opts = {}) {
  const host = getToastHost();
  const node = el(`div.toast.toast--${opts.type || 'info'}`, {
    attrs: { role: 'status', 'aria-live': 'polite' }
  }, [el('span.toast__text', { text: message })]);

  let timer = null;
  const close = () => {
    clearTimeout(timer);
    node.classList.add('is-leaving');
    node.addEventListener('animationend', () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 400);
  };

  if (opts.action) {
    node.append(el('button.toast__action', {
      text: opts.action.label,
      attrs: { type: 'button' },
      on: {
        click: () => {
          opts.action.onClick();
          close();
        }
      }
    }));
  }

  host.append(node);
  timer = setTimeout(close, opts.duration || APP.toastDuration);
  return { close };
}

/** Toastlar joylashadigan konteynerni qaytaradi (kerak bo'lsa yaratadi). */
function getToastHost() {
  let host = document.getElementById('toasts');
  if (!host) {
    host = el('div.toasts', { attrs: { id: 'toasts' } });
    document.body.append(host);
  }
  return host;
}

/* ------------------------------------------------------- qatlam (umumiy) */

/** Body scroll'ini bloklaydi/ochadi. */
function lockScroll(lock) {
  document.body.classList.toggle('is-locked', lock);
}

/**
 * Modal va bottom-sheet uchun umumiy qatlam yaratadi.
 * @param {{className: string, panel: HTMLElement, dismissible?: boolean,
 *          onClose?: Function}} cfg
 * @returns {{close: () => void, root: HTMLElement}}
 */
function openLayer(cfg) {
  const panel = cfg.panel;
  const backdrop = el('div.layer__backdrop');
  const root = el(`div.layer.${cfg.className}`, {
    attrs: { role: 'dialog', 'aria-modal': 'true' }
  }, [backdrop, panel]);

  const prevFocus = document.activeElement;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    root.classList.add('is-leaving');
    const finish = () => {
      root.remove();
      const i = layers.indexOf(handle);
      if (i > -1) layers.splice(i, 1);
      if (!layers.length) lockScroll(false);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      if (cfg.onClose) cfg.onClose();
    };
    root.addEventListener('transitionend', finish, { once: true });
    setTimeout(finish, 320);
  };

  const handle = { close, root, dismissible: cfg.dismissible !== false };
  layers.push(handle);
  document.body.append(root);
  lockScroll(true);

  // Kirish animatsiyasi keyingi kadrda boshlanadi
  requestAnimationFrame(() => root.classList.add('is-open'));

  if (handle.dismissible) backdrop.addEventListener('click', close);
  const focusable = panel.querySelector('button, [href], input, select, textarea');
  (focusable || panel).focus?.();

  return handle;
}

// Escape — eng yuqoridagi qatlamni yopadi
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !layers.length) return;
  const top = layers[layers.length - 1];
  if (top.dismissible) top.close();
});

/* ------------------------------------------------------------------- modal */

/**
 * Markazdagi modal oyna.
 * @param {{title?: string, content?: Node|string, actions?: Array<
 *          {label: string, variant?: string, onClick?: Function, close?: boolean}>,
 *          dismissible?: boolean, onClose?: Function}} cfg
 * @returns {{close: () => void}}
 */
export function modal(cfg = {}) {
  const body = el('div.modal__body');
  if (cfg.content instanceof Node) body.append(cfg.content);
  else if (typeof cfg.content === 'string') body.textContent = cfg.content;

  const panel = el('div.modal__panel', { attrs: { tabindex: '-1' } });
  if (cfg.title) panel.append(el('h2.modal__title', { text: cfg.title }));
  panel.append(body);

  const handle = { close: () => {} };

  if (cfg.actions && cfg.actions.length) {
    const footer = el('div.modal__actions');
    cfg.actions.forEach((action) => {
      footer.append(el(`button.btn.btn--${action.variant || 'ghost'}`, {
        text: action.label,
        attrs: { type: 'button' },
        on: {
          click: () => {
            if (action.onClick) action.onClick();
            if (action.close !== false) handle.close();
          }
        }
      }));
    });
    panel.append(footer);
  }

  const layer = openLayer({
    className: 'layer--modal',
    panel,
    dismissible: cfg.dismissible,
    onClose: cfg.onClose
  });
  handle.close = layer.close;
  return handle;
}

/**
 * Ha/yo'q so'rovi.
 * @param {{title?: string, text?: string, okText?: string, cancelText?: string,
 *          danger?: boolean}} cfg
 * @returns {Promise<boolean>}
 */
export function confirm(cfg = {}) {
  return new Promise((resolve) => {
    let answer = false;
    modal({
      title: cfg.title,
      content: cfg.text,
      onClose: () => resolve(answer),
      actions: [
        { label: cfg.cancelText || t('common.cancel'), variant: 'ghost' },
        {
          label: cfg.okText || t('common.confirm'),
          variant: cfg.danger ? 'danger' : 'primary',
          onClick: () => {
            answer = true;
          }
        }
      ]
    });
  });
}

/* ------------------------------------------------------------ bottom-sheet */

/**
 * Pastdan chiqadigan panel. Pastga surib yopiladi (mahsulot oynasi uchun).
 * @param {{title?: string, content?: Node|string, footer?: Node,
 *          dismissible?: boolean, onClose?: Function}} cfg
 * @returns {{close: () => void, body: HTMLElement}}
 */
export function bottomSheet(cfg = {}) {
  const grabber = el('div.sheet__grabber', { attrs: { 'aria-hidden': 'true' } });
  const body = el('div.sheet__body');
  if (cfg.content instanceof Node) body.append(cfg.content);
  else if (typeof cfg.content === 'string') body.innerHTML = cfg.content;

  const panel = el('div.sheet__panel', { attrs: { tabindex: '-1' } }, [grabber]);
  if (cfg.title) {
    panel.append(el('div.sheet__head', {}, [
      el('h2.sheet__title', { text: cfg.title }),
      el('button.icon-btn.sheet__close', {
        html: '&times;',
        attrs: { type: 'button', 'aria-label': t('common.close') },
        on: { click: () => handle.close() }
      })
    ]));
  }
  panel.append(body);
  if (cfg.footer) panel.append(el('div.sheet__footer', {}, [cfg.footer]));

  const layer = openLayer({
    className: 'layer--sheet',
    panel,
    dismissible: cfg.dismissible,
    onClose: cfg.onClose
  });
  const handle = { close: layer.close, body };

  // Pastga surib yopish
  let startY = 0;
  let delta = 0;
  let dragging = false;
  const canDrag = (e) => body.scrollTop <= 0 || grabber.contains(e.target);

  panel.addEventListener('touchstart', (e) => {
    if (!canDrag(e)) return;
    dragging = true;
    startY = e.touches[0].clientY;
    delta = 0;
    panel.style.transition = 'none';
  }, { passive: true });

  panel.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    delta = e.touches[0].clientY - startY;
    if (delta < 0) delta = 0;
    panel.style.transform = `translateY(${delta}px)`;
  }, { passive: true });

  panel.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    panel.style.transition = '';
    panel.style.transform = '';
    if (delta > 110) {
      haptic();
      handle.close();
    }
  });

  return handle;
}

/* --------------------------------------------------------------- skeleton */

/**
 * Skeleton (spinner emas) — yuklanayotgan kontent o'rniga.
 * @param {'card'|'line'|'product'|'list'} [variant='card']
 * @param {number} [count=1]
 * @returns {DocumentFragment}
 */
export function skeleton(variant = 'card', count = 1) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    if (variant === 'line') {
      frag.append(el('div.skel.skel--line'));
    } else if (variant === 'product') {
      frag.append(el('div.skel-product', {}, [
        el('div.skel.skel--thumb'),
        el('div.skel-product__text', {}, [
          el('div.skel.skel--line'),
          el('div.skel.skel--line.skel--short')
        ])
      ]));
    } else if (variant === 'list') {
      frag.append(el('div.skel-row', {}, [
        el('div.skel.skel--avatar'),
        el('div.skel.skel--line')
      ]));
    } else {
      frag.append(el('div.skel.skel--card'));
    }
  }
  return frag;
}

/* ----------------------------------------------------------------- loader */

let loaderNode = null;
let loaderCount = 0;

/** Bloklovchi yuklash indikatori (buyurtma yuborish kabi amallar uchun). */
export const loader = {
  /**
   * Ko'rsatadi. Ichma-ich chaqirilsa hisoblagich oshadi.
   * @param {string} [text]
   */
  show(text) {
    loaderCount += 1;
    if (!loaderNode) {
      loaderNode = el('div.loader', { attrs: { role: 'status', 'aria-live': 'polite' } }, [
        el('div.loader__spinner', { attrs: { 'aria-hidden': 'true' } }),
        el('p.loader__text', { text: text || t('app.loading') })
      ]);
      document.body.append(loaderNode);
      lockScroll(true);
    } else if (text) {
      loaderNode.querySelector('.loader__text').textContent = text;
    }
  },
  /** Yashiradi (hisoblagich nolga tushganda). */
  hide() {
    loaderCount = Math.max(0, loaderCount - 1);
    if (loaderCount === 0 && loaderNode) {
      loaderNode.remove();
      loaderNode = null;
      if (!layers.length) lockScroll(false);
    }
  }
};

/**
 * Bo'sh holat bloki (savat bo'sh, buyurtma yo'q).
 * @param {{icon?: string, title: string, hint?: string, action?: HTMLElement}} cfg
 * @returns {HTMLElement}
 */
export function emptyState(cfg) {
  return el('div.state', {}, [
    cfg.icon ? el('div.state__icon', { text: cfg.icon, attrs: { 'aria-hidden': 'true' } }) : null,
    el('h2.state__title', { text: cfg.title }),
    cfg.hint ? el('p.state__hint', { text: cfg.hint }) : null,
    cfg.action || null
  ]);
}
