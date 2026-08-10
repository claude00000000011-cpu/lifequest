// ============================================================
// screens/social.js — Social + notifiche follow
// ============================================================

import { CUR, DB, refreshCUR } from '../db.js';
import { Users } from '../api.js';
import { escHtml, toast, timeAgo, debounce } from '../utils.js';
import { playSound } from '../audio.js';

let _socialTab = 'following';

export function switchSocialTab(t) { _socialTab = t; renderFriendsScreen(); }

// ── Render principale (async per caricare utenti mancanti) ───

export async function renderFriendsScreen() {
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

  // Shell immediata con loading
  container.innerHTML = `
    <div class="screen-header"><h2>Social</h2></div>
    <div class="tab-row">
      ${tabs.map(t => `
        <button class="tab-btn ${_socialTab === t.id ? 'tab-btn--active' : ''}"
                onclick="window._switchSocialTab?.('${t.id}')">
          ${t.label}
        </button>`).join('')}
    </div>
    <div id="social-list-content">
      ${_socialTab === 'search' ? renderSearchPanel() : '<div class="feed-loading">Caricamento…</div>'}
    </div>
  `;

  if (_socialTab === 'search') return;

  const content = document.getElementById('social-list-content');
  const ids = _socialTab === 'following' ? following : followers;
  const html = await renderUserList(ids, _socialTab === 'following');
  if (content) content.innerHTML = html;
}

// ── Lista utenti (carica da Supabase quelli mancanti) ────────

async function renderUserList(userIds, isFollowing) {
  if (!userIds.length) return `<div class="empty-state">
    ${isFollowing ? 'Non segui ancora nessuno. Cerca con 🔍!' : 'Nessun follower ancora.'}
  </div>`;

  // Carica da Supabase gli utenti non ancora in cache locale
  const missing = userIds.filter(id => !DB.users[id]);
  if (missing.length) {
    await Promise.all(missing.map(id => Users.get(id)));
  }

  const users = userIds.map(id => DB.users[id]).filter(Boolean);
  if (!users.length) return `<div class="empty-state">Dati non disponibili.</div>`;

  return `<div class="user-list">${users.map(u => userCard(u)).join('')}</div>`;
}

