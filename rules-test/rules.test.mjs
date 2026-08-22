/**
 * firestore.rules ni HAQIQIY Firestore emulyatorida sinaydi.
 *
 * Asosiy savol: qoidalar yoqilgach ilova buzilmaydimi. Shu sababli har
 * bir tekshiruv ilovadagi ANIQ so'rovni takrorlaydi (js/db.js va
 * admin/js/db.js dagi chaqiruvlar bilan bir xil).
 */

import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment, assertSucceeds, assertFails
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs,
  query, where, orderBy, addDoc, serverTimestamp
} from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'pizza-test',
  firestore: {
    host: '127.0.0.1',
    port: 8180,
    rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
  }
});

const NOW = new Date();

/** Qoidalarni chetlab o'tib ma'lumot yozadi (test tayyorgarligi). */
async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'menu', 'current'), { version: 7, products: [], categories: [] });
    await setDoc(doc(db, 'branches', 'b1'), { name: 'Markaziy', active: true });
    await setDoc(doc(db, 'banners', 'ban1'), { order: 1, active: true });
    await setDoc(doc(db, 'settings', 'global'), { guaranteeMinutes: 35 });

    await setDoc(doc(db, 'staff', 'super1'), { role: 'superadmin', active: true });
    await setDoc(doc(db, 'staff', 'manager1'), { role: 'manager', active: true });
    await setDoc(doc(db, 'staff', 'operator1'), { role: 'operator', active: true });
    await setDoc(doc(db, 'staff', 'kitchen1'), { role: 'kitchen', active: true });
    await setDoc(doc(db, 'staff', 'off1'), { role: 'manager', active: false });

    await setDoc(doc(db, 'users', 'u1'), {
      phone: '+998901234567', name: 'Ali', bonusBalance: 24000, tier: 'silver', totalSpent: 500000
    });
    await setDoc(doc(db, 'users', 'u2'), { phone: '+998907654321', name: 'Vali' });
    await setDoc(doc(db, 'users', 'u1', 'addresses', 'a1'), { address: 'Amir Temur 12' });
    await setDoc(doc(db, 'users', 'u1', 'bonusHistory', 'h1'), { type: 'earn', amount: 2000 });

    await setDoc(doc(db, 'orders', 'o1'), {
      uid: 'u1', orderNumber: 1, status: 'delivered', total: 100000, createdAt: NOW
    });
    await setDoc(doc(db, 'orders', 'o2'), {
      uid: 'u1', orderNumber: 2, status: 'cooking', total: 50000, createdAt: NOW
    });
    await setDoc(doc(db, 'orders', 'o3'), {
      uid: 'u2', orderNumber: 3, status: 'new', total: 70000, createdAt: NOW
    });

    await setDoc(doc(db, 'couriers', 'c1'), { name: 'Sardor', onShift: true, location: { lat: 41.3, lng: 69.2 } });
    await setDoc(doc(db, 'couriers', 'pending_998905550011'), { name: 'Yangi', phone: '+998905550011', active: true });
    await setDoc(doc(db, 'orders', 'o4'), {
      uid: 'u2', orderNumber: 4, status: 'on_way', total: 60000, courierId: 'c1', createdAt: NOW
    });
    await setDoc(doc(db, 'promocodes', 'YANGI10'), { type: 'percent', value: 10, active: true });
    await setDoc(doc(db, 'reports', '2026-08-19'), { orders: 10, revenue: 900000 });
    await setDoc(doc(db, 'counters', 'orderNumber'), { value: 42 });
    await setDoc(doc(db, 'otps', '998901234567'), { codeHash: 'xxx', attempts: 0 });
    await setDoc(doc(db, 'idempotency', 'k1'), { uid: 'u1', status: 'done' });
  });
}

await seed();

/** Mehmon (kirmagan). */
const guest = () => env.unauthenticatedContext().firestore();
/** Kirgan mijoz. */
const asUser = (uid) => env.authenticatedContext(uid).firestore();

test.after(() => env.cleanup());

/* ================================================== MIJOZ: katalog */

test('mehmon menyuni o\'qiy oladi', async () => {
  await assertSucceeds(getDoc(doc(guest(), 'menu', 'current')));
});

