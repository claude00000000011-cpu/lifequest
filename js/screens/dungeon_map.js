// ============================================================
// dungeon_map.js — Mappa mondiale, unlock, dettaglio stanze
// js/screens/dungeon_map.js
// ============================================================

import { _buildRooms, WORLD_DUNGEONS } from '../battle/config.js';
import { supabase }                    from '../../supabase.js';
import { CUR }                         from '../db.js';

// ─── STORAGE ─────────────────────────────────────────────────────────────────

// Cache locale per evitare troppe query
let _progressCache = null;

async function loadProgress() {
  if (_progressCache) return _progressCache;
  if (!CUR?.id) return {};
  const { data, error } = await supabase
    .from('user_dungeon_progress')
    .select('*')
    .eq('user_id', CUR.id);
  if (error || !data) return {};
  const progress = {};
  data.forEach(row => {
    progress[row.dungeon_id] = {
      maxRoom:     row.max_room   || 0,
      completed:   row.completed  || false,
      totalGold:   row.total_gold || 0,
      totalXp:     row.total_xp   || 0,
      completedAt: row.completed_at || null,
    };
  });
  _progressCache = progress;
  return progress;
}

async function saveProgress(dungeonId, state) {
  if (!CUR?.id) return;
  _progressCache = null; // invalida cache
  await supabase
    .from('user_dungeon_progress')
    .upsert({
      user_id:      CUR.id,
      dungeon_id:   dungeonId,
      max_room:     state.maxRoom,
      completed:    state.completed,
      total_gold:   state.totalGold,
      total_xp:     state.totalXp,
      completed_at: state.completedAt ? new Date(state.completedAt).toISOString() : null,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'user_id,dungeon_id' });
}

// ─── LOGICA UNLOCK ───────────────────────────────────────────────────────────

/**
 * Ritorna lo stato di un singolo dungeon per l'utente corrente.
 * { maxRoom: number, completed: boolean, totalGold: number, totalXp: number }
 */
export async function getDungeonState(dungeonId) {
  const progress = await loadProgress();
  return progress[dungeonId] || { maxRoom: 0, completed: false, totalGold: 0, totalXp: 0 };
}

/**
 * Controlla se il dungeon all'indice `i` è sbloccato.
 * Condizioni: primo dungeon sempre aperto, altrimenti il precedente deve essere completato
 * E il giocatore deve avere il livello richiesto.
 */
export async function isUnlocked(dungeonIndex, playerLevel) {
  const dungeon = WORLD_DUNGEONS[dungeonIndex];
  if (!dungeon) return false;
  if (playerLevel < dungeon.requiredLevel) return false;
  if (dungeonIndex === 0) return true;
  const prevId = WORLD_DUNGEONS[dungeonIndex - 1].id;
  const prev   = await getDungeonState(prevId);
  return prev.completed === true;
}

/**
 * Segna una stanza come completata e aggiorna il progresso.
 * Chiamare questa funzione DOPO ogni vittoria in battaglia.
 */
export async function markRoomComplete(dungeonId, roomNumber, goldEarned, xpEarned) {
  const progress = await loadProgress();
  const current  = progress[dungeonId] || { maxRoom: 0, completed: false, totalGold: 0, totalXp: 0 };

  current.maxRoom   = Math.max(current.maxRoom, roomNumber);
  current.totalGold = (current.totalGold || 0) + goldEarned;
  current.totalXp   = (current.totalXp  || 0) + xpEarned;

  if (roomNumber === 10 && !current.completed) {
    current.completed   = true;
    current.completedAt = Date.now();
  }

  await saveProgress(dungeonId, current);
  return current;
}

// ─── RENDER: MAPPA PRINCIPALE ────────────────────────────────────────────────

/**
 * Renderizza la mappa con i marker cliccabili.
 * @param {HTMLElement} containerEl  — il div dove disegnare
 * @param {number}      playerLevel  — livello attuale del giocatore
 * @param {Function}    onEnter      — callback(dungeon, state) quando il giocatore clicca un dungeon
 */
