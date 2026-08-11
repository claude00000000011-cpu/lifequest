// ============================================================
// js/battle/engine.js — Motore Combattimento a Turni LifeQuest
// Gestisce la logica di un singolo scontro (PvE o PvP).
// Stateless: riceve uno stato di battaglia e restituisce
// lo stato aggiornato. Nessun side effect su DB.
// ============================================================

import { COMBAT, ABILITY_VALUES, BOSS_MECHANICS } from './config.js';
import { DB } from '../db.js';

// ── Tipi ─────────────────────────────────────────────────────

/**
 * @typedef {Object} Fighter
 * @property {string}  id         — 'player' o 'enemy'
 * @property {string}  name
 * @property {number}  hp
 * @property {number}  hpMax
 * @property {number}  attack
 * @property {number}  defense
 * @property {number}  speed
 * @property {number}  mana
 * @property {number}  manaMax
 * @property {number}  luck        — percentuale (es. 5.5)
 * @property {boolean} isBoss
 * @property {Array}   statusEffects  — [{ type, stacks, turnsLeft }]
 * @property {Array}   activeBuffs    — buff del boss in fase 2
 * @property {boolean} isPhase2
 * @property {number}  immunityLeft   — turni immunità attivi (solo boss)
 * @property {number}  immunityCooldown
 */

/**
 * @typedef {Object} BattleState
 * @property {Fighter} player
 * @property {Fighter} enemy
 * @property {number}  turn        — turno corrente (1-based)
 * @property {boolean} isOver
 * @property {string|null} winner  — 'player'|'enemy'|'draw'|null
 * @property {Array}   log         — messaggi del turno corrente
 * @property {Array}   fullLog     — tutti i messaggi di tutti i turni
 * @property {boolean} supportAvailable — buff co-op disponibile
 * @property {Object|null} supportAbility
 */

// ── Costruzione stato iniziale ────────────────────────────────

/**
 * Inizializza un nuovo scontro.
 * @param {Object} playerStats   — stats calcolate da character.js:calcBattleStats
 * @param {Object} enemyData     — riga dalla tabella enemies o stats PvP
 * @param {number} playerLevel   — per il scaling del nemico
 * @param {Object} [support]     — abilità co-op inviata da un amico
 * @returns {BattleState}
 */
export function initBattle(playerStats, enemyData, playerLevel, support = null) {
  const enemyScaling = calcEnemyScaling(enemyData, playerLevel);

  const player = {
    id:               'player',
    name:             'Tu',
    hp:               playerStats.hp,
    hpMax:            playerStats.hp,
    attack:           playerStats.attack,
    defense:          playerStats.defense,
    speed:            playerStats.speed,
    mana:             playerStats.mana,
    manaMax:          playerStats.mana,
    luck:             playerStats.luck,
    isBoss:           false,
    statusEffects:    [],
    activeBuffs:      [],
    isPhase2:         false,
    immunityLeft:     0,
    immunityCooldown: 0,
  };

  const enemy = {
    id:               'enemy',
    name:             enemyData.name,
    hp:               enemyScaling.hp,
    hpMax:            enemyScaling.hp,
    attack:           enemyScaling.attack,
    defense:          enemyScaling.defense,
    speed:            enemyData.speed_base || 5,
    mana:             0,
    manaMax:          0,
    luck:             0,
    isBoss:           enemyData.is_boss || false,
    statusEffects:    [],
    activeBuffs:      [],
    isPhase2:         false,
    immunityLeft:     0,
    immunityCooldown: 0,
    enemyData,           // dati originali per meccaniche boss
  };

  return {
    player,
    enemy,
    turn:            1,
    isOver:          false,
    winner:          null,
    log:             [`La battaglia ha inizio! ${enemy.name} si avvicina minaccioso.`],
    fullLog:         [],
    supportAvailable: !!support,
    supportAbility:  support || null,
    supportUsed:     false,
    itemsUsedCount:  0,
  };
}

// ── Scaling nemico per livello giocatore ─────────────────────

