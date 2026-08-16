// ============================================================
// js/screens/battle_screen.js — UI Combattimento
// Layout verticale: Nemico 40% | Log 20% | Azioni 40%
// ============================================================


import { CUR, DB, persist }    from '../db.js';
import { supabase } from '../../supabase.js';
import { escHtml, toast }       from '../utils.js';
import { playSound, playSoundDucked } from '../audio.js';
import { calcBattleStats, getBattleChar, getDailyLimits,
         incrementDailyLimit, updateGold } from '../battle/character.js';
import { initBattle, processPlayerAction, calcPveRewards } from '../battle/engine.js';
import { awardXP }              from '../xp.js';
import { COMBAT, DUNGEONS }     from '../battle/config.js';
import { advanceRoom, completeDungeon,
         defeatEnemy, getCurrentEnemy } from '../battle/dungeon.js';






let _battleState = null;
let _enemyData   = null;
let _dungeonCtx  = null;
let _animLock    = false;
let _summonData  = null;  // dati alleato evocato




const _sleep = ms => new Promise(r => setTimeout(r, ms));
function _lockNav(lock) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.disabled = lock;
    btn.style.opacity = lock ? '0.4' : '';
    btn.style.pointerEvents = lock ? 'none' : '';
  });
}


// Navigazione verso il villaggio (usata da overlay fine battaglia)
window._gotoVillage = function() {
  _lockNav(false);
  import('./village.js').then(m => m.renderVillage());
};
// ── Entry point ───────────────────────────────────────────────

export async function renderBattleScreen(enemyData, dungeonCtx = {}) {
  if (!CUR) return;
  _enemyData  = enemyData;
_lockNav(true);
  _dungeonCtx = dungeonCtx;

  const container = document.getElementById('screen-battle');
  if (!container) return;

  container.innerHTML = `<div class="battle-loading">Preparazione battaglia…</div>`;

  // Verifica limiti giornalieri
  const limits = await getDailyLimits(CUR.id);
  if ((limits?.pve_count || 0) >= COMBAT.dailyPveLimit) {
    container.innerHTML = `
      <div class="battle-gate card-section" style="text-align:center;padding:3rem 1rem">
        <div style="font-size:2.5rem">⏰</div>
        <h3>Limite giornaliero raggiunto</h3>
        <p style="color:var(--text-2)">Hai completato ${COMBAT.dailyPveLimit} combattimenti PvE oggi. Torna domani!</p>
        <button class="btn-secondary" style="margin-top:1rem" onclick="window._gotoVillage?.()">← Villaggio</button>
      </div>`;
    return;
  }

  if (!DB.combatConfig) {
     const { supabase: sb } = await import('../../supabase.js');
    const { data: ccData } = await sb
      .from('combat_config')
      .select('*');
    if (ccData) {
      DB.combatConfig = Object.fromEntries(ccData.map(r => [r.key, Number(r.value)]));
      persist();
    }
  }
  const stats = calcBattleStats(CUR.id);
  if (!stats) {
    container.innerHTML = `<p class="battle-error">Statistiche non disponibili. Ricarica la pagina.</p>`;
    return;
  }

  // Carica alleato evocato se presente
  _summonData = null;
  const { supabase } = await import('../../supabase.js');
  const { data: summon } = await supabase
    .from('active_summons')
    .select('*, bc:battle_characters!active_summons_summoned_bc_id_fkey(*)')
    .eq('summoner_id', CUR.id)
    .eq('status', 'active')
    .maybeSingle();

  if (summon?.bc) {
    _summonData = {
      id:       summon.id,
      bcId:     summon.summoned_bc_id,
      hp:       summon.hp_current,
      hpMax:    summon.hp_max,
      attack:   summon.bc.attack  || 10,
      defense:  summon.bc.defense || 5,
      speed:    summon.bc.speed   || 5,
      class_id: summon.bc.class_id || 'warrior',
      isDead:   false,
    };
  }

   _battleState = initBattle(stats, enemyData, stats.level, null, stats.defense);
  _renderUI(container);


         
}

// ── Render UI ─────────────────────────────────────────────────

