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
import { config, checkConfig } from './src/config.js';
import { pingDb } from './src/firebase.js';
import { requestOtp, verifyOtp, httpError } from './src/otp.js';
import { createOrder, updateStatus, PAYMENT_METHODS } from './src/orders.js';
import { startCron, runGuaranteeJob, runBonusJob, runReportJob } from './src/cron.js';
import { cors, requireAuth, requireAdmin, rateLimit, errorHandler } from './src/middleware.js';

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

// --- Health ---------------------------------------------------------------
// Render bepul planida servis uxlaydi. Tashqi ping xizmati shu manzilni
// chaqirib turadi; javob yengil bo'lishi uchun Firestore faqat
// `?deep=1` bilan tekshiriladi.
app.get('/api/health', wrap(async (req, res) => {
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
    try {
      await pingDb();
      body.firestore = 'ok';
    } catch (e) {
      body.ok = false;
      body.firestore = e.message;
    }
  }

  res.json(body);
}));

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
  const order = await createOrder({
    uid: req.user.uid,
    phone: req.user.phone,
    payload
  });
  res.status(201).json(order);
}));

// Statusni faqat admin o'zgartiradi (kuryer paneli keyingi bosqichda)
app.patch('/api/orders/:id/status', requireAuth, requireAdmin, wrap(async (req, res) => {
  const result = await updateStatus({
    orderId: req.params.id,
    status: String(req.body?.status || ''),
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
