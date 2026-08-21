# Loyiha holati

> Har seans boshida shu faylni o'qi. Faqat "Joriy bosqich" deb belgilangan
> ishni bajar. Boshqa bosqichlarga o'tma. Tugagach shu faylni yangila.

**Joriy bosqich: 7**

> Qoldirilgan ish: Payme/Click to'lov integratsiyasi (SPEC 4.2) —
> foydalanuvchi qarori bilan keyinga surildi. Qo'shilganda
> `server/src/orders.js` dagi `PAYMENT_METHODS`, `js/config.js` dagi
> `APP.paymentMethods` va webhook yo'llari birga kengaytiriladi.

---

## Bosqich 0 — asos
Status: **bajarildi**

Yaratiladi:
- `index.html` — app shell: header, `main#app`, pastki nav
  (Menyu / Savat / Buyurtmalar / Profil), safe-area inset
- `css/style.css` — dizayn tizimi: rang o'zgaruvchilari (dark/light),
  tipografiya, tugma, kartochka, input, skeleton, bottom-sheet modal
- `js/config.js` — Firebase init (config placeholder), konstantalar
- `js/i18n.js` — uz / ru / en, kamida 40 ta kalit, `t()` funksiyasi
- `js/state.js` — savat, foydalanuvchi, til, tanlangan manzil,
  localStorage sync, subscribe mexanizmi
- `js/router.js` — hash router, sahifa registratsiyasi, orqaga tugmasi
- `js/utils.js` — `formatPrice`, `formatDate`, `debounce`,
  `pointInPolygon`, `haversine`
- `js/ui.js` — `toast`, `modal`, `bottomSheet`, `skeleton`, `loader`
- `js/db.js` — FAQAT skeleton: funksiya nomlari + JSDoc izoh, ichi bo'sh
- `manifest.json`, `sw.js` — app shell cache
- `.gitignore`

