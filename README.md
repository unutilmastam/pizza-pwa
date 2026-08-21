# Pitsa PWA

Pitsa yetkazib berish uchun Progressive Web App: vanilla JavaScript (ES6
modullar, framework yo'q), Firebase v10 (Auth + Firestore) va kichik Node
servis. Mobil-birinchi, iPhone Safari uchun optimallashtirilgan.

Loyihaning to'liq talablari `docs/SPEC.md` da, bosqichlar holati
`docs/PROGRESS.md` da.

## Tuzilma

```
index.html            ilova karkasi, router ro'yxati
sw.js                 service worker (versiyalangan kesh)
css/style.css         barcha uslublar
js/
  config.js           Firebase config, API_BASE, AUTH_MODE, APP sozlamalari
  api.js              Node servis bilan aloqa (yagona fetch qatlami)
  auth.js             OTP va sessiya
  db.js               BARCHA Firestore chaqiruvlari faqat shu yerda
  i18n.js             uz / ru / en matnlari
  router.js, state.js, ui.js, utils.js
  pages/              menu, product, cart, checkout, address, auth, order, profile
server/               Node servis (Express + Firebase Admin SDK)
tools/                bir martalik seed vositalari (brauzerda ochiladi)
docs/                 SPEC, PROGRESS va demo ma'lumot fayllari
```

## Frontend'ni ishga tushirish

Statik fayllar — hech qanday build yo'q. Istalgan statik server yetarli:

```bash
npx http-server . -p 8080 -c-1
```

GitHub Pages'ga chiqarish: `main` shoxini Pages manbasi qilib belgilash
kifoya. Firebase konsolida **Authentication → Settings → Authorized
domains** ro'yxatiga sayt domenini qo'shish kerak.

`js/config.js` da o'zgartiriladigan qiymatlar:

| Konstanta | Ma'nosi |
| --- | --- |
| `FIREBASE_CONFIG` | Firebase web ilovasi konfiguratsiyasi |
| `API_BASE` | Node servis manzili (Render) |
| `AUTH_MODE` | `production` — OTP Node servis orqali; `test` — zaxira rejim, kod `000000` |
| `YANDEX_MAPS_KEY` | Yandex Maps JS API kaliti |

> Service worker `js/config.js` ni **hech qachon keshlamaydi** — config
> o'zgarsa foydalanuvchi darhol yangisini oladi. Boshqa fayl o'zgarsa
> `sw.js` dagi `VERSION` ni oshiring, aks holda eski kesh qoladi.

## Node servis (`server/`)

Servis faqat client bajara olmaydigan ishlarni qiladi (SPEC 4-bo'lim):

1. **Buyurtma yakunlash** — `POST /api/orders`. Narx `menu/current` dan
   QAYTA HISOBLANADI (client narxiga ishonilmaydi), stop-list, zona va
   minimal summa tekshiriladi, promokod va bonus qo'llanadi,
   `orderNumber` transaction bilan beriladi.
2. **OTP** — `POST /api/auth/send-otp`, `POST /api/auth/verify-otp`.
   Kod SHA-256 xeshi ko'rinishida Firestore'da saqlanadi, tekshiruvdan
   keyin Firebase custom token qaytariladi.
3. **Telegram** — admin guruhga yangi buyurtma, mijozga status xabari.
4. **Kafolat cron** — `guaranteeDeadline` o'tgan buyurtmaga promokod.
5. **Bonus cron** — muddati o'tgan bonusni kuydirish.
6. **Kunlik hisobot** — `reports/{YYYY-MM-DD}` va Telegram xulosasi.

### To'lov haqida

Hozircha **naqd** va **kuryerdagi karta** — ikkalasi ham buyurtmada faqat
belgi (`paymentMethod`), servis pul o'tkazmasi bilan ishlamaydi va
`paymentStatus` doim `unpaid` bo'lib qoladi. Payme/Click integratsiyasi
(webhook, imzo tekshiruvi) **keyingi bosqichga qoldirilgan** — u
qo'shilganda `server/src/orders.js` dagi `PAYMENT_METHODS` va
`js/config.js` dagi `APP.paymentMethods` birga kengaytiriladi.

### Mahalliy ishga tushirish

```bash
cd server
cp .env.example .env      # qiymatlarni to'ldiring
npm install
npm start                 # yoki: npm run dev
npm test                  # narxlash va zona testlari (Firestore kerak emas)
```

Firebase kalitlarisiz ham servis ko'tariladi — `/api/health` javob beradi
va nima yetishmayotganini `problems` ro'yxatida ko'rsatadi.

### API

| Metod | Manzil | Kim uchun |
| --- | --- | --- |
| `GET` | `/api/health` (`?deep=1` — Firestore ham tekshiriladi) | hamma |
| `POST` | `/api/auth/send-otp` | hamma |
| `POST` | `/api/auth/verify-otp` | hamma |
| `POST` | `/api/orders` | Firebase ID token |
| `PATCH` | `/api/orders/:id/status` | `ADMIN_UIDS` |
| `POST` | `/api/jobs/:name` (`guarantee`, `bonus`, `report`) | `ADMIN_UIDS` |

Xato javobi doim bir xil ko'rinishda:
`{ "error": "out-of-zone", "message": "..." }`.

---

## Render'ga deploy qilish

### 1. Firebase xizmat akkaunti

Firebase konsoli → **Project settings → Service accounts → Generate new
private key**. Yuklab olingan JSON dan uchta qiymat kerak:
`project_id`, `client_email`, `private_key`.

JSON faylni repozitoriyga **qo'ymang** — `.gitignore` uni to'sadi, lekin
asosiy qoida oddiy: maxfiy kalit faqat environment o'zgaruvchisida
bo'ladi.

### 2. Web Service yaratish

Render → **New → Web Service** → repozitoriyni ulang.

| Sozlama | Qiymat |
| --- | --- |
| Name | `pizza-api` (bu nom `API_BASE` ga mos bo'lsin) |
| Region | Frankfurt (O'zbekistonga eng yaqini) |
| Branch | `main` |
| Root Directory | `server` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free |
| Health Check Path | `/api/health` |

`Root Directory` ni `server` qilish muhim — aks holda Render ildizdagi
statik fayllarni qurmoqchi bo'ladi.

Deploy tugagach manzil `https://pizza-api.onrender.com` ko'rinishida
bo'ladi. Boshqacha bo'lsa `js/config.js` dagi `API_BASE` ni yangilang.

### 3. Environment o'zgaruvchilari

Render → servis → **Environment** → **Add Environment Variable**.
`PORT` ni Render o'zi beradi, qo'lda qo'shilmaydi.

**Majburiy:**

| O'zgaruvchi | Izoh |
| --- | --- |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | CORS uchun frontend manzillari, vergul bilan: `https://unutilmastam.github.io` |
| `FIREBASE_PROJECT_ID` | xizmat akkaunti JSON dagi `project_id` |
| `FIREBASE_CLIENT_EMAIL` | JSON dagi `client_email` |
| `FIREBASE_PRIVATE_KEY` | JSON dagi `private_key` — ko'p qatorli, `\n` bilan yozing va qo'shtirnoq ichiga oling |
| `ADMIN_UIDS` | status o'zgartira oladigan uid'lar, vergul bilan |

**SMS (ixtiyoriy, lekin production uchun kerak):**

| O'zgaruvchi | Izoh |
| --- | --- |
| `SMS_PROVIDER` | `console` (kod logga yoziladi) yoki `eskiz` |
| `ESKIZ_EMAIL`, `ESKIZ_PASSWORD` | Eskiz.uz hisobi |
| `ESKIZ_FROM` | jo'natuvchi nomi, standart `4546` |
| `OTP_TTL_SECONDS` | kod amal qilish muddati, standart `300` |
| `OTP_RESEND_SECONDS` | qayta yuborish taymeri, standart `60` |
| `OTP_MAX_ATTEMPTS` | noto'g'ri urinishlar chegarasi, standart `5` |
| `OTP_HOURLY_LIMIT` | bir raqamga soatiga nechta kod, standart `5` |
| `TEST_PHONE`, `TEST_OTP_CODE` | doimiy test raqami (SMS yuborilmaydi) |

**Telegram (ixtiyoriy):**

| O'zgaruvchi | Izoh |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | @BotFather bergan token. Bo'sh bo'lsa xabar yuborilmaydi, servis ishlayveradi |
| `TELEGRAM_ADMIN_CHAT_ID` | admin guruh yoki kanal, masalan `-1001234567890` |

**Biznes qoidalari (ixtiyoriy — `settings/global` bo'lmasa ishlatiladi):**

`GUARANTEE_MINUTES` (35), `CASHBACK_PERCENT` (2),
`BONUS_EXPIRY_DAYS` (90), `ENABLE_CRON` (`true`).

To'liq ro'yxat va izohlar `server/.env.example` da.

### 4. Bepul plandagi uyqu

Render'ning bepul web-servisi **15 daqiqa so'rovsiz qolsa uxlaydi**.
Oqibatlari va ular qanday hal qilingani:

- **Birinchi so'rov 30–60 soniya ketadi.** `js/api.js` da kutish
  chegarasi 60 soniya; 4 soniyadan keyin ekranda "server uyg'onmoqda"
  yoziladi. Bundan tashqari savat, checkout yoki kirish sahifasiga
  o'tilganda servis fonda uyg'otiladi (`wakeUp()`), shunda buyurtma
  berish payti kutish deyarli sezilmaydi.
- **Uyquda cron ishlamaydi.** Shuning uchun kafolat va bonus vazifalari
  vaqtga emas, holatga tayanadi (`guaranteeClosed`, `expired`
  bayroqlari) — kechikib ishga tushsa ham o'tkazib yuborilganini topib
  bajaradi. Servis uyg'onganda `runCatchUp()` ularni darhol bir marta
  yugurtiradi.
- **Doim uyg'oq turishi kerak bo'lsa** tashqi ping qo'shing: masalan
  [cron-job.org](https://cron-job.org) da har 10 daqiqada
  `https://pizza-api.onrender.com/api/health` ni chaqiring. Bepul planda
  oylik soat chegarasi borligini hisobga oling.
- **Zaxira yo'l:** servis butunlay yetib bo'lmaydigan holatda
  `js/config.js` da `AUTH_MODE = 'test'` qilib qo'yish mumkin — kirish
  test rejimida ishlaydi (kod `000000`), lekin buyurtma berish baribir
  servisni talab qiladi.

### 5. Firestore indekslari

Servis bir nechta murakkab so'rov qiladi — Firestore ular uchun
**composite index** talab qiladi. Indeks yo'q bo'lsa xato matnida tayyor
havola keladi, uni bosish kifoya. Oldindan qo'shsangiz:

| Kolleksiya | Maydonlar |
| --- | --- |
| `orders` | `guaranteeBroken` (asc) + `guaranteeDeadline` (asc) |
| `orders` | `uid` (asc) + `promoCode` (asc) |
| `bonusHistory` (collection group) | `type` (asc) + `expiresAt` (asc) |

### 6. Deploydan keyin tekshirish

```bash
curl https://pizza-api.onrender.com/api/health
curl "https://pizza-api.onrender.com/api/health?deep=1"
```

`ok: true` va bo'sh `problems` — hammasi joyida. `problems` ichida
yozilgan har bir satr qaysi environment o'zgaruvchisi yetishmayotganini
aytadi.

## Ma'lumotni to'ldirish

`tools/` dagi HTML vositalar brauzerda ochiladi va bir martalik yozuv
qiladi (yozishdan oldin tasdiq so'raydi):

- `tools/seed.html` → `docs/seed-menu.json` ni `menu/current` ga
- `tools/seed-branches.html` → `docs/seed-branches.json` ni `branches` ga
- `tools/seed-order.html` → joriy foydalanuvchi uchun demo buyurtma va
  status/kuryer tugmalari (treking sahifasini sinash uchun)

Firestore ichma-ich massivni qabul qilmaydi, shuning uchun zona
ko'pburchaklari `[{lat, lng}, ...]` ko'rinishida saqlanadi.

## Kod yozish qoidalari

- Vanilla JS, ES6 modullar, framework yo'q.
- **Barcha Firestore chaqiruvi faqat `js/db.js` da**, barcha `fetch`
  faqat `js/api.js` da.
- Interfeys matnlari faqat `js/i18n.js` da, uchala tilda.
- Kod izohlari o'zbek tilida.
- Maxfiy kalitlar hech qachon kodga yozilmaydi.
