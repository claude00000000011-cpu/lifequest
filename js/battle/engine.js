
// ╔══════════════════════════════════════════════════════════════╗
// ║  FILE 2/3 — js/battle/engine.js                             ║
// ║  Sostituisce COMPLETAMENTE il file originale                 ║
// ╚══════════════════════════════════════════════════════════════╝
 
import { COMBAT, BOSS_MECHANICS } from './config.js';
import { DB } from '../db.js';
 
// ── Costruzione stato iniziale ────────────────────────────────
 
export function initBattle(playerStats, enemyData, playerLevel, support = null, playerDef = 10) {
  const enemyScaling = enemyData.already_scaled
  ? { hp: enemyData.hp_base, attack: enemyData.attack_base, defense: enemyData.defense_base }
  : calcEnemyScaling(enemyData, playerLevel, playerStats.attack, playerDef);
 
  const player = {
    id:               'player',
    name:             'Tu',
    hp:               playerStats.hp,
    hpMax:            playerStats.hpMax ?? playerStats.hp,
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
    enemyData,
  };
 
  return {
    player,
    enemy,
    turn:             1,
    isOver:           false,
    winner:           null,
    log:              [`La battaglia ha inizio! ${enemy.name} si avvicina minaccioso.`],
    fullLog:          [],
    supportAvailable: !!support,
    supportAbility:   support || null,
    supportUsed:      false,
    itemsUsedCount:   0,
  };
}
 
// ── Scaling nemico ────────────────────────────────────────────
// PATCH: ora scala gli HP anche in base all'ATK reale del giocatore,
// così nemici e giocatore rimangono in tensione anche con stat alte.
 
function calcEnemyScaling(enemyData, playerLevel, playerAtk = 10, playerDef = 10) {
  const dungeonConfig = getDungeonConfig(enemyData.tier);
  const minLevel      = dungeonConfig?.minLevel || 1;
  const excess        = Math.max(0, playerLevel - minLevel);
  const levelMult     = 1 + excess * (dungeonConfig?.scalingPerLevel || 0.04);

  // L'ATK nemico scala con la difesa del giocatore usando un soft-cap.
  // def=54 → defMult ≈ 1.95  (nemici quasi raddoppiano ATK)
  // def=10 → defMult ≈ 1.14
  // def=100→ defMult ≈ 2.58  (cap morbido, non esplode)
  const defMult = 1 + Math.log10(1 + playerDef / 20);

  // Gli HP nemici scalano con l'ATK del giocatore (come prima)
  const atkBaseForTier = (dungeonConfig?.enemyAttackBase || 14);
const atkRatio       = Math.max(1, playerAtk / (atkBaseForTier * 2));
  const hpAtkScaling   = Math.min(atkRatio, 1.5);

  return {
    hp:      Math.floor(enemyData.hp_base * levelMult * hpAtkScaling),
    attack:  Math.floor(enemyData.attack  * levelMult * defMult),
    defense: Math.floor(enemyData.defense * levelMult),
  };
}



 
function getDungeonConfig(tier) {
  // Importazione inline per evitare circular dep con config.js
  const DUNGEONS_LOCAL = [
    null,
    { minLevel: 1,  scalingPerLevel: 0.04, enemyAttackBase: 14 },
    { minLevel: 10, scalingPerLevel: 0.04, enemyAttackBase: 22 },
    { minLevel: 20, scalingPerLevel: 0.04, enemyAttackBase: 36 },
    { minLevel: 35, scalingPerLevel: 0.04, enemyAttackBase: 58 },
    { minLevel: 50, scalingPerLevel: 0.04, enemyAttackBase: 90 },
  ];
  return DUNGEONS_LOCAL[tier] || DUNGEONS_LOCAL[1];
}
 
// ── Azione del giocatore ──────────────────────────────────────
 
