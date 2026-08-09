// ============================================================
// screens/pvp.js — Sfide PvP tra utenti
// ============================================================

import { CUR, DB } from '../db.js';
import { Challenges, Feed } from '../api.js';
import { awardXP } from '../xp.js';
import { escHtml, toast, today } from '../utils.js';
import { playSound } from '../audio.js';
import { openModal, closeModal } from '../modals.js';

let _pvpTab = 'active'; // 'active' | 'public' | 'create'

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
    const isCreator   = c.creatorId === CUR.id;
    const isOpponent  = c.opponentId === CUR.id;
    const canJoin     = isPublic && !isCreator && c.status === 'open';
    const canDeclare  = (isCreator || isOpponent) && c.status === 'active';

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
          ${opponent ? `<span>🆚 @${escHtml(opponent.username)}</span>` : ''}
          <span>💰 ${c.stakeXP} XP in palio</span>
          ${c.expiresAt ? `<span>📅 Scade: ${c.expiresAt}</span>` : ''}
          ${c.joinCode  ? `<span>🔑 Codice: ${c.joinCode}</span>` : ''}
        </div>
        <div class="challenge-card__actions">
          ${canJoin    ? `<button class="btn-primary" onclick="window._joinChallenge?.('${c.id}')">Unisciti</button>` : ''}
          ${canDeclare ? `
            <button class="btn-primary" onclick="window._declareWinner?.('${c.id}','${CUR.id}')">🏆 Ho vinto io</button>
            ${opponent ? `<button onclick="window._declareWinner?.('${c.id}','${c.opponentId === CUR.id ? c.creatorId : c.opponentId}')">🏳️ Ha vinto lui</button>` : ''}
            <button onclick="window._declareWinner?.('${c.id}','draw')">🤝 Pareggio</button>
          ` : ''}
          ${c.status === 'completed' && c.winnerId
            ? `<p>🏆 Vincitore: @${escHtml(DB.users[c.winnerId]?.username || 'N/D')}</p>`
            : ''}
        </div>
      </div>`;
  }).join('');
}

// ── Modal creazione ───────────────────────────────────────────

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
  const { ok, error } = await Challenges.join(challengeId, CUR.id);
  if (!ok) return toast(error || 'Errore', 'error');
  playSound('challenge');
  toast('Ti sei unito alla sfida! ⚔️', 'success');
  renderPvP();
};

window._declareWinner = async function(challengeId, winnerId) {
  const challenge = DB.challenges.find(c => c.id === challengeId);
  if (!challenge) return;

  const isDraw = winnerId === 'draw';
  const { ok } = await Challenges.declareWinner(challengeId, isDraw ? null : winnerId);
  if (!ok) return toast('Errore nella dichiarazione', 'error');

  if (!isDraw && winnerId === CUR.id) {
    const earned = await awardXP(challenge.stakeXP * 2, 'sfida');
    await Feed.create({
      content:  `🏆 Ho vinto la sfida: "${challenge.title}"`,
      category: 'sfida',
      xpEarned: earned,
      refType:  'challenge',
      refId:    challengeId,
    });
    toast(`Vittoria! +${earned} XP 🏆`, 'success');
  } else if (isDraw) {
    const earned = await awardXP(Math.round(challenge.stakeXP * 0.5), 'sfida');
    toast(`Pareggio! +${earned} XP 🤝`, 'success');
  } else {
    toast('Sconfitta registrata. Prossima volta!', 'info');
  }

  playSound(isDraw ? 'tap' : winnerId === CUR.id ? 'trophy' : 'error');
  renderPvP();
};