function _renderUI(container) {
  const s = _battleState;
  const learnedAbilities = (DB.characterAbilities[CUR.id] || [])
    .map(la => (DB.battleAbilities || []).find(ab => ab.id === la.ability_id))
    .filter(Boolean)
    .filter(ab => ab.type !== 'passive')
    .slice(0, 4);

  const tier = _dungeonCtx?.tier || 1;
  const heroClass = DB.battleCharacters?.[CUR.id]?.class_id || 'warrior';



         
 const isBoss = _enemyData.is_boss || false;
const bgUrl = (() => {
  if (isBoss) {
    const n = Math.random() < 0.5 ? 1 : 2;
    return `/lifequest/assets/battle/sfondi/bossfight_${n}.gif`;
  }
  const tierBgs = {
    1: ['battaglia_1.gif'],
    2: ['battaglia_2.gif', 'battaglia_3.gif'],
    3: ['battaglia_4.gif', 'battaglia_5.gif'],
    4: ['battaglia_6.gif'],
    5: ['battaglia_6.gif'],
  };
  const pool = tierBgs[tier] || ['battaglia_1.gif'];
  return `/lifequest/assets/battle/sfondi/${pool[Math.floor(Math.random() * pool.length)]}`;
})();





         
const heroLoopGif = `/lifequest/assets/battle/classes/${heroClass}_loop.gif`;

         

  container.innerHTML = `
    <div class="battle-screen" id="battle-root">

      <!-- ZONA SCENA (45%) -->
      <section class="battle-enemy-zone" style="background-image:url('${bgUrl}'); background-size:cover; background-position:center;">

        <!-- Info nemico in alto a sinistra -->
        <div class="battle-enemy-info">
          <div class="battle-enemy-name">${escHtml(s.enemy.name)}${s.enemy.isBoss ? ' <span class="boss-badge">BOSS</span>' : ''}</div>
          <div class="battle-bar-row">
            <span class="battle-bar-label" style="color:var(--dmg-color)">HP</span>
            <div class="battle-bar-track"><div class="hp-fill enemy-hp-fill" id="enemy-hp-fill" style="width:100%"></div></div>
            <span class="battle-bar-value" id="enemy-hp-val">${s.enemy.hp}/${s.enemy.hpMax}</span>
          </div>
          <div id="enemy-status" class="enemy-status-effects"></div>
        </div>

        <!-- Sprite nemico in alto a destra -->
        <div class="battle-enemy-sprite">
         <img src="${escHtml(_enemyData.loop_gif || _enemyData.icon_path || '')}"
               alt="${escHtml(s.enemy.name)}"
               id="enemy-sprite"
               onerror="this.style.display='none'">
        </div>





      <!-- Sprite alleato evocato (se presente) -->
        ${_summonData ? `
          <div class="battle-summon-sprite">
            <img src="/lifequest/assets/battle/classes/${_summonData.class_id}_loop.gif"
                 alt="Alleato"
                 id="summon-sprite"
                 onerror="this.style.display='none'">
          </div>
        ` : ''}

        <!-- Sprite eroe in basso a sinistra -->
        <div class="battle-hero-sprite">
          <img src="${escHtml(heroLoopGif)}"
               alt="Eroe"
               id="hero-sprite"
               onerror="this.style.display='none'">
        </div>





        <!-- Info eroe in basso a destra -->
        <div class="battle-hero-info-overlay">
          <div class="battle-bar-row">
            <span class="battle-bar-label" style="color:var(--hp-bar)">HP</span>
            <div class="battle-bar-track"><div class="hp-fill" id="hero-hp-fill" style="width:100%"></div></div>
            <span class="battle-bar-value" id="hero-hp-val">${s.player.hp}/${s.player.hpMax}</span>
          </div>
          <div class="battle-bar-row">
            <span class="battle-bar-label" style="color:var(--mana-bar)">MP</span>
            <div class="battle-bar-track"><div class="mana-fill" id="hero-mana-fill" style="width:100%"></div></div>
            <span class="battle-bar-value" id="hero-mana-val">${s.player.mana}/${s.player.manaMax}</span>
          </div>



          
          <div id="hero-status" class="hero-status-effects"></div>

      </section>

      <!-- ZONA LOG (15%) -->
      <section class="battle-log-zone" aria-live="polite">
        <div class="battle-log" id="battle-log">
          <div class="log-entry log-start">${escHtml(s.log[0] || '')}</div>
        </div>
      </section>

      <!-- ZONA AZIONI (40%) -->
      <section class="battle-actions-zone">
        <div class="battle-turn-info">Turno <span id="battle-turn">1</span>/10</div>
        <div class="battle-actions" id="battle-actions">
          ${_buildButtons(learnedAbilities)}
        </div>
        <div class="battle-items" id="battle-items">
          ${_buildItemButtons()}
        </div>
        <button class="btn-flee" id="btn-flee">🏃 Fuggi</button>
      </section>

    </div>
  `;

  _bindEvents(container, learnedAbilities);
}
function _buildButtons(abilities) {
  const base = [
    { action:'attack',  label:'⚔️ Attacca' },
   { action:'guard',   label:'🛡️ Contrattacco' },
  ];
  const btns = base.map(b =>
    `<button class="btn-battle-action" data-action="${b.action}">${b.label}</button>`
  ).join('');
  const abBtns = abilities.map(ab =>
    `<button class="btn-battle-action btn-ability" data-action="ability" data-ab-id="${escHtml(ab.id)}"
             title="${escHtml(ab.description || '')}">
       ${escHtml(ab.name)}
       ${ab.mana_cost ? `<span class="ability-cost">${ab.mana_cost}MP</span>` : ''}
     </button>`
  ).join('');
 const dismissBtn = (_summonData && !_summonData.isDead)
    ? `<button class="btn-battle-action" data-action="dismiss">🚪 Congeda</button>`
    : '';
  if (_battleState.supportAvailable && !_battleState.supportUsed) {
    return btns + abBtns + `<button class="btn-battle-action" data-action="support">🤝 Aiuto</button>` + dismissBtn;
  }
  return btns + abBtns + dismissBtn;
}