test('mehmon filiallarni o\'qiy oladi', async () => {
  await assertSucceeds(getDocs(collection(guest(), 'branches')));
});

test('mehmon banner va sozlamalarni o\'qiy oladi', async () => {
  await assertSucceeds(getDoc(doc(guest(), 'banners', 'ban1')));
  await assertSucceeds(getDoc(doc(guest(), 'settings', 'global')));
});

test('mijoz menyuni O\'ZGARTIRA OLMAYDI', async () => {
  await assertFails(setDoc(doc(asUser('u1'), 'menu', 'current'), { version: 999 }));
  await assertFails(setDoc(doc(asUser('u1'), 'branches', 'b1'), { name: 'Soxta' }));
});

/* ================================================ MIJOZ: profil */

test('mijoz o\'z hujjatini o\'qiydi, boshqanikini o\'qimaydi', async () => {
  await assertSucceeds(getDoc(doc(asUser('u1'), 'users', 'u1')));
  await assertFails(getDoc(doc(asUser('u1'), 'users', 'u2')));
});

test('mijoz ism va tug\'ilgan kunni yangilay oladi', async () => {
  await assertSucceeds(updateDoc(doc(asUser('u1'), 'users', 'u1'), {
    name: 'Alisher', birthday: '1990-01-01'
  }));
});

test('ensureUserDoc yo\'li ishlaydi (phone, lang, lastLoginAt)', async () => {
  await assertSucceeds(updateDoc(doc(asUser('u1'), 'users', 'u1'), {
    phone: '+998901234567', lang: 'uz', lastLoginAt: serverTimestamp()
  }));
});

test('yangi foydalanuvchi o\'z hujjatini yarata oladi', async () => {
  await assertSucceeds(setDoc(doc(asUser('newbie'), 'users', 'newbie'), {
    phone: '+998900000000', name: '', createdAt: serverTimestamp(), lastLoginAt: serverTimestamp()
  }));
});

test('mijoz BONUSNI O\'ZI YOZA OLMAYDI', async () => {
  await assertFails(updateDoc(doc(asUser('u1'), 'users', 'u1'), { bonusBalance: 999999 }));
  await assertFails(updateDoc(doc(asUser('u1'), 'users', 'u1'), { tier: 'gold' }));
  await assertFails(updateDoc(doc(asUser('u1'), 'users', 'u1'), { totalSpent: 0 }));
  await assertFails(updateDoc(doc(asUser('u1'), 'users', 'u1'), { blocked: false }));
});

test('bonus maydonini yaratishda ham qo\'shib bo\'lmaydi', async () => {
  await assertFails(setDoc(doc(asUser('cheat'), 'users', 'cheat'), {
    phone: '+998900000001', bonusBalance: 1000000
  }));
});

test('manzillar egasiniki', async () => {
  await assertSucceeds(getDocs(collection(asUser('u1'), 'users', 'u1', 'addresses')));
  await assertSucceeds(addDoc(collection(asUser('u1'), 'users', 'u1', 'addresses'), { address: 'Yangi' }));
  await assertSucceeds(deleteDoc(doc(asUser('u1'), 'users', 'u1', 'addresses', 'a1')));
  await assertFails(getDocs(collection(asUser('u2'), 'users', 'u1', 'addresses')));
});

test('bonus tarixi faqat o\'qiladi', async () => {
  await assertSucceeds(getDocs(collection(asUser('u1'), 'users', 'u1', 'bonusHistory')));
  await assertFails(addDoc(collection(asUser('u1'), 'users', 'u1', 'bonusHistory'), {
    type: 'earn', amount: 500000
  }));
});

/* =============================================== MIJOZ: buyurtma */

test('mijoz O\'Z buyurtmalarini ro\'yxat qilib oladi', async () => {
  const db = asUser('u1');
  await assertSucceeds(getDocs(query(collection(db, 'orders'), where('uid', '==', 'u1'))));
});

test('mijoz boshqaning buyurtmalarini so\'rasa rad etiladi', async () => {
  const db = asUser('u1');
  await assertFails(getDocs(query(collection(db, 'orders'), where('uid', '==', 'u2'))));
  await assertFails(getDocs(collection(db, 'orders')));
  await assertFails(getDoc(doc(db, 'orders', 'o3')));
});

