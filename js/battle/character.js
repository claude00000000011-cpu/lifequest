// ============================================================
// js/battle/character.js — Personaggio Battle System - MODIFICA 03:14 dopo ore dalla fine del funzionamento del sito. test 1
// ============================================================

import { supabase }    from '../../supabase.js';
import { DB, persist } from '../db.js';
import { calcLevel }   from '../xp.js';
import {
  CLASS_BASE_STATS,
  CLASS_PRIMARY_STAT,
  CLASS_STAT_MULT,
  PROGRESSION,
} from './config.js';

if (!DB.battleCharacters)  DB.battleCharacters  = {};
if (!DB.characterAbilities) DB.characterAbilities = {};
if (!DB.characterEquipment) DB.characterEquipment = {};

// ── calcBattleStats ───────────────────────────────────────────

export function calcBattleStats(userId) {
  const user = DB.users[userId];
  if (!user) return null;

  const bc      = DB.battleCharacters[userId];
  const classId = bc?.class_id;
  const base    = classId ? CLASS_BASE_STATS[classId] : CLASS_BASE_STATS.warrior;
  const mult    = classId ? CLASS_STAT_MULT[classId]  : CLASS_STAT_MULT.warrior;
  const primary = classId ? CLASS_PRIMARY_STAT[classId] : 'corpo';

  const stats    = user.stats || { mente: 0, corpo: 0, cultura: 0, sfide: 0, sociale: 0 };
  const level    = calcLevel(user.xp || 0);
  const primStat = stats[primary] || 0;

  const hp = Math.max(10, Math.floor(
    base.hp + (stats.corpo || 0) * 1.5 + level * base.hpPerLevel + primStat * mult.hp
  ));

  const attack = Math.max(1, Math.floor(
    base.attack + primStat * mult.attack
  ));

  const defense = Math.max(1, Math.floor(
    base.defense + (stats.corpo || 0) * 0.6 + primStat * mult.defense
  ));

  const speed = Math.max(1, Math.floor(
    base.speed + (stats.sfide || 0) * 0.4 + primStat * mult.speed
  ));

  const mana = Math.max(0, Math.floor(
    base.mana + (stats.mente || 0) * 1.2 + primStat * mult.mana + level * base.manaPerLevel
  ));

  const luckRaw = base.luck + (stats.cultura || 0) * 0.08 + primStat * mult.luck;
  const luck    = Math.max(0, parseFloat(Math.min(luckRaw, 50).toFixed(2)));

  const equipment = DB.characterEquipment[userId] || [];
  const eqBonus   = calcEquipmentBonus(equipment);

  const eqAttackCapped = eqBonus.attack <= 50
    ? eqBonus.attack
    : 50 + Math.floor((eqBonus.attack - 50) * 0.5);

  return {
    hp:      hp      + eqBonus.hp,
    attack:  attack  + eqAttackCapped,
    defense: defense + eqBonus.defense,
    speed:   speed   + eqBonus.speed,
    mana:    mana    + eqBonus.mana,
    luck:    Math.min(luck + eqBonus.luck, 60),
    level,
    classId,
  };
}

// ── calcEquipmentBonus ────────────────────────────────────────
// UNA SOLA dichiarazione — esportata

export function calcEquipmentBonus(equipment = []) {
  const bonus = { hp: 0, attack: 0, defense: 0, speed: 0, mana: 0, luck: 0 };
  if (!equipment?.length) return bonus;

  for (const row of equipment) {
    if (!row) continue;
    const item = row.battle_items || row;
    if (!item) continue;

    const durability           = row.durability ?? item.durability ?? 100;
    const durabilityMultiplier = Math.max(0, Math.min(100, durability)) / 100;

    bonus.hp      += Math.floor((item.bonus_hp      || 0) * durabilityMultiplier);
    bonus.attack  += Math.floor((item.bonus_attack  || 0) * durabilityMultiplier);
    bonus.defense += Math.floor((item.bonus_defense || 0) * durabilityMultiplier);
    bonus.speed   += Math.floor((item.bonus_speed   || 0) * durabilityMultiplier);
    bonus.mana    += Math.floor((item.bonus_mana    || 0) * durabilityMultiplier);
    bonus.luck    += parseFloat(((item.bonus_luck_pct || 0) * durabilityMultiplier).toFixed(2));

    const str = item.bonus_strength     || 0;
    const int = item.bonus_intelligence || 0;
    const agi = item.bonus_agility      || 0;
    const vit = item.bonus_vitality     || 0;
    const spi = item.bonus_spirit       || 0;
    const cha = item.bonus_charisma     || 0;

    bonus.attack  += Math.floor((str * 1 + agi * 0.5 + int * 1) * durabilityMultiplier);
    bonus.hp      += Math.floor((str * 2 + vit * 5) * durabilityMultiplier);
    bonus.mana    += Math.floor((int * 3 + spi * 2) * durabilityMultiplier);
    bonus.defense += Math.floor(spi * 0.5 * durabilityMultiplier);
    bonus.speed   += Math.floor(agi * durabilityMultiplier);
    bonus.luck    += Math.floor(cha * durabilityMultiplier);
  }

  bonus.luck = Math.min(bonus.luck, 20);
  return bonus;
}

