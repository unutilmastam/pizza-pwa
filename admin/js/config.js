/**
 * Admin panel konfiguratsiyasi.
 *
 * Firebase sozlamalari va Node servis manzili MIJOZ ILOVASIDAN olinadi —
 * ikkita joyda saqlansa ular ajralib ketadi. Bu yerda faqat adminga xos
 * qiymatlar yoziladi.
 */

export { FIREBASE_CONFIG, API_BASE, getFirebase } from '../../js/config.js';

/**
 * Rollar va ularning huquqlari.
 *
 * `superadmin` hamma narsani ko'radi. Qolganlari faqat o'z bo'limlarini —
 * menyuda ham, sahifa ochilganda ham shu ro'yxat tekshiriladi.
 */
export const ROLE_SECTIONS = {
  superadmin: ['dashboard', 'orders', 'kds', 'menu', 'branches', 'couriers',
    'banners', 'promos', 'customers', 'broadcast', 'reports', 'settings', 'audit'],
  manager: ['dashboard', 'orders', 'kds', 'menu', 'branches', 'couriers',
    'banners', 'promos', 'customers', 'reports'],
  // Operator kuryerlarni ko'radi (buyurtmani u tayinlaydi) va mijozlar
  // bazasini (qo'ng'iroqda kim ekanini bilishi kerak)
  operator: ['dashboard', 'orders', 'kds', 'couriers', 'customers'],
  kitchen: ['kds'],
  // Kuryerning o'z ilovasi bo'ladi — admin panelda unga bo'lim yo'q
  courier: []
};

/** Chap menyu tartibi va sarlavha kalitlari. */
export const SECTIONS = [
  { id: 'dashboard', path: '/', icon: '📊', key: 'nav.dashboard' },
  { id: 'orders', path: '/orders', icon: '🧾', key: 'nav.orders' },
  { id: 'kds', path: '/kds', icon: '👨‍🍳', key: 'nav.kds' },
  { id: 'menu', path: '/menu', icon: '🍕', key: 'nav.menu' },
  { id: 'branches', path: '/branches', icon: '📍', key: 'nav.branches' },
  { id: 'couriers', path: '/couriers', icon: '🛵', key: 'nav.couriers' },
  { id: 'banners', path: '/banners', icon: '🖼', key: 'nav.banners' },
  { id: 'promos', path: '/promos', icon: '🎟', key: 'nav.promos' },
  { id: 'customers', path: '/customers', icon: '👤', key: 'nav.customers' },
  { id: 'broadcast', path: '/broadcast', icon: '📣', key: 'nav.broadcast' },
  { id: 'reports', path: '/reports', icon: '📈', key: 'nav.reports' },
  { id: 'settings', path: '/settings', icon: '⚙️', key: 'nav.settings' },
  { id: 'audit', path: '/audit', icon: '📋', key: 'nav.audit' }
];

export const ADMIN = {
  /** Buyurtma statuslari ketma-ketligi — servisdagi bilan bir xil. */
  statuses: ['new', 'accepted', 'cooking', 'in_oven', 'packing', 'on_way', 'delivered'],

  /** KDS ekranida ko'rinadigan statuslar. */
  kdsStatuses: ['accepted', 'cooking', 'in_oven'],

  /** Oqimda ko'rinadigan statuslar — yopilganlari tushmaydi. */
  activeStatuses: ['new', 'accepted', 'cooking', 'in_oven', 'packing', 'on_way'],

  /** Rad etish sabablari. */
  rejectReasons: [
    'reject.busy', 'reject.noProducts', 'reject.outOfZone',
    'reject.badAddress', 'reject.customer', 'reject.other'
  ],

  /** Tayyorlanish vaqti tanlovlari (daqiqa). */
  prepMinutes: [15, 20, 25, 30, 40, 50, 60],

  /** Yangi buyurtma kelganda ovoz signali beriladimi (SPEC 106). */
  soundEnabled: true,

  /** Oqim necha soniyada bir marta "eskirdi" deb belgilansin. */
  staleAfterMinutes: 10,

  /** Til tanlovi — admin uchun ikki til yetarli. */
  langs: [
    { code: 'uz', label: "O'zbekcha" },
    { code: 'ru', label: 'Русский' }
  ],
  defaultLang: 'uz',

  /** localStorage kalitlari. */
  storage: {
    lang: 'pizza.admin.lang',
    theme: 'pizza.admin.theme',
    sound: 'pizza.admin.sound'
  }
};
