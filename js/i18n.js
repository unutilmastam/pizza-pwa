/**
 * Tarjimalar. Interfeysdagi HAR QANDAY matn shu yerdan olinadi.
 * Yangi matn kerak bo'lsa — uchala tilga ham qo'shiladi.
 */

import { APP } from './config.js';

const DICT = {
  uz: {
    'app.name': 'Pitsa',
    'app.tagline': 'Issiq pitsa 35 daqiqada',
    'app.offline': 'Internet yo\'q. Oflayn rejim.',
    'app.online': 'Internet tiklandi',
    'app.install': 'Ilovani o\'rnatish',
    'app.loading': 'Yuklanmoqda...',
    'app.retry': 'Qayta urinish',
    'app.error': 'Xatolik yuz berdi',
    'app.notFound': 'Sahifa topilmadi',
    'app.soon': 'Tez orada',
    'app.emptyStage': 'Bu bo\'lim keyingi bosqichda to\'ldiriladi',

    'nav.menu': 'Menyu',
    'nav.cart': 'Savat',
    'nav.orders': 'Buyurtmalar',
    'nav.profile': 'Profil',

    'common.back': 'Orqaga',
    'common.close': 'Yopish',
    'common.cancel': 'Bekor qilish',
    'common.save': 'Saqlash',
    'common.delete': 'O\'chirish',
    'common.edit': 'Tahrirlash',
    'common.confirm': 'Tasdiqlash',
    'common.continue': 'Davom etish',
    'common.search': 'Qidirish',
    'common.undo': 'Qaytarish',
    'common.yes': 'Ha',
    'common.no': 'Yo\'q',
    'common.from': 'dan',
    'common.total': 'Jami',
    'common.qty': 'Miqdor',
    'common.price': 'Narx',
    'common.free': 'Bepul',
    'common.today': 'Bugun',
    'common.yesterday': 'Kecha',

    'menu.title': 'Menyu',
    'menu.searchPlaceholder': 'Pitsa, ichimlik, desert...',
    'menu.nothingFound': 'Hech narsa topilmadi',
    'menu.stopList': 'Hozircha mavjud emas',
    'menu.addToCart': 'Savatga',
    'menu.loadError': 'Menyu yuklanmadi',
    'menu.clear': 'Tozalash',
    'menu.results': 'Qidiruv natijalari',

    'badge.hit': 'Xit',
    'badge.new': 'Yangi',
    'badge.spicy': 'Achchiq',
    'badge.veg': 'Vegetarian',

    'product.size': 'O\'lcham',
    'product.dough': 'Xamir',
    'product.dough.thin': 'Yupqa',
    'product.dough.traditional': 'An\'anaviy',
    'product.addons': 'Qo\'shimchalar',
    'product.removable': 'Olib tashlash',
    'product.composition': 'Tarkibi',
    'product.kcal': 'Kaloriya',
    'product.weight': 'Og\'irligi',
    'product.added': 'Savatga qo\'shildi',

    'cart.title': 'Savat',
    'cart.empty': 'Savat bo\'sh',
    'cart.emptyHint': 'Menyudan mahsulot tanlang',
    'cart.subtotal': 'Mahsulotlar',
    'cart.delivery': 'Yetkazib berish',
    'cart.discount': 'Chegirma',
    'cart.promo': 'Promokod',
    'cart.promoApply': 'Qo\'llash',
    'cart.minOrder': 'Minimal buyurtma summasi',
    'cart.itemRemoved': 'Mahsulot o\'chirildi',
    'cart.checkout': 'Rasmiylashtirish',
    'cart.toMinOrder': 'Minimal buyurtmagacha yana {sum}',
    'cart.freeDeliveryIn': 'Bepul yetkazishgacha {sum}',
    'cart.freeDelivery': 'Yetkazish bepul',
    'cart.upsell': 'Buyurtmangizga qo\'shing',
    'cart.promoPlaceholder': 'Promokodni kiriting',
    'cart.promoSaved': 'Promokod saqlandi',
    'cart.promoRemoved': 'Promokod olib tashlandi',
    'cart.promoPending': 'Rasmiylashtirishda tekshiriladi',
    'cart.removed': 'Olib tashlandi',
    'cart.goToMenu': 'Menyuga o\'tish',

    'checkout.title': 'Buyurtma',
    'checkout.type': 'Buyurtma turi',
    'checkout.address': 'Manzil',
    'checkout.addressAdd': 'Manzilni kiritish',
    'checkout.addressRequired': 'Yetkazish manzilini kiriting',
    'checkout.street': 'Ko\'cha va uy raqami',
    'checkout.branchRequired': 'Filialni tanlang',
    'checkout.branchEmpty': 'Filiallar hali qo\'shilmagan',
    'checkout.branchError': 'Filiallar ro\'yxati yuklanmadi',
    'checkout.pickTime': 'Vaqtni tanlash',
    'checkout.timeTooSoon': 'Kamida {min} daqiqadan keyingi vaqtni tanlang',
    'checkout.payme': 'Payme',
    'checkout.click': 'Click',
    'checkout.uzum': 'Uzum',
    'checkout.changePlaceholder': 'Qancha puldan qaytim kerak',
    'checkout.changeTooSmall': 'Qaytim summasi buyurtma summasidan kam',
    'checkout.commentPlaceholder': 'Kuryer uchun izoh, mo\'ljal',
    'checkout.offerRequired': 'Oferta shartlarini tasdiqlang',
    'checkout.minOrderNotMet': 'Minimal buyurtma summasi {sum}',
    'checkout.summary': 'Buyurtma tarkibi',
    'checkout.draftSaved': 'Buyurtma tayyorlandi',
    'checkout.draftHint': 'Buyurtmani serverga yuborish 6-bosqichda (Node servis) ulanadi. Kiritilgan ma\'lumotlar saqlandi, savat tegilmadi.',
    'checkout.delivery': 'Yetkazib berish',
    'checkout.pickup': 'Olib ketish',
    'checkout.time': 'Yetkazish vaqti',
    'checkout.asap': 'Tezroq',
    'checkout.payment': 'To\'lov usuli',
    'checkout.cash': 'Naqd',
    'checkout.card': 'Kuryerda karta',
    'checkout.change': 'Qaytim',
    'checkout.cutlery': 'Idish-tovoq soni',
    'checkout.comment': 'Izoh',
    'checkout.offer': 'Ommaviy oferta shartlariga roziman',
    'checkout.submit': 'Buyurtma berish',

    'address.title': 'Manzil',
    'address.add': 'Manzil qo\'shish',
    'address.apartment': 'Kvartira',
    'address.entrance': 'Podyezd',
    'address.floor': 'Qavat',
    'address.intercom': 'Domofon',
    'address.landmark': 'Mo\'ljal',
    'address.outOfZone': 'Bu manzil yetkazish zonasidan tashqarida',
    'address.branch': 'Filial',

    'auth.title': 'Kirish',
    'auth.phone': 'Telefon raqam',
    'auth.sendCode': 'Kod yuborish',
    'auth.code': 'Tasdiqlash kodi',
    'auth.resend': 'Kodni qayta yuborish',
    'auth.resendIn': 'Qayta yuborish: {sec} sek',
    'auth.guest': 'Mehmon sifatida davom etish',
    'auth.logout': 'Chiqish',
    'auth.required': 'Davom etish uchun tizimga kiring',

    'order.title': 'Buyurtma holati',
    'order.number': 'Buyurtma №{n}',
    'order.repeat': 'Takrorlash',
    'order.empty': 'Hali buyurtma yo\'q',
    'order.guarantee': 'Kafolat: {min} daqiqa',
    'order.courier': 'Kuryer',
    'order.rate': 'Baholash',
    'status.new': 'Qabul qilinmoqda',
    'status.accepted': 'Qabul qilindi',
    'status.cooking': 'Tayyorlanmoqda',
    'status.in_oven': 'Pechda',
    'status.packing': 'Qadoqlanmoqda',
    'status.on_way': 'Yo\'lda',
    'status.delivered': 'Yetkazildi',
    'status.canceled': 'Bekor qilindi',

    'profile.title': 'Profil',
    'profile.guest': 'Mehmon',
    'profile.name': 'Ism',
    'profile.birthday': 'Tug\'ilgan kun',
    'profile.bonus': 'Bonus balansi',
    'profile.addresses': 'Manzillarim',
    'profile.history': 'Buyurtmalar tarixi',
    'profile.lang': 'Til',
    'profile.theme': 'Mavzu',
    'profile.support': 'Yordam',

    'unit.g': 'g',
    'unit.sum': 'so\'m',
    'unit.min': 'daq',
    'unit.cm': 'sm'
  },

  ru: {
    'app.name': 'Пицца',
    'app.tagline': 'Горячая пицца за 35 минут',
    'app.offline': 'Нет интернета. Офлайн-режим.',
    'app.online': 'Интернет восстановлен',
    'app.install': 'Установить приложение',
    'app.loading': 'Загрузка...',
    'app.retry': 'Повторить',
    'app.error': 'Произошла ошибка',
    'app.notFound': 'Страница не найдена',
    'app.soon': 'Скоро',
    'app.emptyStage': 'Этот раздел появится на следующем этапе',

    'nav.menu': 'Меню',
    'nav.cart': 'Корзина',
    'nav.orders': 'Заказы',
    'nav.profile': 'Профиль',

    'common.back': 'Назад',
    'common.close': 'Закрыть',
    'common.cancel': 'Отмена',
    'common.save': 'Сохранить',
    'common.delete': 'Удалить',
    'common.edit': 'Изменить',
    'common.confirm': 'Подтвердить',
    'common.continue': 'Продолжить',
    'common.search': 'Поиск',
    'common.undo': 'Вернуть',
    'common.yes': 'Да',
    'common.no': 'Нет',
    'common.from': 'от',
    'common.total': 'Итого',
    'common.qty': 'Количество',
    'common.price': 'Цена',
    'common.free': 'Бесплатно',
    'common.today': 'Сегодня',
    'common.yesterday': 'Вчера',

    'menu.title': 'Меню',
    'menu.searchPlaceholder': 'Пицца, напитки, десерт...',
    'menu.nothingFound': 'Ничего не найдено',
    'menu.stopList': 'Сейчас недоступно',
    'menu.addToCart': 'В корзину',
    'menu.loadError': 'Меню не загрузилось',
    'menu.clear': 'Очистить',
    'menu.results': 'Результаты поиска',

    'badge.hit': 'Хит',
    'badge.new': 'Новинка',
    'badge.spicy': 'Острое',
    'badge.veg': 'Вегетарианское',

    'product.size': 'Размер',
    'product.dough': 'Тесто',
    'product.dough.thin': 'Тонкое',
    'product.dough.traditional': 'Традиционное',
    'product.addons': 'Добавки',
    'product.removable': 'Убрать',
    'product.composition': 'Состав',
    'product.kcal': 'Калории',
    'product.weight': 'Вес',
    'product.added': 'Добавлено в корзину',

    'cart.title': 'Корзина',
    'cart.empty': 'Корзина пуста',
    'cart.emptyHint': 'Выберите товар из меню',
    'cart.subtotal': 'Товары',
    'cart.delivery': 'Доставка',
    'cart.discount': 'Скидка',
    'cart.promo': 'Промокод',
    'cart.promoApply': 'Применить',
    'cart.minOrder': 'Минимальная сумма заказа',
    'cart.itemRemoved': 'Товар удалён',
    'cart.checkout': 'Оформить',
    'cart.toMinOrder': 'До минимального заказа ещё {sum}',
    'cart.freeDeliveryIn': 'До бесплатной доставки {sum}',
    'cart.freeDelivery': 'Доставка бесплатно',
    'cart.upsell': 'Добавить к заказу',
    'cart.promoPlaceholder': 'Введите промокод',
    'cart.promoSaved': 'Промокод сохранён',
    'cart.promoRemoved': 'Промокод удалён',
    'cart.promoPending': 'Проверим при оформлении',
    'cart.removed': 'Убрано',
    'cart.goToMenu': 'Перейти в меню',

    'checkout.title': 'Заказ',
    'checkout.type': 'Тип заказа',
    'checkout.address': 'Адрес',
    'checkout.addressAdd': 'Указать адрес',
    'checkout.addressRequired': 'Укажите адрес доставки',
    'checkout.street': 'Улица и номер дома',
    'checkout.branchRequired': 'Выберите филиал',
    'checkout.branchEmpty': 'Филиалы ещё не добавлены',
    'checkout.branchError': 'Не удалось загрузить филиалы',
    'checkout.pickTime': 'Выбрать время',
    'checkout.timeTooSoon': 'Выберите время не раньше чем через {min} минут',
    'checkout.payme': 'Payme',
    'checkout.click': 'Click',
    'checkout.uzum': 'Uzum',
    'checkout.changePlaceholder': 'С какой суммы нужна сдача',
    'checkout.changeTooSmall': 'Сумма сдачи меньше суммы заказа',
    'checkout.commentPlaceholder': 'Комментарий курьеру, ориентир',
    'checkout.offerRequired': 'Подтвердите условия оферты',
    'checkout.minOrderNotMet': 'Минимальная сумма заказа {sum}',
    'checkout.summary': 'Состав заказа',
    'checkout.draftSaved': 'Заказ подготовлен',
    'checkout.draftHint': 'Отправка заказа на сервер появится на 6-м этапе (Node-сервис). Введённые данные сохранены, корзина не тронута.',
    'checkout.delivery': 'Доставка',
    'checkout.pickup': 'Самовывоз',
    'checkout.time': 'Время доставки',
    'checkout.asap': 'Как можно скорее',
    'checkout.payment': 'Способ оплаты',
    'checkout.cash': 'Наличные',
    'checkout.card': 'Картой курьеру',
    'checkout.change': 'Сдача с',
    'checkout.cutlery': 'Количество приборов',
    'checkout.comment': 'Комментарий',
    'checkout.offer': 'Согласен с условиями оферты',
    'checkout.submit': 'Оформить заказ',

    'address.title': 'Адрес',
    'address.add': 'Добавить адрес',
    'address.apartment': 'Квартира',
    'address.entrance': 'Подъезд',
    'address.floor': 'Этаж',
    'address.intercom': 'Домофон',
    'address.landmark': 'Ориентир',
    'address.outOfZone': 'Адрес вне зоны доставки',
    'address.branch': 'Филиал',

    'auth.title': 'Вход',
    'auth.phone': 'Номер телефона',
    'auth.sendCode': 'Отправить код',
    'auth.code': 'Код подтверждения',
    'auth.resend': 'Отправить код заново',
    'auth.resendIn': 'Повторно через {sec} сек',
    'auth.guest': 'Продолжить как гость',
    'auth.logout': 'Выйти',
    'auth.required': 'Войдите, чтобы продолжить',

    'order.title': 'Статус заказа',
    'order.number': 'Заказ №{n}',
    'order.repeat': 'Повторить',
    'order.empty': 'Заказов пока нет',
    'order.guarantee': 'Гарантия: {min} минут',
    'order.courier': 'Курьер',
    'order.rate': 'Оценить',
    'status.new': 'Принимается',
    'status.accepted': 'Принят',
    'status.cooking': 'Готовится',
    'status.in_oven': 'В печи',
    'status.packing': 'Упаковка',
    'status.on_way': 'В пути',
    'status.delivered': 'Доставлен',
    'status.canceled': 'Отменён',

    'profile.title': 'Профиль',
    'profile.guest': 'Гость',
    'profile.name': 'Имя',
    'profile.birthday': 'День рождения',
    'profile.bonus': 'Бонусный баланс',
    'profile.addresses': 'Мои адреса',
    'profile.history': 'История заказов',
    'profile.lang': 'Язык',
    'profile.theme': 'Тема',
    'profile.support': 'Поддержка',

    'unit.g': 'г',
    'unit.sum': 'сум',
    'unit.min': 'мин',
    'unit.cm': 'см'
  },

  en: {
    'app.name': 'Pizza',
    'app.tagline': 'Hot pizza in 35 minutes',
    'app.offline': 'No connection. Offline mode.',
    'app.online': 'Back online',
    'app.install': 'Install app',
    'app.loading': 'Loading...',
    'app.retry': 'Retry',
    'app.error': 'Something went wrong',
    'app.notFound': 'Page not found',
    'app.soon': 'Coming soon',
    'app.emptyStage': 'This section arrives in the next stage',

    'nav.menu': 'Menu',
    'nav.cart': 'Cart',
    'nav.orders': 'Orders',
    'nav.profile': 'Profile',

    'common.back': 'Back',
    'common.close': 'Close',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.confirm': 'Confirm',
    'common.continue': 'Continue',
    'common.search': 'Search',
    'common.undo': 'Undo',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.from': 'from',
    'common.total': 'Total',
    'common.qty': 'Quantity',
    'common.price': 'Price',
    'common.free': 'Free',
    'common.today': 'Today',
    'common.yesterday': 'Yesterday',

    'menu.title': 'Menu',
    'menu.searchPlaceholder': 'Pizza, drinks, dessert...',
    'menu.nothingFound': 'Nothing found',
    'menu.stopList': 'Currently unavailable',
    'menu.addToCart': 'Add to cart',
    'menu.loadError': 'Could not load the menu',
    'menu.clear': 'Clear',
    'menu.results': 'Search results',

    'badge.hit': 'Bestseller',
    'badge.new': 'New',
    'badge.spicy': 'Spicy',
    'badge.veg': 'Vegetarian',

    'product.size': 'Size',
    'product.dough': 'Dough',
    'product.dough.thin': 'Thin',
    'product.dough.traditional': 'Traditional',
    'product.addons': 'Add-ons',
    'product.removable': 'Remove',
    'product.composition': 'Ingredients',
    'product.kcal': 'Calories',
    'product.weight': 'Weight',
    'product.added': 'Added to cart',

    'cart.title': 'Cart',
    'cart.empty': 'Your cart is empty',
    'cart.emptyHint': 'Pick something from the menu',
    'cart.subtotal': 'Items',
    'cart.delivery': 'Delivery',
    'cart.discount': 'Discount',
    'cart.promo': 'Promo code',
    'cart.promoApply': 'Apply',
    'cart.minOrder': 'Minimum order amount',
    'cart.itemRemoved': 'Item removed',
    'cart.checkout': 'Checkout',
    'cart.toMinOrder': '{sum} more to reach the minimum order',
    'cart.freeDeliveryIn': '{sum} more for free delivery',
    'cart.freeDelivery': 'Delivery is free',
    'cart.upsell': 'Add to your order',
    'cart.promoPlaceholder': 'Enter promo code',
    'cart.promoSaved': 'Promo code saved',
    'cart.promoRemoved': 'Promo code removed',
    'cart.promoPending': 'Checked at checkout',
    'cart.removed': 'Removed',
    'cart.goToMenu': 'Go to menu',

    'checkout.title': 'Order',
    'checkout.type': 'Order type',
    'checkout.address': 'Address',
    'checkout.addressAdd': 'Enter address',
    'checkout.addressRequired': 'Enter the delivery address',
    'checkout.street': 'Street and house number',
    'checkout.branchRequired': 'Choose a branch',
    'checkout.branchEmpty': 'No branches added yet',
    'checkout.branchError': 'Could not load branches',
    'checkout.pickTime': 'Pick a time',
    'checkout.timeTooSoon': 'Choose a time at least {min} minutes from now',
    'checkout.payme': 'Payme',
    'checkout.click': 'Click',
    'checkout.uzum': 'Uzum',
    'checkout.changePlaceholder': 'Change from what amount',
    'checkout.changeTooSmall': 'Change amount is less than the order total',
    'checkout.commentPlaceholder': 'Note for the courier, landmark',
    'checkout.offerRequired': 'Please accept the offer terms',
    'checkout.minOrderNotMet': 'Minimum order amount is {sum}',
    'checkout.summary': 'Order items',
    'checkout.draftSaved': 'Order prepared',
    'checkout.draftHint': 'Sending the order to the server arrives in stage 6 (Node service). Your details are saved and the cart is untouched.',
    'checkout.delivery': 'Delivery',
    'checkout.pickup': 'Pickup',
    'checkout.time': 'Delivery time',
    'checkout.asap': 'As soon as possible',
    'checkout.payment': 'Payment method',
    'checkout.cash': 'Cash',
    'checkout.card': 'Card to courier',
    'checkout.change': 'Change from',
    'checkout.cutlery': 'Cutlery sets',
    'checkout.comment': 'Comment',
    'checkout.offer': 'I agree to the terms of offer',
    'checkout.submit': 'Place order',

    'address.title': 'Address',
    'address.add': 'Add address',
    'address.apartment': 'Apartment',
    'address.entrance': 'Entrance',
    'address.floor': 'Floor',
    'address.intercom': 'Intercom',
    'address.landmark': 'Landmark',
    'address.outOfZone': 'This address is outside the delivery zone',
    'address.branch': 'Branch',

    'auth.title': 'Sign in',
    'auth.phone': 'Phone number',
    'auth.sendCode': 'Send code',
    'auth.code': 'Verification code',
    'auth.resend': 'Resend code',
    'auth.resendIn': 'Resend in {sec} s',
    'auth.guest': 'Continue as guest',
    'auth.logout': 'Sign out',
    'auth.required': 'Sign in to continue',

    'order.title': 'Order status',
    'order.number': 'Order #{n}',
    'order.repeat': 'Repeat',
    'order.empty': 'No orders yet',
    'order.guarantee': 'Guarantee: {min} minutes',
    'order.courier': 'Courier',
    'order.rate': 'Rate',
    'status.new': 'Being accepted',
    'status.accepted': 'Accepted',
    'status.cooking': 'Cooking',
    'status.in_oven': 'In the oven',
    'status.packing': 'Packing',
    'status.on_way': 'On the way',
    'status.delivered': 'Delivered',
    'status.canceled': 'Canceled',

    'profile.title': 'Profile',
    'profile.guest': 'Guest',
    'profile.name': 'Name',
    'profile.birthday': 'Birthday',
    'profile.bonus': 'Bonus balance',
    'profile.addresses': 'My addresses',
    'profile.history': 'Order history',
    'profile.lang': 'Language',
    'profile.theme': 'Theme',
    'profile.support': 'Support',

    'unit.g': 'g',
    'unit.sum': 'UZS',
    'unit.min': 'min',
    'unit.cm': 'cm'
  }
};

