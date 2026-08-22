/**
 * Uchala ilova uchun UMUMIY kesh va tarmoq chegarasi qatlami.
 *
 * NEGA ALOHIDA FAYL: ilgari "keshdan ber, fonda yangila" mantig'i faqat
 * mijoz ilovasidagi `js/db.js` da bor edi. Admin va kuryer ilovalari
 * har sahifa o'tishida Firestore'ni qaytadan so'rardi — o'lchovda admin
 * `menu/current` ni bir seansda 4 marta, `branches` ni 3 marta o'qigan.
 * Sekin tarmoqda bu har o'tishda 1.2–3 sekundlik kutish demak edi.
 *
 * Bu yerda uchta narsa bor:
 *  1. `withTimeout()` — Firestore SDK bir martalik o'qishga O'Z
 *     chegarasini qo'ymaydi, ulanish osilsa va'da hech qachon
 *     tugamaydi va ekran skeletonda muzlab qoladi;
 *  2. `swr()` — kesh bo'lsa sahifa tarmoqni umuman kutmaydi;
 *  3. `watchGuard()` — `onSnapshot` uchun chegara. Birinchi snapshot
 *     kelmasa oqim JIM turadi va spinner abadiy qoladi.
 */

/** Bitta o'qishga vaqt chegarasi (ms). */
export const READ_TIMEOUT = 12000;

/** Birinchi `onSnapshot` javobiga chegara (ms). */
export const WATCH_TIMEOUT = 10000;

/**
 * Kesh do'koni yasaydi. Har ilova o'z prefiksi bilan chaqiradi,
 * shunda admin va mijoz keshlari aralashib ketmaydi.
 *
 * @param {string} prefix - `localStorage` kalit prefiksi
 * @returns {object}
 */
export function createCache(prefix) {
  /** Seans davomidagi xotira keshi — `localStorage` dan tez. */
  const memory = new Map();

  /** Fon rejimida ketayotgan yangilashlar — ikkilanmasin. */
  const inflight = new Map();

  const full = (key) => `${prefix}.${key}`;

  /**
   * Keshdagi yozuvni oladi (avval xotira, keyin localStorage).
   * @param {string} key
   * @returns {?{value: *, at: number}}
   */
  function read(key) {
    if (memory.has(key)) return memory.get(key);
    try {
      const raw = localStorage.getItem(full(key));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.at) return null;
      memory.set(key, parsed);
      return parsed;
    } catch (e) {
      // Shaxsiy rejim yoki buzuq yozuv — kesh ixtiyoriy
      return null;
    }
  }

  /**
   * Keshga yozadi.
   * @param {string} key
   * @param {*} value
   */
  function write(key, value) {
    const entry = { value, at: Date.now() };
    memory.set(key, entry);
    try {
      localStorage.setItem(full(key), JSON.stringify(entry));
    } catch (e) {
      // Joy tugagan bo'lishi mumkin — xotira keshi baribir ishlaydi
    }
  }

  /**
   * Kesh yozuvini o'chiradi (ma'lumot o'zgargandan keyin).
   * @param {string} key
   */
  function drop(key) {
    memory.delete(key);
    try {
      localStorage.removeItem(full(key));
    } catch (e) {
      // Ixtiyoriy
    }
  }

  /** Prefiksdagi hamma narsani tozalaydi (chiqishda). */
  function clear() {
    memory.clear();
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(`${prefix}.`))
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      // Ixtiyoriy
    }
  }

  /**
   * "Keshdan darhol ber, fonda yangila".
   *
   * Sahifalar tarmoqni KUTMAYDI: kesh bo'lsa ma'lumot shu zahoti
   * qaytadi, yangisi esa fonda keladi va `onUpdate` orqali beriladi.
   *
   * @template T
   * @param {string} key
   * @param {number} ttl - kesh yangi hisoblanadigan muddat (ms)
   * @param {() => Promise<T>} fetcher
   * @param {?(value: T) => void} [onUpdate]
   * @returns {Promise<T>}
   */
  async function swr(key, ttl, fetcher, onUpdate = null) {
    const entry = read(key);
    const fresh = entry && Date.now() - entry.at < ttl;

    const refresh = () => {
      if (inflight.has(key)) return inflight.get(key);
      const task = withTimeout(fetcher(), key)
        .then((value) => {
          write(key, value);
          return value;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, task);
      return task;
    };

    // Kesh yangi — tarmoqqa umuman chiqmaymiz
    if (fresh) return entry.value;

    // Kesh bor, lekin eskirgan: darhol beramiz, yangisini fonda olamiz
    if (entry) {
      refresh()
        .then((value) => {
          if (onUpdate && JSON.stringify(value) !== JSON.stringify(entry.value)) {
            onUpdate(value);
          }
        })
        .catch((e) => console.warn(`[cache] fon yangilash (${key}): ${e.message}`));
      return entry.value;
    }

    // Kesh yo'q — kutishdan boshqa iloj yo'q, lekin chegara bilan
    return refresh();
  }

  /**
   * Keshdagi qiymatni tarmoqsiz beradi (eskirgan bo'lsa ham).
   * @param {string} key
   * @returns {?*}
   */
  function peek(key) {
    const entry = read(key);
    return entry ? entry.value : null;
  }

  return { swr, peek, read, write, drop, clear };
}

/**
 * Va'daga vaqt chegarasi qo'yadi.
 * @template T
 * @param {Promise<T>} promise
 * @param {string} label - xato matnida ko'rinadi
 * @param {number} [ms]
 * @returns {Promise<T>}
 */
export function withTimeout(promise, label, ms = READ_TIMEOUT) {
  let timer = null;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`${label}: server javob bermadi`);
      error.code = 'timeout';
      reject(error);
    }, ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

/**
 * `onSnapshot` ga birinchi javob chegarasini qo'shadi.
 *
 * NEGA KERAK: `onSnapshot` ulanish yo'q bo'lganda XATO BERMAYDI — u
 * shunchaki jim turadi va qayta ulanishga urinaveradi. Sahifa esa
 * birinchi snapshot kelishini kutib skeletonda qoladi. O'lchovda
 * tarmoq uzilganda admin va kuryer ilovalari 20 sekunddan keyin ham
 * spinner ko'rsatib turgan edi.
 *
 * Obuna UZILMAYDI — kechikkan javob baribir kelsa ishlatiladi.
 * Chegara faqat sahifaga "kutma, keshdagini ko'rsat" deb aytadi.
 *
 * @param {Function} subscribe - `(onData, onError) => unsubscribe`
 * @param {Function} onData
 * @param {Function} onError
 * @param {number} [ms]
 * @returns {Function} obunani uzish
 */
export function watchGuard(subscribe, onData, onError, ms = WATCH_TIMEOUT) {
  let delivered = false;
  let timer = setTimeout(() => {
    if (delivered) return;
    const error = new Error('oqim javob bermadi');
    error.code = 'timeout';
    onError(error);
  }, ms);

  const stop = subscribe(
    (value) => {
      delivered = true;
      clearTimeout(timer);
      timer = null;
      onData(value);
    },
    (error) => {
      delivered = true;
      clearTimeout(timer);
      timer = null;
      onError(error);
    }
  );

  return () => {
    if (timer) clearTimeout(timer);
    stop();
  };
}
