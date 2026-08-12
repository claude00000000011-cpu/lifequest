// ============================================================
// js/battle/config.js — Costanti Battle System LifeQuest
// Questi valori specchiano i parametri del file Excel di bilanciamento.
// Per una patch: modifica qui + aggiorna il foglio 🔧 Patch Notes.
// ============================================================

// ── CLASSI — Statistiche base al Lv.1 ───────────────────────
// [foglio 🎭 Classi]

export const CLASS_BASE_STATS = {
  warrior: { hp: 100, attack: 12, defense: 8,  speed: 6,  mana: 30, luck: 3,  hpPerLevel: 10, manaPerLevel: 3  },
  mage:    { hp: 80,  attack: 15, defense: 4,  speed: 7,  mana: 70, luck: 4,  hpPerLevel: 7,  manaPerLevel: 8  },
  bard:    { hp: 70,  attack: 9,  defense: 6,  speed: 8,  mana: 50, luck: 5,  hpPerLevel: 9,  manaPerLevel: 6  },
  shadow:  { hp: 75,  attack: 14, defense: 5,  speed: 10, mana: 40, luck: 7,  hpPerLevel: 8,  manaPerLevel: 5  },
  oracle:  { hp: 90,  attack: 8,  defense: 7,  speed: 5,  mana: 60, luck: 4,  hpPerLevel: 11, manaPerLevel: 7  },
};

// Quale statistica reale alimenta ogni classe
export const CLASS_PRIMARY_STAT = {
  warrior: 'corpo',
  mage:    'mente',
  bard:    'cultura',
  shadow:  'sfide',
  oracle:  'sociale',
};

// Moltiplicatori stat reale → bonus combattimento [foglio 🎭 Classi]
export const CLASS_STAT_MULT = {
  warrior: { attack: 1.5, hp: 2.0,  mana: 0.5, defense: 0.8, speed: 0.3, luck: 0.05 },
  mage:    { attack: 1.8, hp: 0.8,  mana: 2.0, defense: 0.3, speed: 0.5, luck: 0.08 },
  bard:    { attack: 1.2, hp: 1.2,  mana: 1.5, defense: 0.5, speed: 0.4, luck: 0.12 },
  shadow:  { attack: 1.6, hp: 1.0,  mana: 1.2, defense: 0.4, speed: 0.8, luck: 0.15 },
  oracle:  { attack: 1.0, hp: 1.5,  mana: 1.8, defense: 0.6, speed: 0.3, luck: 0.10 },
};

// ── EVOLUZIONE CLASSI ────────────────────────────────────────
export const CLASS_EVOLUTION = {
  levelFirst:  20,   // lv minimo prima evoluzione
  levelSecond: 40,   // lv minimo seconda evoluzione
  paCost:      15,   // Punti Abilità consumati
  goldCost:    500,  // Gold richiesti
  attackBonus: { warrior: 15, mage: 20, bard: 10, shadow: 18, oracle: 8  },  // % attacco
  hpBonus:     { warrior: 20, mage: 10, bard: 15, shadow: 12, oracle: 25 },  // % PF
};

// Percorsi di evoluzione
export const EVOLUTION_PATHS = {
  warrior: ['paladin', 'berserker'],
  mage:    ['archmage', 'warlock'],
  bard:    ['singer', 'diplomat'],
  shadow:  ['assassin', 'hunter'],
  oracle:  ['high_priest', 'seer'],
};

// ── PUNTI ABILITÀ ────────────────────────────────────────────
export const SKILL_POINTS = {
  perLevel:      1,   // PA guadagnati per ogni livello
  startingPa:    0,   // PA iniziali al lv.1
  maxAccumulated: 99, // Limite PA non spesi
  resetCost:     300, // Gold per reset albero
  maxPerBranch:  15,  // Max PA in un singolo ramo
};

// Costi per sbloccare ogni livello abilità
export const ABILITY_LEVEL_COSTS = [
  { pa: 1, gold: 0,   minCharLevel: 1  },  // Lv.1
  { pa: 2, gold: 50,  minCharLevel: 5  },  // Lv.2
  { pa: 3, gold: 100, minCharLevel: 10 },  // Lv.3
  { pa: 4, gold: 200, minCharLevel: 20 },  // Lv.4
  { pa: 5, gold: 500, minCharLevel: 30 },  // Lv.5 (ultimate)
];

// ── COMBATTIMENTO ─────────────────────────────────────────────
// [foglio ⚔️ Combattimento]

