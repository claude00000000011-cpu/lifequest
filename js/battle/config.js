// ============================================================
// js/battle/config.js — ZERO numeri di bilanciamento.
// Tutti i valori numerici vivono in Supabase.
// Questo file contiene solo:
//   - costanti di struttura (nomi tabelle, nomi chiavi)
//   - formule pure (funzioni senza magic numbers)
//   - configurazioni non-numeriche
// ============================================================


// ── Tabelle Supabase da caricare all'avvio ──────────────────
export const DB_TABLES = {
  combatConfig:  'combat_config',
  dungeonTiers:  'dungeon_tiers',
  dungeonConfig: 'dungeon_config',
  battleClasses: 'battle_classes',
  battleEnemies: 'battle_enemies',
  bossMechanics: 'boss_mechanics_data',
};


// ── Formula danno — l'unica formula che resta nel codice ────
// K (def_constant) viene letto da DB.combatConfig.def_constant
// Chiamata: COMBAT.damage(atk, def, DB.combatConfig.def_constant)
export const COMBAT = {
  damage: (atk, def, K) =>
    Math.max(1, Math.floor(atk * (1 - def / (def + K)))),

  critDamage: (baseDmg, multiplier, bonusPct) =>
    Math.floor(baseDmg * multiplier * (1 + bonusPct)),

  // Tutti gli altri parametri numerici vengono da DB.combatConfig
  // Accesso: DB.combatConfig['def_constant'], DB.combatConfig['crit_multiplier'], ecc.
};


// ── Evoluzione classi ────────────────────────────────────────
export const CLASS_EVOLUTION = {
  levelFirst:  20,
  levelSecond: 40,
  paCost:      15,
  goldCost:    500,
  attackBonus: { warrior: 15, mage: 20, bard: 10, shadow: 18, oracle: 8  },
  hpBonus:     { warrior: 20, mage: 10, bard: 15, shadow: 12, oracle: 25 },
};


// ── Skill points ─────────────────────────────────────────────
export const SKILL_POINTS = {
  perLevel:       1,
  startingPa:     0,
  maxAccumulated: 99,
  resetCost:      300,
  maxPerBranch:   15,
};


// ── Costi abilità ────────────────────────────────────────────
export const ABILITY_LEVEL_COSTS = [
  { pa: 1, gold: 0,   minCharLevel: 1  },
  { pa: 2, gold: 50,  minCharLevel: 5  },
  { pa: 3, gold: 100, minCharLevel: 10 },
  { pa: 4, gold: 200, minCharLevel: 20 },
  { pa: 5, gold: 500, minCharLevel: 30 },
];


// ── Progressione e unlock ────────────────────────────────────
export const PROGRESSION = {
  tutorialFights: 5,
  startingGold:   50,
  starterItem:    1,
  UNLOCKS: {
    classChoice:     1,
    pvpArena:        5,
    guilds:          15,
    goldBoxes:       20,
    dungeon3:        20,
    dungeon4:        35,
    dungeon5:        50,
    evolution:       25,
    guildWar:        30,
    mythicBoxes:     50,
    ultimateAbility: 40,
  },
  dungeonLevelCap: 2,
  pvpLevelCap:     10,
  PVP_SEASON_REWARDS: {
    top1pct:  { gold: 500, legendaryItem: true  },
    top10pct: { gold: 200, legendaryItem: false },
    top50pct: { gold: 80,  legendaryItem: false },
  },
  pvpSeasonReset: 0.50,
};


// ── Economia ─────────────────────────────────────────────────
export const ECONOMY = {
  goldSellPct:       0.20,
  targetDailyGold:   300,
  goldPvpWin:        80,
  goldPvpLoss:       20,
  goldDungeonBonus:  60,
  goldGuildQuestMin: 30,
  goldGuildQuestMax: 100,
  LOOT_BOXES: {
    wood:   { cost: 50,   pity: 10, rarityTarget: 'uncommon'  },
    iron:   { cost: 150,  pity: 10, rarityTarget: 'rare'      },
    gold:   { cost: 400,  pity: 10, rarityTarget: 'epic'      },
    mythic: { cost: 2500, pity: 10, rarityTarget: 'legendary' },
  },
  BOX_RATES: {
    wood:   { common: 0.60, uncommon: 0.40, rare: 0,    epic: 0,    legendary: 0,    mythic: 0    },
    iron:   { common: 0,    uncommon: 0.60, rare: 0.30, epic: 0.10, legendary: 0,    mythic: 0    },
    gold:   { common: 0,    uncommon: 0,    rare: 0.65, epic: 0.30, legendary: 0.05, mythic: 0    },
    mythic: { common: 0,    uncommon: 0,    rare: 0,    epic: 0.78, legendary: 0.20, mythic: 0.02 },
  },
  MERCHANT: {
    rotationHours:   24,
    slotsAvailable:  6,
    priceHealSmall:  15,
    priceHealMedium: 35,
    priceHealLarge:  70,
    priceManaSmall:  15,
    priceManaLarge:  60,
    priceBombAoe:    40,
    rareItemMarkup:  1.50,
    dailyFreeItem:   1,
  },
};


