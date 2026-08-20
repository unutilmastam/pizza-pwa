# Loyiha holati

> Har seans boshida shu faylni o'qi. Faqat "Joriy bosqich" deb belgilangan
> ishni bajar. Boshqa bosqichlarga o'tma. Tugagach shu faylni yangila.

**Joriy bosqich: 1**

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
Status: **joriy**

`js/pages/menu.js`, `js/pages/product.js`
- `menu/current` bitta hujjat, localStorage'ga `version` bilan keshlanadi
- Sticky kategoriya chiplari + scroll-spy
- Qidiruv (debounce 300ms)
- Stop-list: o'chirilgan mahsulot kulrang
- Mahsulot bottom-sheet: galereya, o'lcham, xamir, addon, remove, miqdor

Izoh:

---

## Bosqich 2 — savat va checkout
Status: boshlanmagan

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