Kutilgan natija: sahifa ochiladi, pastki nav ishlaydi, sahifalar
almashadi (ichi bo'sh — bu normal).

Izoh:
- Barcha rejalashtirilgan fayllar yaratildi. Qo'shimcha: `icons/icon.svg`
  va `icons/icon-maskable.svg` (manifest uchun), ilova bootstrap kodi
  `index.html` ichidagi module skriptda (alohida `app.js` ochilmadi —
  SPEC'dagi fayl strukturasiga sodiq qolindi).
- `js/config.js`: Firebase dangasa (lazy) yuklanadi — `getFirebase()`
  faqat birinchi murojaatda CDN'dan import qiladi, shuning uchun kalitlar
  to'ldirilmagan holatda ham app shell ochilaveradi.
- `js/db.js` — faqat kontrakt: 22 ta funksiya nomi + JSDoc, tanasi bo'sh.
  1–5-bosqichlarda to'ldiriladi.
- 0-bosqichda sahifalar `index.html` da vaqtinchalik "stub" sifatida
  ro'yxatdan o'tgan. 1-bosqichda `register('/menu', () =>
  import('./js/pages/menu.js'))` ko'rinishiga almashtiriladi.
- Tekshirildi (Chromium, 390×844): nav almashadi va faol bo'lim
  yoritiladi, 404 ishlaydi, bottom-sheet ochilib Escape bilan yopiladi,
  savat localStorage'dan tiklanadi (reload'dan keyin badge saqlanadi),
  til uz/ru/en almashadi, SW ro'yxatdan o'tadi, konsolda xato yo'q.
  `formatPrice` → `125 000 so'm`, `pointInPolygon` va `haversine` to'g'ri.

0-bosqichdan keyin qo'shilgan ishlar:
- `js/config.js` — haqiqiy Firebase sozlamalari (`pizza-pwa`). Storage
  ishlatilmaydi (bepul planda yo'q): SDK ro'yxatidan `firebase-storage.js`
  va `storageBucket` olib tashlandi. Rasmlar GitHub Pages'dagi `images/`
  papkasidan beriladi. Diqqat: `js/db.js` dagi `uploadImage()` kontrakti
  hali Storage'ga tayanadi — 5-bosqichda boshqa yechimga o'tkaziladi.
- `docs/seed-menu.json` — `menu/current` uchun demo ma'lumot: 3 kategoriya,
  10 mahsulot (6 pitsa × 3 variant + 5 addon + 3 removable, 2 ichimlik,
  2 zakuska), uz/ru/en, `version: 1`. Addon/removable nomlari ham ko'p
  tilli obyekt — `i18n.pick()` ikkalasini ham qabul qiladi.
- `tools/seed.html` — bir martalik vosita: JSON'ni o'qib `menu/current` ga
  yozadi, `updatedAt` = `serverTimestamp()`, yozishdan oldin tasdiq so'raydi.
- **Kesh xatosi va tuzatilishi.** SW `js/config.js` ni keshlagani uchun
  brauzerda placeholder'li eski config qolib ketgan edi; noto'g'ri
  `projectId` bilan `setDoc` xato bermay cheksiz osilib qolardi.
  Tuzatildi: `sw.js` `VERSION = 'v2'`, `config.js` kesh ro'yxatidan
  chiqarildi va **network-only** qilindi (`NEVER_CACHE`), `activate` da
  boshqa versiyaning barcha keshlari hamda eski `config.js` yozuvlari
  o'chiriladi. `tools/seed.html` configni `?nocache=` bilan o'qiydi,
  placeholder topilsa yozuvni bloklaydi, har bosqichga timeout qo'yilgan
  (JSON 15s, SDK 20s, yozuv 20s) va "Kesh va SW ni tozalash" tugmasi bor.
  Tekshirildi: v1 → v2 yangilanishida eski kesh o'chdi, `config.js`
  hech qaysi keshda qolmadi, har yuklashda tarmoqqa so'rov ketadi,
  ilova ishlaydi va konsolda xato yo'q.
- Ma'lum cheklov: `config.js` endi network-only, shuning uchun **oflaynda
  ilova ochilmaydi** (app shell keshda bor, lekin config import qilinmaydi).
  Kerak bo'lsa "avval tarmoq, uzilsa kesh" strategiyasiga o'tkazish mumkin.

---

## Bosqich 1 — menyu
Status: **bajarildi**

`js/pages/menu.js`, `js/pages/product.js`
- `menu/current` bitta hujjat, localStorage'ga `version` bilan keshlanadi
- Sticky kategoriya chiplari + scroll-spy
- Qidiruv (debounce 300ms)
- Stop-list: o'chirilgan mahsulot kulrang
- Mahsulot bottom-sheet: galereya, o'lcham, xamir, addon, remove, miqdor

Izoh:
- `js/db.js` da yozildi: `getMenu()`, `getMenuVersion()`,
  `getCachedMenuVersion()`, `getStopList()`. Kesh mantiqi: localStorage'da
  10 daqiqadan yangi kesh bo'lsa Firestore'ga **umuman murojaat qilinmaydi**;
  eskirgan bo'lsa hujjat o'qilib kesh yangilanadi; tarmoq uzilgan bo'lsa
  eski kesh qaytadi. Qolgan funksiyalar hamon kontrakt holida.
- `js/pages/menu.js` — sticky qidiruv + chiplar, kategoriya bo'limlari,
  scroll-spy, stop-list, skeleton, xato holati "Qayta urinish" bilan.
- `js/pages/product.js` — bottom-sheet: scroll-snap galereya + nuqtalar,
  o'lcham/xamir segment tanlagichi, addon ro'yxati, olib tashlash chiplari,
  miqdor va real vaqtdagi narx. **Router sahifasi emas** — `menu.js` uni
  bevosita chaqiradi, chunki oyna menyu ustida ochilishi kerak.
  Deep-link (`#/product/:id`) kerak bo'lsa keyin qo'shiladi.
- Xamir tanlagichi variantlardan hosil qilinadi: `seed-menu.json` da har
  o'lchamda bitta xamir bor, shuning uchun blok ko'rinmaydi. Menyuga
  `dough: "thin"` variantlari qo'shilsa — o'zi paydo bo'ladi.
- Rasmlar hali yo'q (`images/products/*.jpg` 404 beradi) — `onerror` bilan
  kategoriya emojisi ko'rsatiladi, interfeys buzilmaydi.
- Stop-list `state.branchId` bo'lgandagina Firestore'dan o'qiladi. Filial
  tanlash 3-bosqichda, shungacha ro'yxat bo'sh; `active: false` mahsulot
  esa hozir ham kulrang bo'ladi.
- Bu bosqichda qilinmadi (PROGRESS ro'yxatida yo'q): banner slayder,
  filtrlar (vegetarian/achchiq/narx), sevimlilar, pitsa konstruktori.
- Tuzatilgan xato: `render()` ma'lumotni `await` qilib turgani uchun router
  sahifani DOM'ga kech qo'yardi va **skeleton umuman ko'rinmasdi**. Endi
  karkas darhol qaytariladi, ma'lumot fonda yuklanadi (skeleton ~60 ms da
  chiqadi). Yana ikkita mayda tuzatish: oxirgi chip bosilganda scroll-spy
  uni bosib ketardi (endi 800 ms "lock" va sahifa oxiri hisobga olinadi);
  og'irlik birligi "г" qotib qolgan edi (endi `unit.g`).
- `sw.js` `VERSION = 'v3'`, yangi sahifa modullari app shell ro'yxatida.
- Tekshirildi (Chromium 390×844, soxta `db.js` bilan): 3 bo'lim / 10
  kartochka, chiplar va scroll-spy (oxirgi bo'lim ham), qidiruv 300 ms
  debounce bilan ("tovuq" → 3 ta natija, "zzzz" → topilmadi, tozalash
  qaytaradi), stop-listdagi Margarita kulrang va bosilmaydi, Pepperoni
  oynasida 35 sm o'chirilgan, narx 45 000 → 30 sm 65 000 → mozzarella
  bilan 77 000 → 2 dona 154 000, savatga qo'shilgach badge 2 va
  localStorage'da to'g'ri `unitPrice`. Haqiqiy `db.js` bilan: yangi keshda
  0 ta tarmoq so'rovi, eskirgan kesh + tarmoqsiz holatda eski menyu
  qaytadi, kesh yo'q + tarmoqsiz holatda xato ekrani chiqadi.
  Konsolda xato yo'q (rasm 404'laridan boshqa).

---

## Bosqich 2 — savat va checkout
Status: **bajarildi**

`js/pages/cart.js`, `js/pages/checkout.js`
- Savat: miqdor, o'chirish undo bilan, promokod, minimal summa
  progress-bar, upsell, narx breakdown
- Checkout: manzil/filial, vaqt, to'lov usuli, qaytim, idish-tovoq,
  izoh, oferta checkbox

Izoh:
- `js/pages/cart.js` — qatorlar (rasm, konfiguratsiya matni, stepper,
  narx), o'chirish "Qaytarish" toasti bilan, promokod bloki, progress-bar,
  upsell tasmasi, breakdown va sticky CTA. `calcTotals()` shu fayldan
  eksport qilinadi — checkout ham o'shani ishlatadi.
- `js/pages/checkout.js` — 8 ta blok: buyurtma turi, manzil/filial, vaqt,
  to'lov usuli (+ naqd uchun qaytim), idish-tovoq, izoh, buyurtma tarkibi,
  oferta. Har bir maydon tekshiriladi.
- **Buyurtma serverga yuborilmaydi** — bu ataylab. SPEC 3-bo'lim: client
  `orders` ga yoza olmaydi, narxni Node servis qayta hisoblaydi
  (6-bosqich). Shuning uchun "Buyurtma berish" to'liq validatsiyadan
  o'tkazib, `state.orderDraft` ga `orders` sxemasiga mos draft yozadi va
  buni oynada ochiq aytadi. Savat tozalanmaydi. Soxta buyurtma raqami
  yoki status yaratilmadi.
- **Promokod tekshirilmaydi** — `promocodes` ni client o'qiy olmaydi.
  Kod `state.promoCode` ga saqlanadi, breakdown'da "Rasmiylashtirishda
  tekshiriladi" deb turadi, chegirma 0. Node servis ulangach hisoblanadi.
- **Yetkazish narxi va minimal summa** hozircha `config.js` dagi zaxira
  qiymatlardan: 15 000 / 50 000 / bepul 150 000 dan. 3-bosqichda bular
  filial zonasidan (`branches/{id}.zones[]`) olinadi.
- **Manzil qo'lda kiritiladi** (ko'cha, kvartira, podyezd, qavat, domofon,
  mo'ljal) — bottom-sheet forma. 3-bosqichda Yandex Maps xaritasi, reverse
  geocode va zona tekshiruvi bilan almashtiriladi; `lat/lng` shundan keyin
  to'ladi.
- Pickup uchun `db.getBranches()` yozildi. Firestore'da `branches`
  hali yo'q — ro'yxat bo'sh bo'lsa "Filiallar hali qo'shilmagan" chiqadi.
  Masofa bo'yicha saralash 3-bosqichda.
- Bu bosqichda qilinmadi (PROGRESS ro'yxatida yo'q): bonus slider,
  Payme/Click redirect (faqat tanlash bor), kombo tarkibini almashtirish.
- `js/state.js` ga qo'shildi: `checkout` (to'lov usuli, qaytim,
  idish-tovoq, izoh — keyingi buyurtmada eslab qolinadi), `orderDraft`,
  `setCheckout()`, `setOrderDraft()`.