export const COMBAT = {
  // Formula danni
  damageFormula: (atk, def) => Math.max(1, atk - Math.floor(def / 2)),
  damageVariance:       0.15,   // ±15% danno casuale
  critMultiplier:       1.5,    // ×1.5 sul danno base
  magicDefReduction:    0.5,    // Difesa fisica riduce magici a 0.5×

  // Struttura turni
  maxTurns:             10,     // Turni massimi per scontro
  actionsPerTurn:       1,
  manaRegenPerTurn:     5,
  guardDefBonus:        0.30,   // +30% difesa scegliendo Difendi
  maxItemsPerFight:     3,

  // Effetti di stato
  maxStatusStacks:      3,
  defaultStatusDuration: 3,    // turni
  poisonDamagePerStack: 8,     // PF/turno
  regenHealPerStack:    6,     // PF/turno
  stunTurns:            1,
  attackBuffPerStack:   0.10,  // +10% per stack
  statusResistBase:     0.20,  // 20% prob. di resistere

  // PvP
  pvpMatchmakingRange:  5,     // ±5 livelli
  pvpSeasonDays:        30,
  pvpWinGold:           80,
  pvpLossGold:          20,
  pvpWinPoints:         25,
  pvpLossPoints:        -10,
  pvpMinPoints:         0,

  // Limiti giornalieri (reset mezzanotte UTC)
  dailyPveLimit:        9999,
  dailyPvpLimit:        9999,
  dailyDungeonLimit:    9999,
  resetHourUTC:         0,
};

// ── DUNGEON ───────────────────────────────────────────────────
// [foglio 🗺️ Dungeon]

export const DUNGEONS = [
  {
    tier:             1,
    minLevel:         1,
    normalRooms:      3,
    enemiesMin:       1,
    enemiesMax:       2,
    goldPerEnemy:     8,
    goldBoss:         40,
    xpBonus:          50,
    goldBonus:        30,
    enemyHpBase:      80,
    bossHpMult:       3.5,
    enemyAttackBase:  10,
    bossAttackMult:   1.8,
    enemyDefenseBase: 5,
    scalingPerLevel:  0.03,
    dropRateNormal:   0.15,
    dropRateBoss:     0.60,
  },
  {
    tier:             2,
    minLevel:         10,
    normalRooms:      3,
    enemiesMin:       2,
    enemiesMax:       3,
    goldPerEnemy:     15,
    goldBoss:         80,
    xpBonus:          100,
    goldBonus:        60,
    enemyHpBase:      140,
    bossHpMult:       3.5,
    enemyAttackBase:  18,
    bossAttackMult:   2.0,
    enemyDefenseBase: 10,
    scalingPerLevel:  0.03,
    dropRateNormal:   0.18,
    dropRateBoss:     0.65,
  },
  {
    tier:             3,
    minLevel:         20,
    normalRooms:      3,
    enemiesMin:       2,
    enemiesMax:       3,
    goldPerEnemy:     25,
    goldBoss:         150,
    xpBonus:          200,
    goldBonus:        120,
    enemyHpBase:      250,
    bossHpMult:       4.0,
    enemyAttackBase:  30,
    bossAttackMult:   2.2,
    enemyDefenseBase: 18,
    scalingPerLevel:  0.03,
    dropRateNormal:   0.22,
    dropRateBoss:     0.70,
  },
  {
    tier:             4,
    minLevel:         35,
    normalRooms:      4,
    enemiesMin:       3,
    enemiesMax:       4,
    goldPerEnemy:     40,
    goldBoss:         250,
    xpBonus:          400,
    goldBonus:        200,
    enemyHpBase:      420,
    bossHpMult:       4.0,
    enemyAttackBase:  50,
    bossAttackMult:   2.5,
    enemyDefenseBase: 28,
    scalingPerLevel:  0.03,
    dropRateNormal:   0.28,
    dropRateBoss:     0.75,
  },
  {
    tier:             5,
    minLevel:         50,
    normalRooms:      4,
    enemiesMin:       3,
    enemiesMax:       5,
    goldPerEnemy:     60,
    goldBoss:         400,
    xpBonus:          700,
    goldBonus:        350,
    enemyHpBase:      700,
    bossHpMult:       5.0,
    enemyAttackBase:  80,
    bossAttackMult:   3.0,
    enemyDefenseBase: 45,
    scalingPerLevel:  0.03,
    dropRateNormal:   0.35,
    dropRateBoss:     0.85,
  },
];