function _buildItemButtons() {
  const usable = (DB.battleInventory?.[CUR.id] || []).filter(inv => {
    const item = (DB.battleItems || []).find(i => i.id === inv.item_id);
    return item?.slot === 'consumable';
  }).slice(0, 4);
  if (!usable.length) return '';
  const used = _battleState.itemsUsedCount;
  return `<div class="items-label">Oggetti (${3 - used} rimasti)</div>` +
    usable.map(inv => {
      const item = (DB.battleItems || []).find(i => i.id === inv.item_id);
      return `<button class="btn-battle-item" data-item-id="${escHtml(inv.item_id)}"
                      ${used >= 3 ? 'disabled' : ''}>
                🧪 ${escHtml(item?.name || 'Oggetto')}
              </button>`;
    }).join('');
}

function _bindEvents(container, abilities) {
  container.querySelectorAll('.btn-battle-action').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (_animLock || _battleState.isOver) return;
      const action  = btn.dataset.action;
      const abId    = btn.dataset.abId;
      const abData  = abId ? DB.battleAbilities.find(a => a.id === abId) : null;
      await _handleAction(container, action, {}, abData);
    });
  });

  container.querySelectorAll('.btn-battle-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (_animLock || _battleState.isOver) return;
      await _handleAction(container, 'item', { itemId: btn.dataset.itemId });
    });
  });





         
container.querySelector('[data-action="dismiss"]')?.addEventListener('click', async () => {
    if (_animLock) return;
    _summonData = null;
    const sprite = document.getElementById('summon-sprite');
    if (sprite) sprite.closest('.battle-summon-sprite')?.remove();
    const { supabase } = await import('../../supabase.js');
    await supabase.from('active_summons')
      .update({ status: 'dismissed' })
      .eq('summoner_id', CUR.id);
    const ba = container.querySelector('#battle-actions');
    if (ba) ba.innerHTML = _buildButtons(abilities);
    _rebindActions(container, abilities);
  });
  container.querySelector('#btn-flee')?.addEventListener('click', () => {
    if (_animLock) return;
    playSound('flee');
    _battleState.isOver = true;
    _battleState.winner = null;
    _showEndOverlay(container, null, 0);
  });



         
}