function userCard(user) {
  const myFollowing = DB.users[CUR.id]?.following || CUR.following || [];
  const iFollow     = myFollowing.includes(user.id);
  const isMe        = user.id === CUR.id;
  const initials    = user.username.slice(0, 2).toUpperCase();
  const avatar      = user.avatarUrl
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
        <input type="text" id="user-search-input" placeholder="Cerca username…"
               oninput="window._searchUsers?.(this.value)" autocomplete="off">
      </div>
      <div id="search-results" class="user-list">
        <p class="search-hint">Scrivi almeno 2 caratteri per cercare.</p>
      </div>
    </div>`;
}

window._switchSocialTab = switchSocialTab;

window._syncFollowData = async function() {
  const user = DB.users[CUR.id] || {};
  const ids  = [...new Set([...(user.following || []), ...(user.followers || [])])];
  await Promise.all(ids.map(id => Users.get(id)));
  renderFriendsScreen();
  toast('Dati sincronizzati', 'success');
};

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
  results.forEach(u => { if (!DB.users[u.id]) DB.users[u.id] = u; });
  container.innerHTML = `<div class="user-list">${results.map(u => userCard(u)).join('')}</div>`;
}, 350);

// ── Follow / Unfollow con notifica ────────────────────────────

window._socialToggleFollow = async function(targetId, currentlyFollowing) {
  if (!CUR || targetId === CUR.id) return;

  const user   = DB.users[CUR.id]   || {};
  const target = DB.users[targetId] || {};

  if (currentlyFollowing) {
    DB.users[CUR.id]   = { ...user,   following: (user.following || []).filter(id => id !== targetId) };
    DB.users[targetId] = { ...target, followers: (target.followers || []).filter(id => id !== CUR.id) };
  } else {
    DB.users[CUR.id]   = { ...user,   following: [...new Set([...(user.following || []), targetId])] };
    DB.users[targetId] = { ...target, followers: [...new Set([...(target.followers || []), CUR.id])] };
  }

  refreshCUR();
  renderFriendsScreen();

  if (currentlyFollowing) {
    const { ok } = await Users.unfollow(CUR.id, targetId);
    if (!ok) toast('Errore sincronizzazione', 'error');
    else toast('Non segui più questo utente.', 'info');
  } else {
    const { ok } = await Users.follow(CUR.id, targetId);
    if (!ok) toast('Errore sincronizzazione', 'error');
    else {
      toast('Stai seguendo questo utente! 👥', 'success');
      const { pushNotification } = await import('./home.js');
      pushNotification({
        toUserId:     targetId,
        type:         'follow',
        fromUsername: CUR.username,
      });
    }
  }
  playSound('tap');
};

// ── Profilo pubblico — schermata completa ─────────────────────

window._viewUserProfile = async function(userId) {
  if (!DB.users[userId]) {
    const { ok, data } = await Users.get(userId);
    if (!ok) return toast('Profilo non disponibile', 'error');
  }

  const u      = DB.users[userId] || {};
  const myUser = DB.users[CUR.id] || {};
  const iFollow = (myUser.following || []).includes(userId);
  const isMe    = userId === CUR.id;
  const initials = (u.username || '?').slice(0, 2).toUpperCase();

  const container = document.getElementById('screen-social');
  if (!container) return;

  const avatar = u.avatarUrl
    ? `<div style="width:64px;height:64px;border-radius:50%;background-image:url(${u.avatarUrl});background-size:cover;background-position:center;border:2px solid var(--accent-light);flex-shrink:0"></div>`
    : `<div style="width:64px;height:64px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.2rem;color:#fff;border:2px solid var(--accent-light);flex-shrink:0">${escHtml(initials)}</div>`;

  container.innerHTML = `
    <div class="screen-header" style="gap:0.5rem">
      <button style="font-size:1.2rem;color:var(--text-2);background:none;border:none;cursor:pointer;padding:0.25rem"
              onclick="window._switchSocialTab?.('${_socialTab}')">←</button>
      <h2 style="flex:1;font-size:1rem">@${escHtml(u.username || '?')}</h2>
    </div>

    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem">
      ${avatar}
      <div style="flex:1;min-width:0">
        <div style="font-weight:800;font-size:1.05rem">@${escHtml(u.username || '?')}</div>
        <div style="color:var(--accent-light);font-size:0.82rem;margin-bottom:0.3rem">
          ${escHtml(u.rankTitle || 'Novizio')} — Lv. ${u.level || 1}
        </div>
        <div style="display:flex;gap:1rem;font-size:0.8rem;color:var(--text-3)">
          <span><strong style="color:var(--text)">${(u.following || []).length}</strong> seguiti</span>
          <span><strong style="color:var(--text)">${(u.followers || []).length}</strong> follower</span>
          <span><strong style="color:#fbbf24">${(u.xp || 0).toLocaleString()}</strong> XP</span>
        </div>
      </div>
    </div>

    ${!isMe ? `
    <button id="profile-follow-btn"
            class="${iFollow ? 'btn-secondary' : 'btn-primary'}"
            style="margin-bottom:1.25rem"
            onclick="window._profileToggleFollow?.('${userId}', ${iFollow})">
      ${iFollow ? '✖ Smetti di seguire' : '+ Segui'}
    </button>` : ''}

    <h3 class="section-title">📰 Attività recenti</h3>
    <div id="user-profile-feed">
      <div class="feed-loading" style="text-align:center;padding:2rem;color:var(--text-3)">
        Caricamento attività…
      </div>
    </div>
  `;

  _loadUserFeed(userId, u);
};

async function _loadUserFeed(userId, u) {
  const container = document.getElementById('user-profile-feed');
  if (!container) return;

  const { Feed } = await import('../api.js');
  const { ok, data } = await Feed.get(userId, 'all');
  const allPosts = ok ? data : DB.feedPosts;

  const posts = allPosts
    .filter(p => p.userId === userId)
    .slice(0, 30);

  if (!posts.length) {
    container.innerHTML = `<div class="empty-state" style="padding:2rem">
      Nessuna attività pubblica ancora.
    </div>`;
    return;
  }

  container.innerHTML = posts.map(post => {
    const likes     = Array.isArray(post.likes) ? post.likes : [];
    const likeCount = likes.length;
    const commentCount = DB.comments.filter(c => c.postId === post.id).length;

    const photo = post.photoUrl
      ? `<div style="border-radius:var(--radius-sm);overflow:hidden;margin:0 0 0.5rem;max-height:220px">
           <img src="${post.photoUrl}" style="width:100%;object-fit:cover" loading="lazy">
         </div>` : '';

    const xpBadge = post.xpEarned
      ? `<span class="feed-xp">+${post.xpEarned} XP</span>` : '';

    return `
      <div class="feed-card" style="margin-bottom:0.65rem">
        <div class="feed-card__header">
          <div style="display:flex;align-items:center;gap:0.5rem;flex:1;min-width:0">
            <div style="font-size:0.88rem;color:var(--text-2)">
              <strong>@${escHtml(u.username || '?')}</strong>
            </div>
            <time style="font-size:0.75rem;color:var(--text-3)">
              ${timeAgo(new Date(post.createdAt).getTime())}
            </time>
          </div>
          ${xpBadge}
        </div>
        <p class="feed-card__content">${escHtml(post.content)}</p>
        ${photo}
        <div class="feed-card__actions">
          <span class="feed-btn">🤍 ${likeCount}</span>
          <span class="feed-btn">💬 ${commentCount}</span>
        </div>
      </div>`;
  }).join('');
}

window._profileToggleFollow = async function(targetId, currentlyFollowing) {
  await window._socialToggleFollow?.(targetId, currentlyFollowing);
  const btn = document.getElementById('profile-follow-btn');
  if (btn) {
    const nowFollowing = !currentlyFollowing;
    btn.className   = nowFollowing ? 'btn-secondary' : 'btn-primary';
    btn.textContent = nowFollowing ? '✖ Smetti di seguire' : '+ Segui';
    btn.setAttribute('onclick', `window._profileToggleFollow?.('${targetId}', ${nowFollowing})`);
  }
};
