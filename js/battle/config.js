
// ╔══════════════════════════════════════════════════════════════╗
// ║  FILE 1/3 — js/battle/config.js                             ║
// ║  Sostituisce COMPLETAMENTE il file originale                 ║
// ╚══════════════════════════════════════════════════════════════╝
 
export const CLASS_BASE_STATS = {
  warrior: { hp: 120, attack: 14, defense: 10, speed: 6,  mana: 30,  luck: 3,  hpPerLevel: 12, manaPerLevel: 3  },
  mage:    { hp: 90,  attack: 16, defense: 5,  speed: 7,  mana: 80,  luck: 4,  hpPerLevel: 8,  manaPerLevel: 10 },
  bard:    { hp: 85,  attack: 11, defense: 7,  speed: 9,  mana: 60,  luck: 6,  hpPerLevel: 10, manaPerLevel: 7  },
  shadow:  { hp: 90,  attack: 16, defense: 6,  speed: 11, mana: 45,  luck: 8,  hpPerLevel: 9,  manaPerLevel: 5  },
  oracle:  { hp: 110, attack: 9,  defense: 9,  speed: 5,  mana: 70,  luck: 5,  hpPerLevel: 13, manaPerLevel: 8  },
};
 
export const CLASS_PRIMARY_STAT = {
  warrior: 'corpo',
  mage:    'mente',
  bard:    'cultura',
  shadow:  'sfide',
  oracle:  'sociale',
};
 
// ── Moltiplicatori ridotti per evitare scaling esponenziale ──
// Le stat reali ora danno bonus significativi ma non rompono il gioco.
// Regola: primStat=50 → +ATK circa 40-50 (non 75+).
export const CLASS_STAT_MULT = {
//         attack   hp    mana  defense speed  luck
// Warrior: corpo → ATK leggermente alzato (era 0.8 → 0.9)
  warrior: { attack: 0.9,  hp: 1.2,  mana: 0.3, defense: 0.5, speed: 0.2, luck: 0.04 },
// Mage: mente → magia pura, ATK invariato, mana dominante
  mage:    { attack: 0.9,  hp: 0.5,  mana: 1.2, defense: 0.2, speed: 0.3, luck: 0.05 },
// Bard: cultura → fortuna la stat più iconica, attack ridotto
  bard:    { attack: 0.55, hp: 0.7,  mana: 0.9, defense: 0.3, speed: 0.3, luck: 0.08 },
// Shadow: sfide → velocità e crit, attack alto (luck leggermente ridotto a 0.08)
  shadow:  { attack: 0.85, hp: 0.6,  mana: 0.7, defense: 0.2, speed: 0.6, luck: 0.08 },
// Oracle: sociale → supporto, luck soft-cappato via calcBattleStats
  oracle:  { attack: 0.45, hp: 0.95, mana: 1.1, defense: 0.45, speed: 0.2, luck: 0.04 },
};
 
export const CLASS_EVOLUTION = {
  levelFirst:  20,
  levelSecond: 40,
  paCost:      15,
  goldCost:    500,
  attackBonus: { warrior: 15, mage: 20, bard: 10, shadow: 18, oracle: 8  },
  hpBonus:     { warrior: 20, mage: 10, bard: 15, shadow: 12, oracle: 25 },
};
 
export const EVOLUTION_PATHS = {
  warrior: ['paladin', 'berserker'],
  mage:    ['archmage', 'warlock'],
  bard:    ['singer', 'diplomat'],
  shadow:  ['assassin', 'hunter'],
  oracle:  ['high_priest', 'seer'],
};
 
export const SKILL_POINTS = {
  perLevel:       1,
  startingPa:     0,
  maxAccumulated: 99,
  resetCost:      300,
  maxPerBranch:   15,
};
 
export const ABILITY_LEVEL_COSTS = [
  { pa: 1, gold: 0,   minCharLevel: 1  },
  { pa: 2, gold: 50,  minCharLevel: 5  },
  { pa: 3, gold: 100, minCharLevel: 10 },
  { pa: 4, gold: 200, minCharLevel: 20 },
  { pa: 5, gold: 500, minCharLevel: 30 },
];
 