async function _handleAction(container, action, payload, abilityData = null) {
  _animLock = true;
  _setDisabled(container, true);

  // Suono azione giocatore
  if (action === 'attack')  playSound('attack');
  if (action === 'guard')   playSound('guard');
  if (action === 'ability') playSound('ability');
  if (action === 'item')    playSound('heal');
  if (action === 'support') playSound('buff');

  if (['attack', 'ability'].includes(action)) await _playAttackAnim('hero');

  const newState = processPlayerAction(_battleState, action, payload, abilityData);
  const newLogs  = newState.log;

  // Suono attacco nemico
  const enemyAttacked = newLogs.some(l => l.includes('colpisce') || l.includes('attacca'));
  if (enemyAttacked) {
    playSound('attack_enemy');
    await _playAttackAnim('enemy');
  }

  // Suoni dal log
  for (const msg of newLogs) {
    const type = _classifyLog(msg);
    if (type === 'damage') playSound('hit');
    if (type === 'heal')   playSound('heal');
    if (type === 'status') {
      if (msg.includes('veleno'))   playSound('poison');
      if (msg.includes('stord'))    playSound('stun');
      if (msg.includes('immune'))   playSound('immunity');
      if (msg.includes('potenzia')) playSound('buff');
    }
    if (msg.includes('CRITICO'))   playSound('crit');
    if (msg.includes('FASE 2'))    playSound('phase2');
    if (type === 'win')  playSoundDucked('victory', 0.4);
    if (type === 'lose') playSound('defeat');
    await _appendLog(container, msg, type);
    await _sleep(280);
  }

 _battleState = newState;
  _updateBars(container, newState);
  _updateStatuses(container, newState);
  document.getElementById('battle-turn').textContent = Math.min(newState.turn, 10);

  // Attacco automatico alleato evocato
  if (_summonData && !_summonData.isDead && !newState.isOver) {
    await _sleep(400);
    await _playSummonAttackAnim();
    const summonDmg = Math.max(1, _summonData.attack - Math.floor(_battleState.enemy.defense * 0.3));
    _battleState.enemy.hp = Math.max(0, _battleState.enemy.hp - summonDmg);
    await _appendLog(container, `⚡ Alleato attacca per ${summonDmg} danni!`, 'damage');
    _updateBars(container, _battleState);

    // Controlla se il nemico è morto per l'attacco dell'alleato
    if (_battleState.enemy.hp <= 0) {
      _battleState.isOver = true;
      _battleState.winner = 'player';
      await _appendLog(container, '🏆 Vittoria!', 'win');
      await _onBattleEnd(container, _battleState);
      return;
    }
  }

// Controlla se l'alleato ha ricevuto danni dal nemico e è morto
  if (_summonData && !_summonData.isDead) {
    // L'alleato subisce il 30% dei danni nemico ogni turno
    const enemyAtk = _battleState.enemy.attack || 10;
    const summonDmgTaken = Math.max(1, Math.floor(enemyAtk * 0.3) - Math.floor(_summonData.defense * 0.2));
    _summonData.hp = Math.max(0, _summonData.hp - summonDmgTaken);

    // Aggiorna barra HP alleato
    const fill = document.getElementById('summon-hp-fill');
    const val  = document.getElementById('summon-hp-val');
    const pct  = Math.round((_summonData.hp / _summonData.hpMax) * 100);
    if (fill) fill.style.width = pct + '%';
    if (val)  val.textContent  = `${_summonData.hp}/${_summonData.hpMax}`;

    if (_summonData.hp <= 0) {
      _summonData.isDead = true;
      await _appendLog(container, '💀 Il tuo alleato è caduto!', 'lose');
      const sprite = document.getElementById('summon-sprite');
      if (sprite) sprite.style.opacity = '0.3';

      // Aggiorna stato su Supabase
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(6, 0, 0, 0);
      const { supabase } = await import('../../supabase.js');
      await supabase.from('active_summons').update({
        status:     'dead',
        died_at:    new Date().toISOString(),
        revives_at: tomorrow.toISOString(),
        hp_current: 0,
      }).eq('summoner_id', CUR.id);
    } else {
      // Aggiorna HP su Supabase (ogni turno)
      const { supabase } = await import('../../supabase.js');
      await supabase.from('active_summons')
        .update({ hp_current: _summonData.hp })
        .eq('summoner_id', CUR.id);
    }
  }

  if (newState.isOver) {
    await _onBattleEnd(container, newState);
  } else {
    _animLock = false;




           
    _setDisabled(container, false);
    const abl = (DB.characterAbilities[CUR.id] || [])
      .map(la => (DB.battleAbilities || []).find(ab => ab.id === la.ability_id))
      .filter(Boolean).filter(ab => ab.type !== 'passive').slice(0, 4);
    const ba = container.querySelector('#battle-actions');
    if (ba) ba.innerHTML = _buildButtons(abl);
    const bi = container.querySelector('#battle-items');
    if (bi) bi.innerHTML = _buildItemButtons();
    _rebindActions(container, abl);
  }
}




async function _playSummonAttackAnim() {
  const sprite = document.getElementById('summon-sprite');
  if (!sprite || !_summonData) return;
  const attackGif = `/lifequest/assets/battle/classes/${_summonData.class_id}_attack.gif`;
  const loopGif   = `/lifequest/assets/battle/classes/${_summonData.class_id}_loop.gif`;
  sprite.src = attackGif;
  await _sleep(800);
  sprite.src = loopGif;
}

