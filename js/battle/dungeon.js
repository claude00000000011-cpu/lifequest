// ============================================================
// js/battle/dungeon.js — Gestione Dungeon LifeQuest
// Genera stanze, seleziona nemici, gestisce il flusso del dungeon.
// Salva lo stato di avanzamento su Supabase.
// ============================================================

import { supabase }                    from '../../supabase.js';
import { DB, CUR, persist }            from '../db.js';
import { DUNGEONS, COMBAT, PROGRESSION }from './config.js';
import { calcPveRewards, rollItemRarity }from './engine.js';
import { updateGold, getBattleChar,
         incrementDailyLimit,
         getDailyLimits,
         incrementFightStreak,
         calcStreakMultiplier }        from './character.js';
import { calcLevel }                   from '../xp.js';
import { awardXP }                     from '../xp.js';

// ── Cache sessione dungeon corrente ───────────────────────────
// (persiste in memoria durante la sessione, non su localStorage)
let _activeDungeon = null;

/**
 * Struttura di una sessione dungeon attiva:
 * {
 *   tier, config, rooms, currentRoom, totalRooms,
 *   bossRoom, goldEarned, itemsDropped, sessionId
 * }
 */

// ── Accesso al Dungeon ────────────────────────────────────────

/**
 * Controlla se l'utente può accedere al dungeon tier N.
 * @param {string} userId
 * @param {number} tier
 * @returns {{ canEnter: boolean, reason?: string }}
 */
export async function checkDungeonAccess(userId, tier) {
  const user  = DB.users[userId];
  if (!user) return { canEnter: false, reason: 'Utente non trovato' };

  const level = calcLevel(user.xp || 0);

  // Tier 1 e 2 disponibili in Fase B
  if (tier > 2) {
    return { canEnter: false, reason: `Il dungeon Tier ${tier} non è ancora disponibile.` };
  }

  const config = DUNGEONS[tier - 1];
  if (level < config.minLevel) {
    return { canEnter: false, reason: `Servono ${config.minLevel} livelli (sei ${level}).` };
  }

  // Cap dungeon: non più di PROGRESSION.dungeonLevelCap tier sopra il proprio livello
  const allowedMaxTier = Math.floor(level / 10) + 1 + PROGRESSION.dungeonLevelCap;
  if (tier > allowedMaxTier) {
    return { canEnter: false, reason: 'Questo dungeon è troppo avanzato per il tuo livello.' };
  }

  // Limite giornaliero
  const limits = await getDailyLimits(userId);
  if (limits && limits.dungeon_count >= COMBAT.dailyDungeonLimit) {
    return {
      canEnter: false,
      reason:   `Hai già completato ${COMBAT.dailyDungeonLimit} dungeon oggi. Torna domani!`,
    };
  }

  return { canEnter: true };
}

// ── Generazione Dungeon ───────────────────────────────────────

/**
 * Avvia una nuova sessione dungeon.
 * @param {string} userId
 * @param {number} tier  — 1 o 2 (Fase B)
 * @returns {{ ok: boolean, dungeon?, error? }}
 */
export async function startDungeon(userId, tier) {
  const access = await checkDungeonAccess(userId, tier);
  if (!access.canEnter) return { ok: false, error: access.reason };

  const config  = DUNGEONS[tier - 1];
  const level   = calcLevel(DB.users[userId]?.xp || 0);
  const bc      = getBattleChar(userId);
  if (!bc) return { ok: false, error: 'Personaggio battle non trovato. Ricarica la pagina.' };

  // Genera le stanze
  const rooms = generateRooms(tier, config, level);












         
  // Crea il record su Supabase
  const { data: session, error } = await supabase
    .from('dungeon_progress')
    .insert({
      character_id:  bc.id,
      dungeon_tier:  tier,
      session_date:  new Date().toISOString().slice(0, 10),
      rooms_cleared: 0,
      boss_defeated: false,
    })
    .select()
    .single();

  if (error) {
    console.warn('[Dungeon] startDungeon error:', error.message);
  }

  _activeDungeon = {
    tier,
    config,
    rooms,
    currentRoom:  0,
    totalRooms:   rooms.length,
    goldEarned:   0,
    itemsDropped: [],
    sessionId:    session?.id || null,
    userId,
  };

  return { ok: true, dungeon: _activeDungeonSummary() };
}

