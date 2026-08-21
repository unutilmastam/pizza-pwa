/**
 * Fon vazifalari: kafolat, bonus va kunlik hisobot (SPEC 4.4–4.6).
 *
 * RENDER BEPUL PLANI HAQIDA
 * Bepul web-service 15 daqiqa so'rovsiz qolsa uxlaydi va cron shu vaqtda
 * ISHLAMAYDI. Shuning uchun:
 *  - hech bir vazifa "har daqiqada bir marta ishlagan" degan taxminga
 *    tayanmaydi — hammasi holat bo'yicha ishlaydi (`guaranteeBroken`
 *    bayrog'i, `bonusExpired` bayrog'i), ya'ni kechikib ishga tushsa ham
 *    o'tkazib yuborilganini topib bajaradi;
 *  - servis uyg'onganda vazifalar bir marta darhol chaqiriladi
 *    (`runCatchUp`), shunda uyqu davridagi qarz yopiladi;
 *  - hisobot esa "oxirgi yopilmagan kun" bo'yicha yuboriladi.
 *
 * Uyqu umuman kerak bo'lmasa: tashqi ping xizmati (masalan cron-job.org)
 * `/api/health` ni har 10 daqiqada chaqirsa, servis uyg'oq qoladi.
 * README dagi deploy bo'limiga qarang.
 */

import cron from 'node-cron';
import { config } from './config.js';
import { getDb, getFieldTypes } from './firebase.js';
import { sendTelegramLog, sendMessage } from './telegram.js';

/** Bir yugurishda ko'rib chiqiladigan hujjatlar chegarasi. */
const BATCH = 200;

/** Kafolat buzilganda beriladigan promokod qiymati (so'm). */
const GUARANTEE_PROMO_AMOUNT = 20000;

/**
 * Kafolat: muddati o'tgan, hali yetkazilmagan buyurtmalarni belgilaydi
 * va mijozga promokod beradi.
 * @returns {Promise<number>} nechta buyurtma belgilandi
 */
export async function runGuaranteeJob() {
  const db = await getDb();
  const { Timestamp } = await getFieldTypes();
  const now = Timestamp.now();

  // DIQQAT: Firestore'da `null` timestamp'dan OLDIN turadi, shuning uchun
  // faqat `< now` deb yozilsa `guaranteeDeadline: null` bo'lgan
  // (oldindan rejalashtirilgan) buyurtmalar ham tushib qoladi. Quyi
  // chegara ularni chetlab o'tadi.
  const snap = await db.collection('orders')
    .where('guaranteeBroken', '==', false)
    .where('guaranteeDeadline', '>', Timestamp.fromMillis(0))
    .where('guaranteeDeadline', '<', now)
    .limit(BATCH)
    .get();

  let count = 0;
  for (const doc of snap.docs) {
    const order = doc.data();
    if (!order.guaranteeDeadline) continue;
    if (order.status === 'delivered' || order.status === 'cancelled') {
      // Vaqtida yetkazilgan — bayroqni yopamiz, boshqa ko'rilmasin
      await doc.ref.update({ guaranteeBroken: false, guaranteeClosed: true });
      continue;
    }
    if (order.guaranteeClosed) continue;

    const code = `KAFOLAT${order.orderNumber}`;
    const batch = db.batch();
    batch.update(doc.ref, { guaranteeBroken: true, guaranteeClosed: true, guaranteePromo: code });
    batch.set(db.collection('promocodes').doc(code), {
      type: 'amount',
      value: GUARANTEE_PROMO_AMOUNT,
      minOrder: 0,
      usageLimit: 1,
      usedCount: 0,
      perUserLimit: 1,
      firstOrderOnly: false,
      validFrom: now,
      validTo: Timestamp.fromMillis(Date.now() + 30 * 86400000),
      branchIds: [],
      issuedTo: order.uid,
      reason: `guarantee:${doc.id}`,
      active: true
    });
    await batch.commit();
    count += 1;

    const userSnap = await db.collection('users').doc(order.uid).get();
    const telegramId = userSnap.data()?.telegramId;
    if (telegramId) {
      await sendMessage(
        telegramId,
        `Kechirasiz, #${order.orderNumber} buyurtmasi kafolat vaqtidan kechikdi.\n` +
        `Sizga <b>${GUARANTEE_PROMO_AMOUNT / 1000} 000 so'mlik</b> promokod: <code>${code}</code>`
      );
    }
  }

  if (count) await sendTelegramLog(`⏰ Kafolat buzildi: ${count} ta buyurtma`);
  return count;
}

/**
 * Bonus: muddati o'tgan bonuslarni kuydiradi.
 * @returns {Promise<number>} nechta yozuv kuydirildi
 */
