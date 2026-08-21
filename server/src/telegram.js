/**
 * Telegram xabarlari.
 *
 * Bot tokeni faqat `TELEGRAM_BOT_TOKEN` muhit o'zgaruvchisidan olinadi.
 * Token yo'q bo'lsa hamma funksiya JIM o'tadi — Telegram ishlamagani
 * uchun buyurtma qabul qilinmay qolmasligi kerak.
 */

import { config } from './config.js';

/** Telegram javobini kutish chegarasi (ms). */
const TIMEOUT_MS = 8000;

/**
 * Telegram Bot API chaqiruvi. Xato bo'lsa faqat logga yoziladi.
 * @param {string} method
 * @param {object} payload
 * @returns {Promise<boolean>} yuborildimi
 */
async function call(method, payload) {
  if (!config.telegram.token) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.telegram.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.warn(`[telegram] ${method} → ${res.status} ${detail.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.warn(`[telegram] ${method} yuborilmadi:`, e.message);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ixtiyoriy chatga xabar.
 * @param {string} chatId
 * @param {string} text - HTML formatlash mumkin
 * @returns {Promise<boolean>}
 */
export async function sendMessage(chatId, text) {
  if (!chatId) return false;
  return call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  });
}

/**
 * Admin guruhga texnik xabar (OTP kodi, cron natijasi va h.k.).
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function sendTelegramLog(text) {
  return sendMessage(config.telegram.adminChatId, text);
}

/**
 * Summani `125 000` ko'rinishida beradi.
 * @param {number} value
 * @returns {string}
 */
function money(value) {
  return String(Math.round(Number(value) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * HTML belgilarini xavfsizlantiradi (foydalanuvchi matni uchun).
 * @param {*} value
 * @returns {string}
 */
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Yangi buyurtma haqida admin guruhga xabar.
 * @param {object} order - Firestore'ga yozilgan buyurtma
 * @returns {Promise<boolean>}
 */
export async function notifyNewOrder(order) {
  const payLabel = { cash: 'Naqd', card: 'Kuryerda karta' }[order.paymentMethod] || order.paymentMethod;
  const lines = [
    `🍕 <b>Yangi buyurtma #${order.orderNumber}</b>`,
    `${order.type === 'pickup' ? 'Olib ketish' : 'Yetkazish'} · ${esc(payLabel)}`,
    `Mijoz: ${esc(order.name || '—')} ${esc(order.phone || '')}`,
    order.address?.address ? `Manzil: ${esc(order.address.address)}` : '',
    '',
    ...order.items.map((item) => `• ${esc(item.name)} × ${item.qty} — ${money(item.total)}`),
    '',
    `Mahsulotlar: ${money(order.subtotal)}`,
    order.deliveryPrice ? `Yetkazish: ${money(order.deliveryPrice)}` : '',
    order.discount ? `Chegirma: −${money(order.discount)}` : '',
    order.bonusUsed ? `Bonus: −${money(order.bonusUsed)}` : '',
    `<b>Jami: ${money(order.total)} so'm</b>`,
    order.comment ? `Izoh: ${esc(order.comment)}` : ''
  ];
  return sendTelegramLog(lines.filter(Boolean).join('\n'));
}

/** Status nomlari — mijozga yuboriladigan xabarda. */
const STATUS_TEXT = {
  accepted: 'Buyurtmangiz qabul qilindi ✅',
  cooking: 'Buyurtmangiz tayyorlanmoqda 👨‍🍳',
  in_oven: 'Pitsangiz pechda 🔥',
  packing: 'Buyurtmangiz qadoqlanmoqda 📦',
  on_way: 'Kuryer yo\'lga chiqdi 🛵',
  delivered: 'Buyurtmangiz yetkazildi. Yoqimli ishtaha! 🍕',
  cancelled: 'Buyurtmangiz bekor qilindi'
};

/**
 * Mijozga status o'zgarishi haqida xabar (Telegram ulangan bo'lsa).
 * @param {object} order
 * @param {string} status
 * @param {?string} telegramId
 * @returns {Promise<boolean>}
 */
export async function notifyStatus(order, status, telegramId) {
  const text = STATUS_TEXT[status];
  if (!text || !telegramId) return false;
  return sendMessage(telegramId, `<b>#${order.orderNumber}</b>\n${text}`);
}
