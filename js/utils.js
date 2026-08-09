// ============================================================
// utils.js — Funzioni di utilità condivise
// ============================================================

// ── ID & Time ───────────────────────────────────────────────

/** Genera un ID univoco casuale */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Timestamp corrente (ms) */
export function ts() {
  return Date.now();
}

/** Data odierna in formato ISO (YYYY-MM-DD) */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Data relativa leggibile (adesso, 5 min fa, 2 h fa, 3 g fa) */
export function timeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const min  = Math.floor(diff / 60000);
  const h    = Math.floor(diff / 3600000);
  const d    = Math.floor(diff / 86400000);

  if (min < 1)  return 'adesso';
  if (min < 60) return `${min} min fa`;
  if (h < 24)   return `${h} h fa`;
  return `${d} g fa`;
}

// ── Sicurezza ────────────────────────────────────────────────

/**
 * Genera un hash SHA-256 della stringa in input.
 * Restituisce una stringa esadecimale.
 */
export async function hashStr(str) {
  const buf  = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Sanitizza una stringa per prevenire XSS.
 * Sostituisce i caratteri HTML speciali con entità.
 */
export function escHtml(str = '') {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

// ── UI Helpers ───────────────────────────────────────────────

/**
 * Restituisce una stringa di stelle (★☆) per la difficoltà.
 * @param {number} level — 1..5
 */
export function diffStars(level = 1) {
  const n = Math.min(5, Math.max(1, level));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

/**
 * Mostra un toast a comparsa.
 * @param {string} msg  — Messaggio da mostrare
 * @param {'success'|'error'|'info'} type
 */
export function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container')
    || (() => {
      const el = document.createElement('div');
      el.id = 'toast-container';
      document.body.appendChild(el);
      return el;
    })();

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = msg;
  container.appendChild(el);

  // Forza il reflow per attivare la transizione CSS
  void el.offsetHeight;
  el.classList.add('toast--visible');

  setTimeout(() => {
    el.classList.remove('toast--visible');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
  }, 3000);
}

/**
 * Mostra/nasconde l'overlay di caricamento globale.
 * @param {boolean} show
 * @param {string} [msg]
 */
export function setLoading(show, msg = 'Caricamento…') {
  let overlay = document.getElementById('loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = `<div class="loading-spinner"></div><p class="loading-msg"></p>`;
    document.body.appendChild(overlay);
  }
  overlay.querySelector('.loading-msg').textContent = msg;
  overlay.classList.toggle('loading-overlay--visible', show);
}

/**
 * Genera un float "+XP" animato a schermo.
 * @param {number} xp
 * @param {string} [color]
 */
export function spawnXPFloat(xp, color = '#7c3aed') {
  const el = document.createElement('div');
  el.className = 'xp-float';
  el.textContent = `+${xp} XP`;
  el.style.color = color;
  el.style.left = `${Math.random() * 60 + 20}%`;
  el.style.top  = `${Math.random() * 30 + 40}%`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// ── Immagini ─────────────────────────────────────────────────

/**
 * Comprime un'immagine tramite canvas.
 * @param {File} file
 * @param {number} maxW — larghezza max in px
 * @param {number} quality — 0..1
 * @returns {Promise<string>} dataURL base64
 */
export function compressImage(file, maxW = 800, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const ratio  = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = img.width  * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Apre un file picker per immagini e restituisce il dataURL compresso.
 * @param {number} maxMB — limite dimensione file
 * @returns {Promise<string|null>}
 */
export function pickImage(maxMB = 8) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return resolve(null);
      if (file.size > maxMB * 1024 * 1024) {
        toast(`Immagine troppo grande (max ${maxMB}MB)`, 'error');
        return resolve(null);
      }
      try {
        const dataUrl = await compressImage(file);
        resolve(dataUrl);
      } catch {
        toast('Errore nel caricamento immagine', 'error');
        resolve(null);
      }
    };
    input.click();
  });
}

// ── Validazione ──────────────────────────────────────────────

/**
 * Controlla se una stringa contiene parole bannate.
 * Le banned words vengono caricate da db.js (DB.bannedWords).
 * @param {string} text
 * @param {string[]} bannedWords
 * @returns {boolean}
 */
export function checkBannedWords(text = '', bannedWords = []) {
  const lower = text.toLowerCase();
  return bannedWords.some(w => lower.includes(w.toLowerCase()));
}

// ── Misc ─────────────────────────────────────────────────────

/**
 * Clamp di un valore numerico tra min e max.
 */
export function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

/**
 * Capitalizza la prima lettera di una stringa.
 */
export function capitalize(str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Debounce: ritarda l'esecuzione di fn di `wait` ms.
 */
export function debounce(fn, wait = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/**
 * Raggruppa un array di oggetti per una chiave.
 * @param {Array} arr
 * @param {string} key
 * @returns {Object}
 */
export function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] ?? 'other';
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}