/**
 * Ricostruisce _activeDungeon da Supabase se la sessione esiste ancora.
 * Chiamare al resume dopo refresh/cambio tab.
 * @param {string} userId
 * @returns {{ ok: boolean, dungeon?, error? }}
 */
export async function resumeDungeon(userId) {
  const bc = getBattleChar(userId);
  if (!bc) return { ok: false, error: 'Personaggio non trovato' };

  // Cerca il massimo avanzamento per ogni tier
  const { data: progresses, error } = await supabase
    .from('user_dungeon_progress')
    .select('*')
    .eq('user_id', String(userId))
    .eq('completed', false)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error || !progresses?.length) return { ok: false, error: 'Nessuna sessione attiva trovata' };

  const progress = progresses[0];
  const tier     = parseInt(progress.dungeon_id.replace('tier_', ''));
  const config   = DUNGEONS[tier - 1];
  if (!config) return { ok: false, error: 'Dungeon non trovato' };

  const level        = calcLevel(DB.users[userId]?.xp || 0);
  const rooms        = generateRooms(tier, config, level);
  const roomsCleared = progress.max_room || 0;

  for (let i = 0; i < roomsCleared; i++) {
    if (rooms[i]) {
      rooms[i].cleared = true;
      rooms[i].enemies.forEach(e => e._defeated = true);
    }
  }

_activeDungeon = {
    tier,
    config,
    rooms,
    currentRoom:  roomsCleared,
    totalRooms:   rooms.length,
    goldEarned:   progress.total_gold || 0,
    itemsDropped: [],
    sessionId:    null,
    userId,
  };

  return { ok: true, dungeon: _activeDungeonSummary() };
}

/**
 * Genera la lista di stanze per un dungeon.
 * Struttura: [stanza1, stanza2, stanza3, boss]
 */
function generateRooms(tier, config, playerLevel) {
  const rooms = [];
  const normalRooms = config.normalRooms;
  // Stanze normali — roomIndex cresce per scalare i nemici
  for (let i = 0; i < normalRooms; i++) {
    const count = config.enemiesMin + Math.floor(
      Math.random() * (config.enemiesMax - config.enemiesMin + 1)
    );
    rooms.push({
      type:    'normal',
      index:   i + 1,
      enemies: selectEnemies(tier, false, count, playerLevel, i),
      cleared: false,
    });
  }
  // Stanza boss
  rooms.push({
    type:    'boss',
    index:   normalRooms + 1,
    enemies: selectEnemies(tier, true, 1, playerLevel, normalRooms),
    cleared: false,
  });
  return rooms;
}

/**
 * Seleziona i nemici per una stanza dal catalogo locale.
 */
function selectEnemies(tier, isBoss, count, playerLevel, roomIndex = 0) {
  const pool = (DB.battleEnemies || []).filter(
    e => e.tier === tier && e.is_boss === isBoss
  );

  if (!pool.length) {
    return Array(count).fill(null).map((_, i) =>
      generateProceduralEnemy(tier, isBoss, playerLevel, i, roomIndex)
    );
  }

  // Scala i nemici dal DB in base alla stanza
  const roomMult = 1 + roomIndex * 0.18; // +18% per stanza
  const selected = [];
  for (let i = 0; i < count; i++) {
    const base = { ...pool[Math.floor(Math.random() * pool.length)] };
    base.hp_base      = Math.round((base.hp_base      || 100) * roomMult);
    base.attack_base  = Math.round((base.attack_base  || 10)  * roomMult);
    base.defense_base = Math.round((base.defense_base || 5)   * roomMult);
    selected.push(base);
  }
  return selected;
}

/**
 * Genera un nemico procedurale quando il DB non è disponibile.
 * Usato solo come fallback.
 */