test('mijoz o\'z buyurtmasini bitta hujjat sifatida o\'qiydi', async () => {
  await assertSucceeds(getDoc(doc(asUser('u1'), 'orders', 'o1')));
});

test('mijoz BUYURTMA YARATA OLMAYDI', async () => {
  await assertFails(setDoc(doc(asUser('u1'), 'orders', 'soxta'), {
    uid: 'u1', total: 1, status: 'new'
  }));
  await assertFails(addDoc(collection(asUser('u1'), 'orders'), { uid: 'u1', total: 1 }));
});

test('yetkazilgan buyurtmaga baho qo\'yish MUMKIN', async () => {
  await assertSucceeds(updateDoc(doc(asUser('u1'), 'orders', 'o1'), {
    rating: { food: 5, courier: 5, text: 'zo\'r' }
  }));
});

test('baho bahonasida narx yoki statusni o\'zgartirib bo\'lmaydi', async () => {
  await assertFails(updateDoc(doc(asUser('u1'), 'orders', 'o1'), {
    rating: { food: 5 }, total: 1
  }));
  await assertFails(updateDoc(doc(asUser('u1'), 'orders', 'o2'), { status: 'delivered' }));
});

test('yetkazilmagan buyurtmaga baho qo\'yib bo\'lmaydi', async () => {
  await assertFails(updateDoc(doc(asUser('u1'), 'orders', 'o2'), { rating: { food: 5 } }));
});

test('boshqaning buyurtmasiga baho qo\'yib bo\'lmaydi', async () => {
  await assertFails(updateDoc(doc(asUser('u2'), 'orders', 'o1'), { rating: { food: 1 } }));
});

test('buyurtmani o\'chirib bo\'lmaydi', async () => {
  await assertFails(deleteDoc(doc(asUser('u1'), 'orders', 'o1')));
});

/* ================================================ MIJOZ: kuryer */

test('mijoz kuryer joylashuvini kuzata oladi (treking)', async () => {
  await assertSucceeds(getDoc(doc(asUser('u1'), 'couriers', 'c1')));
});

test('mehmon kuryerni ko\'rmaydi', async () => {
  await assertFails(getDoc(doc(guest(), 'couriers', 'c1')));
});

test('kuryer faqat O\'Z joylashuvini yozadi', async () => {
  await assertSucceeds(updateDoc(doc(asUser('c1'), 'couriers', 'c1'), {
    location: { lat: 41.31, lng: 69.25 }
  }));
  await assertFails(updateDoc(doc(asUser('u1'), 'couriers', 'c1'), {
    location: { lat: 0, lng: 0 }
  }));
  await assertFails(updateDoc(doc(asUser('c1'), 'couriers', 'c1'), { name: 'Boshqa' }));
});

/* ============================================== MIJOZ: yopiq joylar */

test('promokodlarni mijoz O\'QIY OLMAYDI', async () => {
  await assertFails(getDoc(doc(asUser('u1'), 'promocodes', 'YANGI10')));
  await assertFails(getDocs(collection(asUser('u1'), 'promocodes')));
});

test('OTP, hisoblagich va idempotency butunlay yopiq', async () => {
  const db = asUser('u1');
  await assertFails(getDoc(doc(db, 'otps', '998901234567')));
  await assertFails(setDoc(doc(db, 'otps', '998901234567'), { codeHash: 'a' }));
  await assertFails(getDoc(doc(db, 'counters', 'orderNumber')));
  await assertFails(setDoc(doc(db, 'counters', 'orderNumber'), { value: 0 }));
  await assertFails(getDoc(doc(db, 'idempotency', 'k1')));
});

test('mijoz staff hujjatini yarata olmaydi (o\'zini admin qilolmaydi)', async () => {
  await assertFails(setDoc(doc(asUser('u1'), 'staff', 'u1'), { role: 'superadmin', active: true }));
});

test('ro\'yxatda yo\'q kolleksiya yopiq', async () => {
  await assertFails(getDoc(doc(asUser('u1'), 'secretStuff', 'x')));
  await assertFails(setDoc(doc(asUser('u1'), 'secretStuff', 'x'), { a: 1 }));
});

