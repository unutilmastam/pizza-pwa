/**
 * Firebase Admin SDK — dangasa (lazy) init.
 *
 * Xizmat akkaunti kaliti KODDA YO'Q: `config.firebase` uni faqat
 * environment o'zgaruvchilaridan oladi. Kalit bo'lmasa init qilinmaydi
 * va aniq xato tashlanadi — process yiqilmaydi, `/api/health` javob
 * berib turadi.
 */

import { config } from './config.js';

/** @type {?import('firebase-admin/app').App} */
let app = null;

/**
 * Admin ilovasini bir marta yaratadi.
 * @returns {Promise<import('firebase-admin/app').App>}
 */
async function getApp() {
  if (app) return app;

  const { projectId, clientEmail, privateKey } = config.firebase;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase xizmat akkaunti sozlanmagan (env o\'zgaruvchilarni tekshiring)');
  }

  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  app = getApps()[0] || initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId
  });
  return app;
}

/**
 * Firestore namunasi.
 * @returns {Promise<import('firebase-admin/firestore').Firestore>}
 */
export async function getDb() {
  const instance = await getApp();
  const { getFirestore } = await import('firebase-admin/firestore');
  return getFirestore(instance);
}

/**
 * Auth namunasi (custom token, ID token tekshiruvi).
 * @returns {Promise<import('firebase-admin/auth').Auth>}
 */
export async function getAuth() {
  const instance = await getApp();
  const { getAuth: get } = await import('firebase-admin/auth');
  return get(instance);
}

/**
 * Firestore yordamchi tiplari (FieldValue, Timestamp).
 * @returns {Promise<{FieldValue: object, Timestamp: object}>}
 */
export async function getFieldTypes() {
  const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
  return { FieldValue, Timestamp };
}

/**
 * Firestore ulanishini tekshiradi — `/api/health` uchun.
 * @returns {Promise<boolean>}
 */
export async function pingDb() {
  const db = await getDb();
  await db.collection('settings').doc('global').get();
  return true;
}
