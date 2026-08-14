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
  return new Promise((resolve) => {
    // Registra il callback — _showEndOverlay lo chiamerà dopo la battaglia
    window._storyBattleResolve = (outcome, playerHpEnd) => {
      window._storyBattleResolve = null;
      resolve({ outcome, playerHpEnd });
    };
    // Porta il giocatore alla schermata battaglia
    import('./battle_screen.js').then(m => {
      m.renderBattleScreen?.(enemy, {
        dungeon: false,      // non usa il sistema dungeon giornalieri
        storyMode: true,     // flag per identificare modalità Storia
      });
    });
    // Porta il focus sulla schermata battaglia
    window._gotoTab?.('battle');
  });
}