function _rebindActions(container, abilities) {



  container.querySelectorAll('.btn-battle-action').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (_animLock || _battleState.isOver) return;
      const action = btn.dataset.action;
      const abId   = btn.dataset.abId;
      const abData = abId ? {
  ...DB.battleAbilities.find(a => a.id === abId),
  _currentLevel: (DB.characterAbilities[CUR.id] || [])
    .find(la => la.ability_id === abId)?.level ?? 1
} : null;
      await _handleAction(container, action, {}, abData);
    });
  });
  container.querySelectorAll('.btn-battle-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (_animLock || _battleState.isOver) return;
      await _handleAction(container, 'item', { itemId: btn.dataset.itemId });
    });
  });
}






async function _playAttackAnim(who = 'hero') {
  const heroClass = DB.battleCharacters?.[CUR.id]?.class_id || 'warrior';
  const heroLoopGif   = `/lifequest/assets/battle/classes/${heroClass}_loop.gif`;
  const heroAttackGif = `/lifequest/assets/battle/classes/${heroClass}_attack.gif`;

  if (who === 'hero') {
    const sprite = document.getElementById('hero-sprite');
    if (!sprite) return;
    sprite.src = heroAttackGif;
    await _sleep(800);
    sprite.src = heroLoopGif;
  } else {
    const sprite = document.getElementById('enemy-sprite');
    if (!sprite) return;
    sprite.src = _enemyData.attack_gif || _enemyData.loop_gif || '';
    await _sleep(800);
    sprite.src = _enemyData.loop_gif || '';
  }
}










async function _onBattleEnd(container, state) {
  const won = state.winner === 'player';
  let goldEarned = 0, itemDropped = null;





         
if (won) {
  playSoundDucked('victory', 0.4);

    // ── Daily Dungeon ─────────────────────────────────────────
    if (_dungeonCtx?.dailyDungeon) {
      const { supabase: sb } = await import('../../supabase.js');
      const ctx       = _dungeonCtx;
      const diffData  = ctx.diffData;
      const rooms     = diffData.rooms;
      const nextIndex = ctx.roomIndex + 1;
      const goldByDiff = [0, 300, 700, 1400, 3200, 8000];
      goldEarned = Math.floor(goldByDiff[ctx.difficulty] / rooms.length);
      await updateGold(CUR.id, goldEarned, 'daily_dungeon');
      playSound('gold');

      if (nextIndex < rooms.length) {
        // Prossima stanza
        const nextRoom = rooms[nextIndex];
        const { data: nextEnemy } = await sb.from('battle_enemies').select('*').eq('id', nextRoom.enemy_id).single();
        if (nextEnemy) {
          const enemy = {
            ...nextEnemy,
            hp_base: nextEnemy.hp_base, attack_base: nextEnemy.attack,
            defense_base: nextEnemy.defense, speed_base: nextEnemy.speed,
            already_scaled: false,
          };
          _showEndOverlay(container, true, goldEarned, 0, null, () => {
            renderBattleScreen(enemy, { ...ctx, roomIndex: nextIndex });
          });
          return;
        }
      }

      // Dungeon completato — drop 2 item e aggiorna progressi
      const { addToInventory } = await import('../battle/economy.js');
      const bc = (await import('../battle/character.js')).getBattleChar(CUR.id);
      const pool = (DB.battleItems || []).filter(i => i.rarity === diffData.rarity_drop && i.slot !== 'consumable');
      const picked = [];
      for (let i = 0; i < 2; i++) {
        if (pool.length) picked.push(pool[Math.floor(Math.random() * pool.length)]);
      }
      for (const item of picked) await addToInventory(CUR.id, bc.id, item.id);
      itemDropped = picked[0] || null;

      // Aggiorna progressi
      const today = new Date().toISOString().slice(0, 10);
      const { data: prog } = await sb.from('daily_dungeon_progress').select('*')
        .eq('character_id', bc.id).eq('dungeon_id', ctx.dungeonId).maybeSingle();
      const runsToday = prog?.last_run_date === today ? (prog.runs_today || 0) : 0;
      const newMaxDiff = Math.max(prog?.max_difficulty_unlocked || 1, ctx.difficulty < 5 ? ctx.difficulty + 1 : 5);
      await sb.from('daily_dungeon_progress').upsert({
        character_id: bc.id,
        dungeon_id:   ctx.dungeonId,
        difficulty:   ctx.difficulty,
        max_difficulty_unlocked: newMaxDiff,
        runs_today:   runsToday + 1,
        last_run_date: today,
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'character_id,dungeon_id' });

      await incrementDailyLimit(CUR.id, 'pve_count');
      _showEndOverlay(container, true, goldEarned, 0, itemDropped);
      return;
    }

    // Usa defeatEnemy se siamo in un dungeon — gestisce streak, progresso stanza e moltiplicatore gold
    let rewards;
    if (_dungeonCtx?.dungeon && _enemyData) {






             
      const { defeatEnemy } = await import('../battle/dungeon.js');
      const dungeonRewards = await defeatEnemy(CUR.id, _enemyData);
      rewards = {
        gold:       dungeonRewards?.gold       || 0,
        itemRarity: dungeonRewards?.itemRarity || null,
      };
    } else {
      const { incrementFightStreak, calcStreakMultiplier } = await import('../battle/character.js');
      const streak     = await incrementFightStreak(CUR.id);
      const streakMult = calcStreakMultiplier(streak);
      rewards = calcPveRewards(_enemyData, calcBattleStats(CUR.id)?.luck || 3, _dungeonCtx?.tier || 1, streakMult);
    }

    goldEarned = rewards.gold;
    if (goldEarned > 0) {
      await updateGold(CUR.id, goldEarned, 'pve');
      playSound('gold');
    }
    await incrementDailyLimit(CUR.id, 'pve_count');





           
    if (rewards.itemRarity) {
      const pool = DB.battleItems.filter(i =>
        i.rarity === rewards.itemRarity &&
        i.slot !== 'consumable' &&
        i.icon_path !== null
      );
      itemDropped = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      if (itemDropped) playSound('loot_rare');
    }


           
   } else {
    playSound('defeat');
    await incrementDailyLimit(CUR.id, 'pve_count');
  }








         
  // Salva gli HP rimasti dopo la battaglia
  const { error: hpError } = await supabase
    .from('battle_characters')
    .update({
      hp_current: Math.max(0, Math.floor(state.player.hp))
    })
    .eq('user_id', CUR.id);

  if (hpError) {
    console.warn('[Battle] Salvataggio HP fallito:', hpError.message);
  } else {
    if (DB.battleCharacters?.[CUR.id]) {
      DB.battleCharacters[CUR.id].hp_current = Math.max(
        0,
        Math.floor(state.player.hp)
      );
      persist();
    }
  }

  _showEndOverlay(container, won, goldEarned, 0, itemDropped);
}













