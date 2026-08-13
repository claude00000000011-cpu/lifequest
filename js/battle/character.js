// ============================================================
// js/battle/character.js — Personaggio Battle System
// Calcola le stats di combattimento partendo dalle stats XP esistenti.
// Crea/sincronizza il personaggio battle su Supabase.
// NON modifica DB.users — legge solo da esso.
// ============================================================

import { supabase }                     from '../../supabase.js';
import { DB, CUR, persist }             from '../db.js';
import { calcLevel }                    from '../xp.js';
import {
  CLASS_BASE_STATS,
  CLASS_PRIMARY_STAT,
  CLASS_STAT_MULT,
  CLASS_EVOLUTION,
  SKILL_POINTS,
  PROGRESSION,
} from './config.js';

// ── Cache locale ─────────────────────────────────────────────
// Evita round-trip a Supabase per ogni operazione in-battle
if (!DB.battleCharacters) DB.battleCharacters = {};
if (!DB.characterAbilities) DB.characterAbilities = {};
if (!DB.characterEquipment) DB.characterEquipment = {};

// ── Calcola stats derivate ────────────────────────────────────

/**
 * Calcola le statistiche di combattimento a partire da:
 *  - stats reali dell'utente (DB.users[userId].stats)
 *  - classe scelta
 *  - livello personaggio reale
 *
 * Formula base dal Master Plan:
 *  PF      = hpBase + (Corpo × 2) + (level × hpPerLevel)
 *  Attacco = attackBase + (stat_primaria × mult)
 *  Difesa  = defenseBase + (Corpo × 0.8) + bonus equipaggiamento
 *  Velocità= speedBase + (Sfide × 0.5)
 *  Mana    = manaBase + (Mente × 1.5)
 *  Fortuna = luckBase + (Cultura × 0.1)
 *
 * @param {string} userId
 * @returns {Object} stats calcolate
 */
export function calcBattleStats(userId) {
  const user = DB.users[userId];
  if (!user) return null;

  const bc       = DB.battleCharacters[userId];
  const classId  = bc?.class_id;
  const base     = classId ? CLASS_BASE_STATS[classId] : CLASS_BASE_STATS.warrior;
  const mult     = classId ? CLASS_STAT_MULT[classId]  : CLASS_STAT_MULT.warrior;
  const primary  = classId ? CLASS_PRIMARY_STAT[classId] : 'corpo';

  const stats    = user.stats  || { mente: 0, corpo: 0, cultura: 0, sfide: 0, sociale: 0 };
  const level    = calcLevel(user.xp || 0);
  const primStat = stats[primary] || 0;

  // PF base + bonus livello + bonus stat primaria
  const hp = Math.floor(
    base.hp
    + (stats.corpo || 0) * 2
    + level * base.hpPerLevel
    + primStat * mult.hp
  );

  const attack = Math.floor(
    base.attack
    + primStat * mult.attack
  );

  const defense = Math.floor(
    base.defense
    + (stats.corpo || 0) * 0.8
    + primStat * mult.defense
  );

  const speed = Math.floor(
    base.speed
    + (stats.sfide || 0) * 0.5
    + primStat * mult.speed
  );

  const mana = Math.floor(
    base.mana
    + (stats.mente || 0) * 1.5
    + primStat * mult.mana
    + level * base.manaPerLevel
  );

  const luck = parseFloat(
    (base.luck + (stats.cultura || 0) * 0.1 + primStat * mult.luck).toFixed(2)
  );

  // Bonus equipaggiamento (somma dai 5 slot)
  const equipment = DB.characterEquipment[userId] || [];
  const eqBonus   = calcEquipmentBonus(equipment);

  return {
    hp:        hp     + eqBonus.hp,
    attack:    attack + eqBonus.attack,
    defense:   defense+ eqBonus.defense,
    speed:     speed  + eqBonus.speed,
    mana:      mana   + eqBonus.mana,
    luck:      luck   + eqBonus.luck,
    level,
    classId,
  };
}

/**
 * Somma i bonus di tutti gli oggetti equipaggiati.
 * @param {Array} equipment — array slot equipment
 * @returns {Object} bonus totali
 */