export function processPlayerAction(state, action, payload = {}, abilityData = null) {
  if (state.isOver) return state;
 
  let s = deepClone(state);
  s.log = [];
 
  // 1. Inizio turno: rigenera Mana, applica effetti sul giocatore
  s = applyStartOfTurn(s, 'player');
  if (s.isOver) return s;
 
  // 2. Azione giocatore
  switch (action) {
    case 'attack':  s = doAttack(s, 'player', 'enemy'); break;
    case 'ability': s = doAbility(s, 'player', 'enemy', abilityData); break;
    case 'item':    s = doItem(s, 'player', payload.itemId); break;
    case 'guard':   s = doGuard(s, 'player'); break;
    case 'support': s = doSupport(s); break;
    default:        s.log.push('Azione non valida — salto il turno.');
  }
 
  if (s.isOver) {
    s.fullLog.push({ turn: s.turn, actor: 'player', messages: [...s.log] });
    return s;
  }
 
  // 3. Tick effetti di stato sul nemico (veleno, ecc.)
  s = tickStatusEffects(s, 'enemy');
  if (s.isOver) {
    s.fullLog.push({ turn: s.turn, actor: 'player', messages: [...s.log] });
    return s;
  }
 
  // 4. Boss: meccaniche speciali
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
  if (s.isOver) {
    s.fullLog.push({ turn: s.turn, messages: [...s.log] });
    return s;
  }
 
  // 7. Avanza il turno — NESSUN limite massimo
  s.turn++;
 
  s.fullLog.push({ turn: s.turn - 1, messages: [...s.log] });
  return s;
}
 
// ── Attacco base ──────────────────────────────────────────────
 