- CSS: savat qatori, progress-bar, upsell tasmasi, summalar, checkout
  bo'limlari. Ikkita tuzatish: promokod placeholder'i katta harfda
  kesilardi; toast sticky CTA ni to'sib qolardi (`:has(.cart-cta)` bilan
  toast tepaga ko'chirildi, eski brauzerda avvalgidek qoladi).
- `sw.js` `VERSION = 'v4'`, yangi sahifalar app shell ro'yxatida.
- Tekshirildi (Chromium 390×844, soxta `db.js` bilan): bo'sh savat holati;
  2 mahsulot → 92 000; stepper 2 dona → 130 000; o'chirish → "Qaytarish"
  toasti → qator qaytdi; promokod PIZZA20 saqlandi va breakdown'da
  ko'rindi; upsell 6 kartochka; 272 000 da "Yetkazish bepul"; 12 000 da
  CTA o'chirilgan va "Minimal buyurtma summasi 50 000 so'm"; checkout
  validatsiyasi: manzilsiz, kam qaytim (1 000), 30 daqiqadan yaqin vaqt va
  ofertasiz holatlar to'g'ri xato berdi; to'liq to'ldirilgach draft
  localStorage'ga yozildi (items, subtotal 272 000, cutlery 2, izoh,
  changeFrom 500 000) va savat tegilmadi; pickup'da 2 filial ko'rindi,
  tanlandi, yetkazish bepulga o'tdi. Konsolda xato yo'q.