function calcEquipmentBonus(equipment) {
  const bonus = { hp: 0, attack: 0, defense: 0, speed: 0, mana: 0, luck: 0 };
  if (!equipment?.length) return bonus;

  equipment.forEach(slot => {
    if (!slot.item_id) return;
    const item = (DB.battleItems || []).find(i => i.id === slot.item_id);
    if (!item) return;

    const dur  = (slot.durability ?? 100) / 100; // efficacia 0-1
    bonus.hp      += Math.floor((item.bonus_hp      || 0) * dur);
    bonus.attack  += Math.floor((item.bonus_attack  || 0) * dur);
    bonus.defense += Math.floor((item.bonus_defense || 0) * dur);
    bonus.speed   += Math.floor((item.bonus_speed   || 0) * dur);
    bonus.mana    += Math.floor((item.bonus_mana    || 0) * dur);
    bonus.luck    += parseFloat(((item.bonus_luck_pct || 0) * dur).toFixed(2));
  });

  return bonus;
}




/**
 * Calcola il Livello Potenza (LP) del personaggio.
 * Usato per leaderboard, matchmaking PvP e display UI.
 * @param {string} userId
 * @returns {number} LP arrotondato
 */
export function calcPowerLevel(userId) {
  const stats = calcBattleStats(userId);
  if (!stats) return 0;

  const level = stats.level || 1;

  // Bonus enhancement (somma tutti i bonus attivi)
  const bc        = DB.battleCharacters[userId];
  const enhancements = DB.itemEnhancements?.[userId] || [];
  const enhBonus  = enhancements.reduce((acc, e) => {
    acc.attack  += (e.bonus_attack  || 0);
    acc.defense += (e.bonus_defense || 0);
    acc.hp      += (e.bonus_hp      || 0);
    return acc;
  }, { attack: 0, defense: 0, hp: 0 });

  const lp = Math.floor(
    level                              * 10   +
    (stats.attack  + enhBonus.attack)  * 2    +
    (stats.defense + enhBonus.defense) * 1.5  +
    (stats.hp      + enhBonus.hp)      / 10   +
    stats.speed                        * 1    +
    stats.mana                         / 5
  );

  return Math.max(1, lp);
}






// ── Creazione / Sincronizzazione personaggio ──────────────────

/**
 * Sincronizza il personaggio battle dell'utente.
 * Chiamato da api.js → syncCloudDataOnLogin (fire-and-forget).
 * Se non esiste lo crea; se esiste aggiorna le stats derivate.
 *
 * @param {string} userId
 */
export async function syncBattleCharacter(userId) {
  try {
    // 1. Leggi il personaggio esistente
    const { data: existing, error } = await supabase
      .from('battle_characters')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[Battle] syncBattleCharacter error:', error.message);
      return;
    }

    if (!existing) {
      // 2. Prima volta: crea il personaggio
      await _createBattleCharacter(userId);
    } else {
      // 3. Già esistente: aggiorna stats derivate + cache locale
      DB.battleCharacters[userId] = existing;
      persist();
      await _updateDerivedStats(userId, existing);
    }

    // 4. Carica equipaggiamento e abilità
    await Promise.all([
      loadEquipment(userId),
      loadAbilities(userId),
    ]);

  } catch (e) {
    console.warn('[Battle] syncBattleCharacter failed:', e);
  }
}

async function _createBattleCharacter(userId) {
  const user  = DB.users[userId];
  if (!user) return;

  const level = calcLevel(user.xp || 0);

  const newChar = {
    user_id:         userId,
    class_id:        null,           // Scelto al lv.5
    hp_base:         100,
    hp_current:      100,
    attack:          10,
    defense:         5,
    speed:           5,
    mana_max:        50,
    mana_current:    50,
    luck_pct:        3.0,
    gold:            PROGRESSION.startingGold,
    skill_points:    Math.max(0, level - 1), // PA retroattivi per chi è già avanzato
    reputation:      0,
    total_battles:   0,
    total_wins:      0,
  };

  const { data, error } = await supabase
    .from('battle_characters')
    .insert(newChar)
    .select()
    .single();

  if (error) {
    console.warn('[Battle] _createBattleCharacter error:', error.message);
    return;
  }

  DB.battleCharacters[userId] = data;
  persist();

  // Oggetto starter garantito (Non Comune)
  await grantStarterItem(userId, data.id);
}

