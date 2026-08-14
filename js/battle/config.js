
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
  upgradeMaxLevel:         5,
  upgradeBonusPct:         0.10,
  // Aggiunti i tier mancanti per evitare errori di runtime
  upgradeCost: { 
    common:    80, 
    uncommon:  120, 
    rare:      200, 
    epic:      500, 
    legendary: 900, 
    mythic:    1500 
  },
  fusionSuccessRate:       0.60,
  fusionMaterialsRequired: 2,
};
export const ECONOMY = {
  goldNormalMin:       5,
  goldNormalMax:       15,
  goldBossMin:         40,
  goldBossMax:         120,
  goldPvpWin:          80,
  goldPvpLoss:         20,
  goldDungeonBonus:    60,
  goldGuildQuestMin:   30,
  goldGuildQuestMax:   100,
  goldSellPct:         0.20,
  targetDailyGold:     300,

  LOOT_BOXES: {
    wood:   { cost: 50,   pity: 10, rarityTarget: 'uncommon'  },
    iron:   { cost: 150,  pity: 10, rarityTarget: 'rare'      },
    gold:   { cost: 400,  pity: 10, rarityTarget: 'epic'      },
    // Aumentato a 2500 per bilanciare l'economia endgame
    mythic: { cost: 2500, pity: 10, rarityTarget: 'legendary' }, 
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
    priceManaLarge:   60, // Corretto da priceManLarge
    priceBombAoe:     40,
    rareItemMarkup:   1.50,
    dailyFreeItem:    1,
  }
 
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

// ============================================================
// WORLD_DUNGEONS — 17 dungeon × 10 stanze
// Aggiungere in fondo a js/battle/config.js
// ============================================================

/**
 * Genera le 10 stanze di un dungeon.
 * baseHp      = HP nemico stanza 1
 * hpScale     = moltiplicatore per stanza successiva (es. 1.5 = +50% ogni stanza)
 * baseGold    = gold stanza 1
 * xpPerRoom   = XP base per stanza (cresce +25% lineare)
 * bossId      = identificatore meccanica boss (stanza 10)
 */
function _buildRooms({ baseHp, hpScale, baseGold, xpPerRoom, bossId }) {
  return Array.from({ length: 10 }, (_, i) => {
    const isBoss = i === 9;
    const hp     = Math.round(baseHp * Math.pow(hpScale, i));
    return {
      room:        i + 1,
      isBoss,
      enemyHp:     hp,
      enemyMaxHp:  hp,                                          // usato dal sistema battle
      gold:        Math.round(baseGold    * (1 + i * 0.30)),
      xp:          Math.round(xpPerRoom   * (1 + i * 0.25)),
      bossId:      isBoss ? bossId : null,
      // Attributi derivati per il sistema battle esistente
      enemyName:   isBoss ? `Boss: ${bossId.replace(/_/g,' ')}` : `Nemico Stanza ${i+1}`,
      enemyAttack: Math.round(hp * 0.08),   // danno nemico ≈ 8% dei suoi HP
      enemyDef:    Math.round(hp * 0.02),   // difesa nemico ≈ 2% dei suoi HP
    };
  });
}

export const WORLD_DUNGEONS = [
  {
    id: 'dungeon_01', name: 'Faro della Costa',
    mapX: 0.38, mapY: 0.56, requiredLevel: 1,  theme: 'coastal',
    description: 'Un vecchio faro infestato da creature marine.',
    rooms: _buildRooms({ baseHp: 30,    hpScale: 1.40, baseGold: 5,    xpPerRoom: 8,    bossId: 'sea_guardian'      }),
  },
  {
    id: 'dungeon_02', name: 'Porto Meridionale',
    mapX: 0.44, mapY: 0.64, requiredLevel: 3,  theme: 'port',
    description: 'Contrabbandieri e mostri delle profondità controllano il porto.',
    rooms: _buildRooms({ baseHp: 80,    hpScale: 1.45, baseGold: 12,   xpPerRoom: 18,   bossId: 'harbor_master'     }),
  },
  {
    id: 'dungeon_03', name: 'Isola Fortificata',
    mapX: 0.18, mapY: 0.67, requiredLevel: 6,  theme: 'fortress',
    description: 'Una fortezza caduta in mano a mercenari corrotti.',
    rooms: _buildRooms({ baseHp: 180,   hpScale: 1.50, baseGold: 22,   xpPerRoom: 35,   bossId: 'iron_warden'       }),
  },
  {
    id: 'dungeon_04', name: "Villaggio sull'Isola",
    mapX: 0.22, mapY: 0.50, requiredLevel: 9,  theme: 'village',
    description: 'Un villaggio maledetto dove i morti non restano tali.',
    rooms: _buildRooms({ baseHp: 320,   hpScale: 1.50, baseGold: 35,   xpPerRoom: 55,   bossId: 'village_elder'     }),
  },
  {
    id: 'dungeon_05', name: "Montagne dell'Isola",
    mapX: 0.27, mapY: 0.42, requiredLevel: 12, theme: 'mountain',
    description: 'Caverne profonde abitate da giganti di pietra.',
    rooms: _buildRooms({ baseHp: 520,   hpScale: 1.55, baseGold: 50,   xpPerRoom: 80,   bossId: 'stone_titan'       }),
  },
  {
    id: 'dungeon_06', name: 'Foresta Intricata',
    mapX: 0.34, mapY: 0.30, requiredLevel: 15, theme: 'forest',
    description: 'Una foresta antica dove gli alberi stessi sono nemici.',
    rooms: _buildRooms({ baseHp: 800,   hpScale: 1.55, baseGold: 70,   xpPerRoom: 115,  bossId: 'ancient_treant'    }),
  },
  {
    id: 'dungeon_07', name: 'Torre del Sentiero',
    mapX: 0.46, mapY: 0.42, requiredLevel: 18, theme: 'tower',
    description: 'Una torre di guardia occupata da stregoni ribelli.',
    rooms: _buildRooms({ baseHp: 1150,  hpScale: 1.60, baseGold: 95,   xpPerRoom: 160,  bossId: 'tower_sentinel'    }),
  },
  {
    id: 'dungeon_08', name: 'Fortezza del Nord',
    mapX: 0.54, mapY: 0.18, requiredLevel: 22, theme: 'fortress',
    description: 'Fortezza di confine caduta dopo un assedio demoniaco.',
    rooms: _buildRooms({ baseHp: 1600,  hpScale: 1.60, baseGold: 130,  xpPerRoom: 220,  bossId: 'fortress_lord'     }),
  },
  {
    id: 'dungeon_09', name: 'Torre Settentrionale',
    mapX: 0.65, mapY: 0.20, requiredLevel: 26, theme: 'tower',
    description: 'Una torre ghiacciata con un guardiano immortale.',
    rooms: _buildRooms({ baseHp: 2200,  hpScale: 1.65, baseGold: 175,  xpPerRoom: 300,  bossId: 'frost_watcher'     }),
  },
  {
    id: 'dungeon_10', name: 'Castello della Capitale',
    mapX: 0.52, mapY: 0.46, requiredLevel: 30, theme: 'castle',
    description: 'Il castello reale, corrotto dall\'interno da un re ombra.',
    rooms: _buildRooms({ baseHp: 3000,  hpScale: 1.65, baseGold: 230,  xpPerRoom: 400,  bossId: 'capital_king'      }),
  },
  {
    id: 'dungeon_11', name: 'Vulcano Attivo',
    mapX: 0.60, mapY: 0.52, requiredLevel: 34, theme: 'volcano',
    description: 'Le profondità di un vulcano dove vive un demone del fuoco.',
    rooms: _buildRooms({ baseHp: 4000,  hpScale: 1.70, baseGold: 300,  xpPerRoom: 530,  bossId: 'magma_lord'        }),
  },
  {
    id: 'dungeon_12', name: "Oasi del Deserto",
    mapX: 0.78, mapY: 0.55, requiredLevel: 38, theme: 'desert',
    description: 'Sotto l\'oasi si nasconde un labirinto di sabbia e morte.',
    rooms: _buildRooms({ baseHp: 5200,  hpScale: 1.70, baseGold: 380,  xpPerRoom: 680,  bossId: 'sand_pharaoh'      }),
  },
  {
    id: 'dungeon_13', name: 'Lago Tropicale',
    mapX: 0.52, mapY: 0.72, requiredLevel: 42, theme: 'tropical',
    description: 'Acque cristalline che nascondono un\'idra millenaria.',
    rooms: _buildRooms({ baseHp: 6600,  hpScale: 1.72, baseGold: 470,  xpPerRoom: 860,  bossId: 'lagoon_hydra'      }),
  },
  {
    id: 'dungeon_14', name: 'Castello Meridionale',
    mapX: 0.50, mapY: 0.62, requiredLevel: 46, theme: 'castle',
    description: 'Il secondo castello, sede di un duca caduto nell\'oscurità.',
    rooms: _buildRooms({ baseHp: 8200,  hpScale: 1.75, baseGold: 570,  xpPerRoom: 1050, bossId: 'shadow_duke'       }),
  },
  {
    id: 'dungeon_15', name: 'Isole Fluttuanti Est',
    mapX: 0.80, mapY: 0.28, requiredLevel: 50, theme: 'floating',
    description: 'Isole nel cielo pattugliate da colossi di pietra e nuvole.',
    rooms: _buildRooms({ baseHp: 10000, hpScale: 1.80, baseGold: 680,  xpPerRoom: 1280, bossId: 'sky_colossus'      }),
  },
  {
    id: 'dungeon_16', name: 'Isole Fluttuanti Ovest',
    mapX: 0.18, mapY: 0.22, requiredLevel: 55, theme: 'floating',
    description: 'Isole avvolte nel vuoto, dimora di un titano del nulla.',
    rooms: _buildRooms({ baseHp: 12500, hpScale: 1.82, baseGold: 820,  xpPerRoom: 1550, bossId: 'void_titan'        }),
  },
  {
    id: 'dungeon_17', name: 'Castello Fluttuante',
    mapX: 0.88, mapY: 0.18, requiredLevel: 60, theme: 'floating_castle',
    description: 'Il trono finale. Chi lo governa non è di questo mondo.',
    rooms: _buildRooms({ baseHp: 15500, hpScale: 1.85, baseGold: 1000, xpPerRoom: 1900, bossId: 'celestial_overlord' }),
  },
];

// Boss con meccaniche speciali — espandi a piacere
export const BOSS_DATA = {
  sea_guardian:       { extraAbility: 'heal',         healPercent: 0.15, description: 'Si rigenera al 15% dei suoi HP una volta.' },
  harbor_master:      { extraAbility: 'double_attack', description: 'Attacca due volte per turno.' },
  iron_warden:        { extraAbility: 'shield',        shieldHp: 200,    description: 'Ha uno scudo da 200 HP che va distrutto prima.' },
  village_elder:      { extraAbility: 'summon',        summonHp: 150,    description: 'Evoca un servitore a metà battaglia.' },
  stone_titan:        { extraAbility: 'stun',          stunChance: 0.30, description: '30% di probabilità di stordire il giocatore.' },
  ancient_treant:     { extraAbility: 'regen',         regenPerTurn: 80, description: 'Si rigenera di 80 HP ogni turno.' },
  tower_sentinel:     { extraAbility: 'counter',       counterDmg: 0.50, description: 'Contrattacca con il 50% del danno ricevuto.' },
  fortress_lord:      { extraAbility: 'armor_break',   description: 'Riduce la difesa del giocatore del 30%.' },
  frost_watcher:      { extraAbility: 'freeze',        freezeChance: 0.25, description: '25% di probabilità di congelare (salta turno).' },
  capital_king:       { extraAbility: 'phase',         phaseAt: 0.50,    description: 'A metà vita entra in fase 2: +50% attacco.' },
  magma_lord:         { extraAbility: 'burn',          burnDmgPerTurn: 100, description: 'Brucia il giocatore per 100 dmg/turno per 3 turni.' },
  sand_pharaoh:       { extraAbility: 'revive',        description: 'Risorge una volta con il 30% dei HP.' },
  lagoon_hydra:       { extraAbility: 'multi_head',    heads: 3,         description: 'Ha 3 teste: ognuna va eliminata (HP divisi in 3).' },
  shadow_duke:        { extraAbility: 'lifesteal',     stealPercent: 0.20, description: 'Ruba il 20% del danno inflitto come HP.' },
  sky_colossus:       { extraAbility: 'aoe',           aoeDmg: 200,      description: 'Ogni 3 turni infligge 200 dmg AOE inevitabili.' },
  void_titan:         { extraAbility: 'nullify',       description: 'Annulla il primo attacco speciale del giocatore.' },
  celestial_overlord: { extraAbility: 'all',           description: 'Boss finale: usa tutte le meccaniche precedenti a rotazione.' },
};
