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

/**
 * Firebase v10 modular SDK — CDN manzillari (Storage kiritilmagan).
 *
 * DIQQAT: shu manzillar `index.html`, `admin/index.html` va
 * `courier/index.html` dagi `modulepreload` teglarida ham takrorlangan
 * (ular kritik yo'lni qisqartiradi). Versiyani o'zgartirsangiz uchala
 * HTML faylni ham yangilang — aks holda preload behuda ketadi.
 */
export const FIREBASE_SDK = {
  app: 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  auth: 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  firestore: 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
};

/**
 * Node servis (Render) bazaviy manzili — barcha API chaqiruvlari shundan
 * boshlanadi. Servis manzili faqat shu yerda yoziladi; `js/api.js` uni
 * o'qiydi, boshqa fayllar `fetch` qilmaydi.
 *
 * Render'da servis nomi boshqacha bo'lsa shu qatorni almashtiring.
 */
export const API_BASE = 'https://pizza-api-yhd9.onrender.com';

/**
 * Autentifikatsiya rejimi.
 *
 *  - `production` — ISHLAYOTGAN rejim: `/api/auth/send-otp` va
 *                   `/api/auth/verify-otp` chaqiriladi, servis qaytargan
 *                   custom token bilan `signInWithCustomToken()`.
 *  - `test`       — Node servis mavjud bo'lmagan paytdagi zaxira yo'l:
 *                   SMS yuborilmaydi, kod `TEST_OTP_CODE` bilan
 *                   solishtiriladi, sessiya `signInAnonymously()` orqali
 *                   ochiladi.
 *
 * Rejimni almashtirish uchun shu qiymatni o'zgartirish yetarli —
 * `js/auth.js` ikkala yo'lni ham biladi.
 */
export const AUTH_MODE = 'production';

/** Test rejimidagi yagona to'g'ri kod. Ekranda ham shu ko'rsatiladi. */
export const TEST_OTP_CODE = '000000';

/** OTP kodini qayta yuborish taymeri (soniya). */
export const OTP_RESEND_SECONDS = 60;

/**
 * Yandex Maps JS API 2.1.
 * Skript FAQAT manzil sahifasi ochilganda yuklanadi (`js/pages/address.js`
 * dagi `loadYmaps()`), bosh sahifada umuman so'ralmaydi.
 */
export const YANDEX_MAPS_KEY = 'b7ccb8db-fd98-49a9-acaf-b518fe364498';
export const YANDEX_MAPS_VERSION = '2.1';

/**
 * Xarita tili. Yandex Maps `uz_UZ` ni qo'llab-quvvatlamaydi, shuning uchun
 * o'zbek interfeysida ham manzillar ruscha ko'rinishda keladi.
 */
export const YANDEX_MAPS_LANG = { uz: 'ru_RU', ru: 'ru_RU', en: 'en_US' };

/** Toshkent markazi — xarita boshlang'ich nuqtasi. */
export const DEFAULT_CENTER = [41.311081, 69.240562];

/**
 * OpenStreetMap Nominatim — zaxira geokoder.
 * Yandex geokoderi ishlamaganda yoki bo'sh natija qaytarganda ishlatiladi.
 *
 * Foydalanish qoidalari (operations.osmfoundation.org/policies/nominatim):
 *  - sekundiga 1 tadan ko'p so'rov yubormaslik → `minInterval`;
 *  - so'rovni tanitish (User-Agent yoki Referer). Brauzerdan `User-Agent`
 *    ni o'zgartirib bo'lmaydi — u taqiqlangan sarlavha, shuning uchun
 *    brauzer o'zi yuboradigan `Referer` ishlatiladi;
 *  - natijada atributsiya ko'rsatilishi shart → "© OpenStreetMap".
 */
export const NOMINATIM = {
  url: 'https://nominatim.openstreetmap.org/reverse',
  timeout: 8000,
  minInterval: 1200
};

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

  /**
   * To'lov usullari.
   *
   * Hozircha faqat naqd va kuryerdagi karta — ikkalasi ham buyurtmada
   * BELGI sifatida saqlanadi, ilova pul o'tkazmasi bilan ishlamaydi.
   * Payme/Click/Uzum onlayn to'lovi keyingi bosqichga qoldirilgan;
   * ro'yxatga qo'shishdan oldin Node servisda ham `PAYMENT_METHODS`
   * kengaytirilishi va webhook yozilishi kerak.
   */
  paymentMethods: ['cash', 'card'],

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
  settings: 'pizza.settings.v1',
  /**
   * Ma'lumot keshi (`js/db.js` dagi stale-while-revalidate).
   * Sahifalar tarmoqni kutmasligi uchun filial, buyurtma va profil
   * shu prefiks ostida saqlanadi.
   */
  cache: 'pizza.cache.v1'
};

/** Firebase namunalari — takroriy init bo'lmasligi uchun keshlanadi. */
let firebasePromise = null;

/**
 * Firebase SDK'ni dangasa yuklaydi va app / auth / firestore qaytaradi.
 * Faqat `js/db.js` va `js/auth.js` chaqiradi.
 * @returns {Promise<{app: object, auth: object, dbx: object, sdk: object}>}
 */
/**
 * Modulni import qiladi, yiqilsa BOSHQA manzil bilan bir marta qayta
 * uriniladi.
 *
 * NEGA KERAK: `index.html` da Firebase SDK uchun `modulepreload`
 * turadi. Preload yiqilsa (gstatic bir lahzaga yetib bo'lmasa —
 * sekin LTE da bu oddiy hol) brauzer modulni "yiqilgan" deb belgilab
 * qo'yadi va keyingi `import()` UMUMAN so'rov yubormasdan darhol xato
 * qaytaradi. Sinovda aynan shu holat ilovani butunlay ochilmaydigan
 * qilib qo'ygan edi.
 *
 * `?retry=` qo'shilgan manzil — brauzer uchun BOSHQA modul, shuning
 * uchun u haqiqiy so'rov yuboradi.
 *
 * @param {string} url
 * @returns {Promise<object>}
 */
async function importWithRetry(url) {
  try {
    return await import(/* @vite-ignore */ url);
  } catch (e) {
    console.warn('[config] modul yiqildi, qayta urinamiz:', url);
    return import(/* @vite-ignore */ `${url}?retry=${Date.now()}`);
  }
}

export function getFirebase() {
  if (!firebasePromise) {
    firebasePromise = (async () => {
      const [appSdk, authSdk, storeSdk] = await Promise.all([
        importWithRetry(FIREBASE_SDK.app),
        importWithRetry(FIREBASE_SDK.auth),
        importWithRetry(FIREBASE_SDK.firestore)
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
