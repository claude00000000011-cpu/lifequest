// ============================================================
// screens/pvp.js — Sfide PvP
// NEW: conferma vittoria, limite 3 sfide/giorno, cap XP
// ============================================================

import { CUR, DB } from '../db.js';
import { Challenges, Feed, Users } from '../api.js';
import { awardXP } from '../xp.js';
import { escHtml, toast, today } from '../utils.js';
import { playSound } from '../audio.js';
import { openModal, closeModal } from '../modals.js';
import { calcLevel } from '../xp.js';

let _pvpTab = 'active';

export function switchPvPTab(t) { _pvpTab = t; renderPvP(); }

// ── Limiti ────────────────────────────────────────────────────

const MAX_DAILY_JOINS = 3;
const MAX_XP_ABS      = 200;

function xpCap(requestedXP) {
  const level  = calcLevel(CUR?.xp || 0);
  const capByLevel = level * 20;
  return Math.min(requestedXP, capByLevel, MAX_XP_ABS);
}

function dailyJoinsCount() {
  const t = today();
  return DB.challenges.filter(c =>
    c.opponentId === CUR?.id &&
    c.joinedAt?.startsWith(t)
  ).length;
}

// ── Render principale ─────────────────────────────────────────

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
          <input type="number" id="join-code-input"
                 placeholder="Codice a 4 cifre"
                 min="1000" max="9999" class="pvp-code-input" />
          <button class="pvp-search-btn" onclick="window._joinByCode?.()">Cerca</button>
        </div>
        <div id="join-code-result"></div>
      </div>` : ''}

    <div id="pvp-list"><div class="empty-state" style="padding:2rem">Caricamento…</div></div>
  `;

  if (_pvpTab === 'active') {
    const { ok, data } = await Challenges.list(CUR.id);
    const cloud = ok ? data : [];

    const cloudIds  = new Set(cloud.map(c => c.id));
    const localOnly = DB.challenges.filter(
      c => (c.creatorId === CUR.id || c.opponentId === CUR.id) && !cloudIds.has(c.id)
    );
    const merged = [...cloud, ...localOnly].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    // Carica profili mancanti
    const userIds = [...new Set(
      merged.flatMap(c => [c.creatorId, c.opponentId, c.claimedWinnerId]).filter(Boolean)
    )].filter(id => !DB.users[id]);
    if (userIds.length) await Promise.all(userIds.map(id => Users.get(id)));

    renderChallengeList(merged, 'pvp-list', false);
  } else {
    const { ok, data } = await Challenges.listPublic();
    const list = ok ? data : [];

    const userIds = [...new Set(list.map(c => c.creatorId).filter(Boolean))]
      .filter(id => !DB.users[id]);
    if (userIds.length) await Promise.all(userIds.map(id => Users.get(id)));

    renderChallengeList(list, 'pvp-list', true);
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

  const otherUserId = isCreator ? c.opponentId : c.creatorId;
  const otherUser   = otherUserId ? DB.users[otherUserId] : null;

  // Stato conferma vittoria
  const hasClaim       = !!c.claimedWinnerId;
  const iClaimedWin    = c.claimedWinnerId === CUR.id;
  const otherClaimed   = hasClaim && !iClaimedWin && alreadyIn;
  const claimantUser   = hasClaim ? DB.users[c.claimedWinnerId] : null;

  // Posso dichiarare solo se la sfida è active, sono dentro, e nessuno ha ancora dichiarato
  const canDeclare = alreadyIn && c.status === 'active' && !hasClaim;

  const statusBadge = {
    open:      '<span class="badge badge--green">Aperta</span>',
    active:    '<span class="badge badge--yellow">In corso</span>',
    completed: '<span class="badge badge--gray">Conclusa</span>',
  }[c.status] || '';

  const typeIcon = { athletic: '🏋️', mental: '🧠', mixed: '⚔️' }[c.type] || '⚔️';
  const xp       = c.stakeXP || c.stake_xp || 0;
  const cappedXP = xpCap(xp);

  const actionBtns = [];

  // Unisciti (sfide pubbliche)
  if (canJoin) {
    const joinsToday = dailyJoinsCount();
    if (joinsToday >= MAX_DAILY_JOINS) {
      actionBtns.push(`<p class="pvp-waiting">⏳ Hai già accettato ${MAX_DAILY_JOINS} sfide oggi. Torna domani!</p>`);
    } else {
      actionBtns.push(`
        <button class="pvp-btn pvp-btn--primary"
                onclick="window._joinChallenge?.('${c.id}')">
          ⚔️ Unisciti (${MAX_DAILY_JOINS - joinsToday} rimaste oggi)
        </button>`);
    }
  }

  // In attesa avversario
  if (alreadyIn && c.status === 'open') {
    actionBtns.push(`<p class="pvp-waiting">⏳ In attesa di un avversario…</p>`);
  }

  // Dichiarazione vittoria (nessuno ha ancora dichiarato)
  if (canDeclare) {
    actionBtns.push(`
      <button class="pvp-btn pvp-btn--primary"
              onclick="window._claimWin?.('${c.id}','${CUR.id}')">
        🏆 Ho vinto
      </button>`);
    if (otherUser) {
      actionBtns.push(`
        <button class="pvp-btn"
                onclick="window._claimWin?.('${c.id}','${otherUserId}')">
          🏳 Ha vinto @${escHtml(otherUser.username)}
        </button>`);
    }
    actionBtns.push(`
      <button class="pvp-btn"
              onclick="window._claimDraw?.('${c.id}')">
        🤝 Pareggio
      </button>`);
  }

  // L'altro ha dichiarato di aver vinto — io devo confermare o contestare
  if (otherClaimed) {
    actionBtns.push(`
      <div class="pvp-confirm-box">
        <p class="pvp-confirm-msg">
          ⚠️ <strong>@${escHtml(claimantUser?.username || '?')}</strong> ha dichiarato di aver vinto.
          Confermi?
        </p>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
          <button class="pvp-btn pvp-btn--primary"
                  onclick="window._confirmWin?.('${c.id}','${c.claimedWinnerId}')">
            ✅ Sì, ha vinto
          </button>
          <button class="pvp-btn"
                  onclick="window._contestWin?.('${c.id}')">
            ❌ Contesto — pareggio
          </button>
        </div>
      </div>`);
  }

  // Io ho dichiarato, aspetto conferma
  if (iClaimedWin && c.status === 'active') {
    actionBtns.push(`
      <p class="pvp-waiting">
        ⏳ Hai dichiarato vittoria. In attesa che @${escHtml(otherUser?.username || '?')} confermi…
      </p>`);
  }

  // Sfida conclusa
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
        ${xp > 0 ? `<span>💰 ${cappedXP} XP${cappedXP < xp ? ` <small style="color:var(--text-3)">(cap)</small>` : ''}</span>` : ''}
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

  let challenge = DB.challenges.find(
    c => String(c.joinCode) === raw && c.status === 'open'
  );

  if (!challenge) {
    const { ok: found, data } = await Challenges.findByCode(raw);
    if (found && data) challenge = data;
  }

  if (!challenge) {
    resultEl.innerHTML =
      `<p class="pvp-code-error">Nessuna sfida trovata con codice "${escHtml(raw)}".</p>`;
    return;
  }

  if (challenge.creatorId === CUR.id) {
    resultEl.innerHTML = `<p class="pvp-code-warn">Sei tu il creatore di questa sfida!</p>`;
    return;
  }
  if (challenge.opponentId === CUR.id) {
    resultEl.innerHTML = `<p class="pvp-code-warn">Hai già accettato questa sfida.</p>`;
    return;
  }

  const joinsToday = dailyJoinsCount();
  if (joinsToday >= MAX_DAILY_JOINS) {
    resultEl.innerHTML =
      `<p class="pvp-code-error">Hai già accettato ${MAX_DAILY_JOINS} sfide oggi. Torna domani!</p>`;
    return;
  }

  const xp       = challenge.stakeXP || 0;
  const cappedXP = xpCap(xp);
  resultEl.innerHTML = `
    <div class="pvp-code-found">
      <div>
        <p class="pvp-code-found__title">⚔️ ${escHtml(challenge.title)}</p>
        ${cappedXP > 0 ? `<p class="pvp-code-found__meta">💰 ${cappedXP} XP in palio</p>` : ''}
        <p style="font-size:0.75rem;color:var(--text-3)">${MAX_DAILY_JOINS - joinsToday} accettazioni rimaste oggi</p>
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
  const type     = document.getElementById('ch-type')?.value || 'mixed';
  const isPublic = document.getElementById('ch-public')?.checked !== false;
  const expires  = document.getElementById('ch-expires')?.value || null;

  if (!title) return toast('Inserisci un titolo alla sfida', 'error');

  const { ok, data, error } = await Challenges.create({
    title, rules, stakeXP: 50, type, isPublic, expiresAt: expires,
  });

  if (!ok) return toast(error || 'Errore nella creazione', 'error');

  playSound('challenge');

  const msg = data.isPublic
    ? '🌐 Sfida pubblica creata!'
    : `🔑 Sfida privata creata! Codice: ${data.joinCode}`;
  toast(msg, 'success');

  ['ch-title', 'ch-rules'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  closeModal('modal-create-challenge');
  _pvpTab = 'active';
  renderPvP();
};

window._joinChallenge = async function(challengeId) {
  const joinsToday = dailyJoinsCount();
  if (joinsToday >= MAX_DAILY_JOINS) {
    return toast(`Hai già accettato ${MAX_DAILY_JOINS} sfide oggi!`, 'error');
  }

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

// ── Dichiarazione vittoria (nuovo sistema) ────────────────────

// Dichiaro che ho vinto (o che ha vinto l'altro)
window._claimWin = async function(challengeId, claimedWinnerId) {
  const challenge = DB.challenges.find(c => c.id === challengeId);
  if (!challenge) return toast('Sfida non trovata', 'error');

  const winner = DB.users[claimedWinnerId];
  const isSelf = claimedWinnerId === CUR.id;
  const msg    = isSelf
    ? 'Stai dichiarando di aver vinto. L\'avversario dovrà confermare.'
    : `Stai dichiarando che ha vinto @${winner?.username || '?'}. Confermi?`;

  if (!confirm(msg)) return;

  const { ok, error } = await Challenges.claimWinner(challengeId, claimedWinnerId);
  if (!ok) return toast(error || 'Errore', 'error');

  playSound('tap');
  toast('Dichiarazione inviata. In attesa di conferma…', 'info');

  // Notifica all'avversario
  const otherUserId = challenge.creatorId === CUR.id ? challenge.opponentId : challenge.creatorId;
  if (otherUserId) {
    const { pushNotification } = await import('./home.js');
    pushNotification({
      toUserId:     otherUserId,
      type:         'pvp_claim',
      fromUsername: CUR.username,
      extra:        isSelf ? 'ha dichiarato vittoria' : 'ti ha concesso la vittoria',
    });
  }

  renderPvP();
};

// Pareggio diretto (entrambi d'accordo)
window._claimDraw = async function(challengeId) {
  if (!confirm('Dichiari pareggio? Entrambi riceverete metà degli XP.')) return;
  await _finalizeResult(challengeId, null, true);
};

// L'avversario conferma la vittoria dichiarata
window._confirmWin = async function(challengeId, winnerId) {
  if (!confirm(`Confermi che @${DB.users[winnerId]?.username || '?'} ha vinto?`)) return;
  await _finalizeResult(challengeId, winnerId, false);
};

// L'avversario contesta → pareggio automatico
window._contestWin = async function(challengeId) {
  if (!confirm('Contesti la vittoria? Il risultato sarà pareggio.')) return;
  await _finalizeResult(challengeId, null, true);
};

async function _finalizeResult(challengeId, winnerId, isDraw) {
  const challenge = DB.challenges.find(c => c.id === challengeId);
  if (!challenge) return toast('Sfida non trovata', 'error');

  const { ok } = await Challenges.declareWinner(challengeId, isDraw ? null : winnerId);
  if (!ok) return toast('Errore nella dichiarazione del vincitore', 'error');

  const xpStake  = challenge.stakeXP || challenge.stake_xp || 50;
  const cappedXP = xpCap(xpStake);

  if (isDraw) {
    const earned = await awardXP(Math.round(cappedXP * 0.5), 'sfide');
    toast(`Pareggio! +${earned} XP 🤝`, 'info');
    playSound('tap');
  } else if (winnerId === CUR.id) {
    const earned = await awardXP(cappedXP * 2, 'sfide');
    await Feed.create({
      content:  `🏆 Ho vinto la sfida: "${challenge.title}"!`,
      category: 'sfide',
      xpEarned: earned,
      refType:  'challenge',
      refId:    challengeId,
    });
    toast(`Vittoria! +${earned} XP 🏆`, 'success');
    playSound('trophy');
  } else {
    toast('Risultato registrato. Ci riproverai! 💪', 'info');
    playSound('error');
  }

  renderPvP();
}