function calcEnemyScaling(enemyData, playerLevel) {
  const dungeonConfig = getDungeonConfig(enemyData.tier);
  const minLevel = dungeonConfig?.minLevel || 1;
  const excess   = Math.max(0, playerLevel - minLevel);
  const scale    = 1 + COMBAT.damageFormula.toString().includes('scale')
    ? 0
    : excess * (dungeonConfig?.scalingPerLevel || 0.03);

  // Scaling semplice su HP e ATK
  const scaleMult = 1 + excess * 0.03;

  return {
    hp:      Math.floor(enemyData.hp_base      * scaleMult),
    attack:  Math.floor(enemyData.attack_base  * scaleMult),
    defense: Math.floor(enemyData.defense_base * scaleMult),
  };
}

function getDungeonConfig(tier) {
  const DUNGEONS = [
    null,
    { minLevel: 1,  scalingPerLevel: 0.03 },
    { minLevel: 10, scalingPerLevel: 0.03 },
    { minLevel: 20, scalingPerLevel: 0.03 },
    { minLevel: 35, scalingPerLevel: 0.03 },
    { minLevel: 50, scalingPerLevel: 0.03 },
  ];
  return DUNGEONS[tier] || DUNGEONS[1];
}

// ── Azione del giocatore ──────────────────────────────────────

/**
 * Processa un'azione del giocatore e restituisce lo stato aggiornato.
 * @param {BattleState} state
 * @param {'attack'|'ability'|'item'|'guard'|'support'} action
 * @param {Object} [payload]  — { abilityId, itemId }
 * @param {Object} [abilityData] — dati abilità da DB
 * @returns {BattleState}
 */
export function processPlayerAction(state, action, payload = {}, abilityData = null) {
  if (state.isOver) return state;

  // Clona deep dello stato per immutabilità
  let s = deepClone(state);
  s.log = [];

  // 1. Inizio turno: rigenera Mana, applica effetti di stato sul giocatore
  s = applyStartOfTurn(s, 'player');
  if (s.isOver) return s;

  // 2. Azione giocatore
  switch (action) {
    case 'attack':
      s = doAttack(s, 'player', 'enemy');
      break;
    case 'ability':
      s = doAbility(s, 'player', 'enemy', abilityData);
      break;
    case 'item':
      s = doItem(s, 'player', payload.itemId);
      break;
    case 'guard':
      s = doGuard(s, 'player');
      break;
    case 'support':
      s = doSupport(s);
      break;
    default:
      s.log.push('Azione non valida — salto il turno.');
  }

  if (s.isOver) {
    s.fullLog.push({ turn: s.turn, actor: 'player', messages: [...s.log] });
    return s;
  }

  // 3. Tick effetti di stato sul nemico (fine turno giocatore)
  s = tickStatusEffects(s, 'enemy');
  if (s.isOver) {
    s.fullLog.push({ turn: s.turn, actor: 'player', messages: [...s.log] });
    return s;
  }

  // 4. Boss: meccaniche speciali (buff, immunità, fase 2)
  if (s.enemy.isBoss) {
    s = processBossMechanics(s);
  }

  // 5. Turno del nemico
  s = processEnemyTurn(s);
  if (s.isOver) {
    s.fullLog.push({ turn: s.turn, actor: 'enemy', messages: [...s.log] });
    return s;
  }

  // 6. Fine turno: tick effetti sul giocatore
  s = tickStatusEffects(s, 'player');

  // 7. Check vittoria per turni esauriti
  s.turn++;
  if (s.turn > COMBAT.maxTurns) {
    s = resolveByHpPercent(s);
  }

  s.fullLog.push({ turn: s.turn - 1, messages: [...s.log] });
  return s;
}

// ── Attacco base ──────────────────────────────────────────────

