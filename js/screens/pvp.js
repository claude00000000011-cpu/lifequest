// ============================================================
// screens/pvp.js — Sfide PvP tra utenti
// ============================================================

import { CUR, DB } from '../db.js';
import { Challenges, Feed } from '../api.js';
import { awardXP } from '../xp.js';
import { escHtml, toast, today } from '../utils.js';
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
      <div class="join-code-box" style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius);padding:0.85rem;margin-bottom:1rem">
        <p style="font-size:0.85rem;color:var(--text-2);margin-bottom:0.5rem">🔑 Hai un codice sfida privata?</p>
        <div style="display:flex;gap:0.5rem">
          <input type="text" id="join-code-input" placeholder="Inserisci codice (4 cifre)"
                 maxlength="4" style="flex:1;font-size:0.9rem">
          <button class="btn-sm btn-primary" onclick="window._joinByCode?.()">Cerca</button>
        </div>
        <div id="join-code-result" style="margin-top:0.5rem"></div>
      </div>` : ''}

    <div id="pvp-list">Caricamento…</div>
  `;

  if (_pvpTab === 'active') {
    const { ok, data } = await Challenges.list(CUR.id);
    renderChallengeList(ok ? data : [], 'pvp-list', false);
  } else {
    const { ok, data } = await Challenges.listPublic();
    renderChallengeList(ok ? data : [], 'pvp-list', true);
  }
}

