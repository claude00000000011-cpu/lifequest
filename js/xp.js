// ============================================================
// xp.js — Sistema XP, livelli, streak e trofei
// ============================================================

import { RANK_TITLES, CAT_STAT, STAT_COLORS } from './config.js';
import { DB, CUR, setCUR, persist } from './db.js';
import { today, spawnXPFloat, toast } from './utils.js';
import { playSound } from './audio.js';
import { Users } from './api.js';

// ── Livelli ──────────────────────────────────────────────────

/**
 * XP necessario per raggiungere il livello `lvl`.
 * Formula: 100 * lvl^1.5
 */
export function xpForLevel(lvl) {
  return Math.floor(100 * Math.pow(lvl, 1.5));
}

/**
 * Calcola il livello corrente dato l'XP totale.
 */
export function calcLevel(xp) {
  let lvl = 1;
  while (xpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}

/**
 * Percentuale di avanzamento verso il prossimo livello.
 * Restituisce un valore 0–100.
 */
export function xpBarPct(xp) {
  const lvl     = calcLevel(xp);
  const current = xpForLevel(lvl);
  const next    = xpForLevel(lvl + 1);
  return Math.round(((xp - current) / (next - current)) * 100);
}

/**
 * Titolo di rango per un dato livello.
 */
export function rankTitle(lvl) {
  const idx = Math.min(
    Math.floor((lvl - 1) / 10),
    RANK_TITLES.length - 1
  );
  return RANK_TITLES[idx];
}

// ── Streak ───────────────────────────────────────────────────

/**
 * Moltiplicatore XP in base ai giorni consecutivi (streak).
 * 3d → ×1.1 | 7d → ×1.2 | 14d → ×1.35 | 30d+ → ×1.5
 */
export function streakMult(streak = 0) {
  if (streak >= 30) return 1.5;
  if (streak >= 14) return 1.35;
  if (streak >= 7)  return 1.2;
  if (streak >= 3)  return 1.1;
  return 1;
}

/**
 * Aggiorna lo streak dell'utente corrente in base all'ultimo giorno attivo.
 * Da chiamare a ogni awardXP.
 * @param {Object} user
 * @returns {Object} user aggiornato
 */
function updateStreak(user) {
  const t          = today();
  const lastActive = user.lastActive;

  if (lastActive === t) return user; // già aggiornato oggi

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  const newStreak = lastActive === yStr ? (user.streak || 0) + 1 : 1;

  return { ...user, streak: newStreak, lastActive: t };
}

// ── Assegnazione XP ──────────────────────────────────────────

/**
 * Assegna XP all'utente corrente.
 * Aggiorna stats, streak, livello; mostra float e suono; sincronizza.
 *
 * @param {number} baseXP      — XP base da assegnare
 * @param {string} [category]  — categoria per aggiornare la stat (es. 'studio')
 * @returns {Promise<number>}  — XP effettivo assegnato (dopo moltiplicatori)
 */
export async function awardXP(baseXP, category = null) {
  if (!CUR) return 0;

  const user = DB.users[CUR.id];
  if (!user) return 0;

  // Aggiorna streak
  const userWithStreak = updateStreak(user);
  const mult           = streakMult(userWithStreak.streak);
  const earned         = Math.round(baseXP * mult);

  const prevLevel = calcLevel(userWithStreak.xp);
  const newXP     = userWithStreak.xp + earned;
  const newLevel  = calcLevel(newXP);

  // Aggiorna stat di categoria
  const stats = { ...userWithStreak.stats };
  const statKey = CAT_STAT[category] || null;
  if (statKey && stats[statKey] !== undefined) {
    stats[statKey] += earned;
  }

  const updated = {
    ...userWithStreak,
    xp:         newXP,
    level:      newLevel,
    rankTitle:  rankTitle(newLevel),
    stats,
  };

  DB.users[CUR.id] = updated;
  setCUR(updated);
  persist();

  // Feedback visivo
  const color = statKey ? STAT_COLORS[statKey] : '#7c3aed';
  spawnXPFloat(earned, color);

  // Suono
  if (newLevel > prevLevel) {
    playSound('levelup');
    toast(`🎉 Level Up! Sei ora al livello ${newLevel}!`, 'success');
  } else {
    playSound('xp');
  }

  // Sync cloud (fire-and-forget)
  Users.update(CUR.id, {
    xp:     newXP,
    level:  newLevel,
    streak: updated.streak,
    lastActive: updated.lastActive,
    stats,
  });

  // Controlla trofei (lazy import per evitare cicli)
  import('./trophies.js').then(({ checkTrophies }) => checkTrophies());

  return earned;
}

// ── Payload utente per il cloud ──────────────────────────────

/**
 * Serializza i dati dell'utente per la sincronizzazione cloud.
 * Esclude dati sensibili (passwordHash, pinHash).
 */
export function buildUserPayload(user) {
  const { passwordHash, pinHash, ...safe } = user;
  return safe;
}
