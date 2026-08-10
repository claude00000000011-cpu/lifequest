// ============================================================
// screens/social.js — Social: follower, following, ricerca
// ============================================================
// BUG FIXATI:
// 1. _toggleFollow aggiorna DB.users[CUR.id] in memoria PRIMA
//    di chiamare renderFriendsScreen, così i contatori sono corretti
// 2. refreshCUR() viene chiamato dopo ogni follow/unfollow
// 3. userCard legge sempre da DB.users[CUR.id] per l'array following
// ============================================================

import { CUR, DB, refreshCUR } from '../db.js';
import { Users } from '../api.js';
import { escHtml, toast, debounce } from '../utils.js';
import { playSound } from '../audio.js';

let _socialTab = 'following';

export function switchSocialTab(t) { _socialTab = t; renderFriendsScreen(); }

export function renderFriendsScreen() {
  if (!CUR) return;
  const container = document.getElementById('screen-social');
  if (!container) return;

  // Leggi SEMPRE da DB.users per avere i dati più freschi
  const user      = DB.users[CUR.id] || CUR;
  const following = user.following || [];
  const followers = user.followers || [];

  const tabs = [
    { id: 'following', label: `👣 Seguiti (${following.length})`  },
    { id: 'followers', label: `👥 Follower (${followers.length})` },
    { id: 'search',    label: '🔍 Cerca'                          },
  ];

  container.innerHTML = `
    <div class="screen-header">
      <h2>Social</h2>
    </div>
    <div class="tab-row">
      ${tabs.map(t => `
        <button class="tab-btn ${_socialTab === t.id ? 'tab-btn--active' : ''}"
                onclick="window._switchSocialTab?.('${t.id}')">
          ${t.label}
        </button>`).join('')}
    </div>

    ${{
      following: renderUserList(following, true),
      followers: renderUserList(followers, false),
      search:    renderSearchPanel(),
    }[_socialTab]}
  `;
}

function renderUserList(userIds, isFollowing) {
  if (!userIds.length) {
    return `<div class="empty-state">
      ${isFollowing
        ? 'Non segui ancora nessuno. Cercane con il tab 🔍!'
        : 'Nessun follower ancora.'}
    </div>`;
  }

  const users = userIds.map(id => DB.users[id]).filter(Boolean);

  if (!users.length) {
    return `<div class="empty-state">Dati non ancora sincronizzati. Riprova tra poco.</div>`;
  }

  return `<div class="user-list">
    ${users.map(u => userCard(u)).join('')}
  </div>`;
}

function userCard(user) {
  // Legge SEMPRE da DB.users[CUR.id] per avere il following aggiornato
  const myFollowing = DB.users[CUR.id]?.following || CUR.following || [];
  const iFollow     = myFollowing.includes(user.id);
  const isMe        = user.id === CUR.id;
  const initials    = user.username.slice(0, 2).toUpperCase();

  const avatar = user.avatarUrl
    ? `<div class="user-card__avatar" style="background-image:url(${user.avatarUrl})"></div>`
    : `<div class="user-card__avatar user-card__avatar--initials">${initials}</div>`;

  return `
    <div class="user-card" onclick="window._viewUserProfile?.('${user.id}')">
      ${avatar}
      <div class="user-card__info">
        <strong>@${escHtml(user.username)}</strong>
        <span>Lv. ${user.level || 1} — ${escHtml(user.rankTitle || 'Novizio')}</span>
        <span style="font-size:0.75rem;color:var(--text-3)">${(user.followers || []).length} follower</span>
      </div>
      ${!isMe ? `
      <button class="${iFollow ? 'btn-unfollow' : 'btn-follow'}"
              onclick="event.stopPropagation(); window._socialToggleFollow?.('${user.id}', ${iFollow})">
        ${iFollow ? 'Unfollow' : 'Follow'}
      </button>` : '<span class="badge">Tu</span>'}
    </div>`;
}

function renderSearchPanel() {
  return `
    <div class="search-panel">
      <div class="search-bar">
        <input type="text" id="user-search-input"
               placeholder="Cerca username…"
               oninput="window._searchUsers?.(this.value)"
               autocomplete="off">
      </div>
      <div id="search-results" class="user-list">
        <p class="search-hint">Scrivi almeno 2 caratteri per cercare.</p>
      </div>
    </div>`;
}

window._switchSocialTab = switchSocialTab;

window._searchUsers = debounce(async function(query) {
  const container = document.getElementById('search-results');
  if (!container) return;

  if (!query || query.length < 2) {
    container.innerHTML = '<p class="search-hint">Scrivi almeno 2 caratteri per cercare.</p>';
    return;
  }

  container.innerHTML = '<p class="search-hint">Ricerca in corso…</p>';
  const { ok, data } = await Users.search(query);
  const results = ok ? data : [];

  if (!results.length) {
    container.innerHTML = `<p class="search-hint">Nessun utente trovato per "${escHtml(query)}".</p>`;
    return;
  }

  // Aggiungi gli utenti trovati al DB locale (per mostrare l'avatar e i dati)
  results.forEach(u => { if (!DB.users[u.id]) DB.users[u.id] = u; });

  container.innerHTML = `<div class="user-list">${results.map(u => userCard(u)).join('')}</div>`;
}, 350);

