// ============================================================
// trophies.js — Definizioni trofei e logica di sblocco
// ============================================================

import { DB, CUR, persist } from './db.js';
import { toast } from './utils.js';
import { playSound } from './audio.js';
import { Users } from './api.js';

// ── Definizioni ──────────────────────────────────────────────

export const TROPHY_DEFS = [
  // Quest
  { id: 'first_quest',    label: '🎯 Prima Quest',         desc: 'Completa la tua prima quest',               check: u => u._completedQuests >= 1 },
  { id: 'quests_10',      label: '⚔️ Avventuriero',         desc: 'Completa 10 quest',                         check: u => u._completedQuests >= 10 },
  { id: 'quests_50',      label: '🏹 Cacciatore',           desc: 'Completa 50 quest',                         check: u => u._completedQuests >= 50 },
  { id: 'quests_100',     label: '🗡️ Veterano',             desc: 'Completa 100 quest',                        check: u => u._completedQuests >= 100 },

  // Streak
  { id: 'streak_3',       label: '🔥 Fiamma Viva',          desc: 'Mantieni uno streak di 3 giorni',           check: u => u.streak >= 3 },
  { id: 'streak_7',       label: '🔥🔥 Settimana di Fuoco',  desc: 'Mantieni uno streak di 7 giorni',           check: u => u.streak >= 7 },
  { id: 'streak_30',      label: '💥 Leggenda Quotidiana',   desc: 'Mantieni uno streak di 30 giorni',          check: u => u.streak >= 30 },

  // Livello
  { id: 'level_5',        label: '⭐ Apprendista',           desc: 'Raggiungi il livello 5',                    check: u => u.level >= 5 },
  { id: 'level_10',       label: '⭐⭐ Guerriero',            desc: 'Raggiungi il livello 10',                   check: u => u.level >= 10 },
  { id: 'level_25',       label: '⭐⭐⭐ Campione',            desc: 'Raggiungi il livello 25',                   check: u => u.level >= 25 },
  { id: 'level_50',       label: '🌟 Maestro',               desc: 'Raggiungi il livello 50',                   check: u => u.level >= 50 },

  // XP
  { id: 'xp_1000',        label: '💎 Diamante Verde',        desc: 'Accumula 1.000 XP totali',                  check: u => u.xp >= 1000 },
  { id: 'xp_10000',       label: '💎💎 Diamante Blu',         desc: 'Accumula 10.000 XP totali',                 check: u => u.xp >= 10000 },
  { id: 'xp_100000',      label: '💎💎💎 Diamante Viola',      desc: 'Accumula 100.000 XP totali',                check: u => u.xp >= 100000 },

  // Libri
  { id: 'first_book',     label: '📖 Lettore',               desc: 'Completa il tuo primo libro',               check: u => u._completedBooks >= 1 },
  { id: 'books_5',        label: '📚 Bibliofilo',             desc: 'Completa 5 libri',                          check: u => u._completedBooks >= 5 },
  { id: 'books_20',       label: '🏛️ Erudito',                desc: 'Completa 20 libri',                         check: u => u._completedBooks >= 20 },

  // Routine
  { id: 'routine_7',      label: '🧘 Abitudini Solide',       desc: '7 giorni consecutivi di routine',           check: u => u.streak >= 7 && u._routinesToday >= 1 },
  { id: 'routine_100',    label: '⚡ Macchina Perfetta',      desc: '100 routine completate in totale',          check: u => u._totalRoutines >= 100 },

  // PvP
  { id: 'first_pvp',      label: '⚔️ Gladiatore',             desc: 'Vinci la tua prima sfida PvP',              check: u => u._pvpWins >= 1 },
  { id: 'pvp_5',          label: '🏆 Campione PvP',           desc: 'Vinci 5 sfide PvP',                         check: u => u._pvpWins >= 5 },

  // Social
  { id: 'first_follow',   label: '👥 Sociale',                desc: 'Segui il tuo primo utente',                 check: u => (u.following?.length || 0) >= 1 },
  { id: 'followers_10',   label: '🌟 Influencer',             desc: 'Raggiungi 10 follower',                     check: u => (u.followers?.length || 0) >= 10 },
  { id: 'followers_100',  label: '🚀 Star',                   desc: 'Raggiungi 100 follower',                    check: u => (u.followers?.length || 0) >= 100 },
];

// ── Stato derivato ───────────────────────────────────────────

/**
 * Calcola i contatori necessari per verificare i trofei.
 * Restituisce l'utente arricchito con campi _xxx.
 */
function enrichUser(user) {
  const userId = user.id;

  const completedQuests = DB.quests.filter(
    q => q.userId === userId && q.completed
  ).length;

  const completedBooks = DB.books.filter(
    b => b.userId === userId && b.completed
  ).length;

  const totalRoutines = DB.routineLogs.filter(
    r => r.userId === userId
  ).length;

  const routinesToday = DB.routineLogs.filter(
    r => r.userId === userId && r.doneAt === new Date().toISOString().slice(0, 10)
  ).length;

  const pvpWins = DB.challenges.filter(
    c => c.winnerId === userId
  ).length;

  return {
    ...user,
    _completedQuests: completedQuests,
    _completedBooks:  completedBooks,
    _totalRoutines:   totalRoutines,
    _routinesToday:   routinesToday,
    _pvpWins:         pvpWins,
  };
}

// ── Check e assegnazione ─────────────────────────────────────

/**
 * Controlla tutti i trofei per l'utente corrente.
 * Sblocca quelli non ancora ottenuti e che soddisfano i requisiti.
 */
export function checkTrophies() {
  if (!CUR) return;

  const user = DB.users[CUR.id];
  if (!user) return;

  const enriched = enrichUser(user);
  const current  = new Set(user.trophies || []);
  const newOnes  = [];

  for (const def of TROPHY_DEFS) {
    if (current.has(def.id)) continue;
    try {
      if (def.check(enriched)) {
        newOnes.push(def.id);
      }
    } catch { /* check failed — ignora */ }
  }

  if (newOnes.length === 0) return;

  const updatedTrophies = [...current, ...newOnes];
  DB.users[CUR.id].trophies = updatedTrophies;
  persist();

  // Notifiche per ogni nuovo trofeo
  newOnes.forEach((id, i) => {
    const def = TROPHY_DEFS.find(d => d.id === id);
    if (!def) return;
    setTimeout(() => {
      playSound('trophy');
      toast(`${def.label} — ${def.desc}`, 'success');
    }, i * 800);
  });

  // Sync cloud
  Users.update(CUR.id, { trophies: updatedTrophies });
}
