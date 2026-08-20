# Loyiha holati

> Har seans boshida shu faylni o'qi. Faqat "Joriy bosqich" deb belgilangan
> ishni bajar. Boshqa bosqichlarga o'tma. Tugagach shu faylni yangila.

**Joriy bosqich: 2**

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
Status: **joriy**

`js/pages/cart.js`, `js/pages/checkout.js`
- Savat: miqdor, o'chirish undo bilan, promokod, minimal summa
  progress-bar, upsell, narx breakdown
- Checkout: manzil/filial, vaqt, to'lov usuli, qaytim, idish-tovoq,
  izoh, oferta checkbox

Izoh:

---

## Bosqich 3 — manzil va zona
Status: boshlanmagan

`js/pages/address.js` — Yandex Maps JS API
- Marker surish, reverse geocode, autocomplete
- `pointInPolygon` bilan zona tekshiruvi
- Zonaga qarab yetkazish narxi va minimal summa
- Saqlangan manzillar CRUD

Izoh:

---

## Bosqich 4 — auth
Status: boshlanmagan

`js/pages/auth.js`, `js/auth.js`
- +998 mask, OTP 6 katak, 60 sek taymer
- `POST /api/auth/send-otp`, `/verify-otp`
- `signInWithCustomToken`
- Mehmon rejimi

Izoh:

---

## Bosqich 5 — treking va profil
Status: boshlanmagan

`js/pages/order.js`, `js/pages/profile.js`
- `onSnapshot` real-time, 7 status stepper, kafolat taymeri
- Kuryer marker
- Profil: tarix, takrorlash, bonus, manzillar

Izoh:

---

## Bosqich 6 — Node servis
Status: boshlanmagan

`server/` — Express + Firebase Admin SDK
- `/api/auth/send-otp`, `/verify-otp`
- `/api/orders` — narxni qayta hisoblash
- `/api/payments/payme`, `/click`
- `/api/orders/:id/status`
- Telegram bot, cron

Izoh:

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
