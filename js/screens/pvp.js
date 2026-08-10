// ============================================================
// screens/pvp.js — Sfide PvP tra utenti
// FIX: input codice visibile, btn Cerca non a piena larghezza,
//      ricerca su Supabase funzionante, stakeXP letto correttamente
// ============================================================

import { CUR, DB } from '../db.js';
import { Challenges, Feed } from '../api.js';
import { awardXP } from '../xp.js';
import { escHtml, toast } from '../utils.js';
import { playSound } from '../audio.js';
import { openModal, closeModal } from '../modals.js';

let _pvpTab = 'active';

export function switchPvPTab(t) { _pvpTab = t; renderPvP(); }

export async function renderPvP() {
  if (!CUR) return;
  const container = document.getElementById('screen-pvp');
  if (!container) return;

  const tabs = [
    { id: 'active', label: '⚔️ Le mie Sfide' },
    { id: 'public', label: '🌐 Pubbliche'     },
  ];

  container.innerHTML = `
    <div class="screen-header">
      <h2>Sfide PvP</h2>
      <button class="btn-add" onclick="window._openCreateChallengeModal?.()">+ Crea</button>
    </div>
    <div class="tab-row">
      ${tabs.map(t => `
        <button class="tab-btn ${_pvpTab === t.id ? 'tab-btn--active' : ''}"
                onclick="window._switchPvPTab?.('${t.id}')">
          ${t.label}
        </button>`).join('')}
    </div>

    ${_pvpTab === 'active' ? `
      <div class="pvp-code-box">
        <p class="pvp-code-label">🔑 Hai un codice sfida privata?</p>
        <div class="pvp-code-row">
          <input
            type="number"
            id="join-code-input"
            placeholder="Codice a 4 cifre"
            min="1000" max="9999"
            class="pvp-code-input"
          />
          <button class="pvp-search-btn" onclick="window._joinByCode?.()">Cerca</button>
        </div>
        <div id="join-code-result"></div>
      </div>` : ''}

    <div id="pvp-list"><div class="empty-state" style="padding:2rem">Caricamento…</div></div>
  `;

  if (_pvpTab === 'active') {
    const { ok, data } = await Challenges.list(CUR.id);
    const cloud = ok ? data : [];

    // Merge con sfide locali non ancora sincronizzate
    const cloudIds  = new Set(cloud.map(c => c.id));
    const localOnly = DB.challenges.filter(
      c => (c.creatorId === CUR.id || c.opponentId === CUR.id) && !cloudIds.has(c.id)
    );
    const merged = [...cloud, ...localOnly].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    renderChallengeList(merged, 'pvp-list', false);
  } else {
    const { ok, data } = await Challenges.listPublic();
    renderChallengeList(ok ? data : [], 'pvp-list', true);
  }
}

// ── Render lista ──────────────────────────────────────────────

function renderChallengeList(challenges, containerId, isPublic) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!challenges.length) {
    container.innerHTML = `<div class="empty-state">
      ${isPublic
        ? 'Nessuna sfida pubblica aperta al momento.'
        : 'Nessuna sfida ancora.<br>Creane una con <strong>+ Crea</strong> in alto!'}
    </div>`;
    return;
  }

  container.innerHTML = challenges.map(c => challengeCard(c, isPublic)).join('');
}