// ── Gilde ────────────────────────────────────────────────────
export const GUILDS = {
  minLevelToCreate:        10,
  creationCost:            500,
  maxMembers:              20,
  maxOfficers:             3,
  maxGuildLevel:           20,
  expansionCost:           200,
  pointsPerPve:            2,
  pointsPerPvpWin:         5,
  pointsPerDungeon:        20,
  pointsPerRaid:           100,
  xpThresholdBase:         500,
  xpThresholdMult:         1.8,
  goldBonusPerLevel:       0.02,
  xpBonusPerLevel:         0.01,
  raidFrequencyDays:       7,
  raidMaxParticipants:     5,
  raidBossHpBase:          10000,
  raidHpPerGuildLevel:     800,
  raidDistributeByContrib: true,
  raidGoldPerMember:       200,
  raidGuaranteedItem:      true,
  warFrequencyDays:        30,
  warDurationDays:         7,
  warMatches:              10,
  warWinnerGold:           500,
  warMatchmakingRange:     3,
};


// ── Coop ─────────────────────────────────────────────────────
export const COOP = {
  maxRequestsPerDay:       1,
  requestVisibilityHours:  24,
  maxSupportersPerRequest: 3,
  supporterResponseHours:  12,
  goldForSupport:          20,
  goldBonusIfWin:          15,
  reputationPerSupport:    20,
  maxReputation:           9999,
  REP_THRESHOLDS: {
    acquaintance: 100,
    ally:         300,
    protector:    800,
    hero:         2000,
    legend:       5000,
  },
  legendDailyGold:     10,
  protectorGuildBonus: 0.03,
  buffDurationFights:  1,
  supportAttackBonus:  0.15,
};


// ── Drop rarity rates per tier (indice = tier-1) ─────────────
// [tier][rarity]: common, uncommon, rare, epic, legendary, mythic
export const DROP_RARITY_RATES = [
  [0, 0.40, 0.25, 0.08, 0.02, 0.00],  // tier 1
  [0, 0.35, 0.30, 0.12, 0.04, 0.00],  // tier 2
  [0, 0.25, 0.35, 0.18, 0.07, 0.01],  // tier 3
  [0, 0.20, 0.35, 0.25, 0.12, 0.02],  // tier 4
  [0, 0.15, 0.35, 0.30, 0.18, 0.05],  // tier 5
];

export const DROP_LUCK_BONUS_PER_POINT = 0.001;


// ── Meccaniche boss (fallback — valori reali da DB) ──────────
export const BOSS_MECHANICS_FALLBACK = {
  phase2HpThreshold: 0.40,
  phase2AttackBonus: 0.25,
  immunityTurns:     1,
  immunityCooldown:  7,
  immunityHpGate:    0.60,
  immunityChance:    0.10,
  buffChancePct:     0.15,
  maxBossBuffs:      2,
};


// ── Equipaggiamento ──────────────────────────────────────────
export const SET_PIECES_REQUIRED = [0, 0, 2, 3, 4];

export const EQUIPMENT_DEGRADATION = {
  combatsPerTick: 10,
  minDurability:  0,
  repairCost: {
    common:    20,
    uncommon:  50,
    rare:      120,
    epic:      280,
    legendary: 600,
    mythic:    1200,
  },
};

export const SMITH = {
  upgradeMaxLevel:         5,
  upgradeBonusPct:         0.10,
  upgradeCost: {
    common:    80,
    uncommon:  120,
    rare:      200,
    epic:      500,
    legendary: 900,
    mythic:    1500,
  },
  fusionSuccessRate:       0.60,
  fusionMaterialsRequired: 2,
};