// ── calcPowerLevel ────────────────────────────────────────────

export function calcPowerLevel(userId) {
  const stats = calcBattleStats(userId);
  if (!stats) return 0;

  const level        = stats.level || 1;
  const bc           = DB.battleCharacters[userId];
  const enhancements = DB.itemEnhancements?.[userId] || [];
  const enhBonus     = enhancements.reduce((acc, e) => {
    acc.attack  += e.bonus_attack  || 0;
    acc.defense += e.bonus_defense || 0;
    acc.hp      += e.bonus_hp      || 0;
    return acc;
  }, { attack: 0, defense: 0, hp: 0 });

  const lp = Math.floor(
    level * 10
    + (stats.attack  + enhBonus.attack)  * 2
    + (stats.defense + enhBonus.defense) * 1.5
    + (stats.hp      + enhBonus.hp)      / 8
    + stats.speed * 1.5
    + stats.mana  / 4
  );

  const supportClasses = ['oracle','bard','high_priest','seer','singer','diplomat'];
  const supportBonus   = supportClasses.includes(bc?.class_id) ? 1.05 : 1.0;
  return Math.max(1, Math.floor(lp * supportBonus));
}

// ── syncBattleCharacter ───────────────────────────────────────

export async function syncBattleCharacter(userId) {
  try {
    const { data: existing, error } = await supabase
      .from('battle_characters').select('*').eq('user_id', userId).maybeSingle();

    if (error) { console.warn('[Battle] syncBattleCharacter error:', error.message); return; }

    if (!existing) {
      await _createBattleCharacter(userId);
    } else {
      DB.battleCharacters[userId] = existing;
      persist();
      await _updateDerivedStats(userId, existing);
    }

    await Promise.all([loadEquipment(userId), loadAbilities(userId), loadItems()]);
  } catch (e) {
    console.warn('[Battle] syncBattleCharacter failed:', e);
  }
}

async function _createBattleCharacter(userId) {
  const user = DB.users[userId];
  if (!user) return;

  const level = calcLevel(user.xp || 0);
  const newChar = {
    user_id: userId, class_id: null,
    hp_base: 100, hp_current: 100, attack: 10, defense: 5, speed: 5,
    mana_max: 50, mana_current: 50, luck_pct: 3.0,
    gold: PROGRESSION.startingGold,
    skill_points: Math.max(0, level - 1),
    reputation: 0, total_battles: 0, total_wins: 0,
  };

  const { data, error } = await supabase.from('battle_characters').insert(newChar).select().single();
  if (error) { console.warn('[Battle] _createBattleCharacter error:', error.message); return; }

  DB.battleCharacters[userId] = data;
  persist();
  await grantStarterItem(userId, data.id);
}

async function _updateDerivedStats(userId, bc) {
  if (!bc.class_id) return;
  const computed = calcBattleStats(userId);
  if (!computed) return;

  const patch = {
    hp_base: computed.hp, attack: computed.attack, defense: computed.defense,
    speed: computed.speed, mana_max: computed.mana, luck_pct: computed.luck,
    power_level: calcPowerLevel(userId), last_stats_sync: new Date().toISOString(),
  };

  await supabase.from('battle_characters').update(patch).eq('user_id', userId);
  DB.battleCharacters[userId] = { ...bc, ...patch };
  persist();
}

// ── chooseClass ───────────────────────────────────────────────

