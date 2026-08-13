// ============================================================
// js/battle/enhancement.js — Sistema Potenziamento Equipaggiamento
// Fabbro: unisce copie dello stesso item per salire di livello.
// ============================================================

import { supabase }          from '../../supabase.js';
import { DB, CUR, persist }  from '../db.js';
import { updateGold, syncPowerLevel } from './character.js';
// ── Costanti ─────────────────────────────────────────────────

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

// ── Helpers ───────────────────────────────────────────────────

function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function randFloat(min, max) {
  return parseFloat((min + Math.random() * (max - min)).toFixed(2));
}

// ── Carica config livelli da DB ───────────────────────────────

let _levelConfig = null;

async function getLevelConfig() {
  if (_levelConfig) return _levelConfig;

  const { data, error } = await supabase
    .from('enhancement_level_config')
    .select('*')
    .order('lvl', { ascending: true });

  if (error || !data) {
    console.warn('[Enhancement] getLevelConfig error:', error?.message);
    return [];
  }

  _levelConfig = data;
  return _levelConfig;
}

// ── Carica enhancement di un item ────────────────────────────

export async function getEnhancement(inventoryId) {
  if (!inventoryId) return null;

  const { data, error } = await supabase
    .from('item_enhancements')
    .select('*')
    .eq('inventory_id', inventoryId)
    .maybeSingle();

  if (error) {
    console.warn('[Enhancement] getEnhancement error:', error?.message);
    return null;
  }

  return data;
}

// ── Carica tutti gli enhancement del personaggio ──────────────

export async function loadEnhancements(userId) {
  const bc = DB.battleCharacters?.[userId];
  if (!bc) return;

  const { data, error } = await supabase
    .from('item_enhancements')
    .select('*')
    .eq('character_id', bc.id);

  if (error) {
    console.warn('[Enhancement] loadEnhancements error:', error?.message);
    return;
  }

  if (!DB.itemEnhancements) DB.itemEnhancements = {};
  DB.itemEnhancements[userId] = data || [];
  persist();
}

// ── Calcola costo potenziamento ───────────────────────────────

export async function calcEnhancementCost(inventoryId, userId) {
  const enh     = await getEnhancement(inventoryId);
  const currentLvl = enh?.enhancement_lvl || 1;
  const nextLvl    = currentLvl + 1;

  const config  = await getLevelConfig();
  const cfg     = config.find(c => c.lvl === currentLvl);
  if (!cfg) return null;

  const inv     = (DB.battleInventory?.[userId] || []).find(i => i.id === inventoryId);
  const item    = (DB.battleItems || []).find(i => i.id === inv?.item_id);
  if (!item) return null;

  const rarityKey = `gold_${item.rarity}`;
  const goldCost  = cfg[rarityKey] || 100;
  const copiesNeeded = cfg.copies_required || 0; // 0 = oltre lv10, solo gold

  return {
    currentLvl,
    nextLvl,
    goldCost,
    copiesNeeded,
    onlyGold: copiesNeeded === 0,
  };
}

// ── Controlla se il potenziamento è possibile ─────────────────

export async function canEnhance(inventoryId, userId) {
  const cost = await calcEnhancementCost(inventoryId, userId);
  if (!cost) return { canEnhance: false, reason: 'Configurazione non trovata' };

  const bc  = DB.battleCharacters?.[userId];
  if (!bc)  return { canEnhance: false, reason: 'Personaggio non trovato' };

  // Verifica gold
  if ((bc.gold || 0) < cost.goldCost) {
    return { canEnhance: false, reason: `Gold insufficienti (hai ${bc.gold}, servono ${cost.goldCost})` };
  }

  // Verifica copie (solo lv1-10)
  if (!cost.onlyGold) {
    const inv  = DB.battleInventory?.[userId] || [];
    const entry = inv.find(i => i.id === inventoryId);
    const item  = (DB.battleItems || []).find(i => i.id === entry?.item_id);
    if (!item) return { canEnhance: false, reason: 'Item non trovato' };

    // Conta copie dello stesso item (esclusa quella che stai potenziando)
    const copies = inv.filter(i =>
      i.item_id === entry.item_id && i.id !== inventoryId
    ).reduce((sum, i) => sum + (i.quantity || 1), 0);

    if (copies < cost.copiesNeeded) {
      return {
        canEnhance: false,
        reason: `Servono ${cost.copiesNeeded} copie di "${item.name}" (ne hai ${copies})`,
      };
    }
  }

  return { canEnhance: true, cost };
}

// ── Esegui il potenziamento ───────────────────────────────────