---

## Bosqich 3 — manzil va zona
Status: **bajarildi**

`js/pages/address.js` — Yandex Maps JS API
- Marker surish, reverse geocode, autocomplete
- `pointInPolygon` bilan zona tekshiruvi
- Zonaga qarab yetkazish narxi va minimal summa
- Saqlangan manzillar CRUD

Izoh:
- `js/pages/address.js` — Yandex Maps JS API 2.1. Xarita, surilishi mumkin
  bo'lgan marker, xaritani bosish, `SuggestView` autocomplete, reverse
  geocode (400 ms debounce), zona tekshiruvi, tafsilot formasi va
  saqlangan manzillar ro'yxati.
- **Skript dangasa yuklanadi.** `loadYmaps()` `<script>` ni faqat manzil
  sahifasi ochilganda `<head>` ga qo'shadi; menyu, savat va checkout'da
  xarita umuman so'ralmaydi (test bilan tasdiqlangan: 0 ta so'rov).
  Skript bir marta yuklanib keshlanadi, 12 soniyalik timeout bor.
- **Xarita yuklanmasa ilova buzilmaydi.** Kalit ishlamasa, skript
  bloklansa yoki tarmoq yo'q bo'lsa — "Xaritani yuklab bo'lmadi, manzilni
  qo'lda kiriting" ogohlantirishi va oddiy forma chiqadi; qidiruv maydoni
  oddiy "Ko'cha va uy raqami" maydoniga aylanadi. Manzil koordinatasiz
  saqlanadi, zona aniqlanmaydi va zaxira narx ishlatiladi.
- **Zona → narx.** `findZone()` `pointInPolygon` bilan filial zonalarini
  tekshiradi; topilgan zona `address.zone` ga yoziladi va `calcTotals()`
  yetkazish narxi hamda minimal summani o'shandan oladi (topilmasa
  `config.js` dagi zaxira qiymatlar). Zonadan tashqaridagi manzilni
  tasdiqlab bo'lmaydi — tugma o'chiriladi.
- **Manzillar CRUD**: mehmon rejimida `state.addresses` (localStorage),
  foydalanuvchi kirgach `users/{uid}/addresses` — `db.js` da
  `getAddresses/addAddress/updateAddress/deleteAddress` yozildi va
  4-bosqichda auth ulangach o'zi ishlay boshlaydi.
- `checkout.js` dagi vaqtinchalik qo'lda kiritish oynasi olib tashlandi —
  endi "Manzilni kiritish" tugmasi `#/address` sahifasiga olib boradi va
  bo'limda zona nomi bilan yetkazish narxi ko'rsatiladi.
- Yandex Maps `uz_UZ` tilini qo'llab-quvvatlamaydi: o'zbek interfeysida
  xarita va manzillar ruscha (`ru_RU`), inglizchada `en_US`.
- `config.js`: `YANDEX_MAPS_KEY` (haqiqiy kalit), `YANDEX_MAPS_VERSION`,
  `YANDEX_MAPS_LANG`, `DEFAULT_CENTER` (Toshkent).
- `sw.js` `VERSION = 'v5'`, `address.js` app shell ro'yxatida. Xarita
  skripti tashqi domendan kelgani uchun SW unga tegmaydi.
- **Geokoder tuzatishi.** Xarita ishlaganda ham manzil "Manzil aniqlanmadi"
  bo'lib qolardi. Sabab: `try/catch` HAR QANDAY xatoni (403 ham, kod
  xatosi ham) bitta jim matnga aylantirardi. Endi: har bosqich konsolga
  yoziladi (`[geocode]` chaqiruv → javob → manzil qatori), xato turi
  aniqlanadi (403 / limit / boshqa) va ekranda ogohlantirish chiqadi;
  geokoder ishlamasa maydonga koordinata yoziladi va qo'lda tahrirlash
  ochiq qoladi (avval map rejimida yozilgan matn e'tiborga olinmasdi —
  bu ham tuzatildi). 403 dan keyin qayta urinilmaydi. `firstGeoObject()`
  javob shakliga bog'liq emas: `getLength()` bo'lmasa ham ishlaydi.
  Zona tekshiruvi geokoderga bog'liq emas — koordinatadan hisoblanadi.
