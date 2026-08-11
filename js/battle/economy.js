// ============================================================
// js/battle/economy.js — Economia Battle System LifeQuest
// Gold, casse loot con pity system, mercante, drop oggetti.
// ============================================================

import { supabase }                from '../../supabase.js';
import { DB, CUR, persist }        from '../db.js';
import { ECONOMY, PROGRESSION,
         EQUIPMENT_RARITIES }      from './config.js';
import { updateGold, getBattleChar,
         loadItems }               from './character.js';
import { rollItemRarity }          from './engine.js';
import { calcLevel }               from '../xp.js';
import { uid, today }              from '../utils.js';

// ── Cache locale mercante ─────────────────────────────────────
if (!DB.merchantSlots)    DB.merchantSlots    = [];
if (!DB.merchantLastRot)  DB.merchantLastRot  = null;
if (!DB.lootBoxHistory)   DB.lootBoxHistory   = {};  // { [boxType]: pityCount }

// ════════════════════════════════════════════════════════════
// LOOT BOXES
// ════════════════════════════════════════════════════════════

/**
 * Controlla se il giocatore può aprire una cassa del tipo indicato.
 * @param {string} userId
 * @param {'wood'|'iron'|'gold'|'mythic'} boxType
 * @returns {{ canOpen: boolean, reason?: string, cost: number }}
 */
export function canOpenBox(userId, boxType) {
  const boxCfg  = ECONOMY.LOOT_BOXES[boxType];
  if (!boxCfg) return { canOpen: false, reason: 'Cassa non valida', cost: 0 };

  const bc      = DB.battleCharacters[userId];
  if (!bc)      return { canOpen: false, reason: 'Personaggio non trovato', cost: 0 };

  // Sblocchi per livello
  const level   = calcLevel(DB.users[userId]?.xp || 0);
  if (boxType === 'gold'   && level < PROGRESSION.UNLOCKS.goldBoxes) {
    return { canOpen: false, reason: `Sblocca al livello ${PROGRESSION.UNLOCKS.goldBoxes}`, cost: boxCfg.cost };
  }
  if (boxType === 'mythic' && level < PROGRESSION.UNLOCKS.mythicBoxes) {
    return { canOpen: false, reason: `Sblocca al livello ${PROGRESSION.UNLOCKS.mythicBoxes}`, cost: boxCfg.cost };
  }

  if ((bc.gold || 0) < boxCfg.cost) {
    return { canOpen: false, reason: `Gold insufficienti (hai ${bc.gold}, servono ${boxCfg.cost})`, cost: boxCfg.cost };
  }

  return { canOpen: true, cost: boxCfg.cost };
}

/**
 * Apre una cassa loot, gestisce pity system e assegna l'oggetto.
 * @param {string} userId
 * @param {'wood'|'iron'|'gold'|'mythic'} boxType
 * @returns {{ ok: boolean, item?, rarity?, pityCount?, error? }}
 */
export async function openLootBox(userId, boxType) {
  const check = canOpenBox(userId, boxType);
  if (!check.canOpen) return { ok: false, error: check.reason };

  const bc     = getBattleChar(userId);
  const boxCfg = ECONOMY.LOOT_BOXES[boxType];
  const rates  = ECONOMY.BOX_RATES[boxType];

  // 1. Scala il Gold
  const goldResult = await updateGold(userId, -boxCfg.cost, 'loot_box', boxType);
  if (!goldResult.ok) return { ok: false, error: goldResult.error };

  // 2. Pity system: conta aperture precedenti senza la rarità target
  if (!DB.lootBoxHistory[userId])        DB.lootBoxHistory[userId] = {};
  if (!DB.lootBoxHistory[userId][boxType]) DB.lootBoxHistory[userId][boxType] = 0;

  const pityCount = DB.lootBoxHistory[userId][boxType];
  const pityTrigger = pityCount >= boxCfg.pity - 1; // -1 perché contiamo da 0

  // 3. Tira la rarità
  let rarity = pityTrigger
    ? boxCfg.rarityTarget
    : rollFromBoxRates(rates);

  // Se pity scatta, garantisce almeno la rarità target
  const rarityRank = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
  if (rarityRank[rarity] < rarityRank[boxCfg.rarityTarget]) {
    rarity = boxCfg.rarityTarget;
  }

  // 4. Aggiorna pity counter
  const hitTarget = rarityRank[rarity] >= rarityRank[boxCfg.rarityTarget];
  DB.lootBoxHistory[userId][boxType] = hitTarget ? 0 : pityCount + 1;
  persist();

  // 5. Seleziona un oggetto casuale della rarità ottenuta
  const item = selectRandomItemByRarity(rarity);

  // 6. Aggiungi all'inventario
  if (item) {
    await addToInventory(userId, bc.id, item.id);
  }

  // 7. Salva apertura su Supabase
  supabase.from('loot_boxes').insert({
    character_id:  bc.id,
    box_type:      boxType,
    item_obtained: item?.id || null,
    pity_counter:  DB.lootBoxHistory[userId][boxType],
  }).then(({ error }) => {
    if (error) console.warn('[Economy] loot_box log failed:', error.message);
  });

  return {
    ok:         true,
    item,
    rarity,
    pityCount:  DB.lootBoxHistory[userId][boxType],
    wasGold:    boxCfg.cost,
  };
}

