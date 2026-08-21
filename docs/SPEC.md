# Pitsa yetkazish ilovasi — texnik spetsifikatsiya

Stek: Vanilla JS PWA + Firebase (Auth / Firestore / Storage) + Node servis (Render) + Telegram bot.

> Bu fayl — ma'lumotnoma. Bu yerdagi funksiyalarning hammasini birdan yozma.
> Nima yozilishi kerakligini `docs/PROGRESS.md` belgilaydi.

---

## 1. Funksiya ro'yxati

### A. Onboarding
1. Til tanlash: uz / ru / en (barcha matn `i18n.js` da)
2. Shahar tanlash (bir nechta shahar bo'lsa)
3. Yetkazish turi: dostavka yoki olib ketish (pickup)
4. PWA install banner
5. Birinchi kirishda joylashuvni so'rash

### B. Manzil va zona
6. Xaritadan manzil tanlash (Yandex Maps)
7. Manzil qidirish (autocomplete)
8. Qo'shimcha maydonlar: kvartira, podyezd, qavat, domofon, mo'ljal
9. Saqlangan manzillar: Uy / Ish / Boshqa, tahrirlash, o'chirish
10. Yetkazish zonasi tekshiruvi — point-in-polygon
11. Zonaga qarab: yetkazish narxi + minimal buyurtma summasi
12. Zonadan tashqarida: xato xabari + eng yaqin filialdan pickup taklifi
13. Pickup uchun filial tanlash, masofa bo'yicha saralash

### C. Autentifikatsiya
14. Telefon raqam kiritish (+998 mask)
15. OTP: Telegram bot orqali yoki SMS (Eskiz / Play Mobile)
16. Kodni qayta yuborish taymeri (60 sek)
17. Sessiya saqlash
18. Chiqish
19. Mehmon rejimi — savat auth'siz to'ladi, checkout'da login so'raladi

### D. Menyu va katalog
20. Bosh sahifa: banner slayder, kategoriya chiplari, tavsiya blok
21. Kategoriyalar: Pitsa, Kombo, Zakuska, Salat, Desert, Ichimlik, Sous
22. Sticky kategoriya navigatsiyasi + scroll-spy
23. Qidiruv (nom va tarkib bo'yicha)
24. Filtrlar: vegetarian, achchiq, halol, narx oralig'i
25. Stop-list — filialda tugagan mahsulot kulrang, bosilmaydi
26. Mahsulot kartochkasi: rasm, nom, qisqa tarkib, "dan" narxi
27. Sevimlilar

### E. Mahsulot detali
28. Rasm galereya (swipe)
29. To'liq tavsif, tarkib, allergenlar
30. KBJU / kaloriya
31. O'lcham: 25 / 30 / 35 sm — narx real-time
32. Xamir turi: yupqa / an'anaviy
33. Ingredient qo'shish (topping, narx qo'shadi)
34. Ingredient olib tashlash ("piyozsiz")
35. Miqdor +/- va yakuniy narx
36. "Savatga" tugmasi

### F. Pitsa konstruktori
37. Bo'sh asosdan: o'lcham → xamir → sous → pishloq → ingredientlar
38. Vizual preview
39. Narx real-time
40. Yarim-yarim pitsa (ixtiyoriy)
41. Yig'ilgan pitsani saqlash

### G. Kombo
42. Kombo tarkibi ko'rinadi
43. Ichidagi mahsulotni almashtirish
44. Kombo chegirmasi

### H. Savat
45. Miqdor, o'chirish (undo bilan)
46. Promokod
47. Minimal summa nazorati
48. Bepul yetkazish progress-bar
49. Upsell blok
50. localStorage'da saqlanadi
51. Narx breakdown

### I. Checkout
52. Manzil yoki filial tasdiqlash
53. Yetkazish vaqti: "Tez" yoki time picker
54. To'lov: naqd / kuryerda karta / Payme / Click / Uzum
55. Qaytim summasi
56. Idish-tovoq soni
57. Izoh
58. Bonus slider
59. Oferta checkbox
60. Buyurtma yaratish

### J. To'lov
61. Payme / Click / Uzum redirect
62. Webhook orqali tasdiqlash
63. `payment_failed` statusi
64. Karta saqlash (token)
65. Refund (admin)

### K. Treking
66. Statuslar: `new → accepted → cooking → in_oven → packing → on_way → delivered`
67. Progress stepper + vaqt shtampi
68. Kafolat taymeri (35 daqiqa)
69. Kuryer ismi, telefon, qo'ng'iroq
70. Kuryer xaritada real-time
71. Bekor qilish (faqat new / accepted)
72. Baholash oynasi

### L. Sodiqlik
73. Cashback 2%
74. Bonus balansi va tarixi
75. Bonus amal muddati (90 kun)
76. Darajalar: Bronza / Kumush / Oltin
77. Referal
78. Tug'ilgan kun promokodi
79. Promokodlar bo'limi

### M. Profil
80. Ism, telefon, tug'ilgan kun
81. Buyurtmalar tarixi + "Takrorlash"
82. Saqlangan manzillar
83. Saqlangan kartalar
84. Til va bildirishnoma sozlamalari
85. Akkauntni o'chirish

### N. Baholash
86. 1–5 yulduz
87. Taom va kuryer alohida
88. Matnli izoh + rasm
89. Past baho → admin alert

### O. Statik sahifalar
90. Aksiyalar
91. Filiallar (xarita, ish vaqti, telefon)
92. Biz haqimizda
93. Oferta, Maxfiylik siyosati
94. FAQ
95. Support (Telegram, call-center)
96. 404

### P. PWA
97. `manifest.json` + ikonkalar (192, 512, maskable)
98. Service worker: app shell cache + offline sahifa
99. Pull-to-refresh (iPhone)
100. Skeleton loader (spinner emas)
101. Haptic feedback
102. Safe-area inset
103. Dark / light rejim

---

## ADMIN PANEL

104. Login + rollar: `superadmin`, `manager`, `operator`, `kitchen`, `courier`
105. Dashboard: bugungi buyurtma, tushum, o'rtacha chek
106. Buyurtmalar oqimi — real-time, ovoz signali
107. Qabul / rad etish (sabab bilan)
108. Tayyorlanish vaqtini belgilash
109. KDS oshxona ekrani: kartochka, taymer, "Tayyor"
110. Kuryerga tayinlash
111. Menyu CRUD + rasm yuklash
112. Filialga qarab narx
113. Stop-list toggle
114. Filial CRUD + zona polygon chizish
115. Promokod CRUD
116. Banner CRUD
117. Mijozlar bazasi, qora ro'yxat
118. Hisobotlar (Chart.js)
119. Broadcast xabar
120. Sozlamalar
121. Audit log

## KURYER

122. Login, smena ochish/yopish
123. Tayinlangan buyurtmalar
124. "Oldim" → "Yo'ldaman" → "Yetkazdim"
125. Navigatsiya (Yandex Navigator deep link)
126. Naqd pul qabul qilindi belgisi
127. Geolokatsiya har 15 sek Firestore'ga
128. Kunlik hisob

---

## 2. Firestore ma'lumot modeli

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
  // BITTA hujjat — 100 read o'rniga 1 read.
  // Client localStorage'ga keshlaydi, version o'zgarmasa Firestore'ga
  // umuman murojaat qilmaydi. Bu eng muhim optimizatsiya.

branches/{branchId}
  { name, address, lat, lng, phone,
    workHours: {open:"10:00", close:"23:00"},
    zones: [ {name, polygon:[{lat,lng},...], deliveryPrice, minOrder, etaMinutes} ],
    // DIQQAT: polygon nuqtalari OBYEKT — Firestore ichma-ich massivni
    // qabul qilmaydi ("Nested arrays are not supported")
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
  { value }   // transaction bilan oshiriladi
```

---

## 3. Security Rules qoidalari

- `menu`, `branches`, `banners`, `settings` → read hamma, write faqat `staff`
- `orders` → mijoz faqat o'z buyurtmasini o'qiydi. Client buyurtma
  yaratolmaydi va yangilay olmaydi — faqat Node servis yozadi
- `users/{uid}` → faqat o'zi read/write, LEKIN `bonusBalance`, `tier`,
  `totalSpent`, `blocked` maydonlarini o'zgartirolmaydi
- `promocodes` → client read qilolmaydi, Node servis tekshiradi
- `couriers` → kuryer faqat o'z `location` maydonini yozadi
- `staff` → faqat `superadmin` yozadi

---

## 4. Node servis vazifalari

Faqat shu 6 ta. Qolgani Firestore'da bevosita.

1. **Buyurtma yakunlash** — narxni `menu/current` dan QAYTA HISOBLASH
   (client narxiga ishonma), promokod tekshirish, bonus yechish,
   `orderNumber` transaction bilan berish
2. **To'lov webhook** — Payme / Click callback, imzo tekshirish,
   `paymentStatus` yangilash
3. **Telegram bot** — OTP yuborish, status xabari, admin guruhga buyurtma
4. **Kafolat cron** — har daqiqada `guaranteeDeadline` o'tganlarni topib
   mijozga promokod berish
5. **Bonus cron** — muddati o'tgan bonusni kuydirish, tug'ilgan kun promokodi
6. **Hisobot** — kunlik agregatsiya

---

## 5. Kod yozish qoidalari

- Vanilla JavaScript, ES6 modullar. Framework yo'q.
- Firebase v10 modular SDK, CDN import.
- Mobile-first, iPhone Safari uchun optimallashtirilgan.
- **BARCHA Firestore chaqiruvi faqat `js/db.js` da.** Boshqa faylda
  `getDoc`, `setDoc`, `collection` ishlatilmaydi.
- Interfeys tili o'zbek (lotin), matnlar `js/i18n.js` da.
- Valyuta: UZS, `125 000 so'm` formatida.
- Kod izohlari o'zbek tilida.
- `// TODO` qoldirilmaydi. Yozilgan funksiya to'liq ishlashi kerak.

### Fayl strukturasi

```
/index.html
/css/style.css
/js/config.js       Firebase init, konstantalar
/js/i18n.js         tarjimalar + t()
/js/db.js           BARCHA Firestore chaqiruvlari
/js/state.js        global holat, localStorage sync
/js/router.js       hash-based SPA router
/js/utils.js        narx, sana, debounce, point-in-polygon
/js/ui.js           toast, modal, skeleton, loader
/js/pages/*.js      har sahifa alohida modul
/manifest.json
/sw.js
/admin/             alohida PWA
/server/            Node servis
```
