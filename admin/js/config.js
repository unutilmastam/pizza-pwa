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
  superadmin: ['dashboard', 'orders', 'kds', 'menu', 'branches', 'couriers', 'promos', 'reports'],
  manager: ['dashboard', 'orders', 'kds', 'menu', 'branches', 'couriers', 'promos', 'reports'],
  // Operator kuryerlarni ko'radi, chunki buyurtmani u tayinlaydi
  operator: ['dashboard', 'orders', 'kds', 'couriers'],
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
  { id: 'promos', path: '/promos', icon: '🎟', key: 'nav.promos' },
  { id: 'reports', path: '/reports', icon: '📈', key: 'nav.reports' }
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