async function _updateDerivedStats(userId, bc) {
  if (!bc.class_id) return; // Nessuna classe → nulla da calcolare ancora

  const computed = calcBattleStats(userId);
  if (!computed) return;

 // Aggiorna solo le stats che cambiano con il livello,
// NON hp_current (potrebbe essere in battaglia)
const patch = {
  hp_base:          computed.hp,
  attack:           computed.attack,
  defense:          computed.defense,
  speed:            computed.speed,
  mana_max:         computed.mana,
  luck_pct:         computed.luck,
  power_level:      calcPowerLevel(userId),   // ← AGGIUNTO
  last_stats_sync:  new Date().toISOString(),
};

await supabase
  .from('battle_characters')
  .update(patch)
  .eq('user_id', userId);

DB.battleCharacters[userId] = { ...bc, ...patch };
persist();
}  // ← chiude _updateDerivedStats

// ── Scelta Classe ─────────────────────────────────────────────
// ── Scelta Classe ─────────────────────────────────────────────

/**
 * Imposta la classe del personaggio. Disponibile dal lv.5.
 * @param {string} userId
 * @param {string} classId — 'warrior'|'mage'|'bard'|'shadow'|'oracle'
 * @returns {{ ok: boolean, error?: string }}
 */
export async function chooseClass(userId, classId) {
  const user  = DB.users[userId];
  if (!user) return { ok: false, error: 'Utente non trovato' };

  const level = calcLevel(user.xp || 0);
  if (level < PROGRESSION.UNLOCKS.classChoice) {
    return { ok: false, error: `Raggiungi il livello ${PROGRESSION.UNLOCKS.classChoice} per scegliere una classe` };
  }

  const bc = DB.battleCharacters[userId];
  if (!bc) return { ok: false, error: 'Personaggio battle non trovato' };

  if (bc.class_id) return { ok: false, error: 'Hai già scelto una classe' };

  const validClasses = ['warrior', 'mage', 'bard', 'shadow', 'oracle'];
  if (!validClasses.includes(classId)) return { ok: false, error: 'Classe non valida' };

  const { error } = await supabase
    .from('battle_characters')
    .update({ class_id: classId })
    .eq('user_id', userId);

  if (error) return { ok: false, error: error.message };

  DB.battleCharacters[userId] = { ...bc, class_id: classId };
  persist();

  // Ricalcola le stats con la nuova classe
  await _updateDerivedStats(userId, DB.battleCharacters[userId]);

  return { ok: true };
}

// ── Punti Abilità ─────────────────────────────────────────────

/**
 * Controlla quanti PA ha il personaggio.
 * I PA = (livello reale - 1) - PA già spesi.
 * @param {string} userId
 * @returns {number}
 */
export function getSkillPoints(userId) {
  return DB.battleCharacters[userId]?.skill_points || 0;
}

/**
 * Sblocca un'abilità spendendo PA (e Gold se richiesto).
 * @param {string} userId
 * @param {string} abilityId
 * @returns {{ ok: boolean, error?: string }}
 */