- **Zaxira geokoder — OSM Nominatim.** Tartib: 1) `ymaps.geocode()`,
  2) muvaffaqiyatsiz yoki bo'sh natijada `nominatim.openstreetmap.org/
  reverse`, 3) u ham bermasa koordinata qoladi va qo'lda yozish taklif
  qilinadi. Konsolda qaysi geokoder ishlagani yoziladi
  (`[geocode] ishlagan geokoder: yandex|osm|hech qaysi`).
  Nominatim qoidalari: debounce 1200 ms + so'rovlar orasida minimal
  1200 ms interval, `accept-language` interfeys tiliga qarab (u o'zbek
  tilini biladi), natija ostida "© OpenStreetMap" atributsiyasi.
  Brauzerdan `User-Agent` yuborib bo'lmaydi (taqiqlangan sarlavha) —
  so'rovni brauzer qo'shadigan `Referer` tanitadi.
- Bu bosqichda qilinmadi: joylashuvni avtomatik aniqlash tugmasi
  (`geolocationControl` xaritaning o'zida bor), manzilni xarita ustida
  ko'rsatuvchi doimiy pin animatsiyasi, filiallarni masofa bo'yicha
  saralash (checkout'dagi ro'yxat hozircha tartibsiz).
- Tekshirildi (Chromium 390×844): **dangasa yuklash** — menyu/savatda 0 ta
  so'rov, manzil sahifasida aynan 1 ta (kalit bilan); **xaritasiz rejim**
  (bu muhitda CDN haqiqatan bloklangan) — ogohlantirish chiqdi, qo'lda
  kiritilgan manzil saqlandi, konsolda xato yo'q; **xarita rejimi**
  (soxta `ymaps` bilan) — marker surilganda reverse geocode ishladi,
  zona ichida "Markaz · 12 000 so'm · min 40 000", tashqarida "zonadan
  tashqarida" va tugma o'chdi, autocomplete tanlovi manzilni yangiladi,
  saqlangach savatda yetkazish 12 000 bo'ldi (zaxira 15 000 emas),
  saqlangan manzil ro'yxatda ko'rindi va o'chirildi, sahifadan chiqqanda
  `map.destroy()` chaqirildi.

---

## Bosqich 4 — auth
Status: **bajarildi (test rejimida)**

`js/pages/auth.js`, `js/auth.js`
- +998 mask, OTP 6 katak, 60 sek taymer
- `POST /api/auth/send-otp`, `/verify-otp`
- `signInWithCustomToken`
- Mehmon rejimi

Izoh:
- **DIQQAT: auth hozircha TEST REJIMIDA.** Node servis 6-bosqichda
  yoziladi, shungacha SMS yuborilmaydi. `config.js` da
  `AUTH_MODE = 'test'` — 6-bosqichda `'production'` ga o'zgartirilsa
  `js/auth.js` o'zi `/api/auth/send-otp` va `/verify-otp` ga o'tadi,
  boshqa hech narsani tahrirlash shart emas.
- Test rejimi qanday ishlaydi: telefon kiritiladi → kod so'raladi (hech
  qayerga so'rov ketmaydi) → `000000` qabul qilinadi →
  `signInAnonymously()` bilan haqiqiy Firebase sessiya ochiladi →
  `users/{uid}` hujjati yaratiladi va unga telefon yoziladi. Ekranda
  ochiq yozilgan: "Test rejimi — kod: 000000".
- `js/auth.js` — yagona auth qatlami: `sendOtp`, `verifyOtp`, `logout`,
  `watchAuth`, `initAuth`, `normalizePhone`, `authErrorKey`. Ikkala
  rejim ham shu yerda, sahifalar Firebase Auth'ni bevosita chaqirmaydi.
- `js/pages/auth.js` — ikki qadam: +998 maskali telefon va 6 katakli OTP
  (raqamlar orasida avtomatik o'tish, Backspace orqaga qaytaradi, to'liq
  kodni paste qilsa kataklarga tarqaladi), 60 soniyalik qayta yuborish
  taymeri, "Raqamni o'zgartirish", mehmon rejimi. Kirgan holatda sessiya
  kartochkasi va "Chiqish".
- `db.ensureUserDoc()` faqat XAVFSIZ maydonlarni yozadi (phone, name,
  lang, createdAt/lastLoginAt). `bonusBalance`, `tier`, `totalSpent`,
  `blocked` — Security Rules bo'yicha client tegmaydi, ularni Node
  servis boshqaradi. `getUser()` va `updateUserProfile()` ham yozildi.
- **Firebase FAQAT kerak bo'lganda yuklanadi**: `initAuth()` kuzatuvchini
  ilgari kirgan foydalanuvchi uchungina ulaydi, mehmon uchun bosh sahifa
  ortiqcha so'rovsiz ochiladi (test bilan tasdiqlangan).
- SPEC 55 bajarildi: checkout'da "Buyurtma berish" bosilganda mehmon
  `#/auth?next=/checkout` ga yo'naltiriladi va kirgach o'sha yerga
  qaytadi. Savat va manzil mehmon rejimida ham ishlayveradi.
