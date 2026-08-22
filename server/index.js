/**
 * Pizza PWA — Node servis (Express + Firebase Admin SDK).
 *
 * SPEC 4-bo'limdagi vazifalar: buyurtma yakunlash, OTP, Telegram,
 * kafolat/bonus cron va kunlik hisobot.
 *
 * TO'LOV: Payme/Click integratsiyasi bu bosqichda YOZILMAGAN — keyinga
 * qoldirilgan. Hozir faqat naqd va kuryerda karta, ikkalasi ham
 * buyurtmada belgi (`paymentMethod`) sifatida saqlanadi.
 *
 * MAXFIY KALITLAR: hech biri kodda yo'q — hammasi `process.env` dan.
 */

import express from 'express';
import { config, checkConfig, keyDiagnostics } from './src/config.js';
import { pingDb } from './src/firebase.js';
import { requestOtp, verifyOtp, httpError } from './src/otp.js';
import {
  createOrder, updateStatus, assignCourier, cancelOwnOrder, PAYMENT_METHODS
} from './src/orders.js';
import { startCron, runGuaranteeJob, runBonusJob, runReportJob } from './src/cron.js';
import {
  claimCourier, courierUpdateStatus, courierReport
} from './src/couriers.js';
import {
  cors, requireAuth, requireAdmin, requireStaff, rateLimit, errorHandler
} from './src/middleware.js';

/** Buyurtma oqimini boshqara oladigan rollar (SPEC 104). */
const ORDER_ROLES = ['superadmin', 'manager', 'operator', 'kitchen'];

/** Kuryer tayinlay oladigan rollar — oshxona buni qilmaydi. */
const DISPATCH_ROLES = ['superadmin', 'manager', 'operator'];

const app = express();
const started = Date.now();

app.set('trust proxy', 1); // Render proxy orqasida ishlaydi — req.ip to'g'ri bo'lsin
app.use(express.json({ limit: '256kb' }));
app.use(cors());

/**
 * Async yo'lni xatosi bilan birga Express'ga ulaydi.
 * @param {Function} handler
 * @returns {import('express').RequestHandler}
 */
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

/**
 * Middleware'ni FAQAT `?deep=1` so'rovida ishlatadi.
 *
 * Oddiy `/api/health` ochiq qolishi kerak — uni tashqi ping xizmati
 * (Render uyqusiga qarshi) autentifikatsiyasiz chaqiradi. `?deep=1` esa
 * diagnostika: u Firestore'ga so'rov yuboradi va xizmat akkaunti
 * haqida ma'lumot qaytaradi, shuning uchun yopiq bo'lishi shart.
 *
 * @param {import('express').RequestHandler} middleware
 * @returns {import('express').RequestHandler}
 */
const deepOnly = (middleware) => (req, res, next) => (
  req.query.deep ? middleware(req, res, next) : next()
);

// --- Health ---------------------------------------------------------------
// Render bepul planida servis uxlaydi. Tashqi ping xizmati shu manzilni
// chaqirib turadi; javob yengil bo'lishi uchun Firestore faqat
// `?deep=1` bilan tekshiriladi — u esa `ADMIN_UIDS` uchun.
app.get('/api/health', deepOnly(requireAuth), deepOnly(requireAdmin), wrap(async (req, res) => {
  const problems = checkConfig();
  const body = {
    ok: problems.length === 0,
    env: config.env,
    uptimeSeconds: Math.round((Date.now() - started) / 1000),
    cron: config.enableCron,
    payments: PAYMENT_METHODS,
    problems
  };

  if (req.query.deep) {
    // Xizmat akkaunti diagnostikasi — kalitning O'ZI hech qachon
    // qaytarilmaydi, faqat o'lchamlar va shakl belgilari. Bu
    // UNAUTHENTICATED sababini (yarim ko'chirilgan kalit, boshqa
    // loyihaning akkaunti) topish uchun kerak.
    body.credentials = keyDiagnostics();

    try {
      await pingDb();
      body.firestore = 'ok';
    } catch (e) {
      body.ok = false;
      body.firestore = {
        code: e.code ?? null,
        status: e.status ?? null,
        message: String(e.message || '').slice(0, 300),
        hint: firestoreHint(e)
      };
    }
  }

  res.json(body);
}));

/**
 * Firestore xatosining eng ehtimolli sababini aytadi.
 * @param {*} error
 * @returns {?string}
 */
function firestoreHint(error) {
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toUpperCase();

  if (text.includes('UNAUTHENTICATED') || text.includes('INVALID_GRANT')) {
    return 'Kalit o\'qildi, lekin Google uni qabul qilmadi. Odatdagi sabablar: ' +
      '(1) kalit Firebase konsolida o\'chirilgan yoki almashtirilgan — yangi ' +
      'xizmat akkaunti kaliti yarating; (2) FIREBASE_CLIENT_EMAIL boshqa ' +
      'akkauntdan, private key esa boshqasidan — uchala qiymat BITTA JSON ' +
      'fayldan olinsin; (3) kalit to\'liq ko\'chirilmagan — shu javobdagi ' +
      'credentials.keyBodyLength ~1600 va keyLines ~28 bo\'lishi kerak.';
  }
  if (text.includes('PERMISSION_DENIED')) {
    return 'Xizmat akkauntida huquq yetarli emas yoki Firestore API yoqilmagan.';
  }
  if (text.includes('NOT_FOUND')) {
    return 'Loyihada Firestore bazasi yaratilmagan yoki projectId noto\'g\'ri.';
  }
  if (text.includes('DECODER') || text.includes('PEM')) {
    return 'Kalit PEM shaklida emas — README dagi base64 variantini ishlating.';
  }
  return null;
}

