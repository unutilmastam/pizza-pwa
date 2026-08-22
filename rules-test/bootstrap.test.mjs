/**
 * `isBootstrapAdmin()` yo'lini sinaydi: ro'yxatga uid yozilganda
 * birinchi superadmin yaratila oladimi va bu teshik boshqa joyga
 * ochilib ketmaydimi.
 */
import fs from 'node:fs';
import test from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const base = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
// Izohdagi joyni haqiqiy uid bilan almashtiramiz — README shuni aytadi
const patched = base.replace("// 'BU_YERGA_UID_YOZING'", "'boss-1', 'boss-2'");

const env = await initializeTestEnvironment({
  projectId: 'pizza-boot',
  firestore: { host: '127.0.0.1', port: 8180, rules: patched }
});
test.after(() => env.cleanup());

test('royxatdagi uid birinchi superadminni yarata oladi', async () => {
  const db = env.authenticatedContext('boss-1').firestore();
  await assertSucceeds(setDoc(doc(db, 'staff', 'boss-1'), {
    role: 'superadmin', name: 'Admin', branchIds: [], active: true
  }));
});

test('royxatda yoq uid staff yoza olmaydi', async () => {
  const db = env.authenticatedContext('random-1').firestore();
  await assertFails(setDoc(doc(db, 'staff', 'random-1'), {
    role: 'superadmin', active: true
  }));
});

test('bootstrap royxati FAQAT staff ga tegishli', async () => {
  // boss-2 ro'yxatda, lekin staff hujjati hali yo'q — u oddiy
  // foydalanuvchi bo'lib qolaveradi va boshqa joyga tegolmaydi
  const db = env.authenticatedContext('boss-2').firestore();
  await assertFails(setDoc(doc(db, 'settings', 'global'), { guaranteeMinutes: 1 }));
  await assertFails(setDoc(doc(db, 'menu', 'current'), { version: 1 }));
  await assertFails(setDoc(doc(db, 'orders', 'x'), { uid: 'boss-2' }));
});

test('staff yaratilgach bootstrap uid haqiqiy superadmin boladi', async () => {
  const db = env.authenticatedContext('boss-1').firestore();
  await assertSucceeds(setDoc(doc(db, 'settings', 'global'), { guaranteeMinutes: 40 }));
});