test('hisobotni mijoz o\'qiy olmaydi', async () => {
  await assertFails(getDoc(doc(asUser('u1'), 'reports', '2026-08-19')));
});

/* ==================================================== ADMIN PANEL */

test('xodim o\'z rolini o\'qiy oladi (kirish shunga bog\'liq)', async () => {
  await assertSucceeds(getDoc(doc(asUser('super1'), 'staff', 'super1')));
  await assertSucceeds(getDoc(doc(asUser('kitchen1'), 'staff', 'kitchen1')));
});

test('xodim boshqaning staff hujjatini o\'qimaydi (superadmindan tashqari)', async () => {
  await assertFails(getDoc(doc(asUser('operator1'), 'staff', 'super1')));
  await assertSucceeds(getDoc(doc(asUser('super1'), 'staff', 'operator1')));
});

test('faqat superadmin staff yozadi', async () => {
  await assertSucceeds(setDoc(doc(asUser('super1'), 'staff', 'yangi'), {
    role: 'operator', name: 'Yangi', active: true
  }));
  await assertFails(setDoc(doc(asUser('manager1'), 'staff', 'yangi2'), {
    role: 'operator', active: true
  }));
});

test('admin buyurtmalar oqimini ko\'radi (uid filtrisiz)', async () => {
  for (const uid of ['super1', 'manager1', 'operator1', 'kitchen1']) {
    const db = asUser(uid);
    await assertSucceeds(getDocs(query(
      collection(db, 'orders'),
      where('createdAt', '>=', new Date(Date.now() - 36 * 3600000)),
      orderBy('createdAt', 'desc')
    )));
  }
});

test('admin ham buyurtmani BEVOSITA o\'zgartira olmaydi (servis orqali)', async () => {
  await assertFails(updateDoc(doc(asUser('super1'), 'orders', 'o3'), { status: 'accepted' }));
  await assertFails(setDoc(doc(asUser('operator1'), 'orders', 'yangi'), { uid: 'u1' }));
});

test('menyuni superadmin va manager chop etadi', async () => {
  await assertSucceeds(setDoc(doc(asUser('super1'), 'menu', 'current'), {
    version: 8, products: [], categories: []
  }));
  await assertSucceeds(setDoc(doc(asUser('manager1'), 'menu', 'current'), {
    version: 9, products: [], categories: []
  }));
});

test('operator va oshxona menyuni chop eta olmaydi', async () => {
  await assertFails(setDoc(doc(asUser('operator1'), 'menu', 'current'), { version: 10 }));
  await assertFails(setDoc(doc(asUser('kitchen1'), 'menu', 'current'), { version: 10 }));
});

test('filial CRUD — superadmin va manager', async () => {
  await assertSucceeds(setDoc(doc(asUser('manager1'), 'branches', 'b2'), {
    name: 'Chilonzor', active: true, zones: []
  }));
  await assertSucceeds(deleteDoc(doc(asUser('super1'), 'branches', 'b2')));
  await assertFails(setDoc(doc(asUser('operator1'), 'branches', 'b3'), { name: 'X' }));
});

test('promokod CRUD — superadmin va manager', async () => {
  await assertSucceeds(getDocs(collection(asUser('manager1'), 'promocodes')));
  await assertSucceeds(setDoc(doc(asUser('manager1'), 'promocodes', 'KUZ20'), {
    type: 'amount', value: 20000, active: true
  }));
  await assertSucceeds(deleteDoc(doc(asUser('super1'), 'promocodes', 'KUZ20')));
  await assertFails(getDocs(collection(asUser('operator1'), 'promocodes')));
});

test('kuryerlar ro\'yxatini admin oladi', async () => {
  await assertSucceeds(getDocs(collection(asUser('operator1'), 'couriers')));
});

test('hisobotni superadmin va manager o\'qiydi, hech kim yozmaydi', async () => {
  await assertSucceeds(getDocs(collection(asUser('manager1'), 'reports')));
  await assertFails(getDocs(collection(asUser('kitchen1'), 'reports')));
  await assertFails(setDoc(doc(asUser('super1'), 'reports', '2026-08-20'), { orders: 1 }));
});

