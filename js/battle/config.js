// ============================================================
// js/battle/config.js
// Bilanciamento numerico → Supabase (combat_config, dungeon_tiers)
// Questo file contiene: formule, struttura, WORLD_DUNGEONS, DUNGEONS
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

// ── Formula danno ────────────────────────────────────────────
// K (def_constant=80) viene da DB.combatConfig.def_constant
export const COMBAT = {
  damage: (atk, def, K) =>
    Math.max(1, Math.floor(atk * (1 - def / (def + K)))),

  critDamage: (baseDmg, multiplier, bonusPct) =>
    Math.floor(baseDmg * multiplier * (1 + bonusPct)),

  // Parametri non-numerici che restano qui
  magicDefReduction:     0.5,
  actionsPerTurn:        1,
  manaRegenPerTurn:      10,
  guardDefBonus:         0.40,
  maxItemsPerFight:      5,
  maxStatusStacks:       3,
  defaultStatusDuration: 3,
  stunTurns:             1,
  attackBuffPerStack:    0.10,
  statusResistBase:      0.30,
  pvpMatchmakingRange:   5,
  pvpSeasonDays:         30,
  pvpWinPoints:          25,
  pvpLossPoints:         -10,
  pvpMinPoints:          0,
  dailyPveLimit:         9999,
  dailyPvpLimit:         9999,
  dailyDungeonLimit:     9999,
  resetHourUTC:          0,

  // Numeri di bilanciamento letti da DB.combatConfig al runtime:
  // def_constant, damageVariance, critMultiplier, critBonusPct,
  // critCapPct, poisonDamagePerStack, regenHealPerStack,
  // pvpWinGold, pvpLossGold, phase2Threshold, phase2AtkBonus
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

// ── DUNGEONS (tier procedurali) ──────────────────────────────
// I valori numerici di bilanciamento sono ora in Supabase (dungeon_tiers).
// Questo array è il FALLBACK usato solo se DB.dungeonTiers non è caricato.
// generateProceduralEnemy() legge prima DB.dungeonTiers.
export const DUNGEONS = [
  { tier:1, minLevel:1,  normalRooms:3, enemiesMin:1, enemiesMax:2,
    enemyHpBase:50,  enemyAttackBase:9,   enemyDefenseBase:5,
    bossHpMult:2.5,  bossAttackMult:1.5,  scalingPerLevel:0.030,
    goldPerEnemy:10, goldBoss:50,  dropRateNormal:0.15, dropRateBoss:0.60 },
  { tier:2, minLevel:10, normalRooms:3, enemiesMin:1, enemiesMax:2,
    enemyHpBase:100, enemyAttackBase:18,  enemyDefenseBase:10,
    bossHpMult:2.5,  bossAttackMult:1.5,  scalingPerLevel:0.030,
    goldPerEnemy:18, goldBoss:90,  dropRateNormal:0.18, dropRateBoss:0.65 },
  { tier:3, minLevel:20, normalRooms:3, enemiesMin:2, enemiesMax:3,
    enemyHpBase:180, enemyAttackBase:30,  enemyDefenseBase:17,
    bossHpMult:2.5,  bossAttackMult:1.6,  scalingPerLevel:0.030,
    goldPerEnemy:28, goldBoss:160, dropRateNormal:0.22, dropRateBoss:0.70 },
  { tier:4, minLevel:35, normalRooms:4, enemiesMin:2, enemiesMax:3,
    enemyHpBase:300, enemyAttackBase:48,  enemyDefenseBase:27,
    bossHpMult:2.5,  bossAttackMult:1.6,  scalingPerLevel:0.025,
    goldPerEnemy:45, goldBoss:280, dropRateNormal:0.28, dropRateBoss:0.75 },
  { tier:5, minLevel:50, normalRooms:4, enemiesMin:2, enemiesMax:4,
    enemyHpBase:480, enemyAttackBase:72,  enemyDefenseBase:40,
    bossHpMult:2.8,  bossAttackMult:1.8,  scalingPerLevel:0.020,
    goldPerEnemy:70, goldBoss:450, dropRateNormal:0.35, dropRateBoss:0.85 },
];

// ── Drop rates ───────────────────────────────────────────────
export const DROP_RARITY_RATES = [
  [0, 0.40, 0.25, 0.08, 0.02, 0.00],
  [0, 0.35, 0.30, 0.12, 0.04, 0.00],
  [0, 0.25, 0.35, 0.18, 0.07, 0.01],
  [0, 0.20, 0.35, 0.25, 0.12, 0.02],
  [0, 0.15, 0.35, 0.30, 0.18, 0.05],
];
export const DROP_LUCK_BONUS_PER_POINT = 0.001;

// ── Boss mechanics fallback ──────────────────────────────────
export const BOSS_MECHANICS = {
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
  repairCost: { common:20, uncommon:50, rare:120, epic:280, legendary:600, mythic:1200 },
};

export const SMITH = {
  upgradeMaxLevel:         5,
  upgradeBonusPct:         0.10,
  upgradeCost: { common:80, uncommon:120, rare:200, epic:500, legendary:900, mythic:1500 },
  fusionSuccessRate:       0.60,
  fusionMaterialsRequired: 2,
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
    wood:   { common:0.60, uncommon:0.40, rare:0,    epic:0,    legendary:0,    mythic:0    },
    iron:   { common:0,    uncommon:0.60, rare:0.30, epic:0.10, legendary:0,    mythic:0    },
    gold:   { common:0,    uncommon:0,    rare:0.65, epic:0.30, legendary:0.05, mythic:0    },
    mythic: { common:0,    uncommon:0,    rare:0,    epic:0.78, legendary:0.20, mythic:0.02 },
  },
  MERCHANT: {
    rotationHours:24, slotsAvailable:6,
    priceHealSmall:15, priceHealMedium:35, priceHealLarge:70,
    priceManaSmall:15, priceManaLarge:60, priceBombAoe:40,
    rareItemMarkup:1.50, dailyFreeItem:1,
  },
};