// --- Auth -----------------------------------------------------------------
app.post('/api/auth/send-otp', rateLimit({ windowMs: 600000, max: 10 }), wrap(async (req, res) => {
  const result = await requestOtp(req.body?.phone);
  res.json(result);
}));

app.post('/api/auth/verify-otp', rateLimit({ windowMs: 600000, max: 20 }), wrap(async (req, res) => {
  const result = await verifyOtp(req.body?.phone, req.body?.code);
  res.json(result);
}));

// --- Buyurtma -------------------------------------------------------------
app.post('/api/orders', requireAuth, rateLimit({ windowMs: 60000, max: 10 }), wrap(async (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    throw httpError(400, 'bad-body', 'So\'rov tanasi noto\'g\'ri');
  }
  // Idempotency kaliti: sarlavhada yoki tanada. Render uyqudan
  // uyg'onganda birinchi so'rov client tomonda timeout bo'lishi mumkin,
  // lekin server uni bajarib bo'ladi — shu kalit takroriy bosishda
  // ikkinchi buyurtma yaratilishiga yo'l qo'ymaydi.
  const order = await createOrder({
    uid: req.user.uid,
    phone: req.user.phone,
    payload,
    idempotencyKey: req.headers['idempotency-key'] || payload.idempotencyKey
  });
  // Takrori bo'lsa 200: yangi resurs yaratilmadi
  res.status(order.duplicate ? 200 : 201).json(order);
}));

// Statusni admin panelidagi xodim o'zgartiradi. Huquq `staff/{uid}`
// hujjatidagi rol bo'yicha beriladi; ADMIN_UIDS bootstrap yo'li bo'lib
// qoladi (birinchi xodim yaratilgunicha).
app.patch('/api/orders/:id/status', requireAuth, requireStaff(ORDER_ROLES), wrap(async (req, res) => {
  const result = await updateStatus({
    orderId: req.params.id,
    status: String(req.body?.status || ''),
    reason: req.body?.reason,
    etaMinutes: req.body?.etaMinutes,
    by: req.user.uid
  });
  res.json(result);
}));

// Mijoz O'Z buyurtmasini bekor qiladi. Xodim emas — shuning uchun
// `requireStaff` yo'q, lekin `cancelOwnOrder()` egalikni va bosqichni
// o'zi tekshiradi.
app.patch('/api/orders/:id/cancel', requireAuth, rateLimit({ windowMs: 60000, max: 10 }), wrap(async (req, res) => {
  const result = await cancelOwnOrder({ orderId: req.params.id, uid: req.user.uid });
  res.json(result);
}));

/* ------------------------------------------------------------ kuryer */

// Kuryer birinchi marta kirganda `pending_<telefon>` hujjati
// `couriers/{uid}` ga ko'chiriladi (SPEC 122).
app.post('/api/courier/claim', requireAuth, rateLimit({ windowMs: 60000, max: 20 }), wrap(async (req, res) => {
  const courier = await claimCourier({ uid: req.user.uid, phone: req.user.phone });
  res.json(courier);
}));

// Kuryer O'ZIGA tayinlangan buyurtma statusini o'zgartiradi.
// `requireStaff` YO'Q: kuryer `staff` da bo'lmasligi mumkin —
// egalik va ruxsat etilgan status `courierUpdateStatus()` da
// tekshiriladi (faqat on_way / delivered, faqat o'zinikiga).
app.patch('/api/orders/:id/courier-status', requireAuth, rateLimit({ windowMs: 60000, max: 60 }), wrap(async (req, res) => {
  const result = await courierUpdateStatus({
    orderId: req.params.id,
    uid: req.user.uid,
    status: String(req.body?.status || ''),
    cashCollected: Boolean(req.body?.cashCollected)
  });
  res.json(result);
}));

// Kunlik hisob (SPEC 128)
app.get('/api/courier/report', requireAuth, wrap(async (req, res) => {
  const report = await courierReport({ uid: req.user.uid, date: req.query.date });
  res.json(report);
}));

// Kuryer tayinlash (SPEC 110)
app.patch('/api/orders/:id/courier', requireAuth, requireStaff(DISPATCH_ROLES), wrap(async (req, res) => {
  const result = await assignCourier({
    orderId: req.params.id,
    courierId: String(req.body?.courierId || ''),
    by: req.user.uid
  });
  res.json(result);
}));

// --- Fon vazifalarini qo'lda ishga tushirish (admin) ----------------------
// Render bepul planida servis uxlab qolsa cron o'tkazib yuboriladi —
// shunda bu manzil orqali qarzni qo'lda yopish mumkin.
app.post('/api/jobs/:name', requireAuth, requireAdmin, wrap(async (req, res) => {
  const jobs = {
    guarantee: runGuaranteeJob,
    bonus: runBonusJob,
    report: () => runReportJob(req.body?.date)
  };
  const job = jobs[req.params.name];
  if (!job) throw httpError(404, 'no-job', 'Bunday vazifa yo\'q');
  res.json({ ok: true, result: await job() });
}));

// --- 404 va xatolar -------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: 'not-found', message: 'Manzil topilmadi' });
});
app.use(errorHandler);

// --- Ishga tushirish ------------------------------------------------------
const problems = checkConfig();
if (problems.length) {
  console.warn('[config] muammolar:');
  problems.forEach((p) => console.warn(`  - ${p}`));
  console.warn('[config] servis ishlaydi, lekin bu qismlar to\'liq bo\'lmaydi');
}

app.listen(config.port, () => {
  console.log(`[server] ${config.env} rejimida ${config.port}-portda tinglayapti`);
  startCron();
});

// Render konteynerni to'xtatganda ochiq so'rovlar tugashini kutamiz
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM — to\'xtatilmoqda');
  process.exit(0);
});

export default app;