function _showEndOverlay(container, won, gold, xp = 0, item = null) {
  const root = container.querySelector('#battle-root');
  if (!root) return;
  const overlay = document.createElement('div');
  overlay.className = `battle-end-overlay ${won ? 'battle-win' : won === null ? '' : 'battle-loss'}`;
  const isDungeon = !!_dungeonCtx?.dungeon;
  const isStory   = !!_dungeonCtx?.storyMode;
  overlay.innerHTML = `
    <div class="battle-end-content">
      <div class="battle-end-icon">${won === null ? '🏃' : won ? '🏆' : '💀'}</div>
      <div class="battle-end-title">${won === null ? 'Fuggito' : won ? 'Vittoria!' : 'Sconfitta'}</div>
      ${gold > 0 ? `<div class="battle-rewards">💰 +${gold} Gold</div>` : ''}
      ${xp   > 0 ? `<div class="battle-rewards">⚡ +${xp} XP</div>`   : ''}
     ${item ? (() => {
        const rarColors = { common:'#9CA3AF', uncommon:'#22C55E', rare:'#3B82F6', epic:'#7C3AED', legendary:'#F59E0B', mythic:'#DC2626' };
        const rarNames  = { common:'Comune', uncommon:'Non Comune', rare:'Raro', epic:'Epico', legendary:'Leggendario', mythic:'Mitico' };
        const col = rarColors[item.rarity] || '#9CA3AF';
        const bonusParts = [];
        if (item.bonus_attack   > 0) bonusParts.push(`+${item.bonus_attack} ATK`);
        if (item.bonus_defense  > 0) bonusParts.push(`+${item.bonus_defense} DEF`);
        if (item.bonus_hp       > 0) bonusParts.push(`+${item.bonus_hp} PF`);
        if (item.bonus_mana     > 0) bonusParts.push(`+${item.bonus_mana} MP`);
        if (item.bonus_speed    > 0) bonusParts.push(`+${item.bonus_speed} VEL`);
        if (item.crit_chance    > 0) bonusParts.push(`🎯 +${item.crit_chance}% Crit`);
        if (item.lifesteal_pct  > 0) bonusParts.push(`🩸 +${item.lifesteal_pct}% Vampirismo`);
        if (item.dodge_chance   > 0) bonusParts.push(`💨 +${item.dodge_chance}% Schivata`);
        if (item.double_hit_chance > 0) bonusParts.push(`⚡ +${item.double_hit_chance}% DoppioColpo`);
        const subParts = [];
        if (item.damage_reduction_pct > 0) subParts.push(`🛡️ -${item.damage_reduction_pct}% DannoSubito`);
        if (item.reflect_pct    > 0) subParts.push(`🔄 ${item.reflect_pct}% Riflesso`);
        if (item.hp_regen_turn  > 0) subParts.push(`💓 +${item.hp_regen_turn} HP/turno`);
        if (item.revive_once)        subParts.push(`✨ Rinascita 1x`);
        const allParts = [...bonusParts, ...subParts];
        return `
          <div class="battle-rewards item-drop-card" style="
            border: 1px solid ${col}88;
            border-radius: 10px;
            padding: 10px 12px;
            margin-top: 6px;
            background: ${col}11;
            box-shadow: 0 0 12px ${col}44;
            text-align: left;
          ">
            <div style="color:${col}; font-weight:700; font-size:1rem; text-shadow:0 0 8px ${col}88;">
              🎁 ${escHtml(item.name)}
            </div>
            <div style="font-size:0.72rem; color:${col}; opacity:0.85; margin-top:2px;">
              ${rarNames[item.rarity] || ''} · ${escHtml(item.slot || '')}${item.class_restriction ? ` · Solo ${item.class_restriction}` : ''}
            </div>
            ${allParts.length ? `<div style="font-size:0.75rem; color:var(--text-2); margin-top:5px; line-height:1.6;">${allParts.join(' &nbsp;·&nbsp; ')}</div>` : ''}
          </div>
        `;
      })() : ''}
      <div id="battle-end-btn-area" style="margin-top:0.75rem">
        <button class="btn-primary" id="btn-back-from-battle">← Villaggio</button>
      </div>
    </div>
  `;









         
// Bottone "Villaggio" — sempre presente come fallback
  overlay.querySelector('#btn-back-from-battle')?.addEventListener('click', () => {
    if (_dungeonCtx?.storyMode && window._storyBattleResolve) {
            window._storyBattleResolve(won ? 'win' : 'loss', Math.max(0, Math.floor(_battleState?.player?.hp ?? 0)));
      window._gotoTab?.('battle');
      window._switchVillageTab?.('dungeon_map');
    } else {
      window._gotoVillage?.();
    }
  });











         
// Modalità Storia — gestisci avanzamento stanza
  if (isStory && won) {
    const btnArea = overlay.querySelector('#battle-end-btn-area');
    btnArea.innerHTML = `
      <button class="btn-primary" id="btn-story-continue">⚔️ Prossima stanza →</button>
      <button class="btn-secondary" id="btn-story-back" style="margin-top:0.5rem">← Torna alla mappa</button>
    `;
    btnArea.querySelector('#btn-story-continue')?.addEventListener('click', () => {
      if (window._storyBattleResolve) {
        window._storyBattleResolve('win', Math.max(0, Math.floor(_battleState?.player?.hp ?? 0)));
      }
    });
    btnArea.querySelector('#btn-story-back')?.addEventListener('click', () => {
      if (window._storyBattleResolve) {
        window._storyBattleResolve('win-back', Math.max(0, Math.floor(_battleState?.player?.hp ?? 0)));
      }
      window._gotoTab?.('battle');
      window._switchVillageTab?.('dungeon_map');
    });
  } else if (isStory && !won) {
    // Sconfitta in modalità Storia — solo torna alla mappa
    overlay.querySelector('#btn-back-from-battle')?.replaceWith((() => {
      const b = document.createElement('button');
      b.className = 'btn-secondary';
      b.textContent = '← Torna alla mappa';
      b.addEventListener('click', () => {
        if (window._storyBattleResolve) {
          window._storyBattleResolve('loss', 0);
        }
        window._gotoTab?.('battle');
        window._switchVillageTab?.('dungeon_map');
      });
      return b;
    })());
  } else if (isDungeon && won) {





           
    const btnArea = overlay.querySelector('#battle-end-btn-area');
    const advance = advanceRoom();

    if (advance.isDungeonComplete) {
      // Era l'ultima stanza (boss) — completa il dungeon
      completeDungeon(CUR.id).then(result => {
        if (btnArea) {
          btnArea.innerHTML = `
            <div class="battle-rewards" style="color:var(--gold)">
              🏰 Dungeon completato! +${result.goldTotal}G · +${result.xpBonus}XP
            </div>
            <button class="btn-primary" id="btn-dungeon-done">🏆 Torna al Villaggio</button>
          `;
          btnArea.querySelector('#btn-dungeon-done')?.addEventListener('click', () => {
            window._gotoVillage?.();
          });
        }
      });
    } else {
      // Ci sono altre stanze — mostra pulsante "Prossima stanza"
      const nextEnemy = getCurrentEnemy();
      if (btnArea && nextEnemy) {
        btnArea.innerHTML = `
          <button class="btn-primary" id="btn-next-room">⚔️ Stanza ${advance.nextRoom?.index} →</button>
          <button class="btn-secondary" id="btn-flee-dungeon" style="margin-top:0.5rem">🏃 Abbandona</button>
        `;




               
       btnArea.querySelector('#btn-next-room')?.addEventListener('click', () => {
          overlay.remove();
          renderBattleScreen(nextEnemy, _dungeonCtx);
        });
        btnArea.querySelector('#btn-flee-dungeon')?.addEventListener('click', () => {
          if (_dungeonCtx?.storyMode && window._storyBattleResolve) {
            window._storyBattleResolve('flee', 0);
            window._gotoTab?.('battle');
            window._switchVillageTab?.('dungeon_map');
          } else {
            import('../battle/dungeon.js').then(m => m.abandonDungeon());
            window._gotoVillage?.();
          }
        });






               
      }
    }
  }

  root.appendChild(overlay);
  _animLock = false;
}

