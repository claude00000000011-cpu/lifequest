// ============================================================
// db.js — Database locale (localStorage) + stato sessione
// ============================================================

import { DB_KEY, SESSION_KEY, SESSION_KEYS, ROUTINE_ITEMS } from './config.js';

function mkDB() {
  return {
    version:           5,

    // ── Core app ──────────────────────────────────────────────
    users:             {},
    quests:            [],
    exams:             [],
    chapters:          [],
    concepts:          [],
    studySessions:     [],
    books:             [],
    bookNotes:         [],
    readingSessions:   [],
    challenges:        [],
    feedPosts:         [],
    routines:          [...ROUTINE_ITEMS.map(r => ({ ...r, isDefault: true }))],
    routineLogs:       [],
    comments:          [],
    globalBooks:       [],
    discussions:       [],
    discussionReplies: [],
    bannedWords:       [],
    notifications:     [],

    // ── Battle system — cataloghi globali (array) ─────────────
    battleItems:       [],
    battleEnemies:     [],
    battleClasses:     [],
    battleAbilities:   [],
    lootBoxes:         [],
    enhancementConfig: [],

    // ── Battle system — dati per utente (oggetti keyed by userId) ─
    battleCharacters:  {},
    characterEquipment:{},
    characterAbilities:{},
    battleInventory:   {},
    dungeonProgress:   {},
    dungeonSessions:   {},
    dailyBattleLimits: {},
    activeSummons:     {},
    itemEnhancements:  {},

    // ── Social / Guild ────────────────────────────────────────
    guilds:            [],
    guildMembers:      [],
    guildRaids:        [],
    guildWars:         [],
    gameChat:          [],
    gameFriends:       {},

    // ── Mercato / Economia ────────────────────────────────────
    marketListings:    [],
    marketSales:       [],
    goldTransactions:  {},
    lootBoxHistory:    {},

    // ── PvP ───────────────────────────────────────────────────
    pvpRankings:       [],
    pvpSeasons:        [],
    battles:           [],
    battleLeaderboard: [],
  };
}

export function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return mkDB();
    return { ...mkDB(), ...JSON.parse(raw) };
  } catch { return mkDB(); }
}

export function saveDB(db) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  catch (e) { console.error('[DB] saveDB failed:', e); }
}

export let DB = loadDB();
export function persist() { saveDB(DB); }

export function loadSession() {
  for (const key of SESSION_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw) { try { return JSON.parse(raw); } catch { /* continua */ } }
  }
  return null;
}

export function saveSession(user)  { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); }
export function clearSession()     { SESSION_KEYS.forEach(k => localStorage.removeItem(k)); }

export let CUR = loadSession();

export function setCUR(user) {
  CUR = user;
  if (user) saveSession(user);
  else clearSession();
}

export function refreshCUR() {
  if (!CUR) return;
  const fresh = DB.users[CUR.id];
  if (fresh) { CUR = { ...CUR, ...fresh }; saveSession(CUR); }
}

export function findById(collection, id) {
  return DB[collection]?.find(item => item.id === id) ?? null;
}

export function insert(collection, record) {
  if (!DB[collection]) DB[collection] = [];
  if (!DB[collection].find(r => r.id === record.id)) DB[collection].push(record);
  persist();
  return record;
}

export function update(collection, id, patch) {
  const idx = DB[collection]?.findIndex(r => r.id === id);
  if (idx === -1 || idx == null) return null;
  DB[collection][idx] = { ...DB[collection][idx], ...patch };
  persist();
  return DB[collection][idx];
}

export function remove(collection, id) {
  const before = DB[collection]?.length ?? 0;
  DB[collection] = DB[collection]?.filter(r => r.id !== id) ?? [];
  persist();
  return DB[collection].length < before;
}

export function byUser(collection, userId) {
  return DB[collection]?.filter(r => r.userId === userId) ?? [];
}

export function mergeUserData(local, remote) {
  if (!remote) return local;
  if (!local)  return remote;
  const numericMax = (a, b) => Math.max(Number(a) || 0, Number(b) || 0);
  const unionArr   = (a, b) => [...new Set([...(a || []), ...(b || [])])];
  const stats = {};
  const allStatKeys = new Set([...Object.keys(local.stats || {}), ...Object.keys(remote.stats || {})]);
  for (const k of allStatKeys) stats[k] = numericMax(local.stats?.[k], remote.stats?.[k]);
  return {
    ...local, ...remote,
    xp:        numericMax(local.xp,    remote.xp),
    level:     numericMax(local.level, remote.level),
    streak:    numericMax(local.streak,remote.streak),
    trophies:  unionArr(local.trophies,  remote.trophies),
    following: remote.following ?? local.following ?? [],
    followers: remote.followers ?? local.followers ?? [],
    languages: remote.languages ?? local.languages ?? [],
    stats,
  };
}

export function byDate(collection, dateStr, dateField = 'createdAt') {
  return DB[collection]?.filter(r =>
    (r[dateField] || r.date || r.doneAt || '').startsWith(dateStr)
  ) ?? [];
}

export function uniqueDates(collection, dateField = 'createdAt') {
  const dates = DB[collection]
    ?.map(r => (r[dateField] || r.date || r.doneAt || '').slice(0, 10))
    .filter(Boolean) ?? [];
  return [...new Set(dates)];
}