/** Tillar ro'yxati — til tanlash oynasi uchun. */
export const LANGS = [
  { code: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' }
];

let currentLang = APP.defaultLang;

/**
 * Joriy tilni belgilaydi.
 * @param {string} lang - uz | ru | en
 * @returns {string} qabul qilingan til
 */
export function setLang(lang) {
  currentLang = DICT[lang] ? lang : APP.defaultLang;
  document.documentElement.lang = currentLang;
  return currentLang;
}

/**
 * Joriy tilni qaytaradi.
 * @returns {string}
 */
export function getLang() {
  return currentLang;
}

/**
 * Kalit bo'yicha tarjima. `{name}` shaklidagi o'rinbosarlar almashtiriladi.
 * Tarjima topilmasa — uz, u ham bo'lmasa kalitning o'zi qaytadi.
 * @param {string} key - masalan 'cart.title'
 * @param {Object<string, string|number>} [vars] - o'rinbosarlar
 * @returns {string}
 */
export function t(key, vars) {
  const text = (DICT[currentLang] && DICT[currentLang][key]) ||
    DICT[APP.defaultLang][key] || key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m
  );
}

/**
 * Ko'p tilli obyektdan ({uz, ru, en}) joriy til matnini oladi.
 * Firestore'dagi `name` / `description` maydonlari uchun.
 * @param {Object<string, string>|string} field
 * @returns {string}
 */
export function pick(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field[currentLang] || field[APP.defaultLang] || '';
}

/**
 * `data-i18n` atributiga ega barcha elementlarni tarjima qiladi.
 * `data-i18n-attr="placeholder"` bo'lsa — matn o'rniga shu atribut yoziladi.
 * @param {ParentNode} [root=document] - qidiriladigan ildiz element
 */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    if (attr) el.setAttribute(attr, t(key));
    else el.textContent = t(key);
  });
}

/**
 * Brauzer tilidan mos tilni topadi.
 * @returns {string} uz | ru | en
 */
export function detectLang() {
  const nav = (navigator.language || APP.defaultLang).slice(0, 2).toLowerCase();
  return APP.langs.includes(nav) ? nav : APP.defaultLang;
}