// ── Helpers ───────────────────────────────────────────────────

function _updateBars(container, s) {
  const set = (id, pct, val) => {
    const fill = document.getElementById(id + '-fill');
    const txt  = document.getElementById(id + '-val');
    if (fill) fill.style.width = pct + '%';
    if (txt)  txt.textContent  = val;
  };
  
  set('enemy-hp',  Math.round(s.enemy.hp  / s.enemy.hpMax  * 100), `${s.enemy.hp}/${s.enemy.hpMax}`);
  set('hero-hp',   Math.round(s.player.hp / s.player.hpMax * 100), `${s.player.hp}/${s.player.hpMax}`);

  // Immortalità admin
  if (window._adminImmortal && s.player.hp <= 0) {
    s.player.hp = 1;
    const fill = document.getElementById('hero-hp-fill');
    const txt  = document.getElementById('hero-hp-val');
    if (fill) fill.style.width = '1%';
    if (txt)  txt.textContent  = `1/${s.player.hpMax}`;
  }

  const heroManaFill = document.getElementById('hero-mana-fill');
  const heroManaVal  = document.getElementById('hero-mana-val');
  if (heroManaFill) heroManaFill.style.width = Math.round(s.player.mana / Math.max(1, s.player.manaMax) * 100) + '%';
  if (heroManaVal)  heroManaVal.textContent   = `${s.player.mana}/${s.player.manaMax}`;
}