// ── Follow / Unfollow ─────────────────────────────────────────
// NOTA: questa funzione è separata da quella in libri.js
// per evitare dipendenze circolari tra moduli.

window._socialToggleFollow = async function(targetId, currentlyFollowing) {
  if (!CUR || targetId === CUR.id) return;

  // 1. Aggiorna DB locale IMMEDIATAMENTE (ottimistic update)
  const user   = DB.users[CUR.id]   || {};
  const target = DB.users[targetId] || {};

  if (currentlyFollowing) {
    DB.users[CUR.id] = {
      ...user,
      following: (user.following || []).filter(id => id !== targetId),
    };
    DB.users[targetId] = {
      ...target,
      followers: (target.followers || []).filter(id => id !== CUR.id),
    };
  } else {
    DB.users[CUR.id] = {
      ...user,
      following: [...new Set([...(user.following || []), targetId])],
    };
    DB.users[targetId] = {
      ...target,
      followers: [...new Set([...(target.followers || []), CUR.id])],
    };
  }

  // 2. Aggiorna CUR in sessione
  refreshCUR();

  // 3. Re-render immediato con dati aggiornati
  renderFriendsScreen();

  // 4. Sync cloud in background
  if (currentlyFollowing) {
    const { ok } = await Users.unfollow(CUR.id, targetId);
    if (!ok) toast('Errore nella sincronizzazione', 'error');
    else toast('Non segui più questo utente.', 'info');
  } else {
    const { ok } = await Users.follow(CUR.id, targetId);
    if (!ok) toast('Errore nella sincronizzazione', 'error');
    else toast('Stai seguendo questo utente! 👥', 'success');
  }

  playSound('tap');
};

// ── Profilo pubblico ──────────────────────────────────────────

window._viewUserProfile = async function(userId) {
  // Carica l'utente se non in cache
  if (!DB.users[userId]) {
    const { ok, data } = await Users.get(userId);
    if (!ok) return toast('Profilo non disponibile', 'error');
  }

  const u       = DB.users[userId] || {};
  const myUser  = DB.users[CUR.id] || {};
  const iFollow = (myUser.following || []).includes(userId);
  const isMe    = userId === CUR.id;
  const initials = (u.username || '?').slice(0, 2).toUpperCase();

  const myBooks    = DB.books.filter(b => b.userId === CUR.id).map(b => b.title.toLowerCase());
  const theirBooks = DB.books.filter(b => b.userId === userId);
  const common     = theirBooks.filter(b => myBooks.includes(b.title.toLowerCase()));

  const modalContent = document.getElementById('modal-profile-content');
  if (!modalContent) return;

  const avatar = u.avatarUrl
    ? `<div class="profile-avatar" style="background-image:url(${u.avatarUrl})"></div>`
    : `<div class="profile-avatar profile-avatar--initials">${initials}</div>`;

  modalContent.innerHTML = `
    <div class="profile-modal">
      ${avatar}
      <h2>@${escHtml(u.username || '?')}</h2>
      <p>${escHtml(u.rankTitle || 'Novizio')} — Lv. ${u.level || 1}</p>

      <div class="profile-stats-row">
        <div><strong>${(u.xp || 0).toLocaleString()}</strong><span>XP</span></div>
        <div><strong>${(u.following || []).length}</strong><span>Seguiti</span></div>
        <div><strong>${(u.followers || []).length}</strong><span>Follower</span></div>
      </div>

      ${u.languages?.length ? `<p>🌍 ${u.languages.join(', ')}</p>` : ''}

      ${common.length ? `
        <div class="profile-common-books">
          <h4>📚 ${common.length} libri in comune</h4>
          <p style="font-size:0.8rem;color:var(--text-2)">${common.slice(0, 3).map(b => escHtml(b.title)).join(' · ')}</p>
        </div>` : ''}

      ${!isMe ? `
        <button id="profile-follow-btn"
                class="${iFollow ? 'btn-unfollow' : 'btn-primary'}"
                onclick="window._profileToggleFollow?.('${userId}', ${iFollow})">
          ${iFollow ? '✖ Smetti di seguire' : '+ Segui'}
        </button>` : `<span class="badge">Il tuo profilo</span>`}

      ${theirBooks.length ? `
        <h4 style="margin-top:1rem">📖 Libreria (${theirBooks.length})</h4>
        <div class="profile-books">
          ${theirBooks.slice(0, 5).map(b =>
            `<span class="profile-book-tag">${escHtml(b.title)}</span>`).join('')}
        </div>` : ''}
    </div>`;

  const { openModal } = await import('../modals.js');
  openModal('modal-profile');
};

// Follow/unfollow dal modal profilo
window._profileToggleFollow = async function(targetId, currentlyFollowing) {
  await window._socialToggleFollow?.(targetId, currentlyFollowing);

  // Aggiorna anche il bottone nel modal
  const btn = document.getElementById('profile-follow-btn');
  if (btn) {
    const nowFollowing = !currentlyFollowing;
    btn.className   = nowFollowing ? 'btn-unfollow' : 'btn-primary';
    btn.textContent = nowFollowing ? '✖ Smetti di seguire' : '+ Segui';
    btn.setAttribute('onclick', `window._profileToggleFollow?.('${targetId}', ${nowFollowing})`);
  }
};
