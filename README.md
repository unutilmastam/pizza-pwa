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
admin/                admin panel — ALOHIDA PWA (o'z manifest va SW bilan)
  index.html
  css/admin.css
  js/
    config.js         rollar, bo'limlar; Firebase sozlamalari ../../js dan
    auth.js           Firebase Auth + staff kolleksiyasida rol
    db.js             admin uchun BARCHA Firestore chaqiruvlari
    api.js            Node servis (status, kuryer)
    pages/            login, dashboard, orders, kds, menu, branches, promos, reports
server/               Node servis (Express + Firebase Admin SDK)
firestore.rules       xavfsizlik qoidalari (konsolga qo'lda nusxalanadi)
rules-test/           qoidalar testi (Firestore emulyatorida)
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
| `PATCH` | `/api/orders/:id/status` | staff: superadmin, manager, operator, kitchen |
| `PATCH` | `/api/orders/:id/courier` | staff: superadmin, manager, operator |
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
| `FIREBASE_PRIVATE_KEY_BASE64` | JSON dagi `private_key` base64 ga o'girilgan holda — **tavsiya etiladi**, pastdagi bo'limga qarang |
| `FIREBASE_PRIVATE_KEY` | O'sha kalitning oddiy PEM varianti (`\n` bilan). Faqat base64 qo'yilmagan bo'lsa ishlatiladi |
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

### 4a. Private key'ni base64 ko'rinishida qo'yish

PEM kalit ko'p qatorli, environment o'zgaruvchisi esa bir qatorli — shu
sababli u Render'da eng ko'p muammo tug'diradigan qiymat:

| Nima bo'lgan | Xato |
| --- | --- |
| `\n` haqiqiy qator ko'chishiga aylanmagan | `error:1E08010C:DECODER routines::unsupported` |
| Qo'shtirnoq qiymat ichida qolib ketgan | `Invalid PEM formatted message` |

**Yechim: kalitni base64 ga o'giring.** Base64 da maxsus belgi ham,
qator ko'chishi ham yo'q, shuning uchun uni hech qanday qochirishsiz
(escaping) qo'yish mumkin.

Xizmat akkaunti JSON faylidan (`key.json`):

```bash
node -e "console.log(Buffer.from(require('./key.json').private_key).toString('base64'))"
```

`.pem` fayldan:

```bash
base64 -w0 private-key.pem      # macOS: base64 -i private-key.pem
```

Chiqqan uzun satrni Render'da **`FIREBASE_PRIVATE_KEY_BASE64`** ga
qo'ying — qo'shtirnoqsiz, o'zgartirmasdan. `FIREBASE_PRIVATE_KEY` ni
bo'sh qoldirsangiz ham bo'ladi.

Servis ikkalasini ham tushunadi: **`FIREBASE_PRIVATE_KEY_BASE64` bo'lsa
o'sha ishlatiladi**, bo'lmasa `FIREBASE_PRIVATE_KEY` dagi `\n` qator
ko'chishiga aylantiriladi. Har ikki holatda ham qiymatni o'rab turgan
qo'shtirnoq olib tashlanadi.

Kalit noto'g'ri bo'lsa servis buni **ishga tushishda** aytadi —
`/api/health` javobidagi `problems` ro'yxatida
`FIREBASE_PRIVATE_KEY PEM shaklida emas...` satri chiqadi, tushunarsiz
OpenSSL xatosini kutib o'tirishga hojat yo'q.

#### Kalit diagnostikasi

`/api/health?deep=1` javobida `credentials` bo'limi bor. **Kalitning
o'zi ham, biror bo'lagi ham qaytarilmaydi** — faqat o'lchamlar va shakl
belgilari:

| Maydon | To'g'ri qiymat |
| --- | --- |
| `keySource` | `base64` yoki `plain` — qaysi env ishlatilgani |
| `keyLength` | ishlatilgan env qiymatining uzunligi (base64 uchun ~2200) |
| `keyLines` | dekodlangan PEM qatorlari soni — **~28** |
| `keyBodyLength` | PEM ichidagi base64 tana — **~1600** |
| `keyHasHeader` / `keyHasFooter` | ikkalasi ham `true` |
| `keyLooksComplete` | `true` |
| `clientEmail`, `projectId` | JSON fayldagi qiymatlar bilan bir xil |
| `emailMatchesProject` | `true` — email `@<projectId>.iam.gserviceaccount.com` bilan tugashi |

`keyLines` yoki `keyBodyLength` kutilganidan kichik bo'lsa — kalit
yarim ko'chirilgan.

Firestore xatosi bo'lsa `firestore` maydonida `code`, `message` va
`hint` keladi. `UNAUTHENTICATED` (`code: 16`) — kalit shakl jihatidan
to'g'ri, lekin Google uni qabul qilmadi. Sabablari:

1. **Kalit Firebase konsolida o'chirilgan yoki almashtirilgan** — eng
   ko'p uchraydigani. Yangi private key yarating.
2. **Qiymatlar turli JSON fayllardan olingan** — `FIREBASE_CLIENT_EMAIL`
   bir akkauntdan, private key boshqasidan. Uchalasi ham **bitta**
   JSON fayldan olinishi shart.
3. **Kalit to'liq emas** — yuqoridagi `keyBodyLength` ni tekshiring.

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

## Admin panel

Manzil: **`/pizza-pwa/admin/`** — mijoz ilovasidan alohida PWA, o'z
manifest va service worker'i bilan.

### Kirish va rollar

Kirish mijoz ilovasidagi bilan bir xil OTP yo'lidan ketadi, lekin undan
keyin YANA BIR tekshiruv bor: `staff/{uid}` hujjati bo'lishi va
`active !== false` bo'lishi shart. Hujjat yo'q bo'lsa sessiya darhol
yopiladi — mijoz raqami bilan panelga kirib bo'lmaydi.

| Rol | Ko'radigan bo'limlari |
| --- | --- |
| `superadmin` | hammasi |
| `manager` | hammasi |
| `operator` | boshqaruv, buyurtmalar, KDS |
| `kitchen` | faqat KDS |
| `courier` | panelga kirolmaydi (kuryerning o'z ilovasi bo'ladi) |

Servis tomonida ham shu rollar tekshiriladi (`requireStaff`): statusni
`superadmin/manager/operator/kitchen`, kuryer tayinlashni esa
`superadmin/manager/operator` o'zgartira oladi. `ADMIN_UIDS` bootstrap
yo'li bo'lib qoladi — `staff` bo'sh bo'lganda ham servisni boshqarish
uchun.

### Birinchi xodimni yaratish

`staff` kolleksiyasi bo'sh bo'lgani uchun birinchi superadmin qo'lda
beriladi:

1. Mijoz ilovasida telefon raqamingiz bilan kiring;
2. **`/pizza-pwa/tools/seed-staff.html`** ni oching — u Firebase
   sessiyasidan `uid` ni o'zi oladi;
3. Rolni `superadmin` qilib "Rolni berish" ni bosing;
4. `/pizza-pwa/admin/` ni oching.

Firestore qoidalari qo'yilgach (8-bosqich) `staff` ga faqat
`superadmin` yoza oladi va bu vosita ishlamay qoladi — shuning uchun
birinchi xodim aynan shu yerdan beriladi.

### Bo'limlar

- **Boshqaruv** — bugungi buyurtma, tushum, o'rtacha chek. Buyurtmalar
  obunasidan hisoblanadi, qo'shimcha so'rovsiz.
- **Buyurtmalar** — real vaqtdagi oqim, yangi buyurtmada ovoz signali.
  Qabul qilish (tayyorlanish vaqti bilan), sabab ko'rsatib rad etish,
  keyingi bosqich, kuryer tayinlash.
- **Oshxona (KDS)** — kartochka, taymer, "Tayyor". Belgilangan vaqtdan
  oshsa kartochka qizil bo'ladi.
- **Menyu** — kategoriya va mahsulot CRUD. `menu/current` BITTA hujjat
  bo'lgani uchun o'zgarishlar xotirada to'planadi va **"Menyuni chop
  etish"** bosilganda bir marta yoziladi; versiya avtomatik oshadi
  (mijoz ilovasi keshni aynan versiya bo'yicha yangilaydi).
- **Filiallar** — filial CRUD, zona polygonlari, stop-list.
  Polygon nuqtalari `lat, lng` qatorlari ko'rinishida kiritiladi va
  `[{lat, lng}]` obyektlari bo'lib saqlanadi (Firestore ichma-ich
  massivni qabul qilmaydi).
- **Promokodlar** — CRUD. Hujjat ID = kodning o'zi, shuning uchun kod
  yaratilgandan keyin o'zgartirilmaydi.
- **Hisobotlar** — `reports/{YYYY-MM-DD}` (cron yozadi) va bugungi kun
  jonli hisoblanadi. Diagramma tashqi kutubxonasiz, inline SVG.

### Rasm yuklash haqida

Firebase Storage bepul planda mavjud emas, shuning uchun menyuda rasm
**yuklanmaydi** — rasm manzillari qo'lda kiritiladi, fayllar esa
GitHub Pages'dagi `images/` papkasida yotadi.

### Keshlash

Admin SW **tarmoq birinchi** tamoyilida ishlaydi: xodim doim eng yangi
kodni oladi, kesh faqat internet uzilganda zaxira bo'ladi. Mijoz
ilovasidagi SW esa "keshdan ber, fonda yangila" — u admin yo'lini
chetlab o'tadi (scope'i kengroq bo'lsa ham).

## Firestore qoidalari (xavfsizlik)

Qoidalar `firestore.rules` faylida. **Node servis Admin SDK orqali
ishlaydi va qoidalarni butunlay chetlab o'tadi** — bu cheklovlar faqat
brauzerdagi ikki ilovaga tegishli.

### Kim nima qila oladi

| Kolleksiya | O'qish | Yozish |
| --- | --- | --- |
| `menu`, `branches`, `banners`, `settings` | hamma (mehmon ham) | `superadmin`, `manager` (`settings` — faqat `superadmin`) |
| `users/{uid}` | o'zi; `superadmin`/`manager`/`operator` | o'zi — faqat `name`, `phone`, `lang`, `birthday`, `lastLoginAt` |
| `users/{uid}/addresses` | o'zi | o'zi |
| `users/{uid}/bonusHistory` | o'zi; `superadmin`/`manager` | hech kim (servis yozadi) |
| `orders` | o'zinikini; buyurtma xodimlari hammasini | **hech kim** — istisno: o'z yetkazilgan buyurtmasiga `rating` |
| `couriers` | kirgan foydalanuvchi (treking uchun) | kuryer — o'z `location`/`onShift` |
| `promocodes` | `superadmin`, `manager` | `superadmin`, `manager` |
| `staff` | o'z hujjatini; `superadmin` hammasini | `superadmin` |
| `reports` | `superadmin`, `manager` | hech kim (cron yozadi) |
| `otps`, `counters`, `idempotency` | **hech kim** | **hech kim** |
| qolgan hamma yo'l | **yopiq** | **yopiq** |

Muhim jihatlar:

- **Bonusni foydalanuvchi o'zi yoza olmaydi.** `bonusBalance`, `tier`,
  `totalSpent`, `blocked` maydonlariga tegilsa yozuv rad etiladi —
  yaratishda ham, yangilashda ham.
- **Buyurtmani client yaratolmaydi.** Yagona istisno — o'z buyurtmangizga
  baho qo'yish, va u ham faqat `status == 'delivered'` bo'lganda hamda
  `rating` dan boshqa maydonga tegmasa.
- **Promokodlarni client o'qiy olmaydi** — aks holda barchasini ko'chirib
  olish mumkin bo'lardi.
- **`otps` yopiq** — unda OTP kodlarining xeshi yotadi.
- Admin panel ham buyurtmalarni **bevosita** o'zgartira olmaydi: status
  va kuryer Node servis orqali yoziladi.

### Joylashtirish (Firebase konsolidan qo'lda)

Firebase CLI shart emas — qoidalarni konsolga nusxalash yetarli:

1. `firestore.rules` faylini oching va **butun mazmunini** nusxalang.
2. [Firebase konsoli](https://console.firebase.google.com/) → loyihangiz
   → **Firestore Database** → yuqoridagi **Rules** yorlig'i.
3. Tahrirlagichdagi eski matnni **butunlay** o'chirib, nusxalanganini
   qo'ying.
4. **Publish** ni bosing. Qoidalar bir necha soniyada kuchga kiradi.

> Konsolda "Rules playground" bor — biror amalni chop etishdan oldin
> sinab ko'rish mumkin.

### MUHIM: tartib

**Qoidalarni chop etishdan OLDIN birinchi superadminni yarating**,
aks holda admin panelga kirib bo'lmay qoladi:

1. Mijoz ilovasida kiring;
2. `tools/seed-staff.html` orqali o'zingizga `superadmin` rolini bering;
3. `/admin/` ochilishini tekshiring;
4. **Endi** qoidalarni chop eting.

Agar tartib buzilgan bo'lsa (qoidalar chop etilgan, lekin superadmin
yo'q) — `firestore.rules` dagi `isBootstrapAdmin()` funksiyasini
ishlating:

```
function isBootstrapAdmin() {
  return signedIn() && request.auth.uid in [
    'SIZNING_UID'          // izohni olib tashlang va uid'ni yozing
  ];
}
```

`uid` ni Firebase konsoli → **Authentication → Users** dan yoki
`tools/seed-staff.html` sahifasidan olasiz. Qoidalarni qayta chop eting,
`seed-staff.html` orqali rolni bering, so'ng ro'yxatni **bo'shatib**
qoidalarni yana chop eting. Bu teshik faqat `staff` kolleksiyasiga
ochiladi — boshqa hech qayerga (test bilan tekshirilgan).

### Nima ishlamay qoladi

`tools/` dagi seed vositalari qoidalar chop etilgach **ishlamaydi** —
ular oddiy foydalanuvchi nomidan `menu` va `branches` ga yozadi.
Bu kutilgan holat: menyu va filiallarni endi admin panelidan
boshqarasiz. `seed-staff.html` ham faqat `superadmin` yoki bootstrap
ro'yxatidagi uid uchun ishlaydi.

### Qoidalarni sinash

Qoidalar Firestore emulyatorida sinaladi (Java kerak):

```bash
cd rules-test
npm install
npm test
```

48 ta test: mehmon menyuni ko'radimi, mijoz o'z buyurtmalarinigina
o'qiydimi, bonusni o'zi yoza oladimi, admin oqimni ko'radimi, o'chirilgan
xodim to'silganmi, bootstrap yo'li ishlaydimi va hokazo.

> Emulyator rad etilgan yozuvlar uchun "evaluation error" deb ham
> yozishi mumkin — bu ma'lumot o'qiydigan qoidalarning ikki bosqichli
> tekshirilishi, xato emas. Yakuniy natija baribir to'g'ri.

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