function _updateStatuses(container, s) {
  const icons = { poison:'☠️', regen:'💚', stun:'⭐', attackBuff:'⬆️', attackDebuff:'⬇️' };
  const render = (effects) => effects.map(e =>
    `<span class="status-badge" title="${e.type}">${icons[e.type] || '❓'}${e.stacks > 1 ? e.stacks : ''}</span>`
  ).join('');
  const heroEl  = document.getElementById('hero-status');
  const enemyEl = document.getElementById('enemy-status');
  if (heroEl)  heroEl.innerHTML  = render(s.player.statusEffects);
  if (enemyEl) enemyEl.innerHTML = render(s.enemy.statusEffects);
}

async function _appendLog(container, msg, type = 'info') {
  const log = document.getElementById('battle-log');
  if (!log) return;
  const div = document.createElement('div');
  div.className   = `log-entry log-${type}`;
  div.textContent = msg;
  log.appendChild(div);
  log.scrollTop   = log.scrollHeight;
}

function _classifyLog(msg) {
  if (msg.includes('danni') && !msg.includes('nemico')) return 'damage';
  if (msg.includes('PF') && msg.includes('+'))          return 'heal';
  if (msg.includes('veleno') || msg.includes('stord'))  return 'status';
  if (msg.includes('Vittoria'))                         return 'win';
  if (msg.includes('Sconfitta'))                        return 'lose';
  return 'info';
}

function _setDisabled(container, disabled) {
  container.querySelectorAll('.btn-battle-action,.btn-battle-item,#btn-flee').forEach(b => { b.disabled = disabled; });
}