function generateProceduralEnemy(tier, isBoss, playerLevel, index, roomIndex = 0) {
 // Legge da DB.dungeonTiers invece che da DUNGEONS[] in config.js
  const config  = DB.dungeonTiers?.[tier];
  if (!config) {
    console.warn('[generateProceduralEnemy] dungeonTiers non caricato per tier:', tier);
    return null;
  }

  const scaling   = 1 + Math.max(0, playerLevel - config.min_level) * config.scaling_per_level;
  const roomMult  = 1 + roomIndex * 0.18;
  const bossMultH = isBoss ? config.boss_hp_mult  : 1;
  const bossMultA = isBoss ? config.boss_atk_mult : 1;

  // Speed varia per stanza e tier invece di essere sempre 5
  const speedBase = Math.max(4, 3 + tier + Math.floor(roomIndex * 0.5));

  return {
    id:                  `proc_t${tier}_${isBoss ? 'boss' : 'normal'}_r${roomIndex}_${index}`,
    name:                isBoss ? `Boss del Dungeon ${tier}` : `Nemico T${tier} (St.${roomIndex + 1})`,
    tier,
    is_boss:             isBoss,
    hp_base:             Math.floor(config.enemy_hp_base  * bossMultH * scaling * roomMult),
    attack_base:         Math.floor(config.enemy_atk_base * bossMultA * scaling * roomMult),
    defense_base:        Math.floor(config.enemy_def_base * scaling   * roomMult),
    speed_base:          speedBase,
    already_scaled:      true,
    gold_min:            Math.floor((isBoss ? config.gold_boss : config.gold_per_enemy) * roomMult),
    gold_max:            Math.floor((isBoss ? config.gold_boss : config.gold_per_enemy) * 2 * roomMult),
    drop_rate_pct:       isBoss ? config.drop_rate_boss * 100 : config.drop_rate_normal * 100,
    icon_path:           null,
    has_immunity:        isBoss,
    buff_chance_pct:     isBoss ? 20 : 0,
    phase2_hp_threshold: 40,   // era 50 — allineato a combat_config.phase2_threshold
    phase2_attack_bonus: 25,
  };



         
}

// ── Navigazione Stanze ────────────────────────────────────────

/**
 * Ritorna la stanza corrente del dungeon attivo.
 */
export function getCurrentRoom() {
  if (!_activeDungeon) return null;
  return _activeDungeon.rooms[_activeDungeon.currentRoom] || null;
}

/**
 * Ritorna il primo nemico vivo della stanza corrente.
 */
export function getCurrentEnemy() {
  const room = getCurrentRoom();
  if (!room) return null;
  return room.enemies.find(e => !e._defeated) || null;
}

/**
 * Segna un nemico come sconfitto e raccoglie le ricompense.
 * @param {string} userId
 * @param {Object} enemyData — dati nemico appena sconfitto
 * @returns {{ gold, itemRarity, isRoomCleared, isBoss }}
 */
export async function defeatEnemy(userId, enemyData) {
  if (!_activeDungeon) return null;

  const bc       = getBattleChar(userId);
  const stats    = DB.battleCharacters[userId];
  const luck     = stats?.luck_pct || 3;
  const tier     = _activeDungeon.tier;

  // Segna il nemico
  const room   = _activeDungeon.rooms[_activeDungeon.currentRoom];
  const target = room.enemies.find(e => e.id === enemyData.id && !e._defeated);
  if (target) target._defeated = true;

  // Streak e moltiplicatore gold
  const streak     = await incrementFightStreak(userId);
  console.log('[Dungeon] fight streak:', streak, 'userId:', userId);
  const streakMult = calcStreakMultiplier(streak);

  // Ricompense
  const rewards = calcPveRewards(enemyData, luck, tier, streakMult);
  _activeDungeon.goldEarned += rewards.gold;

  if (rewards.itemRarity) {
    _activeDungeon.itemsDropped.push({ rarity: rewards.itemRarity, enemyId: enemyData.id });
  }

  // Tutti i nemici della stanza sconfitti?
  const roomCleared = room.enemies.every(e => e._defeated);
  if (roomCleared) {
    room.cleared = true;
    const roomsCleared = _activeDungeon.currentRoom + 1;

    // Aggiorna dungeon_progress (storico)
    if (_activeDungeon.sessionId) {
      await supabase
        .from('dungeon_progress')
        .update({ rooms_cleared: roomsCleared })
        .eq('id', _activeDungeon.sessionId);
    }

// Aggiorna max_room in user_dungeon_progress
    const dungeonId = `tier_${_activeDungeon.tier}`;
    const userId_str = String(_activeDungeon.userId);
    console.log('[Dungeon] upsert user_dungeon_progress', { userId_str, dungeonId, roomsCleared });

    const { error: udpErr } = await supabase
      .from('user_dungeon_progress')
      .upsert({
        user_id:     userId_str,
        dungeon_id:  dungeonId,
        max_room:    roomsCleared,
        total_gold:  _activeDungeon.goldEarned,
        attempts:    1,
        updated_at:  new Date().toISOString(),
      }, {
        onConflict: 'user_id,dungeon_id',
        ignoreDuplicates: false,
      });
    if (udpErr) console.error('[Dungeon] user_dungeon_progress error:', udpErr.message);



           
  }

  return {
    gold:          rewards.gold,
    itemRarity:    rewards.itemRarity,
    isRoomCleared: roomCleared,
    isBoss:        enemyData.is_boss,
  };
}