function doAttack(s, attacker, defender) {
  const atk = s[attacker];
  const def = s[defender];

  // Immunità boss
  if (defender === 'enemy' && def.immunityLeft > 0) {
    s.log.push(`${def.name} è immune ai danni questo turno!`);
    return s;
  }

  const rawDmg  = COMBAT.damageFormula(atk.attack, def.defense);
  const varied  = applyVariance(rawDmg, COMBAT.damageVariance);
  const isCrit  = Math.random() * 100 < (atk.luck || 0) + (attacker === 'player' ? COMBAT.critBonusPve || 0 : 0);
  const finalDmg = isCrit ? Math.floor(varied * COMBAT.critMultiplier) : varied;

  s[defender].hp = Math.max(0, def.hp - finalDmg);

  const critText = isCrit ? ' 💥 CRITICO!' : '';
  const actor    = attacker === 'player' ? 'Attacchi' : `${atk.name} attacca`;
  s.log.push(`${actor} per ${finalDmg} danni.${critText}`);

  if (s[defender].hp === 0) {
    s = checkVictory(s, defender);
  }

  return s;
}

// ── Abilità ───────────────────────────────────────────────────

function doAbility(s, attacker, defender, abilityData) {
  if (!abilityData) {
    s.log.push('Abilità non trovata.');
    return s;
  }

  const atk = s[attacker];

  // Controlla Mana
  const manaCost = abilityData.mana_cost || 0;
  if (atk.mana < manaCost) {
    s.log.push(`Mana insufficiente! (${atk.mana}/${manaCost})`);
    return s;
  }

  s[attacker].mana = Math.max(0, atk.mana - manaCost);

  const type = abilityData.type;

  if (type === 'active') {
    if (abilityData.damage_pct > 0) {
      // Abilità offensiva
      const rawDmg  = Math.floor(atk.attack * (abilityData.damage_pct / 100));
      const isMagic = abilityData.class_id === 'mage' || abilityData.class_id === 'oracle';
      const defVal  = isMagic
        ? s[defender].defense * COMBAT.magicDefReduction
        : s[defender].defense;
      const dmg    = Math.max(1, rawDmg - Math.floor(defVal / 2));

      s[defender].hp = Math.max(0, s[defender].hp - dmg);
      s.log.push(`🔮 ${abilityData.name}: ${dmg} danni!`);

      if (s[defender].hp === 0) s = checkVictory(s, defender);
    }

    if (abilityData.heal_pct > 0 && attacker === 'player') {
      const healed = Math.floor(s.player.hpMax * (abilityData.heal_pct / 100));
      s.player.hp  = Math.min(s.player.hpMax, s.player.hp + healed);
      s.log.push(`💚 ${abilityData.name}: recuperi ${healed} PF.`);
    }

    if (abilityData.buff_pct > 0) {
      applyStatusEffect(s, attacker, 'attackBuff', 1, abilityData.duration_turns || 2);
      s.log.push(`⬆️ ${abilityData.name}: attacco aumentato per ${abilityData.duration_turns} turni.`);
    }

    if (abilityData.debuff_pct < 0) {
      const resisted = Math.random() < COMBAT.statusResistBase;
      if (!resisted) {
        applyStatusEffect(s, defender, 'attackDebuff', 1, abilityData.duration_turns || 2);
        s.log.push(`⬇️ ${abilityData.name}: attacco del nemico ridotto!`);
      } else {
        s.log.push(`🛡️ ${s[defender].name} resiste all'indebolimento.`);
      }
    }

    // Veleno (Ombra)
    if (abilityData.id?.includes('poison')) {
      const resisted = Math.random() < COMBAT.statusResistBase;
      if (!resisted) {
        applyStatusEffect(s, defender, 'poison', 1, abilityData.duration_turns || 3);
        s.log.push(`☠️ ${abilityData.name}: veleno applicato!`);
      } else {
        s.log.push(`🛡️ ${s[defender].name} resiste al veleno.`);
      }
    }

    // Stordimento
    if (abilityData.id?.includes('stun') || abilityData.id?.includes('slow')) {
      const resisted = Math.random() < COMBAT.statusResistBase;
      if (!resisted) {
        applyStatusEffect(s, defender, 'stun', 1, COMBAT.stunTurns);
        s.log.push(`⚡ ${abilityData.name}: stordimento!`);
      } else {
        s.log.push(`🛡️ ${s[defender].name} resiste allo stordimento.`);
      }
    }
  }

  if (type === 'passive') {
    s.log.push(`✨ ${abilityData.name} è passiva e già attiva.`);
  }

  return s;
}