function doAttack(s, attacker, defender) {
  const atk = s[attacker];
  const def = s[defender];
 
  if (defender === 'enemy' && def.immunityLeft > 0) {
    s.log.push(`${def.name} è immune ai danni questo turno!`);
    return s;
  }
 
  const rawDmg = COMBAT.damageFormula(atk.attack, def.defense);
  const varied = applyVariance(rawDmg, COMBAT.damageVariance);
 
  // Crit: luck% + bonus base PvE per il giocatore
  const critChance = (atk.luck || 0) + (attacker === 'player' ? (COMBAT.critBonusPve || 0) : 0);
  const isCrit     = Math.random() * 100 < critChance;
  const finalDmg   = isCrit ? Math.floor(varied * COMBAT.critMultiplier) : varied;
 
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
 
  const atk      = s[attacker];

  // Scala i valori in base al livello corrente dell'abilità
  const abilityLevel = abilityData._currentLevel || 1;
  const levelMult    = 1 + (abilityLevel - 1) * 0.15; // +15% per livello
  const manaCost     = Math.round((abilityData.mana_cost || 0) * levelMult);
 
  if (atk.mana < manaCost) {
    s.log.push(`Mana insufficiente! (${atk.mana}/${manaCost})`);
    return s;
  }
 
  s[attacker].mana = Math.max(0, atk.mana - manaCost);
  const type = abilityData.type;
 
  if (type === 'active') {
  if (abilityData.damage_pct > 0) {
      const rawDmg  = Math.floor(atk.attack * ((abilityData.damage_pct * levelMult) / 100));
      const isMagic = abilityData.class_id === 'mage' || abilityData.class_id === 'oracle';
      const defVal  = isMagic
        ? s[defender].defense * COMBAT.magicDefReduction
        : s[defender].defense;
      const dmg = Math.max(1, COMBAT.damageFormula(rawDmg, Math.floor(defVal)));
 
      s[defender].hp = Math.max(0, s[defender].hp - dmg);
      s.log.push(`🔮 ${abilityData.name}: ${dmg} danni!`);
      if (s[defender].hp === 0) s = checkVictory(s, defender);
    }
 
  if (abilityData.heal_pct > 0 && attacker === 'player') {
      const healed = Math.floor(s.player.hpMax * ((abilityData.heal_pct * levelMult) / 100));
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
 
    if (abilityData.id?.includes('poison')) {
      const resisted = Math.random() < COMBAT.statusResistBase;
      if (!resisted) {
        applyStatusEffect(s, defender, 'poison', 1, abilityData.duration_turns || 3);
        s.log.push(`☠️ ${abilityData.name}: veleno applicato!`);
      } else {
        s.log.push(`🛡️ ${s[defender].name} resiste al veleno.`);
      }
    }
 
    if (abilityData.id?.includes('stun') || abilityData.id?.includes('slow')) {
      // I boss in fase 2 sono immuni allo stordimento
      if (s[defender].isBoss && s[defender].isPhase2) {
        s.log.push(`🛡️ ${s[defender].name} è in fase 2 e resiste allo stordimento!`);
      } else {
        const resisted = Math.random() < COMBAT.statusResistBase;
        if (!resisted) {
          applyStatusEffect(s, defender, 'stun', 1, COMBAT.stunTurns);
          s.log.push(`⚡ ${abilityData.name}: stordimento!`);
        } else {
          s.log.push(`🛡️ ${s[defender].name} resiste allo stordimento.`);
        }
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

  // Cerca prima in battleItems, poi in items (consumabili)
  const item = (DB.battleItems || []).find(i => i.id === itemId)
            || (DB.items       || []).find(i => i.id === itemId);
  if (!item) {
    s.log.push('Oggetto non trovato.');
    return s;
  }

  // ── Cura HP ──────────────────────────────────────────────────────────────
  if (item.heal_pct > 0) {
    const healed = Math.floor(s.player.hpMax * (item.heal_pct / 100));
    s.player.hp  = Math.min(s.player.hpMax, s.player.hp + healed);
    s.log.push(`🧪 ${item.name}: recuperi ${healed} PF.`);
  }

  // ── Cura Mana ────────────────────────────────────────────────────────────
  if (item.mana_restore_pct > 0) {
    const restored = Math.floor(s.player.manaMax * (item.mana_restore_pct / 100));
    s.player.mana  = Math.min(s.player.manaMax, s.player.mana + restored);
    s.log.push(`💙 ${item.name}: recuperi ${restored} Mana.`);
  }

  // ── Danno diretto (damage_flat o bonus_attack come danno bomba) ───────────
  if (item.damage_flat > 0) {
    const dmg  = item.damage_flat;
    s.enemy.hp = Math.max(0, s.enemy.hp - dmg);
    s.log.push(`💥 ${item.name}: infliggi ${dmg} danni!`);
    if (s.enemy.hp <= 0) { s = checkVictory(s, 'enemy'); s.itemsUsedCount++; return s; }
  }

// ── Effetti dinamici da Supabase ─────────────────────────────────────────
  if (item.effect_type) {
    switch (item.effect_type) {

      case 'burn': {
        const dmg = Math.floor(s.player.attack * 0.6);
        s.enemy.hp = Math.max(0, s.enemy.hp - dmg);
        s.log.push(`🔥 ${item.name}: ${dmg} danni e bruciatura per ${item.effect_duration} turni!`);
        s = applyStatusEffect(s, 'enemy', { type: 'burn', damage: Math.floor(s.player.attack * item.effect_value), duration: item.effect_duration });
        if (s.enemy.hp <= 0) { s = checkVictory(s, 'enemy'); s.itemsUsedCount++; return s; }
        break;
      }

      case 'slow': {
        s.log.push(`💧 ${item.name}: il nemico è rallentato per ${item.effect_duration} turni!`);
        s = applyStatusEffect(s, 'enemy', { type: 'slow', speedMult: item.effect_value, duration: item.effect_duration });
        break;
      }

      case 'fear': {
        s.log.push(`🌑 ${item.name}: il nemico è indebolito per ${item.effect_duration} turni!`);
        s = applyStatusEffect(s, 'enemy', { type: 'fear', atkMult: item.effect_value, defMult: item.effect_value, duration: item.effect_duration });
        break;
      }

      case 'blind': {
        s.log.push(`✨ ${item.name}: il nemico è accecato per ${item.effect_duration} turni!`);
        s = applyStatusEffect(s, 'enemy', { type: 'blind', misschance: item.effect_value, duration: item.effect_duration });
        break;
      }

      case 'aoe': {
        const dmg = Math.floor(s.player.attack * item.effect_value);
        s.enemy.hp = Math.max(0, s.enemy.hp - dmg);
        s.log.push(`💣 ${item.name}: ${dmg} danni esplosivi!`);
        if (s.enemy.hp <= 0) { s = checkVictory(s, 'enemy'); s.itemsUsedCount++; return s; }
        break;
      }

      case 'barrier': {
        s.player.defense += item.effect_value;
        s.log.push(`🛡️ ${item.name}: difesa aumentata di ${item.effect_value} per questa battaglia!`);
        break;
      }

      case 'revive': {
        const revive = Math.floor(s.player.hpMax * (item.effect_value / 100));
        s.player.hp  = Math.min(s.player.hpMax, s.player.hp + revive);
        s.log.push(`💖 ${item.name}: recuperi ${revive} PF!`);
        break;
      }
    
  


  }

  s.itemsUsedCount++;
  return s;
}
 
// ── Guardia ───────────────────────────────────────────────────
 
function doGuard(s, user) {
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
 
  const bonusDmg     = Math.floor(s.player.attack * 0.20); // era 0.15
  s.enemy.hp         = Math.max(0, s.enemy.hp - bonusDmg);
  s.log.push(`🤝 Aiuto dell'alleato: ${bonusDmg} danni bonus!`);
  s.supportUsed      = true;
  s.supportAvailable = false;
 
  if (s.enemy.hp === 0) s = checkVictory(s, 'enemy');
  return s;
}
 
// ── IA Nemica ─────────────────────────────────────────────────
 
function processEnemyTurn(s) {
  const enemy = s.enemy;
 
  const stun = enemy.statusEffects.find(e => e.type === 'stun' && e.turnsLeft > 0);
  if (stun) {
    s.log.push(`⚡ ${enemy.name} è stordito e salta il turno!`);
    return s;
  }
 
  const hpPct = enemy.hp / enemy.hpMax;
 
  if (hpPct < 0.25 && enemy.isBoss) {
    // Boss quasi morto: attacco disperato
    s = doEnemyAttack(s, 1.4);
  } else if (hpPct < 0.50 && enemy.isBoss) {
    s = doEnemyAttack(s, 1.2);
  } else {
    s = doEnemyAttack(s, 1.0);
  }
 
  return s;
}
 
function doEnemyAttack(s, multiplier = 1.0) {
  const enemy = s.enemy;
  let effectiveAtk = enemy.attack;
 
  if (enemy.isPhase2) {
    effectiveAtk = Math.floor(effectiveAtk * (1 + BOSS_MECHANICS.phase2AttackBonus));
  }
 
  const attackBuff = enemy.activeBuffs.filter(b => b.type === 'attackBuff').length;
  effectiveAtk     = Math.floor(effectiveAtk * (1 + attackBuff * COMBAT.attackBuffPerStack));
  effectiveAtk     = Math.floor(effectiveAtk * multiplier);
 
  // Difesa giocatore con guardia
  const guardMult    = s.player._guarding ? (1 + COMBAT.guardDefBonus) : 1;
  const effectiveDef = Math.floor(s.player.defense * guardMult);
 
  const rawDmg   = COMBAT.damageFormula(effectiveAtk, effectiveDef);
  const finalDmg = applyVariance(rawDmg, COMBAT.damageVariance);
 
  s.player.hp        = Math.max(0, s.player.hp - finalDmg);
  s.player._guarding = false;
 
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
  const boss  = s.enemy;
  const hpPct = boss.hp / boss.hpMax;
 
  // Fase 2
  if (!boss.isPhase2 && hpPct <= BOSS_MECHANICS.phase2HpThreshold) {
    s.enemy.isPhase2 = true;
    s.log.push(`⚠️ ${boss.name} entra in FASE 2! Il suo potere aumenta!`);
  }
 
  // Immunità — solo sotto la soglia HP e non in cooldown
  const underHpGate = hpPct <= (BOSS_MECHANICS.immunityHpGate || 0.60);
  if (
    boss.enemyData?.has_immunity &&
    underHpGate &&
    boss.immunityLeft === 0 &&
    boss.immunityCooldown === 0 &&
    Math.random() < BOSS_MECHANICS.immunityChance
  ) {
    s.enemy.immunityLeft     = BOSS_MECHANICS.immunityTurns;
    s.enemy.immunityCooldown = BOSS_MECHANICS.immunityCooldown;
    s.log.push(`🛡️ ${boss.name} diventa temporaneamente immune ai danni!`);
  }
 
  if (boss.immunityLeft > 0)     s.enemy.immunityLeft--;
  if (boss.immunityCooldown > 0) s.enemy.immunityCooldown--;
 
  // Buff casuali
  if (boss.activeBuffs.length < BOSS_MECHANICS.maxBossBuffs) {
    if (Math.random() < BOSS_MECHANICS.buffChancePct) {
      s.enemy.activeBuffs.push({ type: 'attackBuff', turnsLeft: 3 });
      s.log.push(`🔺 ${boss.name} si potenzia!`);
    }
  }
 
  s.enemy.activeBuffs = boss.activeBuffs
    .map(b => ({ ...b, turnsLeft: b.turnsLeft - 1 }))
    .filter(b => b.turnsLeft > 0);
 
  return s;
}
 
// ── Effetti di Stato ──────────────────────────────────────────
 
function applyStatusEffect(s, target, type, stacks, turns) {
  const effects  = s[target].statusEffects;
  const existing = effects.find(e => e.type === type);
 
  if (existing) {
    existing.stacks    = Math.min(COMBAT.maxStatusStacks, existing.stacks + stacks);
    existing.turnsLeft = Math.max(existing.turnsLeft, turns);
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
      const heal  = COMBAT.regenHealPerStack * eff.stacks;
      s.player.hp = Math.min(s.player.hpMax, s.player.hp + heal);
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
 
// ── Calcolo Ricompense ────────────────────────────────────────

export function calcPveRewards(enemyData, playerLuck, dungeonTier, streakMultiplier = 1.0) {
  const gold = Math.floor(Number(enemyData.gold_reward || 0) * streakMultiplier);
 const xp = 0;           //exp ZERO nei combattimenti

  // Probabilità base di drop determinata dal tier del dungeon
  const dropRates = [0.15, 0.18, 0.22, 0.28, 0.35];
  const baseDropRate = dropRates[Math.min(Math.max(dungeonTier - 1, 0), 4)] || 0.15;

  // La fortuna aumenta leggermente la probabilità di drop
  const luckBonus = Number(playerLuck || 0) * 0.001;
  const drops = Math.random() < Math.min(1, baseDropRate + luckBonus);

  let itemRarity = null;

  if (drops) {
    itemRarity = rollItemRarity(dungeonTier - 1, playerLuck);
  }

 return {
    gold,
    itemRarity,
    xpBonus: 0,
  };
}

export function rollItemRarity(tierIndex, playerLuck = 0) {
  const DROP_RARITY_RATES = [
    [0, 0.40, 0.25, 0.08, 0.02, 0.00],
    [0, 0.35, 0.30, 0.12, 0.04, 0.00],
    [0, 0.25, 0.35, 0.18, 0.07, 0.01],
    [0, 0.20, 0.35, 0.25, 0.12, 0.02],
    [0, 0.15, 0.35, 0.30, 0.18, 0.05],
  ];

  const RARITIES = [
    'common',
    'uncommon',
    'rare',
    'epic',
    'legendary',
    'mythic'
  ];

  const rates =
    DROP_RARITY_RATES[Math.min(Math.max(tierIndex, 0), 4)] ||
    DROP_RARITY_RATES[0];

  const luckMult = 1 + Number(playerLuck || 0) * 0.002;
  const rand = Math.random() / luckMult;

  let cumulative = 0;

  for (let i = rates.length - 1; i >= 0; i--) {
    cumulative += rates[i];

    if (rand < cumulative) {
      return RARITIES[i];
    }
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
 
export function serializeBattleLog(state) {
  return state.fullLog.map(turn => ({
    turn:     turn.turn,
    messages: turn.messages,
  }));
}
 