// Drop rate per rarità, per tier dungeon [foglio 🗺️ Dungeon]
export const DROP_RARITY_RATES = [
  // [common, uncommon, rare, epic, legendary, mythic]  (del drop)
  [0,    0.40, 0.25, 0.08, 0.02, 0.00],  // Tier 1
  [0,    0.35, 0.30, 0.12, 0.04, 0.00],  // Tier 2
  [0,    0.25, 0.35, 0.18, 0.07, 0.01],  // Tier 3
  [0,    0.20, 0.35, 0.25, 0.12, 0.02],  // Tier 4
  [0,    0.15, 0.35, 0.30, 0.18, 0.05],  // Tier 5
];
export const DROP_LUCK_BONUS_PER_POINT = 0.001; // +0.1% per punto Fortuna

// Meccaniche boss
export const BOSS_MECHANICS = {
  phase2HpThreshold: 0.50,  // % PF per entrare in fase 2
  phase2AttackBonus: 0.25,  // +25% attacco in fase 2
  immunityTurns:     1,     // turni di immunità attivabile
  immunityCooldown:  4,     // turni di cooldown immunità
  buffChancePct:     0.20,  // 20% prob. buff per turno
  maxBossBuffs:      3,     // stack massimi di buff simultanei
};

// ── EQUIPAGGIAMENTO ───────────────────────────────────────────
// [foglio 🎒 Equipaggiamento]

export const EQUIPMENT_RARITIES = {
  common:    { attackMin: 2,  attackMax: 5,  defenseMin: 1,  defenseMax: 3,  hpMin: 10,  hpMax: 20,  secondarySlots: 0, secMin: 0,  secMax: 0  },
  uncommon:  { attackMin: 6,  attackMax: 12, defenseMin: 4,  defenseMax: 8,  hpMin: 25,  hpMax: 50,  secondarySlots: 1, secMin: 2,  secMax: 4  },
  rare:      { attackMin: 14, attackMax: 24, defenseMin: 10, defenseMax: 18, hpMin: 60,  hpMax: 110, secondarySlots: 2, secMin: 3,  secMax: 7  },
  epic:      { attackMin: 28, attackMax: 45, defenseMin: 20, defenseMax: 35, hpMin: 120, hpMax: 200, secondarySlots: 3, secMin: 5,  secMax: 12 },
  legendary: { attackMin: 50, attackMax: 80, defenseMin: 38, defenseMax: 60, hpMin: 220, hpMax: 360, secondarySlots: 4, secMin: 8,  secMax: 18 },
  mythic:    { attackMin: 80, attackMax: 130,defenseMin: 60, defenseMax: 100,hpMin: 380, hpMax: 600, secondarySlots: 5, secMin: 12, secMax: 25 },
};

// Set bonus: pezzi necessari per attivare ogni bonus
export const SET_PIECES_REQUIRED = [0, 0, 2, 3, 4]; // indice = rarità (0=common...)

export const EQUIPMENT_DEGRADATION = {
  combatsPerTick:    10,    // -10% efficacia ogni N combattimenti
  minDurability:     0,
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
  upgradeMaxLevel:  5,     // Max potenziamenti per oggetto
  upgradeBonusPct:  0.10,  // +10% bonus per upgrade
  upgradeCost: {
    common:    80,
    rare:      200,
    epic:      500,
  },
  fusionSuccessRate: 0.60,  // 60% prob. fusione stessa rarità → superiore
  fusionMaterialsRequired: 2,
};

// ── ECONOMIA ──────────────────────────────────────────────────
// [foglio 📦 Economia]

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
  goldSellPct:       0.20,    // 20% del valore stimato
  targetDailyGold:   300,     // riferimento bilanciamento

  LOOT_BOXES: {
    wood:  { cost: 50,   pity: 10, rarityTarget: 'uncommon'  },
    iron:  { cost: 150,  pity: 10, rarityTarget: 'rare'      },
    gold:  { cost: 400,  pity: 10, rarityTarget: 'epic'      },
    mythic:{ cost: 1000, pity: 10, rarityTarget: 'legendary' },
  },

  BOX_RATES: {
    wood:   { common: 0.60, uncommon: 0.40, rare: 0,    epic: 0,    legendary: 0,    mythic: 0 },
    iron:   { common: 0,    uncommon: 0.60, rare: 0.30, epic: 0.10, legendary: 0,    mythic: 0 },
    gold:   { common: 0,    uncommon: 0,    rare: 0.65, epic: 0.30, legendary: 0.05, mythic: 0 },
    mythic: { common: 0,    uncommon: 0,    rare: 0,    epic: 0.78, legendary: 0.20, mythic: 0.02 },
  },

  MERCHANT: {
    rotationHours: 24,
    slotsAvailable: 6,
    priceHealSmall:   15,
    priceHealMedium:  35,
    priceHealLarge:   70,
    priceManaSmall:   15,
    priceManLarge:    60,
    priceBombAoe:     40,
    rareItemMarkup:   1.50,  // 150% del valore base
    dailyFreeItem:    1,
  },
};