test('mijozlar bazasini admin o\'qiy oladi (SPEC 117)', async () => {
  await assertSucceeds(getDoc(doc(asUser('manager1'), 'users', 'u1')));
  await assertFails(getDoc(doc(asUser('kitchen1'), 'users', 'u1')));
});

test('O\'CHIRILGAN xodim hech narsa qila olmaydi', async () => {
  const db = asUser('off1');
  await assertFails(setDoc(doc(db, 'menu', 'current'), { version: 99 }));
  await assertFails(getDocs(collection(db, 'promocodes')));
  await assertFails(getDocs(query(
    collection(db, 'orders'),
    where('createdAt', '>=', new Date(0)),
    orderBy('createdAt', 'desc')
  )));
});

test('staff hujjatisiz foydalanuvchi admin amallarini bajara olmaydi', async () => {
  const db = asUser('u1');
  await assertFails(setDoc(doc(db, 'menu', 'current'), { version: 99 }));
  await assertFails(setDoc(doc(db, 'branches', 'b9'), { name: 'X' }));
});

/* ============================================ SETTINGS: faqat superadmin */

test('sozlamalarni faqat superadmin yozadi', async () => {
  await assertSucceeds(setDoc(doc(asUser('super1'), 'settings', 'global'), {
    guaranteeMinutes: 40
  }));
  await assertFails(setDoc(doc(asUser('manager1'), 'settings', 'global'), {
    guaranteeMinutes: 5
  }));
});


/* ==================================================== KURYER (9-bosqich) */

test('kuryer O\'ZIGA tayinlangan buyurtmani o\'qiydi', async () => {
  const db = asUser('c1');
  await assertSucceeds(getDoc(doc(db, 'orders', 'o4')));
  await assertSucceeds(getDocs(query(collection(db, 'orders'), where('courierId', '==', 'c1'))));
});

test('kuryer BEGONA buyurtmani o\'qiy olmaydi', async () => {
  const db = asUser('c1');
  await assertFails(getDoc(doc(db, 'orders', 'o3')));
  await assertFails(getDocs(collection(db, 'orders')));
  await assertFails(getDocs(query(collection(db, 'orders'), where('courierId', '==', 'c2'))));
});

test('boshqa foydalanuvchi kuryer buyurtmasini o\'qiy olmaydi', async () => {
  await assertFails(getDoc(doc(asUser('u1'), 'orders', 'o4')));
});

test('kuryer buyurtma statusini BEVOSITA o\'zgartira olmaydi (servis orqali)', async () => {
  await assertFails(updateDoc(doc(asUser('c1'), 'orders', 'o4'), { status: 'delivered' }));
  await assertFails(updateDoc(doc(asUser('c1'), 'orders', 'o4'), { cashCollected: true }));
});

test('kuryer smena va joylashuvini yoza oladi', async () => {
  const db = asUser('c1');
  await assertSucceeds(updateDoc(doc(db, 'couriers', 'c1'), {
    onShift: true, shiftStartedAt: new Date()
  }));
  await assertSucceeds(updateDoc(doc(db, 'couriers', 'c1'), {
    location: { lat: 41.32, lng: 69.26, at: new Date() }
  }));
});

test('kuryer o\'z hujjatida boshqa maydonga tegolmaydi', async () => {
  await assertFails(updateDoc(doc(asUser('c1'), 'couriers', 'c1'), { name: 'Boshqa' }));
  await assertFails(updateDoc(doc(asUser('c1'), 'couriers', 'c1'), { branchId: 'b9' }));
});

test('kuryer BOSHQA kuryerning hujjatini yoza olmaydi', async () => {
  await assertFails(updateDoc(doc(asUser('u1'), 'couriers', 'c1'), { onShift: false }));
});

test('pending hujjatni faqat admin yaratadi va o\'chiradi', async () => {
  await assertSucceeds(setDoc(doc(asUser('manager1'), 'couriers', 'pending_998901110022'), {
    name: 'Yangi kuryer', phone: '+998901110022', active: true
  }));
  await assertSucceeds(deleteDoc(doc(asUser('super1'), 'couriers', 'pending_998901110022')));
  await assertFails(setDoc(doc(asUser('u1'), 'couriers', 'pending_998909990088'), {
    name: 'Soxta', phone: '+998909990088'
  }));
});
