# Pitsa yetkazish ilovasi — to'liq spetsifikatsiya va build promptlari

Stek: Vanilla JS PWA (yoki React) + Firebase (Auth / Firestore / Storage / Functions) + Node servis (Render) + Telegram bot.

---

## 1-QISM. To'liq funksiya ro'yxati

### A. Onboarding va sozlash
1. Til tanlash: uz / ru / en (barcha matn `i18n.js` da)
2. Shahar tanlash (bir nechta shahar bo'lsa)
3. Yetkazish turi: **dostavka** yoki **olib ketish (pickup)**
4. PWA install banner ("Ilovani o'rnating")
5. Birinchi kirishda joylashuvni so'rash

### B. Manzil va zona
6. Xaritadan manzil tanlash (Yandex Maps yoki Google Maps)
7. Manzil qidirish (autocomplete)
8. Qo'shimcha maydonlar: kvartira, podyezd, qavat, domofon, mo'ljal
9. Saqlangan manzillar: Uy / Ish / Boshqa, tahrirlash, o'chirish
10. **Yetkazish zonasi tekshiruvi** — polygon ichida mi (point-in-polygon)
11. Zonaga qarab: yetkazish narxi + minimal buyurtma summasi
12. Zonadan tashqarida bo'lsa: "Bu manzilga yetkazmaymiz" + eng yaqin filialdan olib ketish taklifi
13. Pickup uchun filial tanlash + xaritada masofa bo'yicha saralash

### C. Autentifikatsiya
14. Telefon raqam kiritish (+998 mask)
15. OTP kod: Telegram bot orqali (bepul) yoki SMS (Eskiz/Play Mobile)
16. Kodni qayta yuborish taymeri (60 sek)
17. Sessiya saqlash (localStorage token)
18. Chiqish (logout)
19. Mehmon rejimi — savatni auth'siz to'ldirish, faqat checkout'da login so'rash

### D. Menyu va katalog
20. Bosh sahifa: banner slayder (aksiyalar), kategoriya chiplari, tavsiya blok
21. Kategoriyalar: Pitsa, Kombo, Zakuska, Salat, Desert, Ichimlik, Sous
22. Yopishqoq (sticky) kategoriya navigatsiyasi + scroll-spy
23. Mahsulot qidiruvi (nom va tarkib bo'yicha)
24. Filtrlar: vegetarian, achchiq, halol, narx oralig'i
25. **Stop-list** — filialda tugagan mahsulot kulrang va bosilmaydi
26. Mahsulot kartochkasi: rasm, nom, qisqa tarkib, narx ("dan" narxi)
27. Sevimlilar (yurak belgisi)

### E. Mahsulot detali
28. Rasm galereya (swipe)
29. To'liq tavsif, tarkib, allergenlar
30. KBJU/kaloriya jadvali
31. O'lcham tanlash: 25 / 30 / 35 sm — narx real-time o'zgaradi
32. Xamir turi: yupqa / an'anaviy
33. Ingredient **qo'shish** (topping, har biri narx qo'shadi)
34. Ingredient **olib tashlash** ("piyozsiz")
35. Miqdor +/- va yakuniy narx
36. "Savatga" tugmasi + animatsiya

### F. Pitsa konstruktori
37. Bo'sh asosdan boshlash: o'lcham → xamir → sous → pishloq → ingredientlar
38. Vizual preview (ingredientlar rasmi ustma-ust)
39. Narx real-time hisoblanadi
40. Yarim-yarim pitsa (ikki xil ta'm) — ixtiyoriy
41. Yig'ilgan pitsani saqlash ("Mening pitsam")

### G. Kombo va set
42. Kombo tarkibi ko'rsatiladi
43. Ichidagi mahsulotni almashtirish (masalan ichimlikni)
44. Kombo chegirmasi hisobi

### H. Savat
45. Mahsulotlar ro'yxati, miqdor o'zgartirish, o'chirish (undo bilan)
46. Promokod kiritish va tekshirish
47. Minimal summa nazorati: "Yana 15 000 so'mga buyurtma qiling"
48. Bepul yetkazish chegarasi progress-bar
49. **Upsell**: "Bularni ham qo'shing" (sous, ichimlik)
50. Savat localStorage'da saqlanadi (sahifa yopilsa yo'qolmaydi)
51. Narx breakdown: mahsulotlar + yetkazish − chegirma − bonus = jami

### I. Checkout
52. Yetkazish manzili yoki filial tasdiqlash
53. Yetkazish vaqti: "Iloji boricha tez" yoki belgilangan vaqt (time picker)
54. To'lov usuli: naqd, kuryerda karta, online (Payme / Click / Uzum)
55. "Qaytim kerak" — qancha puldan
56. Idish-tovoq va salfetka soni
57. Buyurtmaga izoh
58. Bonus (cashback) bilan to'lash — slider bilan qancha ishlatish
59. Oferta bilan rozilik checkbox
60. Buyurtmani tasdiqlash → order yaratiladi

### J. To'lov
61. Payme / Click / Uzum Pay checkout redirect
62. Webhook orqali to'lov tasdiqlash (Node tomonda)
63. To'lov muvaffaqiyatsiz bo'lsa buyurtma `payment_failed` statusiga o'tadi
64. Karta saqlash (token) va keyingi buyurtmada tanlash
65. Qaytarish (refund) — admin tomondan

### K. Buyurtma trekingi
66. Statuslar: `new → accepted → cooking → in_oven → packing → on_way → delivered`
67. Har status uchun vizual progress + vaqt shtampi
68. Kafolat taymeri (35 daqiqa) orqaga sanaydi
69. Kuryer ismi, telefon, "Qo'ng'iroq qilish" tugmasi
70. Kuryer xaritada real-time harakatlanadi
71. Bekor qilish (faqat `new` va `accepted` statusida)
72. Yetkazilgandan keyin baholash oynasi

### L. Sodiqlik dasturi
73. Cashback: har buyurtmadan 2% bonus ballga aylanadi
74. Bonus balansi va tarixi (qachon kelgan / ishlatilgan)
75. Bonusning amal muddati (masalan 90 kun)
76. Darajalar: Bronza / Kumush / Oltin (harajatga qarab cashback foizi oshadi)
77. **Referal**: taklif havolasi, do'st birinchi buyurtma qilsa ikkalasiga bonus
78. Tug'ilgan kunga sovg'a promokodi (avtomatik)
79. Promokodlar bo'limi: mavjud kodlar ro'yxati

### M. Profil
80. Ism, telefon, tug'ilgan kun, jins
81. Buyurtmalar tarixi + "Takrorlash" tugmasi
82. Saqlangan manzillar
83. Saqlangan kartalar
84. Til va bildirishnoma sozlamalari
85. Akkauntni o'chirish (App Store/Play Market talabi)

### N. Baholash va fikr
86. Buyurtmaga 1–5 yulduz
87. Taom va kuryer alohida baholanadi
88. Matnli izoh + rasm yuklash
89. Past baho (1–2) bo'lsa admin panelda alert

### O. Statik va yordamchi
90. Aksiyalar sahifasi (banner detali)
91. Filiallar sahifasi: xarita, manzil, ish vaqti, telefon
92. Biz haqimizda / Vakansiya
93. Ommaviy oferta, Maxfiylik siyosati
94. FAQ (akkordeon)
95. Support: Telegram chat va call-center raqami
96. 404 sahifa

### P. PWA texnik
97. `manifest.json` + ikonkalar (192, 512, maskable)
98. Service worker: app shell cache + offline sahifa
99. Pull-to-refresh (iPhone uchun)
100. Skeleton loader (spinner emas)
101. Haptic feedback (vibrate)
102. Safe-area inset (iPhone notch)
103. Dark / light rejim

---

### ADMIN PANEL

104. Login + rollar: `superadmin`, `manager`, `operator`, `kitchen`, `courier`
105. Dashboard: bugungi buyurtma soni, tushum, o'rtacha chek, faol buyurtmalar
106. **Buyurtmalar oqimi** — real-time, yangi kelganda ovoz signali
107. Qabul qilish / rad etish (sabab bilan)
108. Tayyorlanish vaqtini qo'lda belgilash
109. **KDS (oshxona ekrani)**: kartochkalar, taymer, "Tayyor" tugmasi
110. Kuryerga tayinlash (bo'sh kuryerlar ro'yxati)
111. Menyu CRUD: kategoriya, mahsulot, o'lcham, ingredient, rasm yuklash
112. Filialga qarab narx (bir mahsulot, har filialda boshqa narx)
113. Stop-list boshqaruvi (bir bosishda o'chirish/yoqish)
114. Filial CRUD: manzil, ish vaqti, telefon, yetkazish zonasi polygon chizish
115. Promokod CRUD: turi (%, summa, bepul yetkazish, sovg'a mahsulot), muddat, ishlatish limiti, faqat birinchi buyurtma uchun
116. Banner/aksiya CRUD (tartib, faollik muddati)
117. Mijozlar bazasi: qidiruv, buyurtma tarixi, bonus qo'lda berish, qora ro'yxat
118. Hisobotlar: kunlik/oylik tushum, top mahsulot, filial bo'yicha, kuryer bo'yicha, soatlik yuklama grafigi
119. Broadcast: barcha mijozlarga Telegram/push xabar
120. Sozlamalar: kafolat vaqti, cashback foizi, minimal summa, yetkazish narxi
121. Audit log (kim nimani o'zgartirdi)

### KURYER ILOVASI
122. Login, smena ochish/yopish
123. Tayinlangan buyurtmalar ro'yxati
124. "Oldim" → "Yo'ldaman" → "Yetkazdim" tugmalari
125. Navigatsiya (Yandex Navigator deep link)
126. Naqd pul qabul qilinganini belgilash
127. Geolokatsiya har 15 sekundda Firestore'ga yoziladi
128. Kunlik hisob: nechta buyurtma, qancha naqd

---

## 2-QISM. Firestore ma'lumot modeli

```
settings/global
{ guaranteeMinutes: 35, cashbackPercent: 2, currency: "UZS",
bonusExpiryDays: 90, supportPhone, supportTelegram }

menu/current
{ version: 47, updatedAt,
categories: [ {id, name:{uz,ru,en}, icon, order} ],
products: [ {
id, categoryId, name:{uz,ru,en}, description:{uz,ru,en},
images: [], badges: ["hit","new","spicy"],
variants: [ {id, size:"30", dough:"thin", price, weight, kcal} ],
addons: [ {id, name, price} ],
removable: [ {id, name} ],
isCombo: false, comboItems: [], order, active
} ]
}
// BITTA hujjat — 100 read o'rniga 1 read. version o'zgarsa client qayta yuklaydi.

branches/{branchId}
{ name, address, lat, lng, phone,
workHours: {open:"10:00", close:"23:00"},
zones: [ {polygon:[[lat,lng],...], deliveryPrice, minOrder, etaMinutes} ],
stopList: ["productId1","variantId2"],
priceOverrides: { "variantId": 52000 },
active }

users/{uid}
{ phone, name, birthday, lang, bonusBalance, tier, totalSpent,
referralCode, referredBy, telegramId, blocked, createdAt }

users/{uid}/addresses/{addressId}
{ label, address, lat, lng, apartment, entrance, floor, intercom, comment }

users/{uid}/bonusHistory/{id}
{ type:"earn"|"spend"|"expire"|"gift", amount, orderId, expiresAt, createdAt }

orders/{orderId}
{ orderNumber, uid, phone, name,
branchId, type:"delivery"|"pickup",
address: {...}, lat, lng,
items: [ {productId, variantId, name, size, dough,
addons:[], removed:[], qty, unitPrice, total} ],
subtotal, deliveryPrice, discount, bonusUsed, total,
promoCode, paymentMethod, paymentStatus, transactionId,
status, statusHistory: [ {status, at, by} ],
courierId, courierLocation: {lat, lng, at},
scheduledFor, guaranteeDeadline, guaranteeBroken,
comment, cutlery, rating: {food, courier, text},
createdAt, deliveredAt }

promocodes/{code}
{ type:"percent"|"amount"|"freeDelivery"|"freeProduct",
value, minOrder, maxDiscount, usageLimit, usedCount,
perUserLimit, firstOrderOnly, validFrom, validTo,
branchIds: [], active }

banners/{id}
{ image:{uz,ru}, link, order, validFrom, validTo, active }

couriers/{uid}
{ name, phone, branchId, onShift, location:{lat,lng,at}, activeOrders: [] }

staff/{uid}
{ role, branchIds: [], name, active }

counters/orderNumber
{ value } // transaction bilan oshiriladi
```

**Security Rules qoidalari (asosiy):**
- `menu`, `branches`, `banners`, `settings` → hamma o'qiydi, faqat `staff` yozadi
- `orders` → mijoz faqat o'z buyurtmasini o'qiydi; **yaratishi mumkin, lekin `status`, `total`, `bonusUsed`, `paymentStatus` maydonlarini yozolmaydi** (Cloud Function yozadi)
- `users/{uid}` → faqat o'zi; `bonusBalance` va `tier` client tomondan yozilmaydi
- `promocodes` → client to'g'ridan-to'g'ri o'qimaydi, Function orqali tekshiriladi

---

## 3-QISM. Node servis nima qiladi

Faqat shu 6 vazifa (qolgani Firestore'da):

1. **Buyurtma yakunlash** — narxni qayta hisoblash (client narxiga ishonmaslik), promokod tekshirish, bonus yechish, `orderNumber` berish
2. **To'lov webhook** — Payme/Click callback, `paymentStatus` yangilash
3. **Telegram bot** — OTP yuborish, buyurtma statusi haqida xabar, admin guruhga yangi buyurtma
4. **Kafolat cron** — har daqiqada `guaranteeDeadline` o'tgan va hali yetkazilmagan buyurtmalarni topib, mijozga promokod berish
5. **Bonus cron** — muddati o'tgan bonuslarni kuydirish, tug'ilgan kun promokodi
6. **Hisobot** — kunlik yig'ma, admin uchun agregatsiya

---

## 4-QISM. Kod yozish uchun promptlar

> **Muhim:** hammasini bitta promptda so'rama — model yarim yo'lda uziladi.
> Quyidagi 8 bosqichni ketma-ket ber, har birida oldingi kodni kontekstga qo'sh.

### Bosqich 0 — asos (birinchi prompt)

```
Sen tajribali frontend dasturchisan. Menga pitsa yetkazish PWA ilovasining
ASOSINI yozib ber.

TEXNIK TALABLAR:
- Vanilla JavaScript (ES6 modullar), framework yo'q
- Firebase v10 modular SDK (CDN import)
- Mobile-first, iPhone Safari uchun optimallashtirilgan
- CSS o'zgaruvchilari bilan dark/light rejim
- Interfeys tili: o'zbek (lotin), i18n moduli bilan uz/ru/en
- Valyuta: UZS, "125 000 so'm" formatida

FAYL STRUKTURASI (aynan shunday yarat):
/index.html
/css/style.css
/js/config.js → Firebase init, konstantalar
/js/i18n.js → tarjimalar obyekti + t() funksiyasi
/js/db.js → BARCHA Firestore chaqiruvlari faqat shu yerda
/js/state.js → global holat, localStorage sync
/js/router.js → hash-based SPA router
/js/utils.js → narx formatlash, sana, debounce, point-in-polygon
/js/ui.js → toast, modal, skeleton, loader
/manifest.json
/sw.js

SHU BOSQICHDA FAQAT:
1. index.html — app shell: header, main#app, bottom nav (Menyu, Savat,
Buyurtmalar, Profil), safe-area inset
2. style.css — dizayn tizimi: rang o'zgaruvchilari, tipografiya, tugma,
kartochka, input, skeleton, bottom-sheet modal
3. router.js — hash router, sahifa registratsiyasi, orqaga tugmasi
4. state.js — savat, foydalanuvchi, til, tanlangan manzil; localStorage
5. i18n.js — 3 til, kamida 40 ta kalit
6. db.js — bo'sh skeleton, har funksiya nomi va JSDoc izohi bilan
7. utils.js, ui.js — to'liq
8. manifest.json va sw.js — app shell cache

QOIDALAR:
- Har fayl to'liq va ishga tayyor bo'lsin, "// TODO" qoldirma
- Firestore chaqiruvi faqat db.js da bo'lsin
- Kodda izohlar o'zbek tilida
- Har javobda 1-2 fayldan ortiq yozma, "davom et" desam keyingisini yoz

Birinchi: index.html va style.css ni yoz.
```

### Bosqich 1 — menyu
```
Endi menyu modulini yoz: /js/pages/menu.js va /js/pages/product.js

MA'LUMOT MODELI: [bu yerga yuqoridagi menu/current sxemasini nusxala]

TALABLAR:
- menu/current bitta hujjat sifatida o'qiladi, localStorage'ga version
bilan keshlanadi. version o'zgarmasa Firestore'ga umuman murojaat qilinmaydi
- Sticky kategoriya chiplari + scroll-spy
- Qidiruv (debounce 300ms), nom va tarkib bo'yicha
- Stop-list: branchId bo'yicha o'chirilgan mahsulot kulrang, bosilmaydi
- Mahsulot bosilganda bottom-sheet modal ochiladi:
rasm galereya (swipe), tavsif, o'lcham tanlash (narx real-time),
xamir turi, qo'shimcha ingredientlar (checkbox, narx qo'shadi),
olib tashlash (piyozsiz), miqdor +/-, "Savatga qo'shish"
- Skeleton loader, spinner emas
```

### Bosqich 2 — savat va checkout
```
/js/pages/cart.js va /js/pages/checkout.js yoz.

SAVAT: miqdor, o'chirish (undo toast bilan), promokod input,
minimal summa progress-bar, upsell blok, narx breakdown,
localStorage'ga saqlash.

CHECKOUT:
- Yetkazish/olib ketish tanlash
- Manzil tanlash (saqlanganlardan yoki yangi)
- Yetkazish vaqti: "Tez" yoki time picker
- To'lov: naqd / kuryerda karta / Payme / Click
- Qaytim summasi (naqd tanlansa)
- Idish-tovoq soni, izoh
- Bonus slider (mavjud balans, maksimum 50% gacha)
- Oferta checkbox
- Tasdiqlashda: db.createOrder() chaqiriladi, buyurtma sahifasiga o'tadi

MUHIM: yakuniy narx client'da KO'RSATILADI lekin server qayta hisoblaydi.
```

### Bosqich 3 — manzil va zona
```
/js/pages/address.js — Yandex Maps JS API bilan.
- Xaritada marker surish, manzilni reverse geocode qilish
- Qidiruv autocomplete
- Kvartira, podyezd, qavat, domofon maydonlari
- point-in-polygon bilan zona tekshiruvi (utils.js dagi funksiya)
- Zonaga qarab yetkazish narxi va minimal summani qaytarish
- Zonadan tashqarida: xato xabari + eng yaqin filialdan pickup taklifi
- Saqlangan manzillar: Uy/Ish/Boshqa, tahrirlash, o'chirish
```

### Bosqich 4 — auth
```
/js/pages/auth.js va /js/auth.js
- Telefon input +998 mask bilan
- "Kod olish" → Node servisga POST /api/auth/send-otp
- Kod Telegram bot orqali keladi (foydalanuvchi botni start qilgan bo'lsa)
yoki SMS orqali
- 6 xonali kod inputi (avtomatik keyingi katakka o'tish)
- Qayta yuborish taymeri 60 sek
- Tasdiqlash → custom token → signInWithCustomToken
- Mehmon rejimi: savat auth'siz to'ladi, checkout'da login so'raladi
```

### Bosqich 5 — treking va profil
```
/js/pages/order.js va /js/pages/profile.js

TREKING:
- onSnapshot bilan buyurtma real-time kuzatiladi
- 7 status uchun progress stepper, har biriga vaqt
- Kafolat taymeri orqaga sanaydi (35 daqiqa)
- Kuryer ismi, telefon, xaritada real-time marker
- Bekor qilish (faqat new/accepted)
- Yetkazilganda baholash modali

PROFIL: ism, tug'ilgan kun, til; buyurtmalar tarixi + "Takrorlash";
bonus balansi va tarixi; referal havola va ulashish;
saqlangan manzillar; akkauntni o'chirish.
```

### Bosqich 6 — Node backend
```
Node.js + Express servis yoz (Render'ga deploy uchun).
Firebase Admin SDK ishlatadi.

ENDPOINTLAR:
POST /api/auth/send-otp → kod generatsiya, Telegram/SMS yuborish
POST /api/auth/verify-otp → tekshirish, custom token qaytarish
POST /api/orders → NARXNI QAYTA HISOBLASH, promokod tekshirish,
bonus yechish, orderNumber transaction bilan,
Firestore'ga yozish, admin guruhga xabar
POST /api/payments/payme → Payme Merchant API webhook (to'liq protokol)
POST /api/payments/click → Click Prepare/Complete webhook
POST /api/orders/:id/status → status o'zgartirish (staff token bilan)

CRON (node-cron):
- Har daqiqa: kafolat muddati o'tganlarga promokod berish
- Har kuni 00:05: muddati o'tgan bonuslarni kuydirish
- Har kuni 09:00: tug'ilgan kun promokodlari
- Har kuni 23:59: kunlik hisobot admin guruhga

TELEGRAM BOT (node-telegram-bot-api):
- /start → telefon so'rash (contact tugmasi), telegramId ni users'ga bog'lash
- OTP yuborish
- Buyurtma statusi o'zgarganda mijozga xabar
- Admin guruhga yangi buyurtma (inline tugmalar: Qabul / Rad)

XAVFSIZLIK: client'dan kelgan narxga ishonma, hammasini menu/current dan
qayta hisobla. Payme/Click imzosini tekshir.
```

### Bosqich 7 — admin va KDS
```
Alohida PWA: /admin/
- Login (Firebase Auth + staff hujjatida rol tekshiruvi)
- Dashboard: bugungi buyurtma, tushum, o'rtacha chek, faol buyurtmalar
- Buyurtmalar oqimi: onSnapshot, yangi kelganda ovoz signali,
Qabul/Rad tugmalari, kuryerga tayinlash
- KDS ekrani: katta kartochkalar, taymer, "Tayyor" tugmasi (planshet uchun)
- Menyu CRUD, rasm Storage'ga yuklash (resize qilib)
- Stop-list toggle
- Filial CRUD + xaritada polygon chizish
- Promokod CRUD
- Mijozlar bazasi, hisobotlar (Chart.js grafik)
```

### Bosqich 8 — Security Rules
```
firestore.rules yoz. Talablar:
- menu, branches, banners, settings: read hamma, write faqat staff
- orders: mijoz faqat o'zinikini o'qiydi; yaratolmaydi (faqat server yaratadi);
update qilolmaydi
- users/{uid}: faqat o'zi read/write, LEKIN bonusBalance, tier, totalSpent,
blocked maydonlarini o'zgartirolmaydi
- promocodes: client read qilolmaydi
- couriers: kuryer faqat o'z location'ini yozadi
- staff: faqat superadmin yozadi
Har qoida ustiga izoh yoz.
```

---

## 5-QISM. Ishga tushirish tartibi

| Hafta | Nima |
|---|---|
| 1 | Bosqich 0–1: asos + menyu |
| 2 | Bosqich 2–3: savat, checkout, manzil |
| 3 | Bosqich 4–5: auth, treking, profil |
| 4 | Bosqich 6: Node servis + Telegram bot |
| 5 | Bosqich 7: admin + KDS |
| 6 | Bosqich 8 + test, naqd to'lov bilan ISHGA TUSHIR |
| 7+ | Payme/Click, bonus, referal |

**Birinchi versiyada bularni QO'SHMA:** online to'lov, bonus/cashback,
referal, pitsa konstruktori, kuryer xaritada. Naqd to'lov va oddiy
status trekingi bilan ishga tushir — mijoz kelgandan keyin qo'shasan.