// ── COMBATTIMENTO ────────────────────────────────────────────
export const COMBAT = {
  // ── Formula danni con soft-cap ──────────────────────────────
  // Vecchia: atk - floor(def/2)  → difesa alta = immunità quasi totale
  // Nuova:   atk * (1 - def/(def+K))  con K=60
  //   def=0  → riduzione 0%    (pieno danno)
  //   def=30 → riduzione 33%
  //   def=60 → riduzione 50%
  //   def=120→ riduzione 67%   (mai oltre ~75% con valori normali)
  // Questo elimina i "0 danni" e i "one-shot" contemporaneamente.
  damageFormula: (atk, def) => Math.max(1, Math.floor(atk * (1 - def / (def + 60)))),
 
  damageVariance:    0.10,   // era 0.15 — meno caos punitivo
  critMultiplier:    1.5,
  critBonusPve:      5,      // NUOVO: +5% crit base in PvE per il giocatore
  magicDefReduction: 0.5,    // magia penetra 50% della difesa fisica
 
  // ── Struttura turni ─────────────────────────────────────────
  // maxTurns RIMOSSO: la battaglia dura finché qualcuno muore.
  // Questo elimina il bug "boss imbattibile in 10 turni".
  actionsPerTurn:    1,
  manaRegenPerTurn:  10,     // era 5 — abilità usabili ~ogni 2 turni
  guardDefBonus:     0.40,   // era 0.30 — difesa più premiante
  maxItemsPerFight:  5,      // era 3
 
  // ── Effetti di stato ─────────────────────────────────────────
  maxStatusStacks:       3,
  defaultStatusDuration: 3,
  poisonDamagePerStack:  5,  // era 8 — veleno meno "gameover immediato"
  regenHealPerStack:     8,  // era 6
  stunTurns:             1,
  attackBuffPerStack:    0.10,
  statusResistBase:      0.30, // era 0.20 — più resistenze, meno frustrazione
 
  // ── PvP ──────────────────────────────────────────────────────
  pvpMatchmakingRange: 5,
  pvpSeasonDays:       30,
  pvpWinGold:          80,
  pvpLossGold:         20,
  pvpWinPoints:        25,
  pvpLossPoints:       -10,
  pvpMinPoints:        0,
 
  // ── Limiti giornalieri ────────────────────────────────────────
  dailyPveLimit:      9999,
  dailyPvpLimit:      9999,
  dailyDungeonLimit:  9999,
  resetHourUTC:       0,
};
 
// ── DUNGEON ──────────────────────────────────────────────────
// HP nemici aumentati per compensare il soft-cap difesa (giocatore fa
// meno danni in percentuale).  ATK nemici leggermente alzati per
// mantenere tensione ora che non c'è più il limite di turni.
export const DUNGEONS = [
  {
    tier:             1,
    minLevel:         1,
    normalRooms:      3,
    enemiesMin:       1,
    enemiesMax:       2,
    goldPerEnemy:     10,
    goldBoss:         50,
    xpBonus:          60,
    goldBonus:        40,
    enemyHpBase:      120,   // era 80
    bossHpMult:       3.0,   // era 3.5 — boss più gestibile
    enemyAttackBase:  14,    // era 10
    bossAttackMult:   1.6,   // era 1.8
    enemyDefenseBase: 8,     // era 5
    scalingPerLevel:  0.04,  // era 0.03
    dropRateNormal:   0.15,
    dropRateBoss:     0.60,
  },
  {
    tier:             2,
    minLevel:         10,
    normalRooms:      3,
    enemiesMin:       1,
    enemiesMax:       2,
    goldPerEnemy:     18,
    goldBoss:         90,
    xpBonus:          110,
    goldBonus:        70,
    enemyHpBase:      200,   // era 140
    bossHpMult:       3.0,
    enemyAttackBase:  22,    // era 18
    bossAttackMult:   1.8,   // era 2.0
    enemyDefenseBase: 15,    // era 10
    scalingPerLevel:  0.04,
    dropRateNormal:   0.18,
    dropRateBoss:     0.65,
  },
  {
    tier:             3,
    minLevel:         20,
    normalRooms:      3,
    enemiesMin:       2,
    enemiesMax:       3,
    goldPerEnemy:     28,
    goldBoss:         160,
    xpBonus:          210,
    goldBonus:        130,
    enemyHpBase:      350,   // era 250
    bossHpMult:       3.2,   // era 4.0
    enemyAttackBase:  36,    // era 30
    bossAttackMult:   2.0,   // era 2.2
    enemyDefenseBase: 24,    // era 18
    scalingPerLevel:  0.04,
    dropRateNormal:   0.22,
    dropRateBoss:     0.70,
  },
  {
    tier:             4,
    minLevel:         35,
    normalRooms:      4,
    enemiesMin:       2,
    enemiesMax:       3,
    goldPerEnemy:     45,
    goldBoss:         280,
    xpBonus:          420,
    goldBonus:        220,
    enemyHpBase:      580,   // era 420
    bossHpMult:       3.5,   // era 4.0
    enemyAttackBase:  58,    // era 50
    bossAttackMult:   2.2,   // era 2.5
    enemyDefenseBase: 36,    // era 28
    scalingPerLevel:  0.04,
    dropRateNormal:   0.28,
    dropRateBoss:     0.75,
  },
 {
    tier:               5,
    minLevel:           50,
    normalRooms:        4,
    enemiesMin:         2,
    enemiesMax:         4,
    goldPerEnemy:       70,
    goldBoss:           450,
    xpBonus:            750,
    goldBonus:          380,
    enemyHpBase:        850,  // Bilanciato a 850
    bossHpMult:         3.5,  // Boss più accessibile (3.5 anziché 4.0)
    enemyAttackBase:    90,
    bossAttackMult:     2.5,
    enemyDefenseBase:   35,   // Ridotto da 55 a 35 per evitare l'effetto "spugna blindata"
    scalingPerLevel:    0.035,// Scalato leggermente al ribasso (0.035 anziché 0.04)
    dropRateNormal:     0.35,
    dropRateBoss:       0.85,
  },
];
 