/**
 * Avanza alla stanza successiva.
 * @returns {{ ok: boolean, nextRoom?, isDungeonComplete? }}
 */
export function advanceRoom() {
  if (!_activeDungeon) return { ok: false };

  const nextIndex = _activeDungeon.currentRoom + 1;

  if (nextIndex >= _activeDungeon.totalRooms) {
    // Dungeon completato!
    return { ok: true, isDungeonComplete: true };
  }

  _activeDungeon.currentRoom = nextIndex;
  return { ok: true, nextRoom: _activeDungeon.rooms[nextIndex], isDungeonComplete: false };
}

/**
 * Completa il dungeon e assegna le ricompense finali.
 * @param {string} userId
 * @returns {{ goldTotal, xpBonus, itemsDropped, ok }}
 */
export async function completeDungeon(userId) {
  if (!_activeDungeon) return { ok: false, error: 'Nessun dungeon attivo.' };

  const tier   = _activeDungeon.tier;
  const config = DUNGEONS[tier - 1];
  const bc     = getBattleChar(userId);

  // Bonus completamento
  const goldTotal = _activeDungeon.goldEarned + config.goldBonus;
  const xpBonus   = config.xpBonus;

  // Aggiorna Gold
  await updateGold(userId, goldTotal, 'dungeon', _activeDungeon.sessionId);

  // Assegna XP bonus
  await awardXP(xpBonus, 'sfide');

  // Salva completion su Supabase
  if (_activeDungeon.sessionId) {
    await supabase
      .from('dungeon_progress')
      .update({
        boss_defeated: true,
        rooms_cleared: _activeDungeon.totalRooms,
        gold_earned:   goldTotal,
        completed_at:  new Date().toISOString(),
      })
      .eq('id', _activeDungeon.sessionId);
  }

// Segna dungeon completato in user_dungeon_progress
  const dungeonId = `tier_${tier}`;
  await supabase
    .from('user_dungeon_progress')
    .upsert({
      user_id:      String(userId),
      dungeon_id:   dungeonId,
      max_room:     _activeDungeon.totalRooms,
      completed:    true,
      total_gold:   goldTotal,
      total_xp:     xpBonus,
      completed_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'user_id,dungeon_id' });

  // Incrementa contatore giornaliero
  await incrementDailyLimit(userId, 'dungeon_count');
  await incrementDailyLimit(userId, 'pve_count');

  const result = {
    ok:           true,
    goldTotal,
    xpBonus,
    itemsDropped: _activeDungeon.itemsDropped,
    tier,
  };

  _activeDungeon = null;
  return result;
}

/**
 * Abbandona il dungeon senza ricompense completamento.
 * Il Gold già racconto è perso (non salvato).
 */
export function abandonDungeon() {
  _activeDungeon = null;
}

// ── Storico ───────────────────────────────────────────────────

/**
 * Carica lo storico dei dungeon completati da Supabase.
 * @param {string} userId
 * @param {number} [limit]
 */
export async function loadDungeonHistory(userId, limit = 20) {
  const bc = getBattleChar(userId);
  if (!bc) return [];

  const { data, error } = await supabase
    .from('dungeon_progress')
    .select('*')
    .eq('character_id', bc.id)
    .eq('boss_defeated', true)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[Dungeon] loadDungeonHistory:', error.message);
    return [];
  }

  return data || [];
}

// ── Helper ────────────────────────────────────────────────────

function _activeDungeonSummary() {
  if (!_activeDungeon) return null;
  return {
    tier:        _activeDungeon.tier,
    totalRooms:  _activeDungeon.totalRooms,
    currentRoom: _activeDungeon.currentRoom,
    rooms:       _activeDungeon.rooms.map(r => ({
      type:    r.type,
      index:   r.index,
      cleared: r.cleared,
      enemies: r.enemies.map(e => ({ id: e.id, name: e.name, is_boss: e.is_boss })),
    })),
  };
}

export function getActiveDungeon() {
  return _activeDungeon ? _activeDungeonSummary() : null;
}
