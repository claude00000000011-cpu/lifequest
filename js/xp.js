// ============================================================
// xp.js — Sistema XP, livelli, streak e trofei
// ============================================================

import { RANK_TITLES, CAT_STAT, STAT_COLORS, LVL_SCALE_FACTOR, DAILY_XP_CAPS } from './config.js';
import { DB, CUR, setCUR, persist } from './db.js';
import { today, spawnXPFloat, toast } from './utils.js';
import { playSound } from './audio.js';
import { Users } from './api.js';

// ── Livelli ──────────────────────────────────────────────────

export function xpForLevel(lvl) {
  // Curva ibrida: lineare nei primi 100 livelli, poi rallenta
  if (lvl <= 100)  return Math.floor(80  * Math.pow(lvl, 1.4));
  if (lvl <= 500)  return Math.floor(60  * Math.pow(lvl, 1.5));
  return               Math.floor(40  * Math.pow(lvl, 1.6));
}

export function calcLevel(xp) {
  let lvl = 1;
  while (xpForLevel(lvl + 1) <= xp) lvl++;
  return lvl;
}

export function xpBarPct(xp) {
  const lvl     = calcLevel(xp);
  const current = xpForLevel(lvl);
  const next    = xpForLevel(lvl + 1);
  return Math.round(((xp - current) / (next - current)) * 100);
}

export function rankTitle(lvl) {
  const idx = Math.min(Math.floor((lvl - 1) / 10), RANK_TITLES.length - 1);
  return RANK_TITLES[idx];
}

// ── Scaling livello ──────────────────────────────────────────

/**
 * Moltiplicatore XP basato sul livello — curva logaritmica.
 * lv.1 → ×1.15 | lv.10 → ×1.65 | lv.50 → ×2.06 | lv.100 → ×2.21
 * Mai oltre ×2.5 anche a livelli altissimi → no snowball.
 */
export function levelScaleMult(level) {
  return 1 + Math.log2(Math.max(1, level)) * 0.15;
}

/**
 * Streak e level scaling ora sono SEPARATI e non si moltiplicano tra loro.
 * Il bonus streak è additivo, non moltiplicativo.
 * Prima: earned = base * levelMult * streakMult  → esponenziale
 * Ora:   earned = base * levelMult + base * streakBonus → lineare
 */
export function streakMult(streak = 0) {
  if (streak >= 30) return 1.25;  // era 1.5
  if (streak >= 14) return 1.15;  // era 1.35
  if (streak >= 7)  return 1.08;  // era 1.2
  if (streak >= 3)  return 1.04;  // era 1.1
  return 1;
}

// ── Streak ───────────────────────────────────────────────────

export function streakMult(streak = 0) {
  if (streak >= 30) return 1.5;
  if (streak >= 14) return 1.35;
  if (streak >= 7)  return 1.2;
  if (streak >= 3)  return 1.1;
  return 1;
}

function updateStreak(user) {
  const t          = today();
  const lastActive = user.lastActive;
  if (lastActive === t) return user;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  const newStreak = lastActive === yStr ? (user.streak || 0) + 1 : 1;
  return { ...user, streak: newStreak, lastActive: t };
}

// ── Cap giornaliero per categoria ────────────────────────────

/**
 * Legge e aggiorna il contatore giornaliero di una categoria.
 * Restituisce le unità ancora disponibili oggi.
 * @param {Object} user
 * @param {string} category
 * @param {number} unitsUsed  — unità consumate in questa azione
 * @returns {{ remaining: number, updatedUser: Object }}
 */
function consumeDailyUnits(user, category, unitsUsed) {
  const cap = DAILY_XP_CAPS[category];
  if (!cap) return { remaining: unitsUsed, updatedUser: user };

  const t = today();

  // Inizializza o resetta il contatore se è un nuovo giorno
  const dailyXP = (user.dailyXP && user.dailyXP.date === t)
    ? { ...user.dailyXP }
    : { date: t };

  const usedSoFar = dailyXP[category] || 0;
  const remaining = Math.max(0, cap.maxUnits - usedSoFar);
  const effective = Math.min(unitsUsed, remaining);

  dailyXP[category] = usedSoFar + effective;

  return {
    remaining: effective,
    updatedUser: { ...user, dailyXP },
  };
}