function challengeCard(c, isPublic) {
  const creator    = DB.users[c.creatorId];
  const opponent   = c.opponentId ? DB.users[c.opponentId] : null;
  const isCreator  = c.creatorId  === CUR.id;
  const isOpponent = c.opponentId === CUR.id;
  const alreadyIn  = isCreator || isOpponent;
  const canJoin    = isPublic && !alreadyIn && c.status === 'open';
  const canDeclare = alreadyIn && c.status === 'active';

  const otherUserId = isCreator ? c.opponentId : c.creatorId;
  const otherUser   = otherUserId ? DB.users[otherUserId] : null;

  const statusBadge = {
    open:      '<span class="badge badge--green">Aperta</span>',
    active:    '<span class="badge badge--yellow">In corso</span>',
    completed: '<span class="badge badge--gray">Conclusa</span>',
  }[c.status] || '';

  const typeIcon = { athletic: '🏋️', mental: '🧠', mixed: '⚔️' }[c.type] || '⚔️';
  const xp = c.stakeXP || c.stake_xp || 0;

  const actionBtns = [];

  if (canJoin) {
    actionBtns.push(`
      <button class="pvp-btn pvp-btn--primary"
              onclick="window._joinChallenge?.('${c.id}')">
        ⚔️ Unisciti
      </button>`);
  }

  if (alreadyIn && c.status === 'open') {
    actionBtns.push(`<p class="pvp-waiting">⏳ In attesa di un avversario…</p>`);
  }

  if (canDeclare) {
    actionBtns.push(`
      <button class="pvp-btn pvp-btn--primary"
              onclick="window._declareWinner?.('${c.id}','${CUR.id}')">
        🏆 Ho vinto
      </button>`);
    if (otherUser) {
      actionBtns.push(`
        <button class="pvp-btn"
                onclick="window._declareWinner?.('${c.id}','${otherUserId}')">
          🏳 Ha vinto @${escHtml(otherUser.username)}
        </button>`);
    }
    actionBtns.push(`
      <button class="pvp-btn"
              onclick="window._declareWinner?.('${c.id}','draw')">
        🤝 Pareggio
      </button>`);
  }

  if (c.status === 'completed') {
    const winnerName = c.winnerId ? (DB.users[c.winnerId]?.username || 'N/D') : null;
    actionBtns.push(`
      <p class="pvp-result">
        🏆 ${winnerName ? `@${escHtml(winnerName)} ha vinto` : 'Pareggio'}
      </p>`);
  }

  return `
    <div class="challenge-card">
      <div class="challenge-card__header">
        <span>${typeIcon} ${escHtml(c.title)}</span>
        ${statusBadge}
      </div>
      ${c.rules ? `<p class="challenge-rules">${escHtml(c.rules)}</p>` : ''}
      <div class="challenge-meta">
        <span>👤 @${escHtml(creator?.username || '?')}</span>
        ${opponent
          ? `<span>🆚 @${escHtml(opponent.username)}</span>`
          : '<span>🆚 In attesa avversario</span>'}
        ${xp > 0 ? `<span>💰 ${xp} XP</span>` : ''}
        ${c.expiresAt ? `<span>📅 ${c.expiresAt}</span>` : ''}
        ${c.joinCode && isCreator
          ? `<span>🔑 Codice: <strong>${c.joinCode}</strong></span>` : ''}
      </div>
      ${actionBtns.length
        ? `<div class="challenge-card__actions">${actionBtns.join('')}</div>`
        : ''}
    </div>`;
}

// ── Cerca per codice ──────────────────────────────────────────

window._joinByCode = async function() {
  const input    = document.getElementById('join-code-input');
  const resultEl = document.getElementById('join-code-result');
  const raw      = input?.value?.toString().trim() || '';

  if (!raw || raw.length !== 4 || isNaN(raw)) {
    if (resultEl) resultEl.innerHTML =
      `<p class="pvp-code-error">Inserisci un codice di esattamente 4 cifre.</p>`;
    return;
  }

  resultEl.innerHTML = `<p class="pvp-code-searching">🔍 Ricerca in corso…</p>`;

  // 1. Cerca in locale (come stringa, per sicurezza)
  let challenge = DB.challenges.find(
    c => String(c.joinCode) === raw && c.status === 'open'
  );

  // 2. Se non trovata localmente, cerca su Supabase
  if (!challenge) {
    try {
      const { supabase } = await import('../supabase.js');
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('join_code', raw)        // Supabase confronta come testo
        .eq('status', 'open')
        .maybeSingle();

      if (error) console.warn('[PvP] Supabase search error:', error.message);

      if (data) {
        challenge = {
          id:         data.id,
          creatorId:  data.creator_id,
          opponentId: data.opponent_id,
          title:      data.title,
          rules:      data.rules,
          stakeXP:    data.stake_xp,
          type:       data.type,
          isPublic:   data.is_public,
          joinCode:   data.join_code,
          status:     data.status,
          expiresAt:  data.expires_at,
          createdAt:  data.created_at,
        };
        // Salva in locale per uso successivo
        if (!DB.challenges.find(c => c.id === challenge.id)) {
          DB.challenges.push(challenge);
        }
      }
    } catch (e) {
      console.warn('[PvP] Import supabase failed:', e);
    }
  }

  if (!challenge) {
    resultEl.innerHTML =
      `<p class="pvp-code-error">Nessuna sfida trovata con codice "${escHtml(raw)}".</p>`;
    return;
  }

  if (challenge.creatorId === CUR.id) {
    resultEl.innerHTML =
      `<p class="pvp-code-warn">Sei tu il creatore di questa sfida!</p>`;
    return;
  }
  if (challenge.opponentId === CUR.id) {
    resultEl.innerHTML =
      `<p class="pvp-code-warn">Hai già accettato questa sfida.</p>`;
    return;
  }

  const xp = challenge.stakeXP || challenge.stake_xp || 0;
  resultEl.innerHTML = `
    <div class="pvp-code-found">
      <div>
        <p class="pvp-code-found__title">⚔️ ${escHtml(challenge.title)}</p>
        ${xp > 0 ? `<p class="pvp-code-found__meta">💰 ${xp} XP in palio</p>` : ''}
      </div>
      <button class="pvp-btn pvp-btn--primary"
              onclick="window._joinChallenge?.('${challenge.id}')">
        Accetta
      </button>
    </div>`;
};