- Profil sahifasi hamon 5-bosqichniki, lekin unga kirish/chiqish tugmasi
  qo'yildi — aks holda auth sahifasiga borish yo'li bo'lmasdi.
- **Firebase konsolida Anonymous kirish yoqilgan bo'lishi shart**
  (Authentication → Sign-in method → Anonymous). Yoqilmagan bo'lsa
  ekranda aniq xabar chiqadi: "Firebase konsolida Anonymous kirish
  yoqilmagan".
- Ma'lum cheklov: mehmon rejimida saqlangan manzillar localStorage'da
  qoladi, kirgandan keyin ular Firestore'ga ko'chirilmaydi. Kerak bo'lsa
  5-bosqichda migratsiya qo'shiladi.
- `sw.js` `VERSION = 'v6'`, `auth.js` va `pages/auth.js` app shell'da.
- Tekshirildi (Chromium 390×844, soxta Firebase auth bilan) — 10 ta
  stsenariy: mehmon uchun auth so'rovi yo'q; test plashkasi ko'rinadi;
  maska `901234567` → `+998 90 123 45 67`; 6 katak va 60 sek taymer;
  noto'g'ri kod → "Kod noto'g'ri" va kataklar tozalanadi; `000000` →
  sessiya ochildi, `state.user` to'ldi, `users/{uid}` ga telefon yozildi;
  profil kirgan raqamni ko'rsatadi; chiqish `user`ni null qiladi;
  mehmon rejimi ishlaydi; checkout `#/auth?next=/checkout` ga yubordi va
  kirgach qaytardi; Anonymous o'chirilgan holatda aniq xabar chiqdi.

---

## Bosqich 5 — treking va profil
Status: **bajarildi**

`js/pages/order.js`, `js/pages/profile.js`
- `onSnapshot` real-time, 7 status stepper, kafolat taymeri
- Kuryer marker
- Profil: tarix, takrorlash, bonus, manzillar

Izoh:
- `js/db.js` da yozildi: `getOrders`, `getOrder`, `watchOrder`,
  `watchActiveOrders`, `watchCourier`, `saveRating`, `getBonusHistory`.
  Saralash CLIENT tomonda: `where('uid')` + `orderBy('createdAt')`
  Firestore'da kompozit indeks talab qiladi, bitta foydalanuvchining
  buyurtmalari esa oz — indekssiz ishlaydi.
- `js/pages/order.js` ikkita marshrutga xizmat qiladi: `#/orders`
  (ro'yxat) va `#/order/:id` (treking). Trekingda: 7 bosqichli stepper
  vaqt shtamplari bilan, kafolat taymeri (har soniyada sanaydi, muddat
  o'tsa "Kafolat muddati o'tdi"), kuryer bloki (ism, telefon,
  qo'ng'iroq), xaritada kuryer markeri, buyurtma tarkibi va narx,
  "Takrorlash", yetkazilgach baholash oynasi (taom va kuryer alohida,
  1–5 yulduz, matnli izoh).
- `js/pages/profile.js`: foydalanuvchi kartochkasi (ism va tug'ilgan
  kunni tahrirlash), bonus balansi + daraja + bonus tarixi oynasi,
  oxirgi 3 buyurtma, manzillar/tarix/til/mavzu sozlamalari, chiqish.
  Bonus va daraja Firestore'dan qayta o'qiladi — client ularni yoza
  olmaydi (Security Rules).
- Xarita skripti trekingda ham DANGASA: `address.js` dagi `loadYmaps()`
  qayta ishlatiladi, xarita yuklanmasa faqat xarita bloki o'rniga
  ogohlantirish chiqadi, sahifaning qolgani ishlayveradi.
- **Buyurtmani bekor qilish** tugmasi bor, lekin u faqat xabar
  ko'rsatadi: client `orders` ga yoza olmaydi, bekor qilish Node servis
  orqali bo'ladi (6-bosqich).
- Baholashda rasm yuklash yo'q — Storage ishlatilmaydi (bepul planda
  mavjud emas). `db.uploadImage()` kontrakti hamon bo'sh turibdi.
