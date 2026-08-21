/**
 * Ilova konfiguratsiyasi va konstantalar.
 *
 * SDK dangasa (lazy) yuklanadi: Firebase faqat birinchi marta kerak
 * bo'lganda CDN'dan import qilinadi, shuning uchun app shell tarmoqsiz
 * ham ochilaveradi.
 *
 * Faqat Auth va Firestore ishlatiladi. Firebase Storage YO'Q (bepul planda
 * mavjud emas) — rasmlar GitHub Pages'dagi `images/` papkasidan beriladi.
 */

/** Firebase loyiha sozlamalari. */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDYCxZLzTTgmlECuOYGiAkifc_MCsJwxW8',
  authDomain: 'pizza-pwa.firebaseapp.com',
  projectId: 'pizza-pwa',
  messagingSenderId: '621801689473',
  appId: '1:621801689473:web:17ab4a7404dba4f1ec9880'
};

/** Firebase v10 modular SDK — CDN manzillari (Storage kiritilmagan). */
export const FIREBASE_SDK = {
  app: 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  auth: 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  firestore: 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
};

/** Node servis (Render) bazaviy manzili. */
export const API_BASE = 'https://pizza-api.onrender.com';

/** Yandex Maps JS API kaliti — 3-bosqichda ishlatiladi. */
export const YANDEX_MAPS_KEY = 'YANDEX_MAPS_API_KEY';

/** Ilova konstantalari. */
export const APP = {
  version: '0.1.0',
  currency: 'UZS',
  defaultLang: 'uz',
  langs: ['uz', 'ru', 'en'],
  /** Kafolat taymeri (daqiqa) — settings/global dan qayta yoziladi. */
  guaranteeMinutes: 35,
  /** Cashback foizi. */
  cashbackPercent: 2,
  /** Bonus amal qilish muddati (kun). */
  bonusExpiryDays: 90,
  /** Qidiruv debounce (ms). */
  searchDebounce: 300,
  /** Toast ko'rinish vaqti (ms). */
  toastDuration: 2600,
  /**
   * Yetkazib berish qiymatlari — VAQTINCHALIK zaxira.
   * 3-bosqichda bular filialning zona ma'lumotidan olinadi
   * (`branches/{id}.zones[].deliveryPrice / minOrder`), zona topilmaguncha
   * shu qiymatlar ishlatiladi.
   */
  delivery: {
    price: 15000,
    minOrder: 50000,
    /** Shu summadan boshlab yetkazish bepul. */
    freeFrom: 150000,
    /** Eng erta yetkazish vaqti (daqiqa) — vaqt tanlashda tekshiriladi. */
    minLeadMinutes: 30
  },

  /** To'lov usullari — 6-bosqichda Payme/Click/Uzum redirect qo'shiladi. */
  paymentMethods: ['cash', 'card', 'payme', 'click', 'uzum'],

  /** Idish-tovoq soni chegarasi. */
  maxCutlery: 10,

  /** Buyurtma statuslari — ketma-ketlik stepper uchun muhim. */
  orderStatuses: [
    'new',
    'accepted',
    'cooking',
    'in_oven',
    'packing',
    'on_way',
    'delivered'
  ]
};

/** localStorage kalitlari — bitta joyda saqlanadi. */
export const STORAGE_KEYS = {
  state: 'pizza.state.v1',
  menu: 'pizza.menu.v1',
  settings: 'pizza.settings.v1'
};

/** Firebase namunalari — takroriy init bo'lmasligi uchun keshlanadi. */
let firebasePromise = null;

/**
 * Firebase SDK'ni dangasa yuklaydi va app / auth / firestore qaytaradi.
 * Faqat `js/db.js` va `js/auth.js` chaqiradi.
 * @returns {Promise<{app: object, auth: object, dbx: object, sdk: object}>}
 */
export function getFirebase() {
  if (!firebasePromise) {
    firebasePromise = (async () => {
      const [appSdk, authSdk, storeSdk] = await Promise.all([
        import(/* @vite-ignore */ FIREBASE_SDK.app),
        import(/* @vite-ignore */ FIREBASE_SDK.auth),
        import(/* @vite-ignore */ FIREBASE_SDK.firestore)
      ]);
      const app = appSdk.initializeApp(FIREBASE_CONFIG);
      return {
        app,
        auth: authSdk.getAuth(app),
        dbx: storeSdk.getFirestore(app),
        sdk: { ...authSdk, ...storeSdk }
      };
    })();
  }
  return firebasePromise;
}