export async function renderDungeonMap(containerEl, playerLevel, onEnter) {
  const progress = await loadProgress();

  containerEl.innerHTML = `
    <div class="dm-map-wrap">
      <h2 class="dm-map-title">🗺️ Mappa del Mondo</h2>
      <div class="dm-map-inner">
        <img src="assets/dungeon_map.png" class="dm-map-bg" alt="Mappa del Mondo" />
        <div class="dm-markers" id="dm-markers"></div>
      </div>
      <div class="dm-legend">
        <span class="dm-legend-item unlocked">● Aperto</span>
        <span class="dm-legend-item locked">● Bloccato</span>
        <span class="dm-legend-item completed">● Completato</span>
      </div>
    </div>
  `;

  const markersEl = containerEl.querySelector('#dm-markers');

  for (let i = 0; i < WORLD_DUNGEONS.length; i++) {
    const dungeon  = WORLD_DUNGEONS[i];
    const unlocked = await isUnlocked(i, playerLevel);
    const state    = progress[dungeon.id] || { maxRoom: 0, completed: false };

    const btn = document.createElement('button');
    btn.className = [
      'dm-marker',
      unlocked        ? 'unlocked'  : 'locked',
      state.completed ? 'completed' : '',
    ].join(' ').trim();

    btn.style.left = `${dungeon.mapX * 100}%`;
    btn.style.top  = `${dungeon.mapY * 100}%`;

    btn.setAttribute('title', unlocked
      ? `${dungeon.name}\nStanza ${state.maxRoom}/10 · Lv ${dungeon.requiredLevel} richiesto`
      : `🔒 ${dungeon.name}\n${
          playerLevel < dungeon.requiredLevel
            ? `Richiede Lv ${dungeon.requiredLevel} (sei Lv ${playerLevel})`
            : 'Completa il dungeon precedente'
        }`
    );

    btn.innerHTML = `
      <span class="dm-num">${i + 1}</span>
      ${state.completed ? '<span class="dm-check">✓</span>' : ''}
      ${state.maxRoom > 0 && !state.completed ? `<span class="dm-progress">${state.maxRoom}/10</span>` : ''}
    `;

    if (unlocked) {
      btn.addEventListener('click', () => onEnter(dungeon, state));
    } else {
      btn.disabled = true;
    }

    markersEl.appendChild(btn);
  }
}

// ─── RENDER: DETTAGLIO DUNGEON (lista stanze) ─────────────────────────────────

/**
 * Renderizza la schermata con le 10 stanze di un dungeon.
 * @param {HTMLElement} containerEl
 * @param {Object}      dungeon       — oggetto da WORLD_DUNGEONS
 * @param {number}      playerLevel
 * @param {Function}    onStartRoom   — callback(dungeon, room) per avviare la battaglia
 * @param {Function}    onBack        — callback per tornare alla mappa
 */
export async function renderDungeonDetail(containerEl, dungeon, playerLevel, onStartRoom, onBack) {
  const state = await getDungeonState(dungeon.id);

  containerEl.innerHTML = `
    <div class="dm-detail">
      <div class="dm-detail-header">
        <button class="dm-btn-back" id="dm-back">← Mappa</button>
        <div class="dm-detail-info">
          <h2 class="dm-detail-title">${dungeon.name}</h2>
          <p class="dm-detail-desc">${dungeon.description}</p>
          <div class="dm-detail-meta">
            <span>📊 Lv richiesto: <b>${dungeon.requiredLevel}</b></span>
            <span>🏆 Stanza raggiunta: <b>${state.maxRoom}/10</b></span>
            <span>💰 Gold totale: <b>${(state.totalGold || 0).toLocaleString()}</b></span>
            <span>✨ XP totale: <b>${(state.totalXp  || 0).toLocaleString()}</b></span>
          </div>
        </div>
      </div>
      <div class="dm-room-grid" id="dm-room-grid"></div>
    </div>
  `;

  containerEl.querySelector('#dm-back').addEventListener('click', onBack);

  const grid = containerEl.querySelector('#dm-room-grid');

  dungeon.rooms.forEach((room) => {
    const done      = state.maxRoom >= room.room;
    const available = room.room === 1 || state.maxRoom >= room.room - 1;
    const locked    = !available;

    const card = document.createElement('div');
    card.className = [
      'dm-room-card',
      done        ? 'done'  : '',
      locked      ? 'locked': '',
      room.isBoss ? 'boss'  : '',
    ].join(' ').trim();

    card.innerHTML = `
      <div class="dm-room-header">
        ${room.isBoss
          ? '<span class="dm-room-label boss-label">👑 Boss</span>'
          : `<span class="dm-room-label">Stanza ${room.room}</span>`
        }
        ${done   ? '<span class="dm-room-done">✓</span>'  : ''}
        ${locked ? '<span class="dm-room-lock">🔒</span>' : ''}
      </div>
      <div class="dm-room-enemy">${room.enemyName}</div>
      <div class="dm-room-hp">❤️ ${room.enemyHp.toLocaleString()} HP</div>
      <div class="dm-room-rewards">
        <span>💰 ${room.gold}g</span>
        <span>✨ ${room.xp} XP</span>
      </div>
      ${!locked && !done ? '<button class="dm-btn-enter">⚔️ Entra</button>' : ''}
      ${done && room.room < 10 ? '<button class="dm-btn-replay">🔁 Rifai</button>' : ''}
    `;

    if (!locked) {
      const enterBtn  = card.querySelector('.dm-btn-enter');
      const replayBtn = card.querySelector('.dm-btn-replay');
      if (enterBtn)  enterBtn .addEventListener('click', () => onStartRoom(dungeon, room));
      if (replayBtn) replayBtn.addEventListener('click', () => onStartRoom(dungeon, room));
    }

    grid.appendChild(card);
  });
}