export async function runBonusJob() {
  const db = await getDb();
  const { FieldValue, Timestamp } = await getFieldTypes();
  const now = Timestamp.now();

  // collectionGroup — barcha foydalanuvchilarning bonus tarixi bo'ylab
  const snap = await db.collectionGroup('bonusHistory')
    .where('type', '==', 'earn')
    .where('expiresAt', '>', Timestamp.fromMillis(0))
    .where('expiresAt', '<', now)
    .limit(BATCH)
    .get();

  let count = 0;
  for (const doc of snap.docs) {
    const entry = doc.data();
    if (entry.expired || !entry.expiresAt) continue;

    const userRef = doc.ref.parent.parent;
    if (!userRef) continue;

    const amount = Math.max(0, Number(entry.amount) || 0);
    const batch = db.batch();
    batch.update(doc.ref, { expired: true });
    if (amount > 0) {
      batch.set(userRef, { bonusBalance: FieldValue.increment(-amount) }, { merge: true });
      batch.set(userRef.collection('bonusHistory').doc(), {
        type: 'expire',
        amount: -amount,
        orderId: entry.orderId ?? null,
        createdAt: now
      });
    }
    await batch.commit();
    count += 1;
  }

  // Balans manfiyga tushib qolmasin (bir vaqtda ikki jarayon ishlagan holat)
  if (count) await sendTelegramLog(`💸 Muddati o'tgan bonus: ${count} ta yozuv`);
  return count;
}

/**
 * Kunlik hisobot — kechagi buyurtmalarni yig'ib admin guruhga yuboradi.
 * @param {Date} [day] - qaysi kun uchun (standart: kecha)
 * @returns {Promise<object>} hisobot
 */
export async function runReportJob(day) {
  const db = await getDb();
  const { Timestamp } = await getFieldTypes();

  const target = day ? new Date(day) : new Date(Date.now() - 86400000);
  const start = new Date(target);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400000);

  const snap = await db.collection('orders')
    .where('createdAt', '>=', Timestamp.fromDate(start))
    .where('createdAt', '<', Timestamp.fromDate(end))
    .get();

  const report = {
    date: start.toISOString().slice(0, 10),
    orders: snap.size,
    delivered: 0,
    cancelled: 0,
    revenue: 0,
    guaranteeBroken: 0,
    byPayment: { cash: 0, card: 0 }
  };

  snap.docs.forEach((doc) => {
    const order = doc.data();
    if (order.status === 'delivered') {
      report.delivered += 1;
      report.revenue += Number(order.total) || 0;
    }
    if (order.status === 'cancelled') report.cancelled += 1;
    if (order.guaranteeBroken) report.guaranteeBroken += 1;
    if (report.byPayment[order.paymentMethod] !== undefined) {
      report.byPayment[order.paymentMethod] += 1;
    }
  });

  await db.collection('reports').doc(report.date).set({
    ...report,
    createdAt: Timestamp.now()
  });

  await sendTelegramLog(
    `📊 <b>${report.date}</b>\n` +
    `Buyurtma: ${report.orders} (yetkazildi ${report.delivered}, bekor ${report.cancelled})\n` +
    `Tushum: ${String(report.revenue).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm\n` +
    `Naqd ${report.byPayment.cash} · Karta ${report.byPayment.card}\n` +
    `Kafolat buzilgan: ${report.guaranteeBroken}`
  );

  return report;
}

/**
 * Vazifani xatosiz o'raydi — bittasi yiqilsa qolganlari ishlashda davom etadi.
 * @param {string} name
 * @param {() => Promise<*>} job
 * @returns {Promise<void>}
 */
async function safe(name, job) {
  try {
    await job();
  } catch (e) {
    console.error(`[cron] ${name} xatosi:`, e.message);
  }
}

/** Oxirgi hisobot yuborilgan kun — takror yubormaslik uchun. */
let lastReportDate = '';

/**
 * Servis uyg'onganda bir marta ishlaydi: uyqu davrida o'tkazib yuborilgan
 * ishlarni bajaradi.
 * @returns {Promise<void>}
 */
export async function runCatchUp() {
  await safe('guarantee', runGuaranteeJob);
  await safe('bonus', runBonusJob);
}

/**
 * Cron jadvalini yoqadi.
 *
 * `ENABLE_CRON=false` bo'lsa umuman yoqilmaydi — bir nechta instansiya
 * bo'lsa faqat bittasida yoqib qo'yish uchun.
 *
 * @returns {Array<object>} yoqilgan vazifalar
 */
export function startCron() {
  if (!config.enableCron) {
    console.log('[cron] o\'chirilgan (ENABLE_CRON=false)');
    return [];
  }

  const tasks = [];

  // Kafolat — har daqiqada (servis uyg'oq bo'lganda)
  tasks.push(cron.schedule('* * * * *', () => safe('guarantee', runGuaranteeJob)));

  // Bonus — har soatda. Kunda bir marta yetardi, lekin uyqu tufayli
  // aniq soatga tayanib bo'lmaydi; ish holat bo'yicha idempotent.
  tasks.push(cron.schedule('7 * * * *', () => safe('bonus', runBonusJob)));

  // Hisobot — har soatda tekshiriladi, kecha uchun bir marta yuboriladi
  tasks.push(cron.schedule('13 * * * *', () => safe('report', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (lastReportDate === yesterday) return;
    await runReportJob();
    lastReportDate = yesterday;
  })));

  console.log('[cron] yoqildi: kafolat, bonus, hisobot');

  // Uyg'onish paytidagi qarzni darhol yopamiz
  runCatchUp().catch(() => {});

  return tasks;
}
