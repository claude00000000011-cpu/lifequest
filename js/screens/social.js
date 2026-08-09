// ============================================================
// screens/social.js — Social: follower, following, ricerca
// ============================================================

import { CUR, DB } from '../db.js';
import { Users } from '../api.js';
import { escHtml, toast, debounce } from '../utils.js';
import { playSound } from '../audio.js';

let _socialTab = 'following'; // 'following' | 'followers' | 'search'

export function switchSocialTab(t) { _socialTab = t; renderFriendsScreen(); }

export function renderFriendsScreen() {
  if (!CUR) return;
  const container = document.getElementById('screen-social');
  if (!container) return;

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

    ${{ following: renderUserList(following, true),
        followers: renderUserList(followers, false),
        search:    renderSearchPanel(),
      }[_socialTab]}
  `;
}

// ── Lista utenti ──────────────────────────────────────────────

function renderUserList(userIds, isFollowing) {
  if (!userIds.length) {
    return `<div class="empty-state">
      ${isFollowing
        ? 'Non segui ancora nessuno. Cerca nuovi utenti!'
        : 'Nessun follower ancora.'}
    </div>`;
  }

  const users = userIds
    .map(id => DB.users[id])
    .filter(Boolean);

  if (!users.length) {
    return `<div class="empty-state">Dati non ancora sincronizzati.</div>`;
  }

  return `<div class="user-list">
    ${users.map(u => userCard(u, isFollowing)).join('')}
  </div>`;
}

function userCard(user, isFollowing) {
  const myFollowing = (DB.users[CUR.id]?.following || []);
  const iFollow     = myFollowing.includes(user.id);
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
        <span>${(user.followers || []).length} follower</span>
      </div>
      <button class="${iFollow ? 'btn-unfollow' : 'btn-follow'}"
              onclick="event.stopPropagation(); window._toggleFollow?.('${user.id}', ${iFollow})">
        ${iFollow ? 'Unfollow' : 'Follow'}
      </button>
    </div>`;
}

// ── Ricerca ───────────────────────────────────────────────────

function renderSearchPanel() {
  return `
    <div class="search-panel">
      <div class="search-bar">
        <input type="text" id="user-search-input"
               placeholder="Cerca username…"
               oninput="window._searchUsers?.(this.value)">
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

  container.innerHTML = '<p class="search-hint">Ricerca…</p>';
  const { ok, data } = await Users.search(query);
  const results = ok ? data : [];

  if (!results.length) {
    container.innerHTML = `<p class="search-hint">Nessun utente trovato per "${escHtml(query)}".</p>`;
    return;
  }

  container.innerHTML = results.map(u => userCard(u, false)).join('');
}, 350);

// ── Follow / Unfollow ─────────────────────────────────────────

window._toggleFollow = async function(targetId, currentlyFollowing) {
  if (!CUR || targetId === CUR.id) return;

  if (currentlyFollowing) {
    const { ok } = await Users.unfollow(CUR.id, targetId);
    if (!ok) return toast('Errore', 'error');
    toast('Non segui più questo utente.', 'info');
  } else {
    const { ok } = await Users.follow(CUR.id, targetId);
    if (!ok) return toast('Errore', 'error');
    toast('Stai seguendo questo utente! 👥', 'success');
  }

  playSound('tap');
  renderFriendsScreen();
};

// ── Profilo pubblico ──────────────────────────────────────────

window._viewUserProfile = async function(userId) {
  const user = DB.users[userId];
  if (!user) {
    const { ok, data } = await Users.get(userId);
    if (!ok) return toast('Profilo non disponibile', 'error');
  }

  const u         = DB.users[userId] || {};
  const myUser    = DB.users[CUR.id] || {};
  const iFollow   = (myUser.following || []).includes(userId);
  const isMe      = userId === CUR.id;
  const initials  = (u.username || '?').slice(0, 2).toUpperCase();

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
        <div><strong>${u.xp?.toLocaleString() || 0}</strong><span>XP</span></div>
        <div><strong>${(u.following || []).length}</strong><span>Seguiti</span></div>
        <div><strong>${(u.followers || []).length}</strong><span>Follower</span></div>
      </div>

      ${u.languages?.length ? `
        <p>🌍 ${u.languages.join(', ')}</p>` : ''}

      ${common.length ? `
        <div class="profile-common-books">
          <h4>📚 ${common.length} libri in comune</h4>
          ${common.slice(0, 3).map(b => `<span>${escHtml(b.title)}</span>`).join(' · ')}
        </div>` : ''}

      ${!isMe ? `
        <button class="${iFollow ? 'btn-unfollow' : 'btn-primary'}"
                onclick="window._toggleFollow?.('${userId}', ${iFollow}); document.getElementById('modal-profile').classList.add('modal--hidden')">
          ${iFollow ? '✖ Smetti di seguire' : '+ Segui'}
        </button>` : ''}

      ${theirBooks.length ? `
        <h4>📖 Libreria (${theirBooks.length})</h4>
        <div class="profile-books">
          ${theirBooks.slice(0, 5).map(b => `
            <span class="profile-book-tag">${escHtml(b.title)}</span>`).join('')}
        </div>` : ''}
    </div>`;

  const { openModal } = await import('../modals.js');
  openModal('modal-profile');
};