export const DROP_RARITY_RATES = [
  [0, 0.40, 0.25, 0.08, 0.02, 0.00],
  [0, 0.35, 0.30, 0.12, 0.04, 0.00],
  [0, 0.25, 0.35, 0.18, 0.07, 0.01],
  [0, 0.20, 0.35, 0.25, 0.12, 0.02],
  [0, 0.15, 0.35, 0.30, 0.18, 0.05],
];
export const DROP_LUCK_BONUS_PER_POINT = 0.001;
 
// ── BOSS MECHANICS ───────────────────────────────────────────
export const BOSS_MECHANICS = {
  phase2HpThreshold: 0.40,  // era 0.50 — fase 2 si attiva a 40% HP
  phase2AttackBonus: 0.25,
 
  immunityTurns:     1,
  immunityCooldown:  7,     // era 4 — molto più raro
  immunityHpGate:    0.60,  // NUOVO: immunità solo quando boss < 60% HP
  immunityChance:    0.10,  // era 0.15
 
  buffChancePct:     0.15,  // era 0.20
  maxBossBuffs:      2,     // era 3
};
 
export const EQUIPMENT_RARITIES = {
  common:    { attackMin: 2,  attackMax: 5,  defenseMin: 1,  defenseMax: 3,  hpMin: 10,  hpMax: 20,  secondarySlots: 0, secMin: 0,  secMax: 0  },
  uncommon:  { attackMin: 6,  attackMax: 12, defenseMin: 4,  defenseMax: 8,  hpMin: 25,  hpMax: 50,  secondarySlots: 1, secMin: 2,  secMax: 4  },
  rare:      { attackMin: 14, attackMax: 24, defenseMin: 10, defenseMax: 18, hpMin: 60,  hpMax: 110, secondarySlots: 2, secMin: 3,  secMax: 7  },
  epic:      { attackMin: 28, attackMax: 45, defenseMin: 20, defenseMax: 35, hpMin: 120, hpMax: 200, secondarySlots: 3, secMin: 5,  secMax: 12 },
  legendary: { attackMin: 50, attackMax: 80, defenseMin: 38, defenseMax: 60, hpMin: 220, hpMax: 360, secondarySlots: 4, secMin: 8,  secMax: 18 },
  mythic:    { attackMin: 80, attackMax: 130,defenseMin: 60, defenseMax: 100,hpMin: 380, hpMax: 600, secondarySlots: 5, secMin: 12, secMax: 25 },
};
 
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
  upgradeMaxLevel:     5,
  upgradeBonusPct:     0.10,
  upgradeCost: { common: 80, uncommon: 120, rare: 200, epic: 500, legendary: 900, mythic: 1500 },
  fusionSuccessRate:   0.60,
  fusionMaterialsRequired: 2,
};
export const ECONOMY = {
  goldNormalMin:     5,
  goldNormalMax:     15,
  goldBossMin:       40,
  goldBossMax:       120,
  goldPvpWin:        80,
  goldPvpLoss:       20,
  goldDungeonBonus:  60,
  goldGuildQuestMin: 30,
  goldGuildQuestMax: 100,
  goldSellPct:       0.20,
  targetDailyGold:   300,
 
  LOOT_BOXES: {
    wood:  { cost: 50,   pity: 10, rarityTarget: 'uncommon'  },
    iron:  { cost: 150,  pity: 10, rarityTarget: 'rare'      },
    gold:  { cost: 400,  pity: 10, rarityTarget: 'epic'      },
   mythic:{ cost: 2500, pity: 10, rarityTarget: 'legendary' },
  },
 
  BOX_RATES: {
    wood:   { common: 0.60, uncommon: 0.40, rare: 0,    epic: 0,    legendary: 0,    mythic: 0 },
    iron:   { common: 0,    uncommon: 0.60, rare: 0.30, epic: 0.10, legendary: 0,    mythic: 0 },
    gold:   { common: 0,    uncommon: 0,    rare: 0.65, epic: 0.30, legendary: 0.05, mythic: 0 },
    mythic: { common: 0,    uncommon: 0,    rare: 0,    epic: 0.78, legendary: 0.20, mythic: 0.02 },
  },
 
  MERCHANT: {
    rotationHours:    24,
    slotsAvailable:   6,
    priceHealSmall:   15,
    priceHealMedium:  35,
    priceHealLarge:   70,
    priceManaSmall:   15,
    priceManLarge:    60,
    priceBombAoe:     40,
    rareItemMarkup:   1.50,
    dailyFreeItem:    1,
  },
};
 