// ── Gilde ────────────────────────────────────────────────────
export const GUILDS = {
  minLevelToCreate:10, creationCost:500, maxMembers:20, maxOfficers:3,
  maxGuildLevel:20, expansionCost:200,
  pointsPerPve:2, pointsPerPvpWin:5, pointsPerDungeon:20, pointsPerRaid:100,
  xpThresholdBase:500, xpThresholdMult:1.8,
  goldBonusPerLevel:0.02, xpBonusPerLevel:0.01,
  raidFrequencyDays:7, raidMaxParticipants:5,
  raidBossHpBase:10000, raidHpPerGuildLevel:800,
  raidDistributeByContrib:true, raidGoldPerMember:200, raidGuaranteedItem:true,
  warFrequencyDays:30, warDurationDays:7, warMatches:10,
  warWinnerGold:500, warMatchmakingRange:3,
};

// ── Coop ─────────────────────────────────────────────────────
export const COOP = {
  maxRequestsPerDay:1, requestVisibilityHours:24,
  maxSupportersPerRequest:3, supporterResponseHours:12,
  goldForSupport:20, goldBonusIfWin:15,
  reputationPerSupport:20, maxReputation:9999,
  REP_THRESHOLDS: { acquaintance:100, ally:300, protector:800, hero:2000, legend:5000 },
  legendDailyGold:10, protectorGuildBonus:0.03,
  buffDurationFights:1, supportAttackBonus:0.15,
};

// ── Progressione ─────────────────────────────────────────────
export const PROGRESSION = {
  tutorialFights:5, startingGold:50, starterItem:1,
  UNLOCKS: {
    classChoice:1, pvpArena:5, guilds:15, goldBoxes:20,
    dungeon3:20, dungeon4:35, dungeon5:50,
    evolution:25, guildWar:30, mythicBoxes:50, ultimateAbility:40,
  },
  dungeonLevelCap:2, pvpLevelCap:10,
  PVP_SEASON_REWARDS: {
    top1pct:  { gold:500, legendaryItem:true  },
    top10pct: { gold:200, legendaryItem:false },
    top50pct: { gold:80,  legendaryItem:false },
  },
  pvpSeasonReset:0.50,
};

// ── _buildRooms ──────────────────────────────────────────────
// Costruisce le 9 stanze normali + 1 boss con valori propri.
// Boss non segue più la curva esponenziale — ha stat separate.
// Fonte dati: DB.dungeonConfig (Supabase) — questa funzione
// viene chiamata dal loader dopo aver letto il DB.
// _buildRooms è ora usata solo come fallback locale.
// In produzione le rooms vengono costruite da loadDungeonRooms()
// che legge DB.dungeonConfig (Supabase).
export function _buildRooms({
  baseHp, baseAtk, baseDef, hpScale, atkScale, defScale,
  baseGold, xpPerRoom, bossId,
  bossHp, bossAtk, bossDef,
}) {
  return Array.from({ length: 10 }, (_, i) => {
    const isBoss = i === 9;
    const hp  = isBoss ? bossHp  : Math.round(baseHp  * Math.pow(hpScale  ?? 1.18, i));
    const atk = isBoss ? bossAtk : Math.round(baseAtk * Math.pow(atkScale ?? 1.18, i));
    const def = isBoss ? bossDef : Math.round(baseDef * Math.pow(defScale ?? 1.18, i));
    return {
      room:        i + 1,
      isBoss,
      enemyHp:     hp,
      enemyMaxHp:  hp,
      enemyAttack: atk,
      enemyDef:    def,
      gold:        Math.round(baseGold  * (1 + i * 0.30)),
      xp:          Math.round(xpPerRoom * (1 + i * 0.25)),
      bossId:      isBoss ? bossId : null,
      enemyName:   isBoss
        ? `Boss: ${bossId.replace(/_/g, ' ')}`
        : `Nemico Stanza ${i + 1}`,
    };
  });
}