// ─── RENDER: RISULTATO BATTAGLIA ─────────────────────────────────────────────

/**
 * Schermata di risultato dopo una stanza.
 * @param {HTMLElement} containerEl
 * @param {Object}  dungeon
 * @param {Object}  room          — stanza appena combattuta
 * @param {string}  outcome       — 'win' | 'loss' | 'flee'
 * @param {number}  playerHpEnd   — HP residui del giocatore
 * @param {Function} onContinue   — vai alla prossima stanza
 * @param {Function} onMap        — torna alla mappa
 */
export async function renderBattleResult(containerEl, dungeon, room, outcome, playerHpEnd, onContinue, onMap) {
  let goldEarned = 0;
  let xpEarned   = 0;

  if (outcome === 'win') {
    goldEarned = room.gold;
    xpEarned   = room.xp;
    await markRoomComplete(dungeon.id, room.room, goldEarned, xpEarned);
  }

  const isLastRoom  = room.room === 10;
  const nextRoomNum = room.room + 1;
  const nextRoom    = dungeon.rooms[nextRoomNum - 1];

  const winMsg = isLastRoom
    ? `🏆 Dungeon completato! Il prossimo dungeon è ora sbloccato.`
    : `Prossima stanza: ${nextRoom?.enemyName} — ❤️ ${nextRoom?.enemyHp.toLocaleString()} HP`;

  containerEl.innerHTML = `
    <div class="dm-result ${outcome}">
      <div class="dm-result-icon">
        ${{ win: '🎉', loss: '💀', flee: '🏃' }[outcome]}
      </div>
      <h2 class="dm-result-title">
        ${{ win: 'Vittoria!', loss: 'Sconfitta', flee: 'Fuggito' }[outcome]}
      </h2>
      <div class="dm-result-room">
        ${dungeon.name} — ${room.isBoss ? '👑 Boss' : `Stanza ${room.room}`}
      </div>

      ${outcome === 'win' ? `
        <div class="dm-result-rewards">
          <div class="dm-reward-item">💰 +${goldEarned} Gold</div>
          <div class="dm-reward-item">✨ +${xpEarned} XP</div>
        </div>
        <p class="dm-result-next">${winMsg}</p>
      ` : `
        <p class="dm-result-msg">
          ${outcome === 'loss' ? 'Sei stato sconfitto. Allenati e riprova!' : 'Hai abbandonato la battaglia.'}
        </p>
      `}

      <div class="dm-result-actions">
        ${outcome === 'win' && !isLastRoom
          ? `<button class="dm-btn-primary" id="dm-continue">⚔️ Stanza ${nextRoomNum}</button>`
          : ''
        }
        <button class="dm-btn-secondary" id="dm-to-map">🗺️ Torna alla Mappa</button>
        ${outcome !== 'win'
          ? `<button class="dm-btn-primary" id="dm-retry">🔁 Riprova</button>`
          : ''
        }
      </div>
    </div>
  `;

  containerEl.querySelector('#dm-to-map')?.addEventListener('click', onMap);
  containerEl.querySelector('#dm-continue')?.addEventListener('click', () => onContinue(dungeon, nextRoom));
  containerEl.querySelector('#dm-retry')?.addEventListener('click', () => onContinue(dungeon, room));
}
