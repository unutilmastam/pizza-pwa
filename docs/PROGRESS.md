# Loyiha holati

> Har seans boshida shu faylni o'qi. Faqat "Joriy bosqich" deb belgilangan
> ishni bajar. Boshqa bosqichlarga o'tma. Tugagach shu faylni yangila.

**Joriy bosqich: 9**

> SPEC.md dagi 0–8 bosqichlar yakunlandi. Ishga tushirish tartibi
> README.md da: Render'ga servis, GitHub Pages'ga ilova, so'ng
> birinchi superadmin va FAQAT SHUNDAN KEYIN Firestore qoidalari.

> Qoldirilgan ishlar:
> 1. Payme/Click to'lov integratsiyasi (SPEC 4.2) — foydalanuvchi qarori
>    bilan keyinga surildi. Qo'shilganda `server/src/orders.js` dagi
>    `PAYMENT_METHODS`, `js/config.js` dagi `APP.paymentMethods` va
>    webhook yo'llari birga kengaytiriladi.
> 2. Admin panelning qolgan bo'limlari (SPEC 116–121): banner CRUD,
>    mijozlar bazasi va qora ro'yxat, broadcast, sozlamalar, audit log.

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
Status: **bajarildi**

`admin/` — alohida PWA
- Buyurtmalar oqimi, KDS, menyu CRUD, filial CRUD, promokod, hisobot

Izoh:
- `admin/` alohida PWA sifatida yozildi: o'z `index.html`, `manifest.json`,
  `sw.js` va `css/admin.css`. GitHub Pages'da `/pizza-pwa/admin/`.
  Desktop-birinchi (xodim kompyuterda ishlaydi), 900px dan pastda chap
  menyu siljib chiqadigan panelga aylanadi.
- **Kirish va rollar (SPEC 104):** OTP mijoz ilovasidagi bilan bir xil
  yo'ldan ketadi, keyin `staff/{uid}` tekshiriladi — hujjat yo'q yoki
  `active: false` bo'lsa sessiya darhol yopiladi. Rollar:
  `superadmin`/`manager` — hammasi, `operator` — boshqaruv/buyurtma/KDS,
  `kitchen` — faqat KDS, `courier` — panelga kirolmaydi.
  Bu tekshiruv INTERFEYSNI yopadi; haqiqiy himoya 8-bosqichdagi
  Firestore qoidalari bilan qo'yiladi.
- **Servisda rol tekshiruvi:** `requireStaff(roles)` qo'shildi —
  `staff/{uid}` hujjatidan rol o'qiydi. `ADMIN_UIDS` bootstrap yo'li
  bo'lib qoladi (`staff` bo'sh bo'lganda ham servisni boshqarish uchun).
  Yangi yo'l: `PATCH /api/orders/:id/courier` (SPEC 110), status yo'li
  esa endi `reason` (SPEC 107) va `etaMinutes` (SPEC 108) qabul qiladi —
  tayyorlanish vaqti kafolat muddatini ham suradi.
- **Buyurtmalar oqimi (SPEC 106):** `onSnapshot` bilan real vaqt, yangi
  buyurtmada ovoz signali (WebAudio bilan generatsiya qilinadi — audio
  fayl yuklanmaydi), status filtri, kutish vaqti va kafolat kechikishi
  belgisi. Har bir amal servis orqali ketadi: client `orders` ga yoza
  olmaydi.
- **KDS (SPEC 109):** kartochka + har soniyada sanaydigan taymer +
  "Tayyor". Taymer butun ro'yxatni qayta chizmaydi, faqat matnni
  yangilaydi — aks holda tugmalar har soniyada "sakrardi".
