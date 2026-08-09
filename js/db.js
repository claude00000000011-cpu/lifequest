// ============================================================
// db.js — Database locale (localStorage) + stato sessione
// ============================================================
// Questo modulo è il SINGLE SOURCE OF TRUTH per i dati locali.
// Nella Fase 2 questo file verrà affiancato da supabase.js;
// api.js continuerà a fare da router senza che il resto cambi.
// ============================================================

import { DB_KEY, SESSION_KEY, SESSION_KEYS, ROUTINE_ITEMS } from './config.js';

// ── Schema vuoto ─────────────────────────────────────────────

function mkDB() {
  return {
    version: 5,
    users:            {},   // { [userId]: UserObject }
    quests:           [],
    exams:            [],
    chapters:         [],
    concepts:         [],
    studySessions:    [],
    books:            [],
    readingSessions:  [],
    challenges:       [],
    feedPosts:        [],
    routines:         [...ROUTINE_ITEMS.map(r => ({ ...r, isDefault: true }))],
    routineLogs:      [],
    comments:         [],
    globalBooks:      [],
    discussions:      [],
    discussionReplies:[],
    bannedWords:      [],
  };
}

// ── Persistenza ──────────────────────────────────────────────

/** Carica il DB da localStorage, o ne crea uno vuoto. */
export function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return mkDB();
    const parsed = JSON.parse(raw);
    // Merge con schema vuoto per garantire tutti i campi
    return { ...mkDB(), ...parsed };
  } catch {
    return mkDB();
  }
}

/** Salva il DB su localStorage. */
export function saveDB(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('[DB] saveDB failed:', e);
  }
}

// ── Istanza globale (singleton) ──────────────────────────────
export let DB = loadDB();

/** Salva e aggiorna l'istanza globale. */
export function persist() {
  saveDB(DB);
}

// ── Sessione utente ──────────────────────────────────────────

/**
 * Legge l'utente corrente dalla sessione (prova chiavi dalla v5 alla v2).
 * @returns {Object|null}
 */
export function loadSession() {
  for (const key of SESSION_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw) {
      try { return JSON.parse(raw); } catch { /* continua */ }
    }
  }
  return null;
}

/**
 * Salva l'utente corrente nella sessione.
 * @param {Object} user
 */
export function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

/**
 * Rimuove tutte le sessioni (logout).
 */
export function clearSession() {
  SESSION_KEYS.forEach(k => localStorage.removeItem(k));
}

// ── Istanza globale utente corrente ──────────────────────────
export let CUR = loadSession();

/** Aggiorna CUR in memoria e in sessione. */
export function setCUR(user) {
  // eslint-disable-next-line no-global-assign
  CUR = user;
  if (user) saveSession(user);
  else clearSession();
}

/** Ricarica CUR dal DB (dopo un aggiornamento dati). */
export function refreshCUR() {
  if (!CUR) return;
  const fresh = DB.users[CUR.id];
  if (fresh) {
    CUR = { ...CUR, ...fresh };
    saveSession(CUR);
  }
}

// ── Helper CRUD generici ─────────────────────────────────────

/**
 * Trova un record per ID in un array del DB.
 * @param {'quests'|'books'|'exams'|...} collection
 * @param {string} id
 */
export function findById(collection, id) {
  return DB[collection]?.find(item => item.id === id) ?? null;
}

/**
 * Inserisce un record in una collezione e persiste.
 * @param {string} collection
 * @param {Object} record
 */
export function insert(collection, record) {
  if (!DB[collection]) DB[collection] = [];
  DB[collection].push(record);
  persist();
  return record;
}

/**
 * Aggiorna un record per ID in una collezione e persiste.
 * @param {string} collection
 * @param {string} id
 * @param {Object} patch
 * @returns {Object|null} record aggiornato
 */
export function update(collection, id, patch) {
  const idx = DB[collection]?.findIndex(r => r.id === id);
  if (idx === -1 || idx == null) return null;
  DB[collection][idx] = { ...DB[collection][idx], ...patch };
  persist();
  return DB[collection][idx];
}

/**
 * Elimina un record per ID da una collezione e persiste.
 * @param {string} collection
 * @param {string} id
 * @returns {boolean}
 */
export function remove(collection, id) {
  const before = DB[collection]?.length ?? 0;
  DB[collection] = DB[collection]?.filter(r => r.id !== id) ?? [];
  persist();
  return DB[collection].length < before;
}

/**
 * Filtra una collezione per userId.
 * @param {string} collection
 * @param {string} userId
 */
export function byUser(collection, userId) {
  return DB[collection]?.filter(r => r.userId === userId) ?? [];
}

// ── Conflitti e merge cloud ──────────────────────────────────

/**
 * Riconcilia i dati locali con quelli del server.
 * Strategia: valori numerici → MAX; array → UNION; oggetti → merge profondo.
 * @param {Object} local  — dati locali CUR
 * @param {Object} remote — dati remoti dal server
 * @returns {Object} oggetto riconciliato
 */
export function mergeUserData(local, remote) {
  if (!remote) return local;
  if (!local)  return remote;

  const numericMax = (a, b) => Math.max(Number(a) || 0, Number(b) || 0);
  const unionArr   = (a, b) => [...new Set([...(a || []), ...(b || [])])];

  const stats = {};
  const allStatKeys = new Set([
    ...Object.keys(local.stats || {}),
    ...Object.keys(remote.stats || {}),
  ]);
  for (const k of allStatKeys) {
    stats[k] = numericMax(local.stats?.[k], remote.stats?.[k]);
  }

  return {
    ...local,
    ...remote,
    xp:       numericMax(local.xp,       remote.xp),
    level:    numericMax(local.level,     remote.level),
    streak:   numericMax(local.streak,    remote.streak),
    trophies: unionArr(local.trophies,   remote.trophies),
    following: remote.following ?? local.following ?? [],
    followers: remote.followers ?? local.followers ?? [],
    languages: remote.languages ?? local.languages ?? [],
    stats,
  };
}

// ── Utility date ─────────────────────────────────────────────

/** Restituisce tutti i record di una collezione con una data specifica. */
export function byDate(collection, dateStr, dateField = 'createdAt') {
  return DB[collection]?.filter(r =>
    (r[dateField] || r.date || r.doneAt || '').startsWith(dateStr)
  ) ?? [];
}

/** Restituisce le date uniche (YYYY-MM-DD) presenti in una collezione. */
export function uniqueDates(collection, dateField = 'createdAt') {
  const dates = DB[collection]
    ?.map(r => (r[dateField] || r.date || r.doneAt || '').slice(0, 10))
    .filter(Boolean) ?? [];
  return [...new Set(dates)];
}