export async function unlockAbility(userId, abilityId) {
  const bc = DB.battleCharacters[userId];
  if (!bc) return { ok: false, error: 'Personaggio non trovato' };

  // Controlla se già sbloccata
  const already = (DB.characterAbilities[userId] || []).find(a => a.ability_id === abilityId);
  if (already) return { ok: false, error: 'Abilità già sbloccata' };

  // Recupera dati abilità
  const ability = (DB.battleAbilities || []).find(a => a.id === abilityId);
  if (!ability) return { ok: false, error: 'Abilità non trovata' };

  // Controlla livello personaggio
  const userLevel = calcLevel(DB.users[userId]?.xp || 0);
  if (userLevel < ability.min_char_level) {
    return { ok: false, error: `Raggiungi il livello ${ability.min_char_level}` };
  }

  // Controlla PA
  if (bc.skill_points < ability.pa_cost) {
    return { ok: false, error: `Servono ${ability.pa_cost} Punti Abilità (ne hai ${bc.skill_points})` };
  }

  // Controlla Gold
  if (ability.gold_cost > 0 && bc.gold < ability.gold_cost) {
    return { ok: false, error: `Servono ${ability.gold_cost} Gold (ne hai ${bc.gold})` };
  }

  // Sblocca
  const { error: abErr } = await supabase
    .from('character_abilities')
    .insert({ character_id: bc.id, ability_id: abilityId });

  if (abErr) return { ok: false, error: abErr.message };

  // Scala PA e Gold
  const newSp   = bc.skill_points - ability.pa_cost;
  const newGold = bc.gold - (ability.gold_cost || 0);

  await supabase
    .from('battle_characters')
    .update({ skill_points: newSp, gold: newGold })
    .eq('id', bc.id);

  DB.battleCharacters[userId].skill_points = newSp;
  DB.battleCharacters[userId].gold         = newGold;

  if (!DB.characterAbilities[userId]) DB.characterAbilities[userId] = [];
  DB.characterAbilities[userId].push({ ability_id: abilityId, unlocked_at: new Date().toISOString() });
  persist();

  return { ok: true };
}

// ── Gold ──────────────────────────────────────────────────────

/**
 * Aggiunge o toglie Gold al personaggio.
 * @param {string} userId
 * @param {number} amount — positivo = guadagno, negativo = spesa
 * @param {string} source — chiave della tabella gold_transactions
 * @param {string} [referenceId]
 * @returns {{ ok: boolean, newGold?: number, error?: string }}
 */
export async function updateGold(userId, amount, source, referenceId = null) {
  const bc = DB.battleCharacters[userId];
  if (!bc) return { ok: false, error: 'Personaggio non trovato' };

  const newGold = (bc.gold || 0) + amount;
  if (newGold < 0) return { ok: false, error: 'Gold insufficienti' };

  // Aggiorna il totale
  const { error } = await supabase
    .from('battle_characters')
    .update({ gold: newGold })
    .eq('id', bc.id);

  if (error) return { ok: false, error: error.message };

  // Log transazione
  supabase.from('gold_transactions').insert({
    character_id: bc.id,
    amount,
    source,
    reference_id: referenceId,
  }).then(({ error: txErr }) => {
    if (txErr) console.warn('[Battle] gold_transaction log failed:', txErr.message);
  });

  DB.battleCharacters[userId].gold = newGold;
  persist();
  return { ok: true, newGold };
}

// ── Limiti Giornalieri ────────────────────────────────────────

/**
 * Legge i limiti giornalieri del personaggio.
 * @param {string} userId
 * @returns {Object} { pve_count, pvp_count, dungeon_count, help_sent }
 */
export async function getDailyLimits(userId) {
  const bc   = DB.battleCharacters[userId];
  if (!bc) return null;

  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('daily_limits')
    .select('*')
    .eq('character_id', bc.id)
    .eq('date', today)
    .maybeSingle();

  if (error) {
    console.warn('[Battle] getDailyLimits:', error.message);
    return { pve_count: 0, pvp_count: 0, dungeon_count: 0, help_sent: 0 };
  }

  if (!data) {
    // Crea il record per oggi
   const { data: created } = await supabase
  .from('daily_limits')
  .upsert({ character_id: bc.id, date: today }, { onConflict: 'character_id,date' })
  .select()
  .single();
    return created || { pve_count: 0, pvp_count: 0, dungeon_count: 0, help_sent: 0 };
  }

  return data;
}

/**
 * Incrementa un contatore giornaliero.
 * @param {string} userId
 * @param {'pve_count'|'pvp_count'|'dungeon_count'|'help_sent'} field
 */
export async function incrementDailyLimit(userId, field) {
  const bc = DB.battleCharacters[userId];
  if (!bc) return;

  const allowedFields = [
    'pve_count',
    'pvp_count',
    'dungeon_count',
    'help_sent',
  ];

  if (!allowedFields.includes(field)) {
    console.warn('[Battle] Campo daily limit non valido:', field);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const { error } = await supabase.rpc('increment_daily_limit', {
      p_character_id: bc.id,
      p_date: today,
      p_field: field,
    });

    if (error) {
      console.warn('[Battle] incrementDailyLimit RPC error:', error.message);
    }
  } catch (err) {
    console.warn('[Battle] incrementDailyLimit failed:', err);
  }
}

