/**
 * Express oraliq qatlamlari: CORS, autentifikatsiya, limit, xato.
 */

import { config } from './config.js';
import { getAuth } from './firebase.js';
import { httpError } from './otp.js';

/**
 * CORS — ruxsat berilgan manbalar `ALLOWED_ORIGINS` da.
 * Ro'yxat bo'sh bo'lsa (dev) hamma manbaga ruxsat beriladi.
 *
 * @returns {import('express').RequestHandler}
 */
export function cors() {
  const allowed = config.allowedOrigins;
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (!allowed.length || allowed.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
}

/**
 * Firebase ID tokenini tekshiradi va `req.user` ga yozadi.
 * @type {import('express').RequestHandler}
 */
export async function requireAuth(req, res, next) {
  try {
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw httpError(401, 'no-token', 'Token yo\'q');

    const auth = await getAuth();
    const decoded = await auth.verifyIdToken(token);
    req.user = { uid: decoded.uid, phone: decoded.phone_number || decoded.phone || null };
    next();
  } catch (e) {
    if (e.status) next(e);
    else next(httpError(401, 'bad-token', 'Token yaroqsiz'));
  }
}

/**
 * Faqat `ADMIN_UIDS` ro'yxatidagilar uchun. `requireAuth` dan keyin turadi.
 * @type {import('express').RequestHandler}
 */
export function requireAdmin(req, res, next) {
  if (!req.user || !config.rules.adminUids.includes(req.user.uid)) {
    next(httpError(403, 'not-admin', 'Ruxsat yo\'q'));
    return;
  }
  next();
}

/** IP bo'yicha so'rov sanog'i — xotirada (bitta instansiya uchun yetarli). */
const hits = new Map();

/**
 * Oddiy tezlik cheklovi.
 * @param {{windowMs: number, max: number}} opts
 * @returns {import('express').RequestHandler}
 */
export function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const key = `${req.path}:${req.ip}`;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now > entry.reset) {
      hits.set(key, { count: 1, reset: now + windowMs });
      next();
      return;
    }
    if (entry.count >= max) {
      next(httpError(429, 'rate-limited', 'Juda ko\'p so\'rov'));
      return;
    }
    entry.count += 1;
    next();
  };
}

/** Xotira o'smasin — eskirgan yozuvlar vaqti-vaqti bilan tozalanadi. */
setInterval(() => {
  const now = Date.now();
  hits.forEach((entry, key) => {
    if (now > entry.reset) hits.delete(key);
  });
}, 300000).unref();

/**
 * Yagona xato javobi. Ichki xatolar mijozga tafsilotsiz ketadi.
 * @type {import('express').ErrorRequestHandler}
 */
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  if (status >= 500) console.error('[api]', req.method, req.path, err);

  const body = {
    error: err.code || 'internal',
    message: status >= 500 ? 'Server xatosi' : err.message
  };
  if (err.resendAfter) body.resendAfter = err.resendAfter;
  if (err.minOrder) body.minOrder = err.minOrder;
  if (err.productId) body.productId = err.productId;

  res.status(status).json(body);
}