// ── Uso oggetto consumabile ───────────────────────────────────

function doItem(s, user, itemId) {
  if (s.itemsUsedCount >= COMBAT.maxItemsPerFight) {
    s.log.push(`Hai già usato ${COMBAT.maxItemsPerFight} oggetti in questo scontro.`);
    return s;
  }

  const item = (DB.battleItems || []).find(i => i.id === itemId);
  if (!item) {
    s.log.push('Oggetto non trovato.');
    return s;
  }

  if (item.heal_pct > 0) {
    const healed    = Math.floor(s.player.hpMax * (item.heal_pct / 100));
    s.player.hp     = Math.min(s.player.hpMax, s.player.hp + healed);
    s.log.push(`🧪 ${item.name}: recuperi ${healed} PF.`);
  }

  if (item.mana_restore_pct > 0) {
    const restored  = Math.floor(s.player.manaMax * (item.mana_restore_pct / 100));
    s.player.mana   = Math.min(s.player.manaMax, s.player.mana + restored);
    s.log.push(`💙 ${item.name}: recuperi ${restored} Mana.`);
  }

  // Bomba AoE (danno fisso al nemico)
  if (itemId === 'bomb_aoe') {
    const dmg       = Math.floor(s.player.attack * 0.6);
    s.enemy.hp      = Math.max(0, s.enemy.hp - dmg);
    s.log.push(`💣 Bomba Esplosiva: ${dmg} danni al nemico!`);
    if (s.enemy.hp === 0) s = checkVictory(s, 'enemy');
  }

  s.itemsUsedCount++;
  return s;
}

// ── Guardia ───────────────────────────────────────────────────

function doGuard(s, user) {
  // Il bonus di difesa viene applicato ai calcoli danni di questo turno
  s[user]._guarding = true;
  s.log.push(`🛡️ Sei in posizione di guardia. Difesa +${Math.round(COMBAT.guardDefBonus * 100)}% questo turno.`);
  return s;
}

// ── Supporto Co-op ────────────────────────────────────────────

function doSupport(s) {
  if (!s.supportAvailable || s.supportUsed) {
    s.log.push('Nessun supporto disponibile.');
    return s;
  }

  const ability = s.supportAbility;
  if (!ability) return s;

  const bonusDmg = Math.floor(s.player.attack * 0.15);
  s.enemy.hp     = Math.max(0, s.enemy.hp - bonusDmg);
  s.log.push(`🤝 Aiuto dell'alleato: ${bonusDmg} danni bonus!`);

  s.supportUsed     = true;
  s.supportAvailable = false;

  if (s.enemy.hp === 0) s = checkVictory(s, 'enemy');
  return s;
}

// ── IA Nemica ─────────────────────────────────────────────────

function processEnemyTurn(s) {
  const enemy = s.enemy;

  // Stordimento
  const stun = enemy.statusEffects.find(e => e.type === 'stun' && e.turnsLeft > 0);
  if (stun) {
    s.log.push(`⚡ ${enemy.name} è stordito e salta il turno!`);
    return s;
  }

  // Sceglie l'azione in base al % di HP rimanente
  const hpPct = enemy.hp / enemy.hpMax;

  if (hpPct < 0.3 && enemy.isBoss) {
    // Boss con pochi HP: usa attacco potenziato
    s = doEnemyAttack(s, 1.3);
    s.log.push(`${enemy.name} attacca furiosamente!`);
  } else {
    s = doEnemyAttack(s, 1.0);
  }

  return s;
}