/**
 * Controlla quante unità sono rimaste oggi per una categoria.
 * Utile per mostrare il cap all'utente prima di loggare.
 */
export function getDailyUnitsLeft(category, unitsPerAction = 1) {
  if (!CUR) return 0;
  const user = DB.users[CUR.id];
  if (!user) return 0;
  const cap = DAILY_XP_CAPS[category];
  if (!cap) return 9999;

  const t = today();
  const dailyXP = (user.dailyXP && user.dailyXP.date === t) ? user.dailyXP : {};
  const usedSoFar = dailyXP[category] || 0;
  return Math.max(0, cap.maxUnits - usedSoFar);
}

// ── Assegnazione XP ──────────────────────────────────────────

/**
 * Assegna XP scalato per livello, con cap giornaliero per categoria.
 *
 * @param {number} baseXP       — XP base (pre-scaling)
 * @param {string} category     — categoria ('lettura', 'studio', ecc.)
 * @param {number} [units]      — unità consumate per il cap (pagine, minuti…)
 *                                Se omesso, usa baseXP come unità
 * @returns {Promise<number>}   — XP effettivo assegnato
 */
export async function awardXP(baseXP, category = null, units = null) {
  if (!CUR) return 0;
  let user = DB.users[CUR.id];
  if (!user) return 0;

  // 1. Aggiorna streak
  user = updateStreak(user);

  // 2. Cap giornaliero — controlla quante unità sono ancora disponibili
  const unitsToConsume = units ?? baseXP;
  const { remaining, updatedUser } = consumeDailyUnits(user, category, unitsToConsume);
  user = updatedUser;

  if (remaining <= 0) {
    DB.users[CUR.id] = user;
    setCUR(user);
    persist();
    toast('📵 Limite XP giornaliero raggiunto per questa attività.', 'info');
    return 0;
  }

  // 3. Ricalcola baseXP proporzionalmente se solo alcune unità sono rimaste
  const ratio      = units ? (remaining / unitsToConsume) : 1;
  const cappedBase = Math.round(baseXP * ratio);

  // 4. Scaling logaritmico per livello
  const level     = calcLevel(user.xp || 0);
  const scaleMult = levelScaleMult(level);

  // 5. Streak bonus — additivo, non moltiplicativo sul level scaling
  const sMult       = streakMult(user.streak);
  const streakBonus = Math.round(cappedBase * (sMult - 1));
  const earned      = Math.round(cappedBase * scaleMult) + streakBonus;

  if (earned <= 0) return 0;

  // 6. Applica XP
  const prevLevel = level;
  const newXP     = user.xp + earned;
  const newLevel  = calcLevel(newXP);

  // 7. Aggiorna stat di categoria
  const stats  = { ...user.stats };
  const statKey = CAT_STAT[category] || null;
  if (statKey && stats[statKey] !== undefined) {
    stats[statKey] += earned;
  }

  const updated = {
    ...user,
    xp:        newXP,
    level:     newLevel,
    rankTitle: rankTitle(newLevel),
    stats,
  };

  DB.users[CUR.id] = updated;
  setCUR(updated);
  persist();

  // 8. Feedback visivo
  const color = statKey ? STAT_COLORS[statKey] : '#7c3aed';
  spawnXPFloat(earned, color);

  if (newLevel > prevLevel) {
    playSound('levelup');
    toast(`🎉 Level Up! Sei ora al livello ${newLevel}!`, 'success');
  } else {
    playSound('xp');
  }

  // 9. Sync cloud
  Users.update(CUR.id, {
    xp:         newXP,
    level:      newLevel,
    streak:     updated.streak,
    lastActive: updated.lastActive,
    stats,
    dailyXP:    updated.dailyXP,
  });

  import('./trophies.js').then(({ checkTrophies }) => checkTrophies());

  return earned;
}

export function buildUserPayload(user) {
  const { passwordHash, pinHash, ...safe } = user;
  return safe;
}