- **Menyu CRUD (SPEC 111):** `menu/current` BITTA hujjat bo'lgani uchun
  tahrirlash xotirada to'planadi va "Chop etish" bosilganda bir marta
  yoziladi (aks holda mijozlar yarim tayyor menyuni ko'rardi), versiya
  avtomatik oshadi. Rasm YUKLANMAYDI — Storage bepul planda yo'q,
  shuning uchun rasm manzillari qo'lda kiritiladi.
- **Filial CRUD (SPEC 112–114):** filial, zona polygonlari va stop-list.
  Polygon `lat, lng` qatorlari ko'rinishida tahrirlanadi va saqlashdan
  oldin `[{lat, lng}]` ga aylantiriladi; 3 tadan kam yoki buzuq nuqta
  bo'lsa saqlanmaydi va sabab aytiladi.
- **Promokod CRUD (SPEC 115):** hujjat ID = kodning o'zi (servis shunday
  o'qiydi), shuning uchun kod yaratilgandan keyin o'zgartirilmaydi.
  Yangi kod yaratishda takrorlanish tekshiriladi.
- **Hisobot (SPEC 118):** `reports/{YYYY-MM-DD}` (cron yozadi) va bugungi
  kun jonli hisoblanadi. Diagramma Chart.js O'RNIGA inline SVG bilan
  chizildi — CDN qo'shimcha ishlamay qolish nuqtasi bo'lardi, kerak
  bo'lgani esa oddiy ustunlar.
- **Keshlash:** `admin/sw.js` TARMOQ BIRINCHI (xodim eski kod bilan
  ishlab qolmasin), ildizdagi `sw.js` esa `/admin/` yo'lini chetlab
  o'tadi — uning scope'i kengroq bo'lgani uchun admin fayllarini
  "stale-while-revalidate" bilan keshlab qo'yishi mumkin edi.
  Ildizdagi `VERSION = 'v10'`.
- `tools/seed-staff.html` yozildi: joriy uid ga rol beradi (standart
  `superadmin`). uid Firebase sessiyasidan olinadi, sessiya bo'lmasa
  `localStorage` dan; qo'lda ham kiritish mumkin. Mavjud rolni o'qiydi,
  yozishdan oldin tasdiq so'raydi, `permission-denied` bo'lsa sababini
  aytadi.
- Bir HAQIQIY bug topildi va tuzatildi: `.boot`/`.admin` uslublaridagi
  `display: grid` brauzerning `[hidden] { display: none }` qoidasini
  bosib ketardi — yashirilgan yuklanish qatlami ekranni to'sib turardi
  va bosishlar unga tushardi. `[hidden] { display: none !important }`
  qo'shildi.
- Tekshirildi (Chromium 1280×900, soxta Firestore va soxta auth,
  `page.route` bilan to'xtatilgan API) — 45 ta tekshiruv o'tdi:
  sessiyasiz kirish ekrani → OTP → panel; rol bo'yicha bo'limlar
  (superadmin 7 ta, kitchen 1 ta va to'g'ridan-to'g'ri KDS ga tushdi,
  kuryer/o'chirilgan xodim/staff hujjatisiz — kirolmadi); dashboard
  ko'rsatkichlari; oqimda faqat faol buyurtmalar, yangisi ajratilgan,
  nomlar `[object Object]` emas; qabul qilishda `etaMinutes: 40`,
  rad etishda sabab yuborildi; kuryer ro'yxatida faqat smenadagi;
  KDS taymeri sanadi va keyingi bosqich yuborildi; menyuda yangi
  mahsulot qo'shilib versiya 7→8 bo'lib yozildi, narxsiz mahsulot rad
  etildi; polygon obyekt formatida saqlandi, kam nuqtali rad etildi;
  promokod katta harfga o'tdi, takrori rad etildi; hisobot jadvali,
  diagrammasi va bugungi jonli qatori; oqim xatosi ekranda ko'rindi.
  Konsolda xato yo'q.
- Bu bosqichda YOZILMAGANI (SPEC 116–121, keyingi bosqichlarga):
  banner CRUD, mijozlar bazasi va qora ro'yxat, broadcast xabar,
  sozlamalar ekrani, audit log. Kuryer ilovasi (SPEC 122–128) ham
  alohida — admin panelda kuryer uchun bo'lim yo'q.

---

## Bosqich 8 — Security Rules
Status: **bajarildi**

`firestore.rules` — SPEC.md 3-bo'lim bo'yicha

Izoh:
- `firestore.rules` yozildi. Node servis Admin SDK orqali ishlaydi va
  qoidalarni BUTUNLAY chetlab o'tadi — cheklovlar faqat brauzerdagi
  ikki ilovaga tegishli.
- **Ochiq o'qish:** `menu`, `branches`, `banners`, `settings` — mehmon
  ham ko'radi (kirmasdan menyuni ko'rish SPEC talabi). Yozish:
  `superadmin`/`manager`, `settings` esa faqat `superadmin`.
- **Foydalanuvchi:** o'z hujjatini o'qiydi va faqat `name`, `phone`,
  `lang`, `birthday`, `lastLoginAt` maydonlarini yozadi. `bonusBalance`,
  `tier`, `totalSpent`, `blocked`, `referralCode`, `referredBy`,
  `telegramId` — YARATISHDA HAM, yangilashda ham rad etiladi.
  Manzillar to'liq o'ziniki, bonus tarixi faqat o'qiladi.
- **Buyurtma:** mijoz faqat o'zinikini o'qiydi (client `where('uid','==')`
  bilan so'raydi, shu sababli ro'yxat so'rovi ham o'tadi). Yaratish —
  hech kimga. Yangilash — YAGONA istisno: o'z buyurtmasiga `rating`,
  va u ham faqat `status == 'delivered'` bo'lganda va boshqa maydonga
  tegmasa. Admin panel ham buyurtmani bevosita o'zgartira olmaydi —
  status va kuryer Node servis orqali yoziladi.
- **Yopiq joylar:** `promocodes` ni client o'qiy olmaydi (aks holda
  barchasini ko'chirib olish mumkin edi); `otps` (OTP kod xeshlari),
  `counters`, `idempotency` butunlay yopiq; ro'yxatda yo'q har qanday
  yo'l — rad etiladi.
- **Kuryer:** kirgan foydalanuvchi kuryer hujjatini o'qiy oladi (treking
  sahifasi jonli koordinatani shundan oladi), kuryer esa faqat o'z
  `location`/`onShift`/`activeOrders` maydonlarini yozadi.
- **Birinchi superadmin muammosi:** qoidalar yoqilgach `staff` ga faqat
  superadmin yoza oladi, lekin birinchi superadmin hali yo'q bo'lsa
  hech kim yoza olmaydi. Yechim — `isBootstrapAdmin()` funksiyasi:
  ro'yxatga o'z uid'ingizni yozib qoidalarni chop etasiz, rolni
  berasiz, so'ng ro'yxatni bo'shatasiz. Bu teshik FAQAT `staff` ga
  ochiladi — test bilan tasdiqlangan.
- `tools/` vositalari qoidalardan keyin ishlamay qoladi (ular oddiy
  foydalanuvchi nomidan `menu`/`branches` ga yozadi) — bu kutilgan
  holat, endi ular admin panelidan boshqariladi.
- Tekshirildi — HAQIQIY Firestore emulyatorida (`rules-test/`,
  `@firebase/rules-unit-testing`), 48 ta test o'tdi:
  - mijoz: mehmon menyu/filial/banner/sozlamalarni o'qidi va ularni
    o'zgartira olmadi; o'z profilini o'qidi va tahrirladi, boshqanikini
    o'qiy olmadi; bonus/tier/totalSpent/blocked ni yoza olmadi (yangi
    hujjat yaratishda ham); manzillar CRUD ishladi; bonus tarixiga yoza
    olmadi; `where('uid','==',me)` so'rovi o'tdi, filtrsiz va begona
    uid bilan so'rov rad etildi; buyurtma yarata olmadi va o'chira
    olmadi; yetkazilgan buyurtmaga baho qo'ya oldi, lekin baho bahonasida
    narx/statusni o'zgartira olmadi va yetkazilmaganiga baho qo'yolmadi;
    kuryer joylashuvini kuzata oldi; promokod, otps, counters,
    idempotency, reports va noma'lum kolleksiyalar yopiq chiqdi;
    o'zini staff qilib qo'yolmadi;
  - admin: har bir xodim o'z rolini o'qidi (kirish shunga bog'liq),
    superadmin boshqalarnikini ham; staff ni faqat superadmin yozdi;
    buyurtmalar oqimi (uid filtrisiz, `orderBy` bilan) to'rt rol uchun
    ham ochildi; menyu/filial/promokodni superadmin va manager
    boshqardi, operator va oshxona qila olmadi; hisobotni faqat
    superadmin/manager o'qidi va hech kim yoza olmadi; O'CHIRILGAN
    xodim (`active: false`) hech narsa qila olmadi;
  - bootstrap: ro'yxatdagi uid birinchi superadminni yaratdi,
    ro'yxatda yo'q uid yarata olmadi, ro'yxatdagi uid esa `staff` dan
    tashqari joyga (settings, menu, orders) tegolmadi.
- README.md ga qo'shildi: kim nima qila olishi jadvali, Firebase
  konsolidan qo'lda joylashtirish tartibi, "avval superadmin, keyin
  qoidalar" ogohlantirishi, bootstrap yo'li va `rules-test` ni
  yugurtirish.

---

## Bosqich 9 — kuryer ilovasi
Status: **bajarildi**

`courier/` — alohida PWA (SPEC 122–128)

- Kirish: telefon + OTP, faqat `couriers` da ro'yxatdan o'tgan raqamlar
- Smena ochish / yopish
- Tayinlangan buyurtmalar ro'yxati
- "Oldim" → "Yo'ldaman" → "Yetkazdim"
- Yandex Navigator'ga o'tish (deep link)
- Naqd pul olindi belgisi
- Geolokatsiya har 15 sek Firestore'ga
- Kunlik hisob

Admin panelga **"Kuryerlar" bo'limi** (CRUD) qo'shiladi — kuryerlarni
shu yerdan qo'shiladi, aks holda ilovaga kirish uchun hujjat bo'lmaydi.

### AVVAL HAL QILINADIGAN TO'SIQLAR

Bular taxmin emas — joriy koddan tekshirilgan. Ilova yozilishidan
oldin ular ochilmasa, kuryer hech narsa ko'ra olmaydi:

1. **Kuryer buyurtmalarni O'QIY OLMAYDI.** `firestore.rules` dagi
   `isOrderStaff()` = `['superadmin','manager','operator','kitchen']` —
   `courier` ro'yxatda YO'Q, `orders` read qoidasi esa faqat shu
   funksiyaga va `resource.data.uid == auth.uid` ga tayanadi.
   Yechim: kuryerga FAQAT o'ziga tayinlangan buyurtmani ochish
   (`resource.data.courierId == request.auth.uid`), hammasini emas.
   Qoida o'zgargach `rules-test/` ga test qo'shilsin.

2. **Kuryer statusni o'zgartira olmaydi.** `server/index.js` dagi
   `ORDER_ROLES` ham `courier` ni o'z ichiga olmaydi, shuning uchun
   `PATCH /api/orders/:id/status` 403 qaytaradi.
   Yechim: kuryer uchun alohida yo'l (`/api/orders/:id/courier-status`)
   yoki `requireStaff(['courier'])` bilan cheklangan, faqat
   `on_way`/`delivered` ga ruxsat beruvchi tekshiruv. Kuryer o'ziga
   tayinlanmagan buyurtmaga tegmasligi serverda tekshirilsin.

3. **`couriers/{id}` hujjat ID si qaysi?** Hozir admin `getCouriers()`
   hujjat ID sini kuryer identifikatori deb oladi, `firestore.rules`
   esa `isOwner(courierId)` — ya'ni ID Firebase `uid` bo'lishi kutiladi.
   Lekin admin kuryerni qo'shayotganda uning `uid` si hali YO'Q
   (u birinchi marta kirgandan keyin paydo bo'ladi).
   Ikki yo'ldan biri tanlansin va yozib qo'yilsin:
   - (a) hujjat ID = `uid`: admin faqat telefon yozadi, kuryer birinchi
     marta kirganda servis `couriers/{uid}` hujjatini telefon bo'yicha
     topib ko'chiradi;
   - (b) hujjat ID = telefon: unda `firestore.rules` dagi
     `isOwner(courierId)` ishlamaydi — egalikni boshqacha tekshirish
     kerak bo'ladi.
   `assignCourier()` buyurtmaga `courierId` ni shu ID dan yozadi,
   shuning uchun tanlov 1- va 2-bandga ham ta'sir qiladi.

### BOSHQA MUHIM JIHATLAR

- **SW scope.** Ildizdagi `sw.js` scope'i `/pizza-pwa/` — u `/courier/`
  ni ham qamrab oladi va uning "keshdan ber, fonda yangila"
  strategiyasi kuryerni eski kod bilan qoldirishi mumkin. `admin/` da
  bu allaqachon yechilgan: `sw.js` da `url.pathname.includes('/admin/')`
  chetlab o'tiladi va `admin/sw.js` TARMOQ BIRINCHI ishlaydi.
  `courier/` uchun AYNAN shu ikki qadam takrorlansin.
- **Geolokatsiya har 15 sek** — bu kuniga ~2000 yozuv (8 soatlik smena,
  bitta kuryer). Bepul Firestore kvotasi 20 000 yozuv/kun, shuning
  uchun 8–10 kuryerda kvota tugaydi. Kamaytirish yo'llari: faqat
  smena ochiq bo'lganda yozish, koordinata sezilarli o'zgarganda
  (masalan 50 metrdan ortiq) yozish, ilova fonda bo'lganda to'xtatish.
  Rejani tanlab, PROGRESS ga yozib qo'yish kerak.
- **Batareya va ruxsat.** `watchPosition` ni `enableHighAccuracy` bilan
  ishlatish batareyani tez yeydi. Ruxsat berilmasa yoki bekor qilinsa
  ilova buzilmasin — smena ochilaveradi, faqat ogohlantirish chiqsin.
- **Yandex Navigator deep link** — `yandexnavi://build_route_on_map?lat_to=..&lon_to=..`.
  Ilova o'rnatilmagan bo'lsa hech narsa bo'lmaydi, shuning uchun
  zaxira sifatida `https://yandex.uz/maps/?rtext=~lat,lon` havolasi
  ham berilsin.
- **Naqd pul belgisi** buyurtmada saqlanadi (masalan `cashCollected`)
  va uni ham servis yozadi — client `orders` ga yoza olmaydi.
- **Kunlik hisob** kuryerning bugungi yetkazilgan buyurtmalaridan
  hisoblanadi: soni, yetkazish narxi yig'indisi, olingan naqd pul.
- Kuryer `staff` da ham bo'lishi mumkin (`role: 'courier'`), lekin
  `admin/js/config.js` dagi `ROLE_SECTIONS.courier = []` — u admin
  panelga kira olmaydi va bu shundayligicha qoladi.

Izoh:

**QABUL QILINGAN QARORLAR** (uchala to'siq shu bilan yopildi):

1. **Hujjat ID = `uid`** (yuqoridagi (a) yo'li). Admin kuryer
   qo'shganda `couriers/pending_<telefon raqamlari>` hujjati
   yaratiladi. Kuryer birinchi marta kirganda
   `POST /api/courier/claim` uni topib `couriers/{uid}` ga
   KO'CHIRADI va `pending_` hujjatini o'chiradi (bitta `batch`).
   Shundan keyin `firestore.rules` dagi `isOwner(courierId)` ishlaydi.
   `pending_` kuryerga buyurtma tayinlab bo'lmaydi — `assignCourier()`
   409 `courier-pending` qaytaradi, admin panelning tayinlash
   ro'yxatida ham u ko'rinmaydi.
2. **Geolokatsiya yozuvi UCHALA shart birga bajarilgandagina:**
   smena ochiq; oxirgi YOZILGAN nuqtadan 50 metrdan ortiq siljigan;
   ilova old planda (`visibilitychange` bilan to'xtaydi). Qo'shimcha
   shart: kuryerda `on_way` statusidagi buyurtma bo'lishi kerak.
   Taymer har 15 sekundda TEKSHIRADI, lekin yozuv shartlarsiz
   bo'lmaydi — kvota shu bilan saqlanadi (kuryer to'xtab turganda,
   fonda yoki bo'sh yurganda yozuv umuman ketmaydi).
3. **`courier` roli qoidalarga qo'shildi:** `orders` read — `isMyDelivery()`
   (`resource.data.courierId == request.auth.uid`); status o'zgartirish
   faqat servis orqali, faqat o'ziga tayinlanganini va faqat `on_way` /
   `delivered` ga.

Bajarilgani:

- **Servis** (`server/src/couriers.js` + `server/index.js` da 3 yo'l):
  - `POST /api/courier/claim` — `couriers/{uid}` ni topadi yoki
    `pending_` dan ko'chiradi; ikkalasi ham yo'q bo'lsa 403
    `not-courier`, `active: false` bo'lsa 403 `courier-disabled`.
  - `PATCH /api/orders/:id/courier-status` — egalikni
    (`order.courierId === uid`) va statusni (`on_way`/`delivered`)
    SERVERDA tekshiradi; `delivered` da `courierClosedAt` va naqd
    buyurtmada `cashCollected` yoziladi, buyurtma kuryerning
    `activeOrders` ro'yxatidan `arrayRemove` bilan chiqadi.
  - `GET /api/courier/report` — kunlik hisob (`summarizeOrders()` sof
    funksiyasi). Sana MAHALLIY hisoblanadi: `toISOString()` UTC ga
    o'tkazib Toshkent vaqtida kunni bir kun orqaga surar edi.
  - `assignCourier()` endi `pending_` kuryerni rad etadi (409).
- **Qoidalar** (`firestore.rules`): `isMyDelivery()` qo'shildi, `orders`
  read shunga kengaytirildi; `couriers` update maydonlari ro'yxatiga
  `shiftStartedAt`/`shiftEndedAt` qo'shildi. `rules-test/` ga 8 ta
  yangi test — jami **56 ta test o'tdi** (haqiqiy emulyatorda).
- **Kuryer PWA** (`courier/`, 13 fayl): o'z `manifest.json` va `sw.js`
  (TARMOQ BIRINCHI — xodim eski kod bilan qolmasin), ildizdagi `sw.js`
  endi `/courier/` ni ham chetlab o'tadi (VERSION `v12`). Router yo'q —
  ikki tab (buyurtmalar, hisob). Mobil uchun: 56px teginish maydonlari,
  `[hidden] { display: none !important; }`.
  - `courier/js/geo.js` — yuqoridagi 2-qaror shu yerda; `distanceMeters()`
    haversine, oxirgi nuqta `localStorage` da (ilova qayta ochilganda
    yaqin joydan yana yozib yubormaslik uchun).
  - `courier/js/db.js` — barcha bir martalik o'qish `withTimeout()`
    ichida (Firestore SDK o'z chegarasini qo'ymaydi; mijoz ilovasidagi
    "skeletonda muzlab qolish" shundan edi).
  - Navigator: `yandexnavi://` deep link, 1200 ms dan keyin sahifa
    hamon ko'rinib tursa `https://yandex.uz/maps/?rtext=~lat,lng`.
- **Admin panel** — "Kuryerlar" bo'limi (`admin/js/pages/couriers.js`):
  CRUD, kutilayotganlar ro'yxat tepasida "kirishi kutilmoqda" belgisi
  bilan, kirgan kuryerda telefon QULFLANGAN (u hujjat ID sining
  asosi), faol buyurtmali kuryer o'chirilmaydi. Bo'lim
  superadmin/manager/operator uchun ochiq (buyurtmani operator
  tayinlaydi).
- Tekshirildi — brauzerda, HAQIQIY kod ustida (Firestore SDK va Node
  servis soxta):
  - kuryer ilovasi, 13 guruh: OTP → `claim`; kuryer bo'lmagan raqam
    kira olmadi; faqat o'ziga tayinlangan 2 buyurtma ko'rindi (boshqa
    kuryerniki ham, yetkazilgani ham chiqmadi); "Oldim" `on_way`
    yubordi; naqd buyurtmada pul so'raldi va "yo'q" da so'rov ketmadi,
    "ha" da `cashCollected: true` ketdi; kartada pul oynasi chiqmadi;
    smena ochildi/yopildi va faol buyurtma bilan yopilmadi;
    **geolokatsiya**: smena yopiq — yozuv yo'q, uchala shart
    bajarilganda 1 yozuv, 50 m dan kam siljishda yozilmadi, ortiq
    siljishda yozildi, fonda yozilmadi, yo'lda buyurtma qolmaganda
    yozilmadi; masofa hisobi (0 / ~50 m / ~1 km) to'g'ri; kunlik
    hisob 6 ko'rsatkich bilan chiqdi; servis xatosi toast bilan
    ko'rsatildi va tugma qayta faollashdi; admin `active: false`
    qilganda sessiya yopildi; tab almashuvida obuna oqmadi;
  - admin "Kuryerlar", 9 guruh: bo'lim menyuda (superadmin va
    operator ko'rdi, oshxona ko'rmadi); kutilayotgan tepada; yangi
    kuryer `pending_998903334455` ID bilan yozildi; ismsiz, noto'g'ri
    va takror raqam saqlanmadi; kirgan kuryerda telefon `readonly` va
    yozuv `uid` ID ga ketdi; kutilayotganda telefon tahrirlandi; faol
    buyurtmali kuryer o'chirilmadi, bo'shi o'chdi; tayinlash
    ro'yxatida kutilayotgan va smenadan tashqaridagi chiqmadi;
    ruscha tilda kalitlar qolib ketmadi;
  - `server/npm test` — **30 ta test o'tdi** (7 tasi yangi: `pendingId`,
    ruxsat etilgan statuslar, hisob yig'indisi).
- README.md ga "Kuryer ilovasi" bo'limi qo'shildi.

### TASHQI KO'RIKDAN KEYINGI TUZATISHLAR

Ko'rikda 5 ta muammo topildi, hammasi yopildi.

1. **Kuryerlar ro'yxati hammaga ochiq edi (JIDDIY).** `couriers` read
   `signedIn()` edi — har qanday kirgan mijoz barcha kuryerlarning
   ismi, telefoni va jonli koordinatasini o'qiy olardi.
   Yechim: koordinata **`courierLocations/{uid}`** ga chiqarildi, unda
   faqat `{lat, lng, at}` bor (`hasOnly` bilan majburlangan — ism yoki
   telefonni u yerga "yashirib" qo'yish yo'li yopiq). `couriers` read
   endi faqat egasi va `superadmin`/`manager`/`operator`. Mijoz
   trekingi kuryerning ismi va telefonini buyurtma hujjatidan oladi
   (`courierName`, `courierPhone` — ularni `assignCourier()` ko'chiradi).
   `couriers` update ro'yxatidan `location` olib tashlandi.
   > Eski `couriers` hujjatlarida qolgan `location` maydoni endi
   > o'qilmaydi va yangilanmaydi — u zararsiz, xohlasa qo'lda tozalanadi.
2. **Manager har qanday mijozning bonusini yoza olardi.** `users`
   update qoidasida qavs yo'q edi: `&&` `||` dan kuchli bo'lgani uchun
   xodim sharti egasining maydon cheklovini butunlay chetlab o'tardi.
   Yechim: qavslar qo'yildi va xodimga ham cheklov berildi — u faqat
   `blocked`, `notes`, `updatedAt` ni o'zgartiradi. `bonusBalance`,
   `tier`, `totalSpent` endi HECH KIMGA ochiq emas, faqat servis.
3. **`/api/health?deep=1` ochiq edi** — autentifikatsiyasiz Firestore'ga
   so'rov yuborardi va `clientEmail` ni qaytarardi. Endi `deepOnly()`
   yordamchisi bilan `requireAuth` + `requireAdmin` ostida. Oddiy
   `/api/health` ochiq qoldi — uni Render uyqusiga qarshi tashqi ping
   xizmati chaqiradi.
4. **Buyurtma raqamida bo'shliq.** Raqam alohida transaction'da
   olinardi, buyurtma esa keyin `batch` bilan yozilardi — batch yiqilsa
   raqam sarflanib ketardi (№17, keyin №19). Endi hisoblagich ham,
   buyurtma ham, bonus yechilishi ham, promo hisoblagichi ham BITTA
   `runTransaction` ichida.
5. **`SMS_PROVIDER=console`** — kodga tegilmadi (Render sozlamasi),
   README ga ogohlantirish qo'shildi: bu rejimda kod faqat logga
   yoziladi va mijoz ilovaga kira olmaydi.

Tuzatishlardan keyin qayta tekshirildi:
- `rules-test` — **63/63** (7 tasi yangi: mijoz `couriers` ni o'qiy
  olmasligi, joylashuv hujjatiga ortiqcha maydon yozib bo'lmasligi,
  xodim mijoz pul maydonlarini yoza olmasligi va h.k.);
- `server/npm test` — **35/35** (5 tasi yangi: yozuv yiqilganda raqam
  sarflanmasligi);
- brauzerda mijoz trekingi, 4 guruh: kuryer ismi/telefoni buyurtmadan
  chiqdi, `couriers` kolleksiyasiga UMUMAN tegilmadi (o'qishlar
  ro'yxati bilan tasdiqlandi), koordinata `courierLocations` dan real
  vaqtda ko'chdi, sahifadan chiqilganda obuna uzildi;
- kuryer ilovasi 13 guruh va admin "Kuryerlar" 9 guruh — qaytadan
  o'tdi, geolokatsiya endi `courierLocations` ga yozilishi va
  hujjatda faqat uch maydon bo'lishi alohida tekshirildi;
- `/api/health` 200, `?deep=1` tokensiz va soxta token bilan 401.

### TEZLIK — 2-TUZATISH (o'lchov bilan)

Sekinlik uchala ilovada qaytdi: "bo'limga o'tsam yuklanish belgisi
turib qoladi, sahifani tortib yangilagandan keyin ochiladi".

Taxmin qilinmadi — **o'lchandi**. Sekin tarmoq taqlid qilindi (har
HTTP so'rovga +1.5 s, Firestore amali 1.2 s, birinchi ulanish +1.8 s)
va uchala ilovada boot sharsharasi hamda sahifa o'tishlari profil
qilindi (`scratchpad/prof/`, haqiqiy kod ustida — soxta faqat
Firebase SDK va Node servis).

**Topilgan sabablar** (foydalanuvchi taxminlariga javob bilan):

1. **Modul grafigi chuqurligi — ASOSIY SABAB.** ES importlar
   daraja-daraja yuklanadi. Admin zanjiri OLTI daraja edi:
   `index.html → app.js → (router, config, i18n, ui, auth, api, db)
   → ../../js/config.js → gstatic SDK → getDoc(staff)`.
   Har daraja bir RTT. Sub-ilovalarning `config.js` i mijoznikidan
   re-eksport qilgani butun bir qo'shimcha daraja qo'shgan.
2. **Firebase SDK gstatic'dan, kritik yo'lda** (1-taxmin — TASDIQLANDI):
   zanjirning 5-darajasida turgan va SW uni keshlay olmaydi.
3. **Admin/kuryer karkasi tarmoq o'qishini kutgan:** admin
   `getDoc(staff)` ni 3 s, kuryer `POST /api/courier/claim` ni 1.5 s
   (Render uyquda bo'lsa 50 s gacha) kutib bo'sh ekran ko'rsatgan.
4. **Admin va kuryerda kesh umuman yo'q edi:** bir seansda
   `menu/current` 4 marta, `branches` 3 marta o'qilgan; kuryerda
   `GET /api/courier/report` har tab almashuvida qayta chaqirilgan.
5. **`onSnapshot` da chegara yo'q edi.** U ulanish yo'qolganda XATO
   BERMAYDI — jim turadi. Uzilish sinovida admin va kuryer 20
   sekunddan keyin ham spinner ko'rsatgan. Aynan shu — foydalanuvchi
   ko'rgan alomat. `admin/js/db.js` da bir martalik o'qishlarda ham
   chegara yo'q edi.
6. **SW "tarmoq birinchi"** (2-taxmin — qisman): har qayta ochilish
   tarmoq tezligiga bog'langan (1.8 s) va uzilganda umuman ochilmagan.
7. **Rasmlar (4-taxmin) — SABAB EMAS.** O'lchov: ular `loading="lazy"`
   bilan, kartochkalar chizilgandan KEYIN (7303→7328 ms) yuklanadi va
   hech nimani to'smaydi.
8. **Render uyqusi (3-taxmin) — mijozda sabab emas** (`wakeUp()` fon
   rejimida), lekin **kuryerda sabab edi** — `claim` kritik yo'lda.

**Tuzatishlar:**

- `js/cache.js` — uchala ilova uchun UMUMIY qatlam: `withTimeout()`,
  `createCache()` (stale-while-revalidate) va `watchGuard()`
  (`onSnapshot` uchun birinchi javob chegarasi; obuna uzilmaydi,
  kechikkan javob baribir ishlatiladi).
- Uchala `index.html` ga `modulepreload` va gstatic uchun
  `preconnect` — grafik yassilandi, zanjir 6 darajadan 2 ga tushdi.
- Admin va kuryer keshga o'tdi; `admin/js/db.js` dagi barcha o'qishlar
  endi chegara bilan.
- Admin karkasi keshdagi rol bilan, kuryer keshdagi hujjat bilan
  DARHOL ochiladi; tekshiruv fonda ketadi. Xavfsiz, chunki rol faqat
  qaysi bo'lim ko'rinishini belgilaydi — huquqni `firestore.rules` va
  servis beradi.
- Kuryer buyurtmalari va kunlik hisobi keshdan darhol chiqadi.
- `admin/sw.js` va `courier/sw.js` — "tarmoq birinchi" saqlandi,
  lekin 2.5 s chegara bilan: yaxshi tarmoqda hech nima o'zgarmadi,
  sekin tarmoqda keshdagi karkas beriladi.
- **Yo'l-yo'lakay topilgan yangi xavf:** `modulepreload` yiqilsa
  brauzer modulni "yiqilgan" deb belgilab qo'yadi va keyingi
  `import()` UMUMAN so'rov yubormaydi — ilova butunlay ochilmaydi.
  Sinovda tasdiqlandi. `importWithRetry()` qo'shildi: yiqilsa
  `?retry=` bilan qayta so'raydi (brauzer uchun boshqa modul).

**Natija (1.5 s/so'rov taqlidida):**

| | sovuq ochilish | issiq (2-ochilish) | takroriy o'tish |
| --- | --- | --- | --- |
| Mijoz | 7373 → **4375 ms** | to'liq boot → **83 ms** | 1300 → **15–35 ms** |
| Admin | 10907 → **6361 ms** | to'liq boot → **1862 ms** | 1300 → **13–17 ms** |
| Kuryer | 9375 → **4853 ms** | to'liq boot → **1843 ms** | 1800 → **30–39 ms** |

Tarmoq uzilishi sinovi: oldin admin va kuryer 20 sekunddan keyin ham
spinner ko'rsatardi — endi uchalasi ham keshdagi ma'lumotni yoki
"qayta urinish" tugmasini beradi. **Cheksiz spinner qolmadi.**

---

## Bosqich 10 — reklama banneri
Status: **bajarildi**

Mijoz ilovasining bosh sahifasida (menyu tepasida) uzun ingichka
reklama karuseli.

Ko'rinish:
- Ekran kengligining 100% (chetlarda kichik padding)
- Balandligi kichik — 16:5 nisbat atrofida, menyuni bosmasin
- Yumaloq burchak, dizayn tizimidagi radius
- Bir vaqtda BITTA rasm

Animatsiya:
- Har 5 sekundda avtomatik almashadi
- Silliq o'tish — fade yoki gorizontal slayd (qaysi biri mobil
  Safari da ravonroq bo'lsa, O'LCHAB tanlanadi)
- Pastda kichik nuqtalar, joriysi ajralib turadi
- Swipe (chapga/o'ngga surish) bilan ham almashadi
- Foydalanuvchi surganda avto-almashish 10 sekundga to'xtaydi
- Bosilganda `banner.link` ga o'tadi (ichki hash yo'l yoki tashqi URL)

Ma'lumot:
- Firestore `banners` kolleksiyasi (SPEC 2-bo'lim sxemasi:
  `image{uz,ru}`, `link`, `order`, `validFrom`, `validTo`, `active`)
- Faqat `active` va sana oralig'idagilar, `order` bo'yicha
- Kesh: menyu bilan bir xil qoida (stale-while-revalidate)
- Banner yo'q bo'lsa blok umuman ko'rinmasin — bo'sh joy qolmasin

Texnik:
- Rasm `loading="lazy"`, faqat joriy va keyingisi yuklansin
- `prefers-reduced-motion` da animatsiya o'chsin, nuqtalar bilan
  qo'lda almashtirilsin
- Sahifadan chiqilganda taymer to'xtasin (leak bo'lmasin)
- Fon tabga o'tganda ham to'xtasin (`visibilitychange`)

Izoh:

**ANIMATSIYA TANLOVI — o'lchandi.**

Fade va gorizontal slayd bir xil sharoitda o'lchandi
(`scratchpad/prof/anim-bench.*`): mobil o'lcham, DPR 3, CPU 1× / 4× /
6× sekinlashtirilgan, har variant 24 marta almashtirildi.

| CPU | fade median / p95 / max | slayd median / p95 / max |
| --- | --- | --- |
| 1× | 16.7 / 16.7 / 16.8 ms | 16.7 / 16.8 / 16.8 ms |
| 4× | 16.7 / 16.8 / 25 ms | 16.7 / 16.8 / 33 ms |
| 6× | 16.7 / 16.8 / 67 ms | 16.7 / 16.8 / 50 ms |

**Natija: tezlik bo'yicha farq YO'Q.** Ikkalasi ham kompozitorda
ketadi (`opacity` va `transform` — ikkalasi ham layout va paint
talab qilmaydi), medianada ikkalasi ham 16.7 ms, tashlangan kadrlar
~500 tadan 0–2 tasi — bu shovqin.

> O'lchov CHEKLOVI: bu muhitda faqat Chromium bor (WebKit yuklab
> bo'lmadi), shuning uchun bu HAQIQIY iPhone Safari emas. CPU
> sekinlashtirilib mobil sinfga yaqinlashtirilgan.

Shuning uchun tanlov FUNKSIYA bo'yicha qilindi: talabda swipe bor.
**Slaydda barmoq yo'lakni 1:1 tortadi** — foydalanuvchi harakat
davomida qayerda ekanini ko'radi (`is-dragging` sinfi animatsiyani
o'chiradi, `transform` esa barmoq bilan yuradi). Fade da bunday
tabiiy moslik yo'q — surish faqat "bo'ldi/bo'lmadi" bo'lib qolardi.

Bajarilgani:

- `js/banner.js` — karusel: avto-almashish (5 s), swipe, nuqtalar,
  bosish (`#/` ichki yo'l → router, tashqi URL → yangi oyna).
- `js/db.js` da `getBanners()` yozildi (ilgari bo'sh stub edi).
  Filtr BRAUZERDA: Firestore bitta so'rovda ikkita diapazon maydonini
  (`validFrom` va `validTo`) qo'llab-quvvatlamaydi. Kesh menyu bilan
  bir xil qoida (`MENU_TTL`, stale-while-revalidate).
- `limitMillis()` — sana chegarasi uchun. Fayldagi mavjud
  `toMillis()` yo'q sanani `0` deb qaytaradi (saralash uchun), bu
  yerda esa "chegara yo'q" ni "1970-yil" dan ajratish SHART, aks
  holda `validFrom` siz banner filtrlanib ketardi.
- `js/pages/menu.js` — banner ALOHIDA hostda: `body` qidiruvda va
  menyu chizilganda butunlay almashadi, banner esa joyida qolishi
  kerak. Menyuni KUTMAYDI va xato bo'lsa jim o'tadi — reklama
  tufayli menyu kechikmasin.
- CSS: 16:5 nisbat, `--r-lg` radius, nuqta teginish maydoni 24px.
  Gorizontal margin YO'Q — `.page` allaqachon padding beradi
  (o'lchovda banner kartochkalardan 16px ichkarida qolgan edi,
  tuzatildi).
- `js/banner.js` `sw.js` SHELL_ASSETS va `index.html` dagi
  `modulepreload` ro'yxatiga qo'shildi (README dagi tezlik qoidasi).

Tekshirildi — brauzerda, haqiqiy kod ustida, 13 guruh:
filtrlash (`active`, `validFrom`/`validTo`, `order`, rasmsizi
tashlanadi); banner yo'q bo'lsa blok umuman chizilmaydi va bo'sh joy
qolmaydi; bitta bannerda nuqta ham, taymer ham yo'q; avto-almashish
aynan 5 sekundda va oxiridan boshiga qaytadi; faqat joriy va keyingi
rasm yuklanadi, hammasi `loading="lazy"`; nuqta bosilsa o'sha
slaydga o'tadi; swipe chapga/o'ngga ishlaydi, chegaradan kam
surishda almashmaydi; surgandan keyin 10 sekund pauza, keyin davom
etadi; ichki hash yo'l, tashqi URL va bo'sh `link` uchtasi ham
to'g'ri; `prefers-reduced-motion` da o'zi almashmaydi, nuqta bilan
qo'lda almashadi; fon tabda taymer to'xtaydi va qaytgach davom
etadi; sahifadan chiqilganda taymer tozalanadi (leak yo'q);
o'lcham 358×112 (nisbat 3.20), radius 18px, bir vaqtda bitta slayd.

Regressiya: kuryer, admin "Kuryerlar" va treking to'plamlari,
`server` 35/35, `rules-test` 63/63 — hammasi o'tdi.

---

## Bosqich 11 — admin panelning qolgan bo'limlari
Status: **bajarildi**

SPEC 116–121.

### 116. Banner CRUD
- Ro'yxat, qo'shish, tahrirlash, o'chirish
- Maydonlar: rasm URL (uz va ru alohida), havola, tartib raqami,
  amal muddati (dan/gacha), faol/nofaol
- Tartibni yuqori/past tugmalari bilan o'zgartirish
- Oldindan ko'rish: mijoz ilovasidagidek
- Faqat superadmin/manager

### 117. Mijozlar bazasi
- Ro'yxat: ism, telefon, buyurtmalar soni, umumiy summa, oxirgi buyurtma
- Telefon yoki ism bo'yicha qidiruv
- Mijozni ochganda: profil, buyurtmalar tarixi, bonus balansi
- Qora ro'yxat (`blocked`)
- MUHIM: pul maydonlariga (`bonusBalance`, `tier`, `totalSpent`)
  TEGILMAYDI — `firestore.rules` ularni yopgan. Faqat `blocked` va
  `notes` yoziladi
- Faqat superadmin/manager/operator

### 118. Bonusni qo'lda berish
- `POST /api/admin/bonus` — `{ uid, amount, reason }`
- Faqat superadmin/manager
- `bonusBalance` transaction bilan o'zgaradi
- `users/{uid}/bonusHistory` ga `type: 'gift'` yoziladi
- Audit logga tushadi
- Mijoz kartochkasida "Bonus berish" tugmasi

### 119. Broadcast
- Telegram xabar: hammasi / faol (30 kun) / uxlab qolgan (60 kun)
- Matn, oldindan ko'rish, qabul qiluvchilar soni
- Yuborishdan oldin tasdiq
- `POST /api/admin/broadcast`, navbat bilan (Telegram limiti ~30/sek)
- Yuborilganlar tarixi saqlanadi
- Faqat superadmin

### 120. Sozlamalar ekrani
`settings/global`: kafolat daqiqalari, cashback foizi, bonus muddati,
support telefoni va Telegram, minimal buyurtma va yetkazish narxi
(zaxira qiymatlar). Faqat superadmin.

### 121. Audit log
- `auditLog/{id}`: `uid`, `staffName`, `action`, `target`, `before`,
  `after`, `at`
- Yoziladi: menyu, narx, promokod, filial, stop-list, bonus berish,
  qora ro'yxat, broadcast, sozlamalar
- Ro'yxat, sana va xodim bo'yicha filtr
- Faqat superadmin o'qiydi, hech kim o'chira olmaydi
- `firestore.rules` ga qo'shiladi

Izoh:

**AUDIT LOG POYDEVOR BO'LDI.** 116, 118, 119 va 120 ning hammasi unga
yozadi, shuning uchun u birinchi qilindi.

**Kim yozadi va NEGA shunday.** Menyu, filial, promokod, banner va
stop-list ni admin panel BEVOSITA Firestore'ga yozadi (SPEC 3-bo'lim),
servis orqali emas. Shuning uchun ular uchun audit yozuvini ham admin
panel o'zi qo'shadi (`admin/js/db.js` dagi `writeAudit()`); bonus va
broadcast esa servisda bajariladi va yozuvni `server/src/audit.js`
qo'yadi.

Qoida `auditLog` ga FAQAT qo'shishga ruxsat beradi va `uid` so'rov
egasining uid'iga teng bo'lishini talab qiladi — boshqa xodim nomidan
yozib bo'lmaydi. `update` va `delete` HECH KIMGA ochiq emas, hatto
superadminga ham.

> CHEKLOV, ochiq aytilgan: yovuz niyatli xodim O'Z nomidan SOXTA yozuv
> qo'sha oladi. Buni to'liq yopish uchun menyu/filial/promokod
> yozuvlari ham servis orqali o'tishi kerak — bu 7-bosqich
> arxitekturasini qayta qurish, alohida ish sifatida qoldirildi.
> Mavjud yozuvni o'zgartirish va o'chirish esa hozirning o'zida
> imkonsiz.

Bajarilgani:

- **116 — banner CRUD** (`admin/js/pages/banners.js`): ro'yxat, qo'shish,
  tahrirlash, o'chirish; rasm URL uz/ru alohida (ru bo'sh bo'lsa uz
  ishlatiladi — mijozdagi `pick()` shunday qulaydi), havola, tartib,
  amal muddati, faol/nofaol. Tartib DRAG emas, **yuqori/past
  tugmalari** bilan: admin panel sensorli ekranda ham ochiladi va u
  yerda drag ishonchsiz, tugma esa klaviatura bilan ham yuradi.
  Ikkita qo'shni bannerning `order` i almashtiriladi — ikkita yozuv
  yetadi. Oldindan ko'rish 16:5 nisbat va `--r-lg` radius bilan,
  mijoz ilovasidagi karusel bilan bir xil.
- **117 — mijozlar bazasi** (`admin/js/pages/customers.js`): ro'yxat
  (ism, telefon, buyurtma soni, umumiy summa, oxirgi buyurtma),
  ism/telefon qidiruvi, kartochkada profil + buyurtmalar tarixi +
  bonus tarixi, qora ro'yxat. **Pul maydonlariga tegilmaydi**:
  `setCustomerFlags()` faqat `blocked` va `notes` ni yozadi, boshqasi
  qoidalar bilan yopiq.
- **118 — bonus** (`POST /api/admin/bonus`): transaction ichida,
  balans manfiy bo'lmaydi, sabab majburiy, `bonusHistory` ga
  `type: 'gift'` yoziladi. Manfiy summa ham qabul qilinadi (xato
  berilgan bonusni qaytarib olish uchun). Tugma faqat
  superadmin/manager da ko'rinadi, servis ham rolni qayta tekshiradi.
- **119 — broadcast** (`POST /api/admin/broadcast`): guruhlar hammasi /
  faol (30 kun) / uxlab qolgan (60 kun); faqat Telegram ulagan va
  bloklanmagan mijozlar. Yuborishdan oldin son ko'rsatiladi va tasdiq
  so'raladi. **Telegram limiti** (~30 xabar/sek) — 25 tadan paket,
  orasida 1.1 sekund pauza. Yuborish FONDA ketadi: 1000 mijozga ~45
  sekund, so'rovni shuncha ushlab bo'lmaydi. Hujjat `sending`
  holatida yaratiladi va `sent`/`failed` yangilanib boradi.
- **120 — sozlamalar** (`admin/js/pages/settings.js`): kafolat, cashback,
  bonus muddati, support telefoni va Telegram, minimal buyurtma va
  yetkazish narxi. Oxirgi ikkitasi ZAXIRA qiymat — haqiqiysi filial
  zonasidan olinadi. Manfiy va 100% dan katta cashback rad etiladi.
- **121 — audit log** (`admin/js/pages/audit.js`): ro'yxat, sana va xodim
  bo'yicha filtr, yozuvni ochib `before`/`after` ni ko'rish. Filtr
  brauzerda (ikkita maydon bo'yicha birga so'rash kompozit indeks
  talab qilardi). `before`/`after` 2000 belgidan uzun bo'lsa
  qisqartiriladi — butun menyu saqlansa Firestore hujjat chegarasi
  (1 MB) yorilardi.

Rollar: superadmin hammasini; manager banner, mijozlar (broadcast,
sozlama va auditsiz); operator faqat mijozlar bazasini (qo'ng'iroqda
kim ekanini bilishi kerak).

Tekshirildi:
- `rules-test` — **70/70** (7 tasi yangi: audit faqat superadminga
  o'qiladi, xodim o'z nomidan qo'sha oladi, BOSHQA nomidan yoza
  olmaydi, xodim bo'lmagan qo'sholmaydi, hech kim o'zgartira va
  o'chira olmaydi; broadcast tarixini faqat superadmin o'qiydi va
  client unga yoza olmaydi);
- `server/npm test` — **43/43** (8 tasi yangi: bonus qo'shish va
  ayirish, manfiy balans rad etilishi va yiqilganda balans
  o'zgarmasligi, sababsiz/nol/juda katta summa, mavjud bo'lmagan
  mijoz, auditoriya tanlash uchta guruh bo'yicha). Modul mock'i uchun
  `npm test` ga `--experimental-test-module-mocks` qo'shildi;
- brauzerda, haqiqiy admin kodi ustida, 6 guruh: rollar (superadmin
  hammasini ko'radi, manager broadcast/sozlama/auditni ko'rmaydi,
  operator faqat mijozlarni, manager audit sahifasiga kira olmaydi);
  banner CRUD (yozuv, ru→uz qulash, avtomatik tartib, rasmsiz va
  teskari sana rad etilishi, tartib almashtirish, o'chirish);
  mijozlar (qidiruv, kartochka, bonus servisga ketishi va Firestore
  ga BEVOSITA yozilmasligi, faqat `blocked` va `updatedAt` yozilishi,
  operatorda bonus tugmasi yo'qligi); broadcast (son, guruh
  almashuvi, oldindan ko'rish, tasdiq, bo'sh matn va bekor qilish);
  sozlamalar (yuklash, saqlash, manfiy va 100%+ rad etilishi); audit
  (tartib, tarjima, servis belgisi, xodim va sana filtri,
  `before`/`after`);
- regressiya: banner, kuryer, treking va admin "Kuryerlar" to'plamlari
  o'tdi (oxirgisida bo'lim soni 8 dan 13 ga o'zgargani uchun
  tekshiruv yangilandi).