export async function chooseClass(userId, classId) {
  const user = DB.users[userId];
  if (!user) return { ok: false, error: 'Utente non trovato' };

  const level = calcLevel(user.xp || 0);
  if (level < PROGRESSION.UNLOCKS.classChoice)
    return { ok: false, error: `Raggiungi il livello ${PROGRESSION.UNLOCKS.classChoice}` };

  const bc = DB.battleCharacters[userId];
  if (!bc)          return { ok: false, error: 'Personaggio battle non trovato' };
  if (bc.class_id)  return { ok: false, error: 'Hai già scelto una classe' };

  const validClasses = ['warrior','mage','bard','shadow','oracle'];
  if (!validClasses.includes(classId)) return { ok: false, error: 'Classe non valida' };

  const { error } = await supabase.from('battle_characters').update({ class_id: classId }).eq('user_id', userId);
  if (error) return { ok: false, error: error.message };

  DB.battleCharacters[userId] = { ...bc, class_id: classId };
  persist();
  await _updateDerivedStats(userId, DB.battleCharacters[userId]);
  return { ok: true };
}

// ── getSkillPoints / unlockAbility ────────────────────────────

export function getSkillPoints(userId) {
  return DB.battleCharacters[userId]?.skill_points || 0;
}

export async function unlockAbility(userId, abilityId) {
  const bc = DB.battleCharacters[userId];
  if (!bc) return { ok: false, error: 'Personaggio non trovato' };

  const already = (DB.characterAbilities[userId] || []).find(a => a.ability_id === abilityId);
  if (already) return { ok: false, error: 'Abilità già sbloccata' };

  const ability = (DB.battleAbilities || []).find(a => a.id === abilityId);
  if (!ability) return { ok: false, error: 'Abilità non trovata' };

  const userLevel = calcLevel(DB.users[userId]?.xp || 0);
  if (userLevel < ability.min_char_level)
    return { ok: false, error: `Raggiungi il livello ${ability.min_char_level}` };

  if (bc.skill_points < ability.pa_cost)
    return { ok: false, error: `Servono ${ability.pa_cost} PA (ne hai ${bc.skill_points})` };

  if (ability.gold_cost > 0 && bc.gold < ability.gold_cost)
    return { ok: false, error: `Servono ${ability.gold_cost} Gold (ne hai ${bc.gold})` };

  const { error: abErr } = await supabase.from('character_abilities')
    .insert({ character_id: bc.id, ability_id: abilityId });
  if (abErr) return { ok: false, error: abErr.message };

  const newSp   = bc.skill_points - ability.pa_cost;
  const newGold = bc.gold - (ability.gold_cost || 0);
  await supabase.from('battle_characters').update({ skill_points: newSp, gold: newGold }).eq('id', bc.id);

  DB.battleCharacters[userId].skill_points = newSp;
  DB.battleCharacters[userId].gold         = newGold;
  if (!DB.characterAbilities[userId]) DB.characterAbilities[userId] = [];
  DB.characterAbilities[userId].push({ ability_id: abilityId, unlocked_at: new Date().toISOString() });
  persist();
  return { ok: true };
}

// ── updateGold ────────────────────────────────────────────────

export async function updateGold(userId, amount, source, referenceId = null) {
  const bc = DB.battleCharacters[userId];
  if (!bc) return { ok: false, error: 'Personaggio non trovato' };

  const newGold = (bc.gold || 0) + amount;
  if (newGold < 0) return { ok: false, error: 'Gold insufficienti' };

  const { error } = await supabase.from('battle_characters').update({ gold: newGold }).eq('id', bc.id);
  if (error) return { ok: false, error: error.message };

  supabase.from('gold_transactions').insert({
    character_id: bc.id, amount, source, reference_id: referenceId,
  }).then(({ error: txErr }) => {
    if (txErr) console.warn('[Battle] gold_transaction log failed:', txErr.message);
  });

  DB.battleCharacters[userId].gold = newGold;
  persist();
  return { ok: true, newGold };
}

// ── getDailyLimits / incrementDailyLimit ──────────────────────

export async function getDailyLimits(userId) {
  const bc = DB.battleCharacters[userId];
  if (!bc) return null;

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from('daily_limits')
    .select('*').eq('character_id', bc.id).eq('date', today).maybeSingle();

  if (error) {
    console.warn('[Battle] getDailyLimits:', error.message);
    return { pve_count: 0, pvp_count: 0, dungeon_count: 0, help_sent: 0 };
  }

  if (!data) {
    const { data: created } = await supabase.from('daily_limits')
      .upsert({ character_id: bc.id, date: today }, { onConflict: 'character_id,date' })
      .select().single();
    return created || { pve_count: 0, pvp_count: 0, dungeon_count: 0, help_sent: 0 };
  }
  return data;
}