export const ABILITY_VALUES = {
  manaCost:         [10, 15, 22, 32, 45],
  damagePct:        [80, 110, 150, 200, 280],
  cooldownTurns:    [0,  0,  2,  3,  4],
  buffDuration:     [2,  2,  3,  3,  4],
  passiveStatPct:   [5,  10, 15, 20, 25],
  passiveCritPct:   [2,  4,  6,  9,  14],
  passiveDmgRedux:  [3,  6,  9,  12, 15],
  ultimateDmgPct:   [0,  0,  0,  0,  500],
  ultimateMana:     [0,  0,  0,  0,  80],
  ultimateCooldown: [0,  0,  0,  0,  3],
  ultimateMinLevel: [0,  0,  0,  0,  30],
  healPct:          [15, 22, 32, 45, 60],
  allyBuffPct:      [10, 15, 22, 30, 40],
  enemyDebuffPct:   [-10,-15,-20,-28,-38],
  shadowCritBonus:  [5,  10, 16, 24, 35],
  shadowEvasion:    [15, 22, 30, 40, 55],
  shadowPoisonDmg:  [5,  9,  15, 22, 32],
  stealthDuration:  [1,  2,  2,  3,  3],
};
 
export const GUILDS = {
  minLevelToCreate:   10,
  creationCost:       500,
  maxMembers:         20,
  maxOfficers:        3,
  maxGuildLevel:      20,
  expansionCost:      200,
  pointsPerPve:       2,
  pointsPerPvpWin:    5,
  pointsPerDungeon:   20,
  pointsPerRaid:      100,
  xpThresholdBase:    500,
  xpThresholdMult:    1.8,
  goldBonusPerLevel:  0.02,
  xpBonusPerLevel:    0.01,
  raidFrequencyDays:  7,
  raidMaxParticipants:5,
  raidBossHpBase:     10000,
  raidHpPerGuildLevel:800,
  raidDistributeByContrib: true,
  raidGoldPerMember:  200,
  raidGuaranteedItem: true,
  warFrequencyDays:   30,
  warDurationDays:    7,
  warMatches:         10,
  warWinnerGold:      500,
  warMatchmakingRange:3,
};
 
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
    legend:       5000 
  },
  legendDailyGold:         10,
  protectorGuildBonus:     0.03,
  buffDurationFights:      1,
  supportAttackBonus:      0.15,
};
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
 