export async function enhanceItem(inventoryId, userId) {
  const check = await canEnhance(inventoryId, userId);
  if (!check.canEnhance) return { ok: false, error: check.reason };

  const { cost } = check;
  const bc = DB.battleCharacters[userId];

  // 1. Scala gold
  const goldResult = await updateGold(userId, -cost.goldCost, 'enhancement', inventoryId);
  if (!goldResult.ok) return { ok: false, error: goldResult.error };

  // 2. Consuma copie (solo lv1-10)
  if (!cost.onlyGold) {
    await _consumeCopies(inventoryId, userId, cost.copiesNeeded);
  }

  // 3. Calcola bonus casuali da aggiungere
  const config = await getLevelConfig();
  const cfg    = config.find(c => c.lvl === cost.currentLvl);
  const bonus  = _rollBonus(cfg);

  // 4. Upsert enhancement su Supabase
  const enh = await getEnhancement(inventoryId);

  let result;
  if (!enh) {
    // Prima volta: crea
    const { data, error } = await supabase
      .from('item_enhancements')
      .insert({
        inventory_id:   inventoryId,
        character_id:   bc.id,
        enhancement_lvl: 2,
        ...bonus,
      })
      .select()
      .single();

    if (error) return { ok: false, error: error.message };
    result = data;
  } else {
    // Aggiorna: somma i bonus esistenti
    const updated = {
      enhancement_lvl: enh.enhancement_lvl + 1,
      bonus_attack:    (enh.bonus_attack  || 0) + bonus.bonus_attack,
      bonus_defense:   (enh.bonus_defense || 0) + bonus.bonus_defense,
      bonus_hp:        (enh.bonus_hp      || 0) + bonus.bonus_hp,
      crit_rate:       parseFloat(((enh.crit_rate    || 0) + bonus.crit_rate).toFixed(2)),
      crit_damage:     parseFloat(((enh.crit_damage  || 0) + bonus.crit_damage).toFixed(2)),
      burn_chance:     parseFloat(((enh.burn_chance  || 0) + bonus.burn_chance).toFixed(2)),
      poison_chance:   parseFloat(((enh.poison_chance|| 0) + bonus.poison_chance).toFixed(2)),
      dot_damage:      (enh.dot_damage    || 0) + bonus.dot_damage,
      updated_at:      new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('item_enhancements')
      .update(updated)
      .eq('inventory_id', inventoryId)
      .select()
      .single();

    if (error) return { ok: false, error: error.message };
    result = data;
  }

  // 5. Aggiorna cache locale
  if (!DB.itemEnhancements) DB.itemEnhancements = {};
  if (!DB.itemEnhancements[userId]) DB.itemEnhancements[userId] = [];
  const idx = DB.itemEnhancements[userId].findIndex(e => e.inventory_id === inventoryId);
  if (idx >= 0) DB.itemEnhancements[userId][idx] = result;
  else DB.itemEnhancements[userId].push(result);
  persist();

  // 6. Aggiorna power level
  await syncPowerLevel(userId);

  return { ok: true, enhancement: result, bonus };
}

// ── Consuma copie dall'inventario ─────────────────────────────

async function _consumeCopies(inventoryId, userId, copiesNeeded) {
  const inv   = DB.battleInventory?.[userId] || [];
  const entry = inv.find(i => i.id === inventoryId);
  if (!entry) return;

  const bc    = DB.battleCharacters[userId];
  let toConsume = copiesNeeded;

  // Prendi copie dagli altri slot (non quello che stai potenziando)
  const copies = inv.filter(i =>
    i.item_id === entry.item_id && i.id !== inventoryId
  );

  for (const copy of copies) {
    if (toConsume <= 0) break;
    const qty = copy.quantity || 1;

    if (qty <= toConsume) {
      // Rimuovi completamente
      toConsume -= qty;
      DB.battleInventory[userId] = DB.battleInventory[userId].filter(i => i.id !== copy.id);
      await supabase.from('inventory').delete()
        .eq('character_id', bc.id)
        .eq('item_id', copy.item_id)
        .eq('id', copy.id);
    } else {
      // Riduci quantità
      copy.quantity -= toConsume;
      toConsume = 0;
      await supabase.from('inventory').update({ quantity: copy.quantity })
        .eq('id', copy.id);
    }
  }

  persist();
}

// ── Tira bonus casuali per il livello ────────────────────────

function _rollBonus(cfg) {
  if (!cfg) return {
    bonus_attack: 0, bonus_defense: 0, bonus_hp: 0,
    crit_rate: 0, crit_damage: 0, burn_chance: 0,
    poison_chance: 0, dot_damage: 0,
  };

  return {
    bonus_attack:  randInt(cfg.atk_min,     cfg.atk_max),
    bonus_defense: randInt(cfg.def_min,     cfg.def_max),
    bonus_hp:      randInt(cfg.hp_min,      cfg.hp_max),
    crit_rate:     randFloat(cfg.crit_rate_min,  cfg.crit_rate_max),
    crit_damage:   randFloat(cfg.crit_dmg_min,   cfg.crit_dmg_max),
    burn_chance:   randFloat(cfg.burn_min,       cfg.burn_max),
    poison_chance: randFloat(cfg.poison_min,     cfg.poison_max),
    dot_damage:    randInt(cfg.dot_min,     cfg.dot_max),
  };
}

// ── Helper pubblico: ottieni enhancement da cache ─────────────

export function getEnhancementFromCache(inventoryId, userId) {
  return (DB.itemEnhancements?.[userId] || [])
    .find(e => e.inventory_id === inventoryId) || null;
}

// ── Helper: stelle display ────────────────────────────────────

export function getStarDisplay(enhancementLvl = 1) {
  return `⭐${enhancementLvl}`;
}