// ── Azioni ────────────────────────────────────────────────────

window._switchPvPTab = switchPvPTab;

window._openCreateChallengeModal = function() {
  openModal('modal-create-challenge');
};

window._createChallenge = async function() {
  const title    = document.getElementById('ch-title')?.value.trim();
  const rules    = document.getElementById('ch-rules')?.value.trim();
  // FIX: leggi stakeXP correttamente e dai 50 come default se vuoto
  const stakeRaw = document.getElementById('ch-stake')?.value;
  const stakeXP  = stakeRaw ? parseInt(stakeRaw, 10) : 50;
  const type     = document.getElementById('ch-type')?.value    || 'mixed';
  const isPublic = document.getElementById('ch-public')?.checked !== false;
  const expires  = document.getElementById('ch-expires')?.value || null;

  if (!title) return toast('Inserisci un titolo alla sfida', 'error');
  if (isNaN(stakeXP) || stakeXP < 1)
    return toast('XP in palio deve essere almeno 1', 'error');

  const { ok, data, error } = await Challenges.create({
    title, rules, stakeXP, type, isPublic, expiresAt: expires,
  });

  if (!ok) return toast(error || 'Errore nella creazione', 'error');

  playSound('challenge');

  const msg = data.isPublic
    ? '🌐 Sfida pubblica creata!'
    : `🔑 Sfida privata creata! Codice: ${data.joinCode}`;
  toast(msg, 'success');

  // Reset campi
  ['ch-title', 'ch-rules'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const stakeEl = document.getElementById('ch-stake');
  if (stakeEl) stakeEl.value = '50';

  closeModal('modal-create-challenge');
  _pvpTab = 'active';
  renderPvP();
};

window._joinChallenge = async function(challengeId) {
  const existing = DB.challenges.find(c => c.id === challengeId);
  if (existing) {
    if (existing.creatorId  === CUR.id)
      return toast('Sei il creatore di questa sfida', 'error');
    if (existing.opponentId === CUR.id)
      return toast('Hai già accettato questa sfida', 'error');
  }

  const { ok, error } = await Challenges.join(challengeId, CUR.id);
  if (!ok) return toast(error || "Errore nell'accettare la sfida", 'error');

  playSound('challenge');
  toast('Ti sei unito alla sfida! ⚔️', 'success');
  _pvpTab = 'active';
  renderPvP();
};

window._declareWinner = async function(challengeId, winnerId) {
  const challenge = DB.challenges.find(c => c.id === challengeId);
  if (!challenge) return toast('Sfida non trovata', 'error');

  if (!confirm('Confermi il risultato? Questa azione non è reversibile.')) return;

  const isDraw = winnerId === 'draw';
  const { ok }  = await Challenges.declareWinner(challengeId, isDraw ? null : winnerId);
  if (!ok) return toast('Errore nella dichiarazione del vincitore', 'error');

  const xpStake = challenge.stakeXP || challenge.stake_xp || 50;

  if (!isDraw && winnerId === CUR.id) {
    const earned = await awardXP(xpStake * 2, 'sfide');
    await Feed.create({
      content:  `🏆 Ho vinto la sfida: "${challenge.title}"!`,
      category: 'sfide',
      xpEarned: earned,
      refType:  'challenge',
      refId:    challengeId,
    });
    toast(`Vittoria! +${earned} XP 🏆`, 'success');
    playSound('trophy');
  } else if (isDraw) {
    const earned = await awardXP(Math.round(xpStake * 0.5), 'sfide');
    toast(`Pareggio! +${earned} XP 🤝`, 'info');
    playSound('tap');
  } else {
    toast('Sconfitta registrata. Ci riproverai! 💪', 'info');
    playSound('error');
  }

  renderPvP();
};