function doEnemyAttack(s, multiplier = 1.0) {
  const enemy  = s.enemy;
  let effectiveAtk = enemy.attack;

  // Fase 2 boss
  if (enemy.isPhase2) {
    effectiveAtk = Math.floor(effectiveAtk * (1 + BOSS_MECHANICS.phase2AttackBonus));
  }

  // Buff stackati
  const attackBuff = enemy.activeBuffs.filter(b => b.type === 'attackBuff').length;
  effectiveAtk     = Math.floor(effectiveAtk * (1 + attackBuff * COMBAT.attackBuffPerStack));

  effectiveAtk = Math.floor(effectiveAtk * multiplier);

  // Difesa giocatore (con guardia)
  const guardBonus  = s.player._guarding ? COMBAT.guardDefBonus : 0;
  const effectiveDef = Math.floor(s.player.defense * (1 + guardBonus));

  const rawDmg   = COMBAT.damageFormula(effectiveAtk, effectiveDef);
  const finalDmg = applyVariance(rawDmg, COMBAT.damageVariance);

  s.player.hp = Math.max(0, s.player.hp - finalDmg);
  s.player._guarding = false; // reset guardia

  s.log.push(`${enemy.name} ti colpisce per ${finalDmg} danni!`);

  if (s.player.hp === 0) {
    s.isOver = true;
    s.winner = 'enemy';
    s.log.push(`💀 Sei stato sconfitto...`);
  }

  return s;
}

// ── Meccaniche Boss ───────────────────────────────────────────

function processBossMechanics(s) {
  const boss    = s.enemy;
  const hpPct   = boss.hp / boss.hpMax;

  // Entrata in fase 2
  if (!boss.isPhase2 && hpPct <= BOSS_MECHANICS.phase2HpThreshold) {
    s.enemy.isPhase2 = true;
    s.log.push(`⚠️ ${boss.name} entra in FASE 2! Il suo potere aumenta!`);
  }

  // Immunità (solo se ha questo potere e non in cooldown)
  if (boss.enemyData?.has_immunity && boss.immunityLeft === 0 && boss.immunityCooldown === 0) {
    if (Math.random() < 0.15) { // 15% base chance di attivare immunità
      s.enemy.immunityLeft     = BOSS_MECHANICS.immunityTurns;
      s.enemy.immunityCooldown = BOSS_MECHANICS.immunityCooldown;
      s.log.push(`🛡️ ${boss.name} diventa temporaneamente immune ai danni!`);
    }
  }

  // Decrementa contatori immunità
  if (boss.immunityLeft > 0)     s.enemy.immunityLeft--;
  if (boss.immunityCooldown > 0) s.enemy.immunityCooldown--;

  // Buff casuale
  if (boss.activeBuffs.length < BOSS_MECHANICS.maxBossBuffs) {
    if (Math.random() < BOSS_MECHANICS.buffChancePct) {
      s.enemy.activeBuffs.push({ type: 'attackBuff', turnsLeft: 3 });
      s.log.push(`🔺 ${boss.name} si potenzia!`);
    }
  }

  // Decrementa buff boss
  s.enemy.activeBuffs = boss.activeBuffs
    .map(b => ({ ...b, turnsLeft: b.turnsLeft - 1 }))
    .filter(b => b.turnsLeft > 0);

  return s;
}

// ── Effetti di Stato ──────────────────────────────────────────

function applyStatusEffect(s, target, type, stacks, turns) {
  const effects = s[target].statusEffects;
  const existing = effects.find(e => e.type === type);

  if (existing) {
    existing.stacks   = Math.min(COMBAT.maxStatusStacks, existing.stacks + stacks);
    existing.turnsLeft= Math.max(existing.turnsLeft, turns);
  } else {
    effects.push({ type, stacks, turnsLeft: turns });
  }
}

function applyStartOfTurn(s, target) {
  s[target].mana = Math.min(
    s[target].manaMax,
    s[target].mana + COMBAT.manaRegenPerTurn
  );
  return s;
}

function tickStatusEffects(s, target) {
  const effects = s[target].statusEffects;

  effects.forEach(eff => {
    if (eff.turnsLeft <= 0) return;

    if (eff.type === 'poison') {
      const dmg    = COMBAT.poisonDamagePerStack * eff.stacks;
      s[target].hp = Math.max(0, s[target].hp - dmg);
      s.log.push(`☠️ ${target === 'player' ? 'Soffri' : `${s.enemy.name} soffre`} per ${dmg} danni da veleno.`);
      if (s[target].hp === 0) s = checkVictory(s, target);
    }

    if (eff.type === 'regen' && target === 'player') {
      const heal   = COMBAT.regenHealPerStack * eff.stacks;
      s.player.hp  = Math.min(s.player.hpMax, s.player.hp + heal);
      s.log.push(`💚 Rigenerazione: recuperi ${heal} PF.`);
    }

    eff.turnsLeft--;
  });

  s[target].statusEffects = effects.filter(e => e.turnsLeft > 0);
  return s;
}