// ── Caricamento dati da Supabase ──────────────────────────────

export async function loadEquipment(userId) {
  const bc = DB.battleCharacters[userId];
  if (!bc) return;

  const { data, error } = await supabase
    .from('character_equipment')
    .select('*')
    .eq('character_id', bc.id);

  if (!error && data) {
    DB.characterEquipment[userId] = data;
    persist();
  }
}

export async function loadAbilities(userId) {
  const bc = DB.battleCharacters[userId];
  if (!bc) return;

  const { data, error } = await supabase
    .from('character_abilities')
    .select('*')
    .eq('character_id', bc.id);

  if (!error && data) {
    DB.characterAbilities[userId] = data;
    persist();
  }
}

export async function loadBattleClasses() {
  if (DB.battleClasses?.length) return; // già in cache

  const { data, error } = await supabase
    .from('battle_classes')
    .select('*');

  if (!error && data) {
    DB.battleClasses = data;
    persist();
  }
}

export async function loadBattleAbilities(classId = null) {
  let query = supabase.from('battle_abilities').select('*');
  if (classId) query = query.eq('class_id', classId);

  const { data, error } = await query;
  if (!error && data) {
    DB.battleAbilities = data;
    persist();
  }
}

export async function loadItems() {
  if (DB.battleItems?.length) return;

  const { data, error } = await supabase
    .from('battle_items')  // era 'items'
    .select('*');

  if (!error && data) {
    DB.battleItems = data;
    persist();
  }
}

export async function loadEnemies(tier = null) {
  let query = supabase.from('battle_enemies').select('*');  // era 'enemies'
  if (tier) query = query.eq('tier', tier);

  const { data, error } = await query;
  if (!error && data) {
    if (!DB.battleEnemies) DB.battleEnemies = [];
    data.forEach(e => {
      if (!DB.battleEnemies.find(x => x.id === e.id)) DB.battleEnemies.push(e);
    });
    persist();
  }
}

// ── Oggetto Starter ───────────────────────────────────────────

async function grantStarterItem(userId, characterId) {
  // Trova un'arma Non Comune casuale
  const starterItems = (DB.battleItems || []).filter(
    i => i.rarity === 'uncommon' && i.slot === 'weapon'
  );

  if (!starterItems.length) return;
  const item = starterItems[Math.floor(Math.random() * starterItems.length)];

  await supabase.from('inventory').insert({
    character_id: characterId,
    item_id:      item.id,
    quantity:     1,
    durability:   100,
  });
}

// ── Helper pubblici ───────────────────────────────────────────

/**
 * Ritorna il personaggio battle dell'utente corrente (cache locale).
 * @param {string} userId
 */
export function getBattleChar(userId) {
  return DB.battleCharacters?.[userId] || null;
}




/**
 * Ricalcola e salva il power_level su Supabase.
 * Chiamare dopo: equip/unequip, enhancement, acquisto item.
 * @param {string} userId
 */
export async function syncPowerLevel(userId) {
  const bc = DB.battleCharacters[userId];
  if (!bc) return;

  const lp = calcPowerLevel(userId);
  if (lp === bc.power_level) return; // nessun cambiamento, skip

  const { error } = await supabase
    .from('battle_characters')
    .update({ power_level: lp })
    .eq('user_id', userId);

  if (error) {
    console.warn('[Battle] syncPowerLevel error:', error.message);
    return;
  }

  DB.battleCharacters[userId].power_level = lp;
  persist();
}




  
/**
 * Controlla se il personaggio può accedere a un dato dungeon tier.
 */
export function canAccessDungeon(userId, tier) {
  const level   = calcLevel(DB.users[userId]?.xp || 0);
  const dungeon = [null, { minLevel: 1 }, { minLevel: 10 }, { minLevel: 20 }, { minLevel: 35 }, { minLevel: 50 }][tier];
  if (!dungeon) return false;
  const delta = tier - 1;
  return level >= dungeon.minLevel && delta <= PROGRESSION.dungeonLevelCap;
}