// ── ABILITÀ ───────────────────────────────────────────────────
// [foglio ✨ Abilità]

// Valori per livello abilità (indice 0 = Lv.1 ... indice 4 = Lv.5)
export const ABILITY_VALUES = {
  manaCost:       [10, 15, 22, 32, 45],
  damagePct:      [80, 110, 150, 200, 280],
  cooldownTurns:  [0,  0,  2,  3,  4],
  buffDuration:   [2,  2,  3,  3,  4],
  passiveStatPct: [5,  10, 16, 24, 35],
  passiveCritPct: [2,  4,  6,  9,  14],
  passiveDmgRedux:[3,  6,  10, 15, 22],
  ultimateDmgPct: [0,  0,  0,  0,  500],
  ultimateMana:   [0,  0,  0,  0,  80],
  ultimateCooldown: [0, 0, 0, 0, 3],   // giorni reali
  ultimateMinLevel: [0, 0, 0, 0, 30],
  healPct:        [15, 22, 32, 45, 60],
  allyBuffPct:    [10, 15, 22, 30, 40],
  enemyDebuffPct: [-10,-15,-20,-28,-38],
  shadowCritBonus:[5,  10, 16, 24, 35],
  shadowEvasion:  [15, 22, 30, 40, 55],
  shadowPoisonDmg:[5,  9,  15, 22, 32],
  stealthDuration:[1,  2,  2,  3,  3],
};

// ── GILDE ─────────────────────────────────────────────────────
// [foglio 🏰 Gilde]

export const GUILDS = {
  minLevelToCreate:   10,
  creationCost:       500,
  maxMembers:         20,
  maxOfficers:        3,
  maxGuildLevel:      20,
  expansionCost:      200,  // per slot extra

  pointsPerPve:       2,
  pointsPerPvpWin:    5,
  pointsPerDungeon:   20,
  pointsPerRaid:      100,
  xpThresholdBase:    500,  // PG per lv.1→2
  xpThresholdMult:    1.8,  // moltiplicatore per livello successivo
  goldBonusPerLevel:  0.02, // +2% Gold per tutti
  xpBonusPerLevel:    0.01, // +1% XP reali per tutti

  raidFrequencyDays:  7,
  raidMaxParticipants:5,
  raidBossHpBase:     10000,
  raidHpPerGuildLevel:800,
  raidDistributeByContrib: true,
  raidGoldPerMember:  200,
  raidGuaranteedItem: true,  // almeno 1 item Raro+

  warFrequencyDays:   30,
  warDurationDays:    7,
  warMatches:         10,
  warWinnerGold:      500,
  warMatchmakingRange:3,  // ±3 livelli gilda
};

// ── CO-OP ─────────────────────────────────────────────────────
// [foglio 🤝 Co-op]

export const COOP = {
  maxRequestsPerDay:    1,
  requestVisibilityHours: 24,
  maxSupportersPerRequest: 3,
  supporterResponseHours: 12,

  goldForSupport:       20,
  goldBonusIfWin:       15,
  reputationPerSupport: 5,
  maxReputation:        9999,

  REP_THRESHOLDS: {
    ally:      50,
    protector: 200,
    legend:    500,
  },
  legendDailyGold:      10,
  protectorGuildBonus:  0.03, // +3% punti gilda prodotti

  buffDurationFights:   1,    // il buff dura 1 intero scontro
  supportAttackBonus:   0.15, // +15% attacco dal supporter
};

// ── PROGRESSIONE ──────────────────────────────────────────────
// [foglio 📈 Progressione]

export const PROGRESSION = {
  tutorialFights:       5,
  startingGold:         50,
  starterItem:          1,

  UNLOCKS: {
    classChoice:        5,
    pvpArena:           5,
    guilds:             10,
    goldBoxes:          15,
    dungeon3:           20,
    evolution:          20,
    guildWar:           20,
    mythicBoxes:        30,
    ultimateAbility:    30,
    dungeon5:           50,
  },

  dungeonLevelCap:      3,  // Non puoi entrare in dungeon di tier superiore di N
  pvpLevelCap:          5,  // Non puoi sfidare chi ha più di N livelli sopra

  PVP_SEASON_REWARDS: {
    top1pct:  { gold: 500, legendaryItem: true },
    top10pct: { gold: 200, legendaryItem: false },
    top50pct: { gold: 80,  legendaryItem: false },
  },
  pvpSeasonReset:       0.50, // 50% dei PR mantenuti a fine stagione
};
