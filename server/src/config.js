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

export const config = {
  port: int('PORT', 8080),
  env: str('NODE_ENV', 'development'),
  isProduction: str('NODE_ENV', 'development') === 'production',

  allowedOrigins: list('ALLOWED_ORIGINS'),

  firebase: {
    projectId: str('FIREBASE_PROJECT_ID'),
    clientEmail: str('FIREBASE_CLIENT_EMAIL'),
    // Render'da qatorlar `\n` ko'rinishida saqlanadi — tiklaymiz
    privateKey: str('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n')
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
  if (!config.firebase.privateKey) problems.push('FIREBASE_PRIVATE_KEY yo\'q');
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