/**
 * Tira una rarità secondo le probabilità della cassa.
 */
function rollFromBoxRates(rates) {
  const rand = Math.random();
  let cumulative = 0;
  // Ordine decrescente per favorire le rarità più basse per ultime
  const order = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
  // Costruiamo in ordine crescente di rarità per avere distribuzione corretta
  const entries = Object.entries(rates).filter(([, v]) => v > 0);
  for (const [rarity, prob] of entries) {
    cumulative += prob;
    if (rand < cumulative) return rarity;
  }
  return entries[0]?.[0] || 'uncommon';
}

/**
 * Seleziona un oggetto casuale dal catalogo locale filtrato per rarità.
 * Esclude consumabili (non droppano dalle casse).
 */
function selectRandomItemByRarity(rarity) {
  const pool = (DB.battleItems || []).filter(
    i => i.rarity === rarity && i.slot !== 'consumable'
  );
  if (!pool.length) {
    // Fallback: oggetto procedurale
    return generateProceduralItem(rarity);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Genera un oggetto procedurale quando il catalogo non ha quella rarità.
 */
function generateProceduralItem(rarity) {
  const rarCfg   = EQUIPMENT_RARITIES[rarity];
  const slots    = ['weapon', 'armor', 'helmet', 'accessory1', 'accessory2'];
  const slot     = slots[Math.floor(Math.random() * slots.length)];
  const rarNames = { common:'Comune', uncommon:'Non Comune', rare:'Raro',
                     epic:'Epico', legendary:'Leggendario', mythic:'Mitico' };

  return {
    id:          `proc_${rarity}_${Date.now()}`,
    name:        `Oggetto ${rarNames[rarity]} Misterioso`,
    description: 'Un oggetto dal potere sconosciuto.',
    slot,
    rarity,
    level_req:   1,
    bonus_attack:  rand(rarCfg.attackMin,  rarCfg.attackMax),
    bonus_defense: rand(rarCfg.defenseMin, rarCfg.defenseMax),
    bonus_hp:      rand(rarCfg.hpMin,      rarCfg.hpMax),
    bonus_mana:    0,
    bonus_speed:   0,
    bonus_luck_pct:0,
    bonus_secondary: [],
    icon_path:    null,
    _procedural:  true,
  };
}

function rand(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

// ════════════════════════════════════════════════════════════
// INVENTARIO
// ════════════════════════════════════════════════════════════

/**
 * Aggiunge un oggetto all'inventario del personaggio.
 * @param {string} userId
 * @param {string} characterId
 * @param {string} itemId
 * @param {number} [quantity]
 */
export async function addToInventory(userId, characterId, itemId, quantity = 1) {
  // Cache locale
  if (!DB.battleInventory) DB.battleInventory = {};
  if (!DB.battleInventory[userId]) DB.battleInventory[userId] = [];

  const existing = DB.battleInventory[userId].find(i => i.item_id === itemId && !i._equipped);
  if (existing) {
    existing.quantity = (existing.quantity || 1) + quantity;
  } else {
    DB.battleInventory[userId].push({
      id:           uid(),
      character_id: characterId,
      item_id:      itemId,
      quantity,
      durability:   100,
      obtained_at:  new Date().toISOString(),
    });
  }
  persist();

  // Sync Supabase
  const { error } = await supabase.from('inventory').insert({
    character_id: characterId,
    item_id:      itemId,
    quantity,
    durability:   100,
  });
  if (error) console.warn('[Economy] addToInventory error:', error.message);
}

/**
 * Carica l'inventario da Supabase.
 */
export async function loadInventory(userId) {
  const bc = getBattleChar(userId);
  if (!bc) return [];

  const { data, error } = await supabase
    .from('inventory')
    .select('*, items(*)')
    .eq('character_id', bc.id);

  if (error) {
    console.warn('[Economy] loadInventory error:', error.message);
    return DB.battleInventory?.[userId] || [];
  }

  if (!DB.battleInventory) DB.battleInventory = {};
  DB.battleInventory[userId] = data || [];
  persist();
  return data || [];
}

/**
 * Vende un oggetto al mercante (20% del valore stimato).
 */
export async function sellItem(userId, inventoryId) {
  if (!DB.battleInventory?.[userId]) return { ok: false, error: 'Inventario non trovato' };

  const inv   = DB.battleInventory[userId];
  const entry = inv.find(i => i.id === inventoryId);
  if (!entry) return { ok: false, error: 'Oggetto non trovato' };

  const item  = (DB.battleItems || []).find(i => i.id === entry.item_id);
  const rarValues = { common: 50, uncommon: 150, rare: 400, epic: 1000, legendary: 2500, mythic: 6000 };
  const baseVal   = rarValues[item?.rarity] || 50;
  const sellPrice = Math.floor(baseVal * ECONOMY.goldSellPct);

  // Rimuovi dall'inventario locale
  DB.battleInventory[userId] = inv.filter(i => i.id !== inventoryId);
  persist();

  // Aggiorna Gold
  const result = await updateGold(userId, sellPrice, 'sell', entry.item_id);
  if (!result.ok) return result;

  // Rimuovi da Supabase
  const bc = getBattleChar(userId);
  if (bc) {
    await supabase.from('inventory').delete()
      .eq('character_id', bc.id)
      .eq('item_id', entry.item_id)
      .limit(1);
  }

  return { ok: true, goldEarned: sellPrice };
}

// ════════════════════════════════════════════════════════════
// MERCANTE
// ════════════════════════════════════════════════════════════

/**
 * Restituisce gli slot del mercante, rigenerando se passate 24h.
 * @returns {Array} slot mercante (6 oggetti)
 */
export async function getMerchantSlots() {
  const lastRot = DB.merchantLastRot;
  const now     = Date.now();
  const rotMs   = ECONOMY.MERCHANT.rotationHours * 3_600_000;

  if (!lastRot || (now - lastRot) >= rotMs || !DB.merchantSlots.length) {
    await rotateMerchant();
  }

  return DB.merchantSlots;
}

/**
 * Rigenera il catalogo del mercante.
 * Composizione: 4 consumabili fissi + 2 oggetti rari a rotazione.
 */
async function rotateMerchant() {
  await loadItems();

  const M = ECONOMY.MERCHANT;

  // Consumabili sempre disponibili
  const fixedSlots = [
    buildMerchantSlot('potion_heal_small',  M.priceHealSmall),
    buildMerchantSlot('potion_heal_medium', M.priceHealMedium),
    buildMerchantSlot('tonic_mana_small',   M.priceManaSmall),
    buildMerchantSlot('bomb_aoe',           M.priceBombAoe),
  ];

  // 2 oggetti rari/epici casuali
  const rarPool = (DB.battleItems || []).filter(
    i => ['rare', 'epic'].includes(i.rarity) && i.slot !== 'consumable'
  );
  const picked = shuffle([...rarPool]).slice(0, 2);
  const rareSlots = picked.map(item => {
    const rarBase = { rare: 400, epic: 1000 };
    const price   = Math.floor((rarBase[item.rarity] || 400) * M.rareItemMarkup);
    return buildMerchantSlot(item.id, price, item);
  });

  // Oggetto gratuito dell'Oracolo (richiede una quest specifica)
  const freePool = (DB.battleItems || []).filter(i => i.rarity === 'uncommon');
  const freeItem = freePool.length
    ? freePool[Math.floor(Math.random() * freePool.length)]
    : null;

  DB.merchantSlots   = [...fixedSlots, ...rareSlots];
  DB.merchantFreeItem = freeItem;
  DB.merchantLastRot  = Date.now();
  persist();
}

function buildMerchantSlot(itemId, price, itemData = null) {
  const item = itemData || (DB.battleItems || []).find(i => i.id === itemId);
  return { itemId, price, item };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Acquista un oggetto dal mercante.
 * @param {string} userId
 * @param {string} itemId
 * @returns {{ ok: boolean, item?, error? }}
 */
export async function buyFromMerchant(userId, itemId) {
  const slots = await getMerchantSlots();
  const slot  = slots.find(s => s.itemId === itemId);
  if (!slot) return { ok: false, error: 'Oggetto non disponibile dal mercante' };

  const bc = getBattleChar(userId);
  if (!bc) return { ok: false, error: 'Personaggio non trovato' };

  if ((bc.gold || 0) < slot.price) {
    return { ok: false, error: `Gold insufficienti (hai ${bc.gold}, prezzo ${slot.price})` };
  }

  const goldResult = await updateGold(userId, -slot.price, 'merchant', itemId);
  if (!goldResult.ok) return goldResult;

  await addToInventory(userId, bc.id, itemId);

  return { ok: true, item: slot.item, goldSpent: slot.price };
}

/**
 * Ritira l'oggetto gratuito dell'Oracolo (1 al giorno).
 */
export async function claimOracleFreeItem(userId) {
  const key = `oracleFreeClaimed_${today()}`;
  if (DB[key]?.[userId]) return { ok: false, error: 'Hai già ritirato l\'oggetto di oggi.' };

  const item = DB.merchantFreeItem;
  if (!item) return { ok: false, error: 'Nessun oggetto disponibile oggi.' };

  const bc = getBattleChar(userId);
  if (!bc) return { ok: false, error: 'Personaggio non trovato' };

  await addToInventory(userId, bc.id, item.id);

  if (!DB[key]) DB[key] = {};
  DB[key][userId] = true;
  persist();

  return { ok: true, item };
}

// ════════════════════════════════════════════════════════════
// FABBRO — Riparazione e Potenziamento
// ════════════════════════════════════════════════════════════

/**
 * Ripara un oggetto nell'equipaggiamento o nell'inventario.
 * @param {string} userId
 * @param {string} inventoryId
 */
export async function repairItem(userId, inventoryId) {
  const { SMITH } = await import('./config.js');
  const inv   = DB.battleInventory?.[userId] || [];
  const entry = inv.find(i => i.id === inventoryId);
  if (!entry) return { ok: false, error: 'Oggetto non trovato' };

  const item  = (DB.battleItems || []).find(i => i.id === entry.item_id);
  if (!item)  return { ok: false, error: 'Dati oggetto non trovati' };

  const { EQUIPMENT_DEGRADATION } = await import('./config.js');
  const cost = EQUIPMENT_DEGRADATION.repairCost[item.rarity] || 50;

  const bc = getBattleChar(userId);
  if ((bc?.gold || 0) < cost) {
    return { ok: false, error: `Servono ${cost} Gold per la riparazione` };
  }

  await updateGold(userId, -cost, 'repair', inventoryId);

  // Ripristina durabilità
  entry.durability = 100;
  persist();

  // Sync Supabase
  if (bc) {
    await supabase.from('inventory')
      .update({ durability: 100 })
      .eq('character_id', bc.id)
      .eq('item_id', entry.item_id);
  }

  return { ok: true, goldSpent: cost };
}

/**
 * Degrada la durabilità degli oggetti equipaggiati dopo N combattimenti.
 * Da chiamare ogni EQUIPMENT_DEGRADATION.combatsPerTick battaglie.
 * @param {string} userId
 */
export async function tickEquipmentDurability(userId) {
  const { EQUIPMENT_DEGRADATION } = await import('./config.js');
  const bc  = getBattleChar(userId);
  if (!bc)  return;

  const equip = DB.characterEquipment?.[userId] || [];
  if (!equip.length) return;

  for (const slot of equip) {
    if (!slot.item_id) continue;
    const newDur = Math.max(
      EQUIPMENT_DEGRADATION.minDurability,
      (slot.durability ?? 100) - 10
    );
    slot.durability = newDur;

    await supabase.from('character_equipment')
      .update({ durability: newDur })
      .eq('character_id', bc.id)
      .eq('slot', slot.slot);
  }
  persist();
}

// ════════════════════════════════════════════════════════════
// DROP DA BATTAGLIA (usato da dungeon.js + pvp_battle.js)
// ════════════════════════════════════════════════════════════

/**
 * Gestisce il drop effettivo di un oggetto dopo una battaglia,
 * lo aggiunge all'inventario e ritorna i dati per la UI.
 * @param {string} userId
 * @param {string} rarity
 * @returns {{ ok: boolean, item? }}
 */
export async function processDrop(userId, rarity) {
  if (!rarity) return { ok: false };

  await loadItems();

  const item = selectRandomItemByRarity(rarity);
  if (!item) return { ok: false };

  const bc = getBattleChar(userId);
  if (!bc)  return { ok: false };

  await addToInventory(userId, bc.id, item.id);
  return { ok: true, item };
}

// ════════════════════════════════════════════════════════════
// RIEPILOGO ECONOMIA GIORNALIERA
// ════════════════════════════════════════════════════════════

/**
 * Restituisce un riepilogo dell'economia giornaliera dell'utente.
 * Usato dalla UI del Villaggio per mostrare le statistiche.
 * @param {string} userId
 */
export async function getDailyEconomySummary(userId) {
  const bc = getBattleChar(userId);
  if (!bc) return null;

  const todayStr = today();

  const { data, error } = await supabase
    .from('gold_transactions')
    .select('amount, source')
    .eq('character_id', bc.id)
    .gte('created_at', `${todayStr}T00:00:00`);

  if (error) {
    console.warn('[Economy] getDailyEconomySummary:', error.message);
    return null;
  }

  const earned = (data || []).filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const spent  = (data || []).filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return {
    totalGold:    bc.gold || 0,
    earnedToday:  earned,
    spentToday:   spent,
    targetDaily:  ECONOMY.targetDailyGold,
    progressPct:  Math.min(100, Math.round((earned / ECONOMY.targetDailyGold) * 100)),
  };
}