function renderChallengeList(challenges, containerId, isPublic) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!challenges.length) {
    container.innerHTML = `<div class="empty-state">
      Nessuna sfida ${isPublic ? 'pubblica' : 'attiva'}.
      ${!isPublic ? 'Creane una!' : ''}
    </div>`;
    return;
  }

  container.innerHTML = challenges.map(c => {
    const creator  = DB.users[c.creatorId];
    const opponent = c.opponentId ? DB.users[c.opponentId] : null;
    const isCreator  = c.creatorId === CUR.id;
    const isOpponent = c.opponentId === CUR.id;

    // Blocca se già partecipante o sfida non aperta
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

    return `
      <div class="challenge-card">
        <div class="challenge-card__header">
          <span>${typeIcon} ${escHtml(c.title)}</span>
          ${statusBadge}
        </div>
        <p class="challenge-rules">${escHtml(c.rules || '—')}</p>
        <div class="challenge-meta">
          <span>👤 @${escHtml(creator?.username || '?')}</span>
          ${opponent ? `<span>🆚 @${escHtml(opponent.username)}</span>` : '<span>🆚 In attesa avversario</span>'}
          <span>💰 ${c.stakeXP} XP in palio</span>
          ${c.expiresAt ? `<span>📅 Scade: ${c.expiresAt}</span>` : ''}
          ${c.joinCode && isCreator ? `<span>🔑 Codice: <strong>${c.joinCode}</strong></span>` : ''}
        </div>
        <div class="challenge-card__actions">
          ${canJoin ? `
            <button class="btn-primary" onclick="window._joinChallenge?.('${c.id}')">
              ⚔️ Unisciti
            </button>` : ''}
          ${alreadyIn && c.status === 'open' ? `
            <p style="font-size:0.82rem;color:var(--text-3)">In attesa che qualcuno accetti…</p>` : ''}
          ${canDeclare ? `
            <button class="btn-primary" onclick="window._declareWinner?.('${c.id}','${CUR.id}')">
              🏆 Ho vinto io
            </button>
            ${otherUser ? `
              <button onclick="window._declareWinner?.('${c.id}','${otherUserId}')">
                🏳️ Ha vinto @${escHtml(otherUser.username)}
              </button>` : ''}
            <button onclick="window._declareWinner?.('${c.id}','draw')">
              🤝 Pareggio
            </button>` : ''}
          ${c.status === 'completed' ? `
            <p style="font-size:0.85rem;color:var(--success)">
              🏆 Vincitore: @${escHtml(c.winnerId ? (DB.users[c.winnerId]?.username || 'N/D') : 'Pareggio')}
            </p>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── Cerca sfida per codice ────────────────────────────────────

window._joinByCode = async function() {
  const code = document.getElementById('join-code-input')?.value.trim();
  const resultEl = document.getElementById('join-code-result');
  if (!code || code.length !== 4) {
    if (resultEl) resultEl.innerHTML = `<p style="color:var(--danger);font-size:0.82rem">Inserisci un codice di 4 cifre.</p>`;
    return;
  }

  if (resultEl) resultEl.innerHTML = `<p style="color:var(--text-3);font-size:0.82rem">Ricerca in corso…</p>`;

  // Cerca nel DB locale prima
  let challenge = DB.challenges.find(c => c.joinCode === code && c.status === 'open');

  // Se non trovata localmente, cerca su Supabase
  if (!challenge) {
    const { supabase } = await import('../../supabase.js');
    const { data } = await supabase
      .from('challenges')
      .select('*')
      .eq('join_code', code)
      .eq('status', 'open')
      .maybeSingle();

    if (data) {
      const { toCamel } = await import('../api.js').catch(() => ({}));
      challenge = data;
    }
  }

  if (!challenge) {
    if (resultEl) resultEl.innerHTML = `<p style="color:var(--danger);font-size:0.82rem">Nessuna sfida trovata con codice "${code}".</p>`;
    return;
  }

  // Blocca se già partecipante
  if (challenge.creator_id === CUR.id || challenge.creatorId === CUR.id) {
    if (resultEl) resultEl.innerHTML = `<p style="color:var(--warning);font-size:0.82rem">Sei tu il creatore di questa sfida!</p>`;
    return;
  }
  if (challenge.opponent_id === CUR.id || challenge.opponentId === CUR.id) {
    if (resultEl) resultEl.innerHTML = `<p style="color:var(--warning);font-size:0.82rem">Hai già accettato questa sfida.</p>`;
    return;
  }

  const title = challenge.title || challenge.title;
  if (resultEl) resultEl.innerHTML = `
    <div style="background:var(--bg-3);border:1px solid var(--border);border-radius:var(--radius-sm);padding:0.65rem;margin-top:0.5rem">
      <p style="font-size:0.88rem;font-weight:700;margin-bottom:0.25rem">⚔️ ${escHtml(title)}</p>
      <p style="font-size:0.8rem;color:var(--text-3);margin-bottom:0.5rem">💰 ${challenge.stake_xp || challenge.stakeXP} XP in palio</p>
      <button class="btn-sm btn-primary" onclick="window._joinChallenge?.('${challenge.id}')">
        Accetta sfida
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
  const stakeXP  = parseInt(document.getElementById('ch-stake')?.value || '50');
  const type     = document.getElementById('ch-type')?.value || 'mixed';
  const isPublic = document.getElementById('ch-public')?.checked !== false;
  const expires  = document.getElementById('ch-expires')?.value || null;

  if (!title) return toast('Inserisci un titolo alla sfida', 'error');
  if (stakeXP < 1) return toast('XP in palio deve essere almeno 1', 'error');

  const { ok, data, error } = await Challenges.create({
    title, rules, stakeXP, type, isPublic, expiresAt: expires,
  });

  if (!ok) return toast(error || 'Errore nella creazione', 'error');

  playSound('challenge');
  toast(`Sfida creata! ${data.isPublic ? '🌐 Pubblica' : `🔑 Codice: ${data.joinCode}`}`, 'success');
  closeModal('modal-create-challenge');
  renderPvP();
};

window._joinChallenge = async function(challengeId) {
  // Blocca se già partecipante
  const existing = DB.challenges.find(c => c.id === challengeId);
  if (existing) {
    if (existing.creatorId === CUR.id) return toast('Sei il creatore di questa sfida', 'error');
    if (existing.opponentId === CUR.id) return toast('Hai già accettato questa sfida', 'error');
  }

  const { ok, error } = await Challenges.join(challengeId, CUR.id);
  if (!ok) return toast(error || 'Errore', 'error');
  playSound('challenge');
  toast('Ti sei unito alla sfida! ⚔️', 'success');
  _pvpTab = 'active';
  renderPvP();
};

window._declareWinner = async function(challengeId, winnerId) {
  const challenge = DB.challenges.find(c => c.id === challengeId);
  if (!challenge) return;

  if (!confirm(`Confermi il risultato?`)) return;

  const isDraw = winnerId === 'draw';
  const { ok } = await Challenges.declareWinner(challengeId, isDraw ? null : winnerId);
  if (!ok) return toast('Errore nella dichiarazione', 'error');

  if (!isDraw && winnerId === CUR.id) {
    const earned = await awardXP(challenge.stakeXP * 2, 'sfide');
    await Feed.create({
      content:  `🏆 Ho vinto la sfida: "${challenge.title}"`,
      category: 'sfide',
      xpEarned: earned,
      refType:  'challenge',
      refId:    challengeId,
    });
    toast(`Vittoria! +${earned} XP 🏆`, 'success');
  } else if (isDraw) {
    const earned = await awardXP(Math.round(challenge.stakeXP * 0.5), 'sfide');
    toast(`Pareggio! +${earned} XP 🤝`, 'success');
  } else {
    toast('Sconfitta registrata. Prossima volta!', 'info');
  }

  playSound(isDraw ? 'tap' : winnerId === CUR.id ? 'trophy' : 'error');
  renderPvP();
};
