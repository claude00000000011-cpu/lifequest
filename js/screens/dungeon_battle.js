// ============================================================
// dungeon_battle.js — Ponte tra il sistema dungeon e il sistema battle
// js/screens/dungeon_battle.js
// ============================================================

import { BOSS_DATA }         from '../battle/config.js';
import { renderBattleResult } from './dungeon_map.js';

/**
 * Avvia una battaglia per una stanza del dungeon.
 *
 * @param {HTMLElement} containerEl   — div dove renderizzare il risultato
 * @param {Object}      dungeon       — oggetto dungeon da WORLD_DUNGEONS
 * @param {Object}      room          — oggetto stanza
 * @param {Object}      player        — stato attuale del giocatore { level, hp, maxHp, attack, defense, ... }
 * @param {Function}    onContinue    — callback(dungeon, nextRoom) dopo vittoria
 * @param {Function}    onMap         — callback per tornare alla mappa
 */
export function startDungeonBattle(containerEl, dungeon, room, player, onContinue, onMap) {
  // Costruisce il nemico nel formato del sistema battle esistente
  const boss     = room.isBoss ? BOSS_DATA[room.bossId] : null;
  const enemy    = buildEnemy(room, boss);

  // ── INTERFACCIA VERSO IL TUO SISTEMA BATTLE ───────────────────────────────
  // Chiama qui il tuo sistema battle esistente.
  // Deve tornare una Promise<{ outcome: 'win'|'loss'|'flee', playerHpEnd: number }>
  //
  // Esempio con il pattern più comune dei battle system JS:
  //
  //   startExistingBattle({ player, enemy, onEnd: (result) => handleResult(result) });
  //
  // Se il tuo sistema usa callback invece di Promise, wrappalo:

  startExistingBattle(player, enemy)
    .then(({ outcome, playerHpEnd }) => {
      renderBattleResult(
        containerEl,
        dungeon,
        room,
        outcome,
        playerHpEnd,
        onContinue,
        onMap,
      );
    })
    .catch((err) => {
      console.error('[DungeonBattle] Errore battaglia:', err);
    });
}

// ─── COSTRUTTORE NEMICO ──────────────────────────────────────────────────────

function buildEnemy(room, bossData) {
  return {
    name:       room.enemyName,
    hp:         room.enemyHp,
    maxHp:      room.enemyMaxHp,
    attack:     room.enemyAttack,
    defense:    room.enemyDef,
    isBoss:     room.isBoss,
    bossId:     room.bossId,
    // meccanica boss — disponibile se il tuo sistema battle la legge
    bossAbility: bossData?.extraAbility ?? null,
    bossParams:  bossData ?? null,
    // loot (il sistema battle può usarli o ignorarli — li usa dungeon_map.js)
    goldDrop:   room.gold,
    xpDrop:     room.xp,
  };
}

// ─── STUB: sostituisci con la chiamata al tuo sistema reale ──────────────────

/**
 * Stub del sistema battle — sostituisci con la firma reale.
 * Deve ritornare Promise<{ outcome: 'win'|'loss'|'flee', playerHpEnd: number }>
 */
function startExistingBattle(player, enemy) {
  // ── RIMUOVI QUESTO STUB E COLLEGA IL TUO SISTEMA ──
  //
  // Esempi di come potrebbe essere strutturata la chiamata reale:
  //
  // A) Il tuo sistema ritorna già una Promise:
  //    return BattleSystem.start({ player, enemy });
  //
  // B) Il tuo sistema usa callback:
  //    return new Promise((resolve) => {
  //      BattleSystem.start(player, enemy, (result) => resolve(result));
  //    });
  //
  // C) Il tuo sistema cambia schermata e salva il risultato in localStorage:
  //    return new Promise((resolve) => {
  //      localStorage.setItem('pending_battle', JSON.stringify({ player, enemy }));
  //      switchScreen('battle');
  //      window.addEventListener('battle_end', (e) => resolve(e.detail), { once: true });
  //    });
  //
  // ─────────────────────────────────────────────────
  // STUB per test immediato (simula una battaglia):
  return new Promise((resolve) => {
    setTimeout(() => {
      const win = Math.random() > 0.35; // 65% di vincere (solo per test)
      resolve({
        outcome:    win ? 'win' : 'loss',
        playerHpEnd: win ? Math.round(player.maxHp * 0.6) : 0,
      });
    }, 800); // simula 0.8s di battaglia
  });
}