// ── Fine Battaglia ────────────────────────────────────────────

function checkVictory(s, defeated) {
  s.isOver = true;
  s.winner = defeated === 'enemy' ? 'player' : 'enemy';

  if (s.winner === 'player') {
    s.log.push(`⚔️ Vittoria! ${s.enemy.name} è stato sconfitto!`);
  } else {
    s.log.push(`💀 Sconfitta... ${s.enemy.name} ti ha battuto.`);
  }

  return s;
}

function resolveByHpPercent(s) {
  const playerPct = s.player.hp / s.player.hpMax;
  const enemyPct  = s.enemy.hp  / s.enemy.hpMax;

  s.isOver = true;
  s.log.push(`⏰ Turni esauriti!`);

  if (playerPct > enemyPct + 0.05) {
    s.winner = 'player';
    s.log.push(`Hai più vita rimanente — Vittoria!`);
  } else if (enemyPct > playerPct + 0.05) {
    s.winner = 'enemy';
    s.log.push(`Il nemico ha più vita rimanente — Sconfitta.`);
  } else {
    s.winner = 'draw';
    s.log.push(`Pareggio!`);
  }

  return s;
}

// ── Calcolo Ricompense ────────────────────────────────────────

/**
 * Calcola le ricompense al termine di uno scontro PvE vinto.
 * @param {Object} enemyData    — riga enemies
 * @param {number} playerLuck   — Fortuna %
 * @param {number} dungeonTier  — 1-5
 * @returns {{ gold, itemRarity, xpBonus }}
 */
export function calcPveRewards(enemyData, playerLuck, dungeonTier) {
  const goldMin = enemyData.gold_min;
  const goldMax = enemyData.gold_max;
  const gold    = Math.floor(goldMin + Math.random() * (goldMax - goldMin));

  // Drop item?
  const baseDropRate = enemyData.drop_rate_pct / 100;
  const luckBonus    = playerLuck * 0.001;
  const drops        = Math.random() < (baseDropRate + luckBonus);

  let itemRarity = null;
  if (drops) {
    itemRarity = rollItemRarity(dungeonTier - 1, playerLuck);
  }

  return { gold, itemRarity, xpBonus: 0 };
}

/**
 * Tira la rarità di un drop secondo la tabella per tier.
 */
export function rollItemRarity(tierIndex, playerLuck = 0) {
  // Importazione inline per evitare circular dependency
  const DROP_RARITY_RATES = [
    [0, 0.40, 0.25, 0.08, 0.02, 0.00],
    [0, 0.35, 0.30, 0.12, 0.04, 0.00],
    [0, 0.25, 0.35, 0.18, 0.07, 0.01],
    [0, 0.20, 0.35, 0.25, 0.12, 0.02],
    [0, 0.15, 0.35, 0.30, 0.18, 0.05],
  ];

  const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
  const rates    = DROP_RARITY_RATES[Math.min(tierIndex, 4)] || DROP_RARITY_RATES[0];
  const luckMult = 1 + playerLuck * 0.002; // lieve bonus fortuna
  const rand     = Math.random() / luckMult;

  let cumulative = 0;
  for (let i = rates.length - 1; i >= 0; i--) {
    cumulative += rates[i];
    if (rand < cumulative) return RARITIES[i];
  }

  return 'uncommon';
}

// ── Utils ─────────────────────────────────────────────────────

function applyVariance(value, variance) {
  const v = 1 - variance + Math.random() * variance * 2;
  return Math.max(1, Math.floor(value * v));
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Serializza lo stato di battaglia per il salvataggio in DB (turns_json).
 */
export function serializeBattleLog(state) {
  return state.fullLog.map(turn => ({
    turn:     turn.turn,
    messages: turn.messages,
  }));
}
