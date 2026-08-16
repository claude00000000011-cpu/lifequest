// ============================================================
// xp.js — Sistema XP, livelli, streak e trofei
// ============================================================

import { RANK_TITLES, CAT_STAT, STAT_COLORS, LVL_SCALE_FACTOR, DAILY_XP_CAPS } from './config.js';
import { DB, CUR, setCUR, persist } from './db.js';
import { today, spawnXPFloat, toast } from './utils.js';
import { playSound } from './audio.js';
import { Users } from './api.js';

export function xpForLevel(lvl) {
  if (lvl <= 20)  return Math.floor(50  * Math.pow(lvl, 1.2));
  if (lvl <= 50)  return Math.floor(35  * Math.pow(lvl, 1.5));
  if (lvl <= 100) return Math.floor(20  * Math.pow(lvl, 1.7));
  if (lvl <= 200) return Math.floor(10  * Math.pow(lvl, 1.9));
  return               Math.floor(5   * Math.pow(lvl, 2.1));
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

export function levelScaleMult(level) {
  return 1 + Math.log2(Math.max(1, level)) * 0.15;
}

export function streakMult(streak = 0) {
  if (streak >= 30) return 1.25;
  if (streak >= 14) return 1.15;
  if (streak >= 7)  return 1.08;
  if (streak >= 3)  return 1.04;
  return 1;
}

// ── Streak ───────────────────────────────────────────────────

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

function consumeDailyUnits(user, category, unitsUsed) {
  const cap = DAILY_XP_CAPS[category];
  if (!cap) return { remaining: unitsUsed, updatedUser: user };

  const t = today();

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

export async function awardXP(baseXP, category = null, units = null) {
  if (!CUR) return 0;
  let user = DB.users[CUR.id];
  if (!user) return 0;

  user = updateStreak(user);

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

  const ratio      = units ? (remaining / unitsToConsume) : 1;
  const cappedBase = Math.round(baseXP * ratio);

  const level     = calcLevel(user.xp || 0);
  const scaleMult = levelScaleMult(level);

  const sMult       = streakMult(user.streak);
  const streakBonus = Math.round(cappedBase * (sMult - 1));
  const earned      = Math.round(cappedBase * scaleMult) + streakBonus;

  if (earned <= 0) return 0;

  const prevLevel = level;
  const newXP     = user.xp + earned;
  const newLevel  = calcLevel(newXP);

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

  const color = statKey ? STAT_COLORS[statKey] : '#7c3aed';
  spawnXPFloat(earned, color);

 if (newLevel > prevLevel) {
    playSound('levelup');
    toast(`🎉 Level Up! Sei ora al livello ${newLevel}!`, 'success');
    const levelsGained = newLevel - prevLevel;
    const bc = DB.battleCharacters?.[CUR.id];
    if (bc) {
      const newSP = (bc.skill_points || 0) + levelsGained;
      DB.battleCharacters[CUR.id].skill_points = newSP;
     import('../../supabase.js').then(({ supabase: sb }) => {
        sb.from('battle_characters')
          .update({ skill_points: newSP })
          .eq('id', bc.id);
      });
    }
  } else {
    playSound('xp');
  }

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