- **Tuzatilgan xato (router):** `compile()` da `/` belgisi
  xavfsizlantirilmagani uchun `:id` parametri HECH QACHON mos kelmagan —
  `#/order/ord-1` 404 berardi. Endi yo'l bo'laklarga bo'linib qayta
  ishlanadi. Bu 0-bosqichdan beri turgan xato edi, parametrli marshrut
  birinchi marta shu bosqichda ishlatildi.
- Yana ikkita tuzatish: `map.getZoom()` bo'lmasa ham marker ko'chadi;
  `formatDate()` o'zbekcha oyni "M08" deb chiqarardi (brauzer lokali),
  endi qo'lda yozilgan qisqartmalar — "18 avg".
- `tools/seed-order.html` — treking sahifasini sinash uchun: ilovada
  kirgan foydalanuvchi uchun demo buyurtma yaratadi (uid `localStorage`
  dan o'qiladi), 7 status tugmasi bilan statusni qo'lda haydaydi, kuryer
  tayinlaydi va uni har bosishda manzil tomon ~200 metr suradi
  (`couriers/{id}.location` va `orders/{id}.courierLocation` yangilanadi).
- `sw.js` `VERSION = 'v7'`, `order.js` va `profile.js` app shell'da.
  Profil va buyurtmalar endi haqiqiy sahifalar — stub'lar olib tashlandi.
- Tekshirildi (Chromium 390×844, soxta Firestore va ymaps bilan) — 9 ta
  stsenariy: ro'yxat kartochkasi; treking (stepper 2 bajarilgan + joriy,
  kafolat 19:58 → 19:55 sanadi, kuryer bloki, xarita, summalar);
  `onSnapshot` orqali status `cooking → on_way` o'zgarganda stepper o'zi
  yangilandi; kuryer koordinatasi kelganda marker `[41.32, 69.26] →
  [41.315, 69.272]` ga ko'chdi; `delivered` bo'lgach taymer yo'qolib
  baholash tugmasi chiqdi, 2 ta yulduz qatori bilan baho saqlandi;
  "Takrorlash" savatga 2 mahsulot qo'shib `#/cart` ga o'tdi; profilda
  telefon, bonus 24 000 + "Kumush", bonus tarixi, ism tahriri va
  qorong'i mavzu ishladi; mehmon uchun "Kirish" tugmasi chiqdi.
  Konsolda xato yo'q.

---

