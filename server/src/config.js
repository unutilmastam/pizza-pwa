/**
 * Muhit o'zgaruvchilarini o'qish va tekshirish.
 *
 * MAXFIY QIYMATLAR KODDA YO'Q — hammasi `process.env` dan olinadi.
 * Namuna uchun `.env.example` ga qarang.
 */

/**
 * Satr o'zgaruvchini o'qiydi.
 * @param {string} name
 * @param {string} [fallback]
 * @returns {string}
 */
function str(name, fallback = '') {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : String(value).trim();
}

/**
 * Butun son o'zgaruvchi.
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function int(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Vergul bilan ajratilgan ro'yxat.
 * @param {string} name
 * @returns {string[]}
 */
function list(name) {
  return str(name)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Firebase xizmat akkauntining private key'ini o'qiydi.
 *
 * PEM kalit ko'p qatorli, environment o'zgaruvchisi esa bir qatorli —
 * shu sababli u Render'da eng ko'p muammo tug'diradigan qiymat:
 *
 *  - qatorlar `\n` ko'rinishida qolib ketsa → `error:1E08010C:DECODER
 *    routines::unsupported`;
 *  - qiymat qo'shtirnoq bilan kiritilsa, Render qo'shtirnoqni ham
 *    qiymatning bir qismi deb saqlaydi → `Invalid PEM formatted message`.
 *
 * Ishonchli yo'l — kalitni base64 ga o'girib `FIREBASE_PRIVATE_KEY_BASE64`
 * ga qo'yish: unda maxsus belgi ham, qator ko'chishi ham yo'q.
 * U bo'lsa shundan olinadi; bo'lmasa eski `FIREBASE_PRIVATE_KEY`
 * ishlatiladi va `\n` almashtiriladi.
 *
 * @returns {string} PEM kalit yoki bo'sh satr
 */
function readPrivateKey() {
  const base64 = str('FIREBASE_PRIVATE_KEY_BASE64');
  if (base64) {
    // Bo'shliq va qator ko'chishi base64 ichida ma'nosiz — tozalaymiz
    const clean = base64.replace(/\s+/g, '');
    return normalizePem(Buffer.from(clean, 'base64').toString('utf8'));
  }
  return normalizePem(str('FIREBASE_PRIVATE_KEY'));
}

/**
 * PEM kalitni tozalaydi: o'rab turgan qo'shtirnoq olib tashlanadi,
 * `\n` haqiqiy qator ko'chishiga aylantiriladi, Windows qatorlari
 * (`\r\n`) tekislanadi va oxiriga qator ko'chishi qo'yiladi.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizePem(value) {
  let key = String(value || '').trim();
  if (!key) return '';

  // Render/Docker ba'zan qo'shtirnoqni qiymat ichida saqlaydi
  if ((key.startsWith('"') && key.endsWith('"')) ||
      (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  key = key.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();
  return key ? `${key}\n` : '';
}

export const config = {
  port: int('PORT', 8080),
  env: str('NODE_ENV', 'development'),
  isProduction: str('NODE_ENV', 'development') === 'production',

  allowedOrigins: list('ALLOWED_ORIGINS'),

  firebase: {
    projectId: str('FIREBASE_PROJECT_ID'),
    clientEmail: str('FIREBASE_CLIENT_EMAIL'),
    // base64 ustun, aks holda `\n` li oddiy variant — `readPrivateKey()` ga qarang
    privateKey: readPrivateKey()
  },

  otp: {
    provider: str('SMS_PROVIDER', 'console'),
    ttlSeconds: int('OTP_TTL_SECONDS', 300),
    resendSeconds: int('OTP_RESEND_SECONDS', 60),
    maxAttempts: int('OTP_MAX_ATTEMPTS', 5),
    hourlyLimit: int('OTP_HOURLY_LIMIT', 5),
    testPhone: str('TEST_PHONE'),
    testCode: str('TEST_OTP_CODE')
  },

  eskiz: {
    email: str('ESKIZ_EMAIL'),
    password: str('ESKIZ_PASSWORD'),
    from: str('ESKIZ_FROM', '4546')
  },

  telegram: {
    token: str('TELEGRAM_BOT_TOKEN'),
    adminChatId: str('TELEGRAM_ADMIN_CHAT_ID')
  },

  rules: {
    adminUids: list('ADMIN_UIDS'),
    guaranteeMinutes: int('GUARANTEE_MINUTES', 35),
    cashbackPercent: int('CASHBACK_PERCENT', 2),
    bonusExpiryDays: int('BONUS_EXPIRY_DAYS', 90)
  },

  enableCron: str('ENABLE_CRON', 'true') !== 'false'
};

/**
 * Kalit PEM ko'rinishidami — boshi, oxiri va haqiqiy qator ko'chishi bor.
 * @param {string} key
 * @returns {boolean}
 */
export function isPemKey(key) {
  return /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(key) &&
    /-----END [A-Z ]*PRIVATE KEY-----/.test(key) &&
    key.includes('\n');
}

/**
 * Ishga tushirishdan oldin muhitni tekshiradi.
 *
 * Firebase kalitlarisiz servis ma'lumot bilan ishlay olmaydi — shuning
 * uchun ular yo'q bo'lsa ochiq ogohlantirish beriladi (`/api/health`
 * ham buni ko'rsatadi), lekin process yiqilmaydi: shunda ham health
 * tekshiruvi javob berib turadi va sabab ko'rinadi.
 *
 * @returns {string[]} topilgan muammolar ro'yxati
 */
export function checkConfig() {
  const problems = [];

  if (!config.firebase.projectId) problems.push('FIREBASE_PROJECT_ID yo\'q');
  if (!config.firebase.clientEmail) problems.push('FIREBASE_CLIENT_EMAIL yo\'q');
  if (!config.firebase.privateKey) {
    problems.push('FIREBASE_PRIVATE_KEY (yoki FIREBASE_PRIVATE_KEY_BASE64) yo\'q');
  } else if (!isPemKey(config.firebase.privateKey)) {
    // Noto'g'ri kalit Admin SDK ichida tushunarsiz OpenSSL xatosi bo'lib
    // chiqadi ("DECODER routines::unsupported"), shuning uchun shaklni
    // shu yerda tekshirib, sababni ochiq aytamiz.
    problems.push(
      'FIREBASE_PRIVATE_KEY PEM shaklida emas — qiymatni base64 ga o\'girib ' +
      'FIREBASE_PRIVATE_KEY_BASE64 ga qo\'ying (README ga qarang)'
    );
  }
  if (!config.allowedOrigins.length) problems.push('ALLOWED_ORIGINS yo\'q');

  if (config.otp.provider === 'eskiz' && (!config.eskiz.email || !config.eskiz.password)) {
    problems.push('SMS_PROVIDER=eskiz, lekin ESKIZ_EMAIL/ESKIZ_PASSWORD yo\'q');
  }
  if (config.isProduction && config.otp.provider === 'console') {
    problems.push('Production rejimida SMS_PROVIDER=console — kod faqat logga yoziladi');
  }
  if (!config.telegram.token) {
    problems.push('TELEGRAM_BOT_TOKEN yo\'q — Telegram xabarlari yuborilmaydi');
  }

  return problems;
}