// Costruisce le rooms di un dungeon leggendo da DB.dungeonConfig.
// Chiamata da renderDungeonMap() e renderDungeonDetail() invece di WORLD_DUNGEONS[i].rooms
export function loadDungeonRooms(dungeonId, dungeonConfig) {
  const cfg = dungeonConfig?.[dungeonId];
  if (!cfg) {
    console.warn('[loadDungeonRooms] dungeonConfig non caricato per:', dungeonId);
    return null;
  }
  return _buildRooms({
    baseHp:   cfg.base_hp,
    baseAtk:  cfg.base_atk,
    baseDef:  cfg.base_def,
    hpScale:  cfg.hp_scale,
    atkScale: cfg.atk_scale,
    defScale: cfg.def_scale,
    baseGold: cfg.base_gold,
    xpPerRoom:cfg.xp_per_room,
    bossId:   dungeonId,
    bossHp:   cfg.boss_hp,
    bossAtk:  cfg.boss_atk,
    bossDef:  cfg.boss_def,
  });
}

// WORLD_DUNGEONS — solo dati di presentazione.
// rooms: null — vengono caricate da loadDungeonRooms() al runtime.
export const WORLD_DUNGEONS = [
  { id:'dungeon_01', name:'Faro della Costa',        mapX:0.38, mapY:0.56, requiredLevel:1,  theme:'coastal',        description:'Un vecchio faro infestato da creature marine.',                    rooms:null },
  { id:'dungeon_02', name:'Porto Meridionale',        mapX:0.44, mapY:0.64, requiredLevel:3,  theme:'port',           description:'Contrabbandieri e mostri delle profondità controllano il porto.', rooms:null },
  { id:'dungeon_03', name:'Isola Fortificata',        mapX:0.18, mapY:0.67, requiredLevel:6,  theme:'fortress',       description:'Una fortezza caduta in mano a mercenari corrotti.',                rooms:null },
  { id:'dungeon_04', name:"Villaggio sull'Isola",     mapX:0.22, mapY:0.50, requiredLevel:9,  theme:'village',        description:'Un villaggio maledetto dove i morti non restano tali.',            rooms:null },
  { id:'dungeon_05', name:"Montagne dell'Isola",      mapX:0.27, mapY:0.42, requiredLevel:12, theme:'mountain',       description:'Caverne profonde abitate da giganti di pietra.',                   rooms:null },
  { id:'dungeon_06', name:'Foresta Intricata',        mapX:0.34, mapY:0.30, requiredLevel:15, theme:'forest',         description:'Una foresta antica dove gli alberi stessi sono nemici.',           rooms:null },
  { id:'dungeon_07', name:'Torre del Sentiero',       mapX:0.46, mapY:0.42, requiredLevel:18, theme:'tower',          description:'Una torre di guardia occupata da stregoni ribelli.',              rooms:null },
  { id:'dungeon_08', name:'Fortezza del Nord',        mapX:0.54, mapY:0.18, requiredLevel:22, theme:'fortress',       description:'Fortezza di confine caduta dopo un assedio demoniaco.',           rooms:null },
  { id:'dungeon_09', name:'Torre Settentrionale',     mapX:0.65, mapY:0.20, requiredLevel:26, theme:'tower',          description:'Una torre ghiacciata con un guardiano immortale.',                 rooms:null },
  { id:'dungeon_10', name:'Castello della Capitale',  mapX:0.52, mapY:0.46, requiredLevel:30, theme:'castle',         description:"Il castello reale, corrotto dall'interno da un re ombra.",        rooms:null },
  { id:'dungeon_11', name:'Vulcano Attivo',            mapX:0.60, mapY:0.52, requiredLevel:34, theme:'volcano',        description:'Le profondità di un vulcano dove vive un demone del fuoco.',      rooms:null },
  { id:'dungeon_12', name:'Oasi del Deserto',          mapX:0.78, mapY:0.55, requiredLevel:38, theme:'desert',         description:"Sotto l'oasi si nasconde un labirinto di sabbia e morte.",         rooms:null },
  { id:'dungeon_13', name:'Lago Tropicale',            mapX:0.52, mapY:0.72, requiredLevel:42, theme:'tropical',       description:"Acque cristalline che nascondono un'idra millenaria.",            rooms:null },
  { id:'dungeon_14', name:'Castello Meridionale',      mapX:0.50, mapY:0.62, requiredLevel:46, theme:'castle',         description:"Il secondo castello, sede di un duca caduto nell'oscurità.",       rooms:null },
  { id:'dungeon_15', name:'Isole Fluttuanti Est',      mapX:0.80, mapY:0.28, requiredLevel:50, theme:'floating',       description:'Isole nel cielo pattugliate da colossi di pietra e nuvole.',      rooms:null },
  { id:'dungeon_16', name:'Isole Fluttuanti Ovest',    mapX:0.18, mapY:0.22, requiredLevel:55, theme:'floating',       description:'Isole avvolte nel vuoto, dimora di un titano del nulla.',         rooms:null },
  { id:'dungeon_17', name:'Castello Fluttuante',       mapX:0.88, mapY:0.18, requiredLevel:60, theme:'floating_castle',description:'Il trono finale. Chi lo governa non è di questo mondo.',          rooms:null },
];
 
