/**
 * Kuryer ilovasi matnlari. Interfeysdagi HAR QANDAY matn shu yerdan.
 * Ikki til — kuryerlar uz yoki ru da ishlaydi.
 */

import { COURIER } from './config.js';

export { pick } from '../../js/i18n.js';

const DICT = {
  uz: {
    'app.title': 'Pitsa — kuryer',
    'app.loading': 'Yuklanmoqda...',
    'app.error': 'Xatolik yuz berdi',
    'app.retry': 'Qayta urinish',
    'app.empty': 'Ma\'lumot yo\'q',
    'app.offline': 'Internet yo\'q',
    'app.notFound': 'Sahifa topilmadi',

    'nav.orders': 'Buyurtmalar',
    'nav.report': 'Hisob',

    'common.close': 'Yopish',
    'common.cancel': 'Bekor qilish',
    'common.confirm': 'Tasdiqlash',
    'common.yes': 'Ha',
    'common.no': 'Yo\'q',
    'common.sum': 'so\'m',
    'common.back': 'Orqaga',
    'common.refresh': 'Yangilash',

    'auth.title': 'Kuryer ilovasi',
    'auth.lead': 'Telefon raqamingiz bilan kiring',
    'auth.phone': 'Telefon raqam',
    'auth.sendCode': 'Kod yuborish',
    'auth.code': 'Tasdiqlash kodi',
    'auth.confirm': 'Kirish',
    'auth.resend': 'Kodni qayta yuborish',
    'auth.resendIn': 'Qayta yuborish: {sec} sek',
    'auth.changePhone': 'Raqamni o\'zgartirish',
    'auth.logout': 'Chiqish',
    'auth.waking': 'Server uyg\'onmoqda, biroz kuting…',
    'auth.phoneInvalid': 'Telefon raqam noto\'g\'ri',
    'auth.codeWrong': 'Kod noto\'g\'ri',
    'auth.codeExpired': 'Kod muddati tugagan',
    'auth.tooMany': 'Juda ko\'p urinish, birozdan keyin qayta urining',
    'auth.networkError': 'Serverga ulanib bo\'lmadi',
    'auth.notCourier': 'Bu raqam kuryer sifatida qo\'shilmagan. Administratorga murojaat qiling',
    'auth.disabled': 'Hisobingiz o\'chirilgan',

    'shift.open': 'Smenani ochish',
    'shift.close': 'Smenani yopish',
    'shift.opened': 'Smena ochildi',
    'shift.closed': 'Smena yopildi',
    'shift.isOpen': 'Smena ochiq',
    'shift.isClosed': 'Smena yopiq',
    'shift.closeConfirm': 'Smenani yopmoqchimisiz?',
    'shift.closeBlocked': 'Avval faol buyurtmalarni yakunlang',
    'shift.hint': 'Smena ochilgach tayinlangan buyurtmalar ko\'rinadi',

    'geo.on': 'Joylashuv yoqilgan',
    'geo.off': 'Joylashuv o\'chirilgan',
    'geo.denied': 'Joylashuvga ruxsat berilmagan — buyurtmalar baribir ishlaydi, lekin mijoz sizni xaritada ko\'rmaydi',
    'geo.unavailable': 'Qurilma joylashuvni bermayapti',
    'geo.waiting': 'Joylashuv kutilmoqda…',
    'geo.idle': 'Yo\'lda buyurtma yo\'q — joylashuv yozilmaydi',
    'geo.background': 'Ilova fonda — joylashuv to\'xtatildi',

    'orders.title': 'Buyurtmalar',
    'orders.empty': 'Tayinlangan buyurtma yo\'q',
    'orders.emptyHint': 'Operator buyurtma tayinlaganda shu yerda chiqadi',
    'orders.number': 'Buyurtma №{n}',
    'orders.customer': 'Mijoz',
    'orders.address': 'Manzil',
    'orders.comment': 'Izoh',
    'orders.items': 'Tarkibi',
    'orders.payment': 'To\'lov',
    'orders.cash': 'Naqd',
    'orders.card': 'Karta (kuryerda)',
    'orders.change': 'Qaytim kerak',
    'orders.total': 'Jami',
    'orders.call': 'Qo\'ng\'iroq',
    'orders.navigate': 'Navigator',
    'orders.take': 'Oldim',
    'orders.onWay': 'Yo\'ldaman',
    'orders.deliver': 'Yetkazdim',
    'orders.taken': 'Buyurtma olindi',
    'orders.delivered': 'Buyurtma yetkazildi',
    'orders.deliverConfirm': '№{n} yetkazildi deb belgilansinmi?',
    'orders.cashQuestion': 'Naqd pul olindimi?',
    'orders.cashAmount': 'Olinadigan summa: {sum}',
    'orders.cashYes': 'Ha, pul olindi',
    'orders.cashNo': 'Yo\'q',
    'orders.cashRequired': 'Naqd pul olinganini tasdiqlang',
    'orders.notAssigned': 'Bu buyurtma sizga tayinlanmagan',
    'orders.tooLate': 'Buyurtma allaqachon yopilgan',
    'orders.statusError': 'Statusni o\'zgartirib bo\'lmadi',

    'status.packing': 'Qadoqlanmoqda',
    'status.on_way': 'Yo\'lda',
    'status.delivered': 'Yetkazildi',

    'report.title': 'Kunlik hisob',
    'report.today': 'Bugun',
    'report.delivered': 'Yetkazilgan',
    'report.active': 'Faol',
    'report.deliveryTotal': 'Yetkazish haqi',
    'report.cashTotal': 'Naqd pul',
    'report.cardTotal': 'Karta',
    'report.orderTotal': 'Umumiy summa',
    'report.hint': 'Hisob bugungi buyurtmalar bo\'yicha, servisdan olinadi'
  },

  ru: {
    'app.title': 'Пицца — курьер',
    'app.loading': 'Загрузка...',
    'app.error': 'Произошла ошибка',
    'app.retry': 'Повторить',
    'app.empty': 'Нет данных',
    'app.offline': 'Нет интернета',
    'app.notFound': 'Страница не найдена',

    'nav.orders': 'Заказы',
    'nav.report': 'Отчёт',

    'common.close': 'Закрыть',
    'common.cancel': 'Отмена',
    'common.confirm': 'Подтвердить',
    'common.yes': 'Да',
    'common.no': 'Нет',
    'common.sum': 'сум',
    'common.back': 'Назад',
    'common.refresh': 'Обновить',

    'auth.title': 'Приложение курьера',
    'auth.lead': 'Войдите по номеру телефона',
    'auth.phone': 'Номер телефона',
    'auth.sendCode': 'Отправить код',
    'auth.code': 'Код подтверждения',
    'auth.confirm': 'Войти',
    'auth.resend': 'Отправить код заново',
    'auth.resendIn': 'Повторно через {sec} сек',
    'auth.changePhone': 'Изменить номер',
    'auth.logout': 'Выйти',
    'auth.waking': 'Сервер просыпается, подождите…',
    'auth.phoneInvalid': 'Неверный номер телефона',
    'auth.codeWrong': 'Неверный код',
    'auth.codeExpired': 'Срок действия кода истёк',
    'auth.tooMany': 'Слишком много попыток, повторите позже',
    'auth.networkError': 'Не удалось связаться с сервером',
    'auth.notCourier': 'Этот номер не добавлен как курьер. Обратитесь к администратору',
    'auth.disabled': 'Ваш аккаунт отключён',

    'shift.open': 'Открыть смену',
    'shift.close': 'Закрыть смену',
    'shift.opened': 'Смена открыта',
    'shift.closed': 'Смена закрыта',
    'shift.isOpen': 'Смена открыта',
    'shift.isClosed': 'Смена закрыта',
    'shift.closeConfirm': 'Закрыть смену?',
    'shift.closeBlocked': 'Сначала завершите активные заказы',
    'shift.hint': 'После открытия смены появятся назначенные заказы',

    'geo.on': 'Геолокация включена',
    'geo.off': 'Геолокация выключена',
    'geo.denied': 'Нет доступа к геолокации — заказы работают, но клиент не увидит вас на карте',
    'geo.unavailable': 'Устройство не отдаёт геолокацию',
    'geo.waiting': 'Ожидание геолокации…',
    'geo.idle': 'Нет заказов в пути — геолокация не пишется',
    'geo.background': 'Приложение в фоне — геолокация остановлена',

    'orders.title': 'Заказы',
    'orders.empty': 'Нет назначенных заказов',
    'orders.emptyHint': 'Заказы появятся здесь, когда оператор их назначит',
    'orders.number': 'Заказ №{n}',
    'orders.customer': 'Клиент',
    'orders.address': 'Адрес',
    'orders.comment': 'Комментарий',
    'orders.items': 'Состав',
    'orders.payment': 'Оплата',
    'orders.cash': 'Наличные',
    'orders.card': 'Карта (курьеру)',
    'orders.change': 'Нужна сдача',
    'orders.total': 'Итого',
    'orders.call': 'Позвонить',
    'orders.navigate': 'Навигатор',
    'orders.take': 'Забрал',
    'orders.onWay': 'В пути',
    'orders.deliver': 'Доставил',
    'orders.taken': 'Заказ забран',
    'orders.delivered': 'Заказ доставлен',
    'orders.deliverConfirm': 'Отметить №{n} как доставленный?',
    'orders.cashQuestion': 'Наличные получены?',
    'orders.cashAmount': 'Сумма к получению: {sum}',
    'orders.cashYes': 'Да, деньги получены',
    'orders.cashNo': 'Нет',
    'orders.cashRequired': 'Подтвердите получение наличных',
    'orders.notAssigned': 'Этот заказ вам не назначен',
    'orders.tooLate': 'Заказ уже закрыт',
    'orders.statusError': 'Не удалось изменить статус',

    'status.packing': 'Упаковка',
    'status.on_way': 'В пути',
    'status.delivered': 'Доставлен',

    'report.title': 'Отчёт за день',
    'report.today': 'Сегодня',
    'report.delivered': 'Доставлено',
    'report.active': 'Активные',
    'report.deliveryTotal': 'За доставку',
    'report.cashTotal': 'Наличные',
    'report.cardTotal': 'Карта',
    'report.orderTotal': 'Общая сумма',
    'report.hint': 'Отчёт по сегодняшним заказам, берётся из сервиса'
  }
};

let currentLang = COURIER.defaultLang;

/**
 * Saqlangan tilni tiklaydi.
 * @returns {string}
 */
export function initLang() {
  try {
    const saved = localStorage.getItem(COURIER.storage.lang);
    if (saved && DICT[saved]) currentLang = saved;
  } catch (e) {
    // Shaxsiy rejimda localStorage yopiq — standart til qoladi
  }
  document.documentElement.lang = currentLang;
  return currentLang;
}

/**
 * Tilni almashtiradi.
 * @param {string} lang
 */
export function setLang(lang) {
  if (!DICT[lang]) return;
  currentLang = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(COURIER.storage.lang, lang);
  } catch (e) {
    // Saqlanmasa ham joriy seansda ishlaydi
  }
}

/** @returns {string} */
export function getLang() {
  return currentLang;
}

/**
 * Kalit bo'yicha matn. `{vars}` o'rniga qiymat qo'yiladi.
 * @param {string} key
 * @param {object} [vars]
 * @returns {string}
 */
export function t(key, vars = {}) {
  const text = (DICT[currentLang] && DICT[currentLang][key]) ||
    DICT[COURIER.defaultLang][key] || key;
  return text.replace(/\{(\w+)\}/g, (m, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m);
}