export async function incrementDailyLimit(userId, field) {
  const bc = DB.battleCharacters[userId];
  if (!bc) return;

  const allowedFields = ['pve_count','pvp_count','dungeon_count','help_sent'];
  if (!allowedFields.includes(field)) {
    console.warn('[Battle] Campo daily limit non valido:', field); return;
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    const { error } = await supabase.rpc('increment_daily_limit',
      { p_character_id: bc.id, p_date: today, p_field: field });
    if (error) console.warn('[Battle] incrementDailyLimit RPC error:', error.message);
  } catch (err) {
    console.warn('[Battle] incrementDailyLimit failed:', err);
  }
}

// ── loadEquipment / loadAbilities / loadItems / loadEnemies ──

export async function loadEquipment(userId) {
  const bc = DB.battleCharacters[userId];
  if (!bc) return;

  const { data, error } = await supabase
    .from('character_equipment')
    .select(`id, slot, item_id, durability, equipped_at,
      battle_items (
        id, name, description, rarity, icon_path, class_id, class_restriction, level_req,
        bonus_attack, bonus_defense, bonus_hp, bonus_mana, bonus_speed, bonus_luck_pct,
        bonus_strength, bonus_intelligence, bonus_agility, bonus_vitality, bonus_spirit,
        bonus_charisma, bonus_luck, bonus_secondary, heal_pct, mana_restore_pct,
        damage_flat, absorb_pct
      )`)
    .eq('character_id', bc.id);

  if (error) { console.warn('[Battle] loadEquipment error:', error.message); return; }

  DB.characterEquipment[userId] = (data || []).filter(row => row.item_id && row.battle_items);
  persist();
}

export async function loadAbilities(userId) {
  const bc = DB.battleCharacters[userId];
  if (!bc) return;
  const { data, error } = await supabase.from('character_abilities').select('*').eq('character_id', bc.id);
  if (!error && data) { DB.characterAbilities[userId] = data; persist(); }
}

export async function loadBattleClasses() {
  if (DB.battleClasses?.length) return;
  const { data, error } = await supabase.from('battle_classes').select('*');
  if (!error && data) { DB.battleClasses = data; persist(); }
}

export async function loadBattleAbilities(classId = null) {
  let query = supabase.from('battle_abilities').select('*');
  if (classId) query = query.eq('class_id', classId);
  const { data, error } = await query;
  if (!error && data) { DB.battleAbilities = data; persist(); }
}

export async function loadItems() {
  if (DB.battleItems?.length) return;
  const { data, error } = await supabase.from('battle_items').select('*');
  if (!error && data) { DB.battleItems = data; persist(); }
}

export async function loadEnemies(tier = null) {
  let query = supabase.from('battle_enemies').select('*');
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

// ── grantStarterItem ──────────────────────────────────────────

async function grantStarterItem(userId, characterId) {
  const starterItems = (DB.battleItems || []).filter(i => i.rarity === 'uncommon' && i.slot === 'weapon');
  if (!starterItems.length) return;
  const item = starterItems[Math.floor(Math.random() * starterItems.length)];
  await supabase.from('inventory').insert({ character_id: characterId, item_id: item.id, quantity: 1, durability: 100 });
}

// ── helper pubblici ───────────────────────────────────────────

export function getBattleChar(userId) {
  return DB.battleCharacters?.[userId] || null;
}

export async function syncPowerLevel(userId) {
  const bc = DB.battleCharacters[userId];
  if (!bc) return;
  const lp = calcPowerLevel(userId);
  if (lp === bc.power_level) return;

  const { error } = await supabase.from('battle_characters').update({ power_level: lp }).eq('user_id', userId);
  if (error) { console.warn('[Battle] syncPowerLevel error:', error.message); return; }
  DB.battleCharacters[userId].power_level = lp;
  persist();
}

export function canAccessDungeon(userId, tier) {
  const level   = calcLevel(DB.users[userId]?.xp || 0);
  const dungeon = [null, { minLevel: 1 }, { minLevel: 10 }, { minLevel: 20 }, { minLevel: 35 }, { minLevel: 50 }][tier];
  if (!dungeon) return false;
  return level >= dungeon.minLevel && (tier - 1) <= PROGRESSION.dungeonLevelCap;
}