## Bosqich 6 — Node servis
Status: **bajarildi (Payme/Click'siz)**

`server/` — Express + Firebase Admin SDK
- `/api/auth/send-otp`, `/verify-otp`
- `/api/orders` — narxni qayta hisoblash
- ~~`/api/payments/payme`, `/click`~~ — keyingi bosqichga qoldirildi
- `/api/orders/:id/status`
- Telegram bot, cron

Izoh:
- `server/` yozildi: Express 4 + Firebase Admin 12, ESM, Node ≥ 20.
  Modullar: `config.js` (env), `firebase.js` (dangasa Admin init),
  `otp.js`, `orders.js`, `telegram.js`, `cron.js`, `geo.js`,
  `middleware.js` va `index.js`.
- **To'lov:** Payme/Click YOZILMADI — keyingi bosqichga qoldirildi.
  Ruxsat etilgan usullar `PAYMENT_METHODS = ['cash', 'card']`
  (naqd va kuryerdagi karta), ikkalasi ham buyurtmada faqat belgi:
  `paymentStatus` doim `unpaid`, pul oqimi bilan servis ishlamaydi.
  `js/config.js` dagi `APP.paymentMethods` ham shu ikkitaga qisqardi.
- **Maxfiy kalitlar kodda yo'q.** Hammasi `process.env` dan o'qiladi,
  namuna `server/.env.example` da. Firebase private key `\n` bilan
  yoziladi va kodda tiklanadi. `checkConfig()` yetishmayotganini
  ro'yxat qilib beradi, lekin process yiqilmaydi — `/api/health`
  javob berib, sababni ko'rsatib turadi.
- **Buyurtma yakunlash** (SPEC 4.1): narx `menu/current` dan qayta
  hisoblanadi (client narxi butunlay e'tiborga olinmaydi), filial
  `priceOverrides` va `stopList` qo'llanadi, faqat mahsulotda ro'yxatga
  olingan qo'shimchalar qabul qilinadi, zona `pointInPolygon` bilan
  topiladi, minimal summa tekshiriladi, promokod (muddat, limit, per-user,
  filial, birinchi buyurtma) va bonus serverda hisoblanadi,
  `orderNumber` esa `counters/orderNumber` ustida transaction bilan
  beriladi. Buyurtma, bonus yechilishi va promo hisoblagichi bitta
  batch'da yoziladi.
- **OTP:** kod Firestore'da (`otps/{phone}`) SHA-256 xesh ko'rinishida
  saqlanadi — xotirada emas, chunki Render uyqusida process qayta
  ishga tushadi. Qayta yuborish taymeri, soatlik limit va urinishlar
  chegarasi bor. SMS provayderi `console` yoki `eskiz`. Tekshiruvdan
  keyin telefon bo'yicha barqaror uid topiladi va custom token beriladi.
- **Cron:** kafolat (har daqiqa), bonus kuydirish (har soat), kunlik
  hisobot. Hammasi holat bayroqlariga tayanadi (`guaranteeClosed`,
  `expired`), shuning uchun uyqu tufayli o'tkazib yuborilgan yugurish
  keyin topib bajariladi; servis uyg'onganda `runCatchUp()` darhol bir
  marta ishlaydi. `POST /api/jobs/:name` bilan admin qo'lda ham
  yugurtira oladi.
- Firestore'da `null` timestamp'dan oldin turishi kafolat va bonus
  so'rovlarida quyi chegara talab qildi — busiz `guaranteeDeadline:
  null` bo'lgan rejalashtirilgan buyurtmalar "kafolat buzildi" deb
  belgilanib ketardi.
- **Render bepul plani:** `/api/health` yengil (Firestore faqat
  `?deep=1` bilan), `trust proxy` yoqilgan, SIGTERM ushlanadi.
  Frontend tomonda `js/api.js` da kutish chegarasi 60 sek, 4 sekdan
  keyin "server uyg'onmoqda" yoziladi, savat/checkout/kirish yo'liga
  o'tilganda servis fonda uyg'otiladi (`wakeUp()`).
- **Frontend ulandi:** `AUTH_MODE = 'production'`, yangi `js/api.js`
  (barcha `fetch` faqat shu yerda, `API_BASE` config.js dan),
  `auth.js` endi shu qatlamdan foydalanadi va servis bergan
  `resendAfter` taymerini qo'llaydi, checkout esa `POST /api/orders`
  ga yuboradi: muvaffaqiyatda savat tozalanadi va `#/order/:id` ga
  o'tiladi, xatoda savat saqlanib qoladi va sabab aytiladi.
  Servis qaytargan narx client hisobidan farq qilsa ogohlantiriladi.
- `sw.js` `VERSION = 'v8'`, `js/api.js` app shell'da.
- README.md yozildi: Render sozlamalari (Root Directory `server`,
  build/start buyruqlari, health check yo'li), majburiy va ixtiyoriy
  env o'zgaruvchilar jadvali, kerakli Firestore composite indekslari,
  uyqu bilan ishlash va tashqi ping tavsiyasi.
- Tekshirildi:
  - `server`: `npm test` — 10 ta test (narx qayta hisoblanishi, filial
    `priceOverrides`, qo'shimcha narxi, stop-list, nofaol mahsulot,
    noma'lum variant/qo'shimcha, miqdor chegaralari, olib tashlanadigan
    ingredient filtri, polygon obyekt formati, `findZone` filial
    afzalligi, telefon normallashtirish) — hammasi o'tdi.
  - servis Firebase kalitlarisiz ko'tarildi: `/api/health` `problems`
    ro'yxatini qaytardi, tokensiz `POST /api/orders` → 401, noto'g'ri
    telefon → `invalid-phone`, noma'lum yo'l → 404.
  - Chromium 390×844 (soxta Firestore, soxta Firebase auth, `page.route`
    bilan to'xtatilgan API): to'lov ro'yxatida faqat "Naqd" va
    "Kuryerda karta"; buyurtma `Bearer` tokeni bilan yuborildi, savat
    va draft tozalandi, `#/order/ord-1` ga o'tdi; `out-of-zone`,
    `stop-list`, `min-order` xatolarida to'g'ri xabar chiqib savat
    saqlanib qoldi; 6 soniya kechikkan javobda tugma bloklandi va
    "Server uyg'onmoqda" ko'rindi; narx farqi ogohlantirildi;
    OTP production yo'li ishladi (telefon normallashdi, servis bergan
    30 sek taymer qo'llandi, custom token bilan kirildi). Konsolda
    xato yo'q (faqat sandboxda bloklangan Yandex Maps skripti).

---

## Bosqich 7 — admin va KDS
Status: boshlanmagan

`admin/` — alohida PWA
- Buyurtmalar oqimi, KDS, menyu CRUD, filial CRUD, promokod, hisobot

Izoh:

---

## Bosqich 8 — Security Rules
Status: boshlanmagan

`firestore.rules` — SPEC.md 3-bo'lim bo'yicha

Izoh:
