// ============================================================
// screens/home.js — Home, Feed, Navigazione, Notifiche
// FIX DEFINITIVO:
//   - Feed caricato SEMPRE da Supabase (no cache stantia)
//   - Like via tabella post_likes (no RLS block)
//   - Commenti caricati da Supabase al primo click
//   - Username risolto da DB.users
//   - Feed "Seguiti" funziona anche con profilo privato
// ============================================================

import { CUR, DB, persist } from '../db.js';
import { escHtml, timeAgo, toast, checkBannedWords } from '../utils.js';
import { playSound } from '../audio.js';
import { calcLevel, xpBarPct, rankTitle, xpForLevel } from '../xp.js';
import { Feed, Users } from '../api.js';
import { MOTIVS, STAT_COLORS } from '../config.js';

// ── Navigazione ──────────────────────────────────────────────

export async function gotoTab(tabId) {
  playSound('tap');
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.classList.toggle('nav-btn--active', btn.dataset.tab === tabId));
  document.querySelectorAll('.screen').forEach(s =>
    s.classList.toggle('screen--hidden', s.dataset.screen !== tabId));
  window.scrollTo(0, 0);
  switch (tabId) {
    case 'home':    return renderHome();
    case 'quest':   return (await import('./quest.js')).renderQuests();
    case 'study':   return (await import('./study.js')).renderStudy();
    case 'routine': return (await import('./routine.js')).renderRoutine();
    case 'pvp':     return (await import('./pvp.js')).renderPvP();
    case 'libri':   return (await import('./libri.js')).renderLibri();
    case 'social':  return (await import('./social.js')).renderFriendsScreen();
    case 'stats':   return (await import('./stats.js')).renderStats();
  }
}

// ── Dashboard ─────────────────────────────────────────────────

export function updateDashboard() {
  if (!CUR) return;
  const user  = DB.users[CUR.id] || CUR;
  const xp    = user.xp || 0;
  const level = calcLevel(xp);
  const pct   = xpBarPct(xp);
  const rank  = rankTitle(level);
  const next  = xpForLevel(level + 1);

  setEl('user-level',    `Lv. ${level}`);
  setEl('user-rank',     rank);
  setEl('user-username', `@${user.username}`);
  setEl('user-streak',   `🔥 ${user.streak || 0} giorni`);

  const bar = document.getElementById('xp-bar-fill');
  if (bar) bar.style.width = `${pct}%`;
  setEl('xp-current', `${xp.toLocaleString()} XP`);
  setEl('xp-next',    `/${next.toLocaleString()}`);

  const avatarEl = document.getElementById('user-avatar');
  if (avatarEl) {
    if (user.avatarUrl) {
      avatarEl.style.backgroundImage = `url(${user.avatarUrl})`;
      avatarEl.textContent = '';
    } else {
      avatarEl.style.backgroundImage = '';
      avatarEl.textContent = user.username.slice(0, 2).toUpperCase();
    }
  }

  const stats = user.stats || {};
  Object.entries(stats).forEach(([key, val]) => {
    setEl(`stat-${key}`, val.toLocaleString());
    const b = document.getElementById(`stat-bar-${key}`);
    if (b) {
      b.style.width = `${Math.min(100, Math.round((val / Math.max(val, 1000)) * 100))}%`;
      b.style.background = STAT_COLORS[key] || '#7c3aed';
    }
  });

  renderNotifBadge();
}

// ── Notifiche ─────────────────────────────────────────────────

function getNotifs() {
  return (DB.notifications || []).filter(n => n.toUserId === CUR?.id);
}

function renderNotifBadge() {
  const unread = getNotifs().filter(n => !n.read).length;
  const btn = document.getElementById('notif-btn');
  if (!btn) return;
  const badge = btn.querySelector('.notif-badge');
  if (badge) {
    badge.textContent = unread > 9 ? '9+' : (unread || '');
    badge.style.display = unread > 0 ? 'block' : 'none';
  }
}

export function pushNotification({ toUserId, type, fromUsername, extra = '' }) {
  if (!DB.notifications) DB.notifications = [];
  DB.notifications.push({
    id:          Date.now().toString(36) + Math.random().toString(36).slice(2),
    toUserId, type, fromUsername, extra,
    read:        false,
    createdAt:   new Date().toISOString(),
  });
  persist();
  if (toUserId === CUR?.id) renderNotifBadge();
}

window._toggleNotifPanel = function() {
  const existing = document.getElementById('notif-panel');
  if (existing) { existing.remove(); return; }

  const notifs = getNotifs().slice().reverse().slice(0, 30);
  if (DB.notifications) {
    DB.notifications.forEach(n => { if (n.toUserId === CUR?.id) n.read = true; });
    persist();
  }
  renderNotifBadge();

  const panel = document.createElement('div');
  panel.id = 'notif-panel';
  panel.className = 'notif-panel';
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem">
      <strong style="font-size:0.9rem">🔔 Notifiche</strong>
      <button onclick="document.getElementById('notif-panel')?.remove()" style="font-size:0.85rem;color:var(--text-3)">✕</button>
    </div>
    ${!notifs.length
      ? `<p class="notif-empty">Nessuna notifica ancora.</p>`
      : notifs.map(n => `
        <div class="notif-item ${n.read ? 'notif-item--read' : ''}">
          <span style="font-size:1.1rem">${{ follow:'👥', like:'❤️', comment:'💬' }[n.type] || '🔔'}</span>
          <span class="notif-text">${escHtml(n.fromUsername)} ${
            n.type === 'follow'  ? 'ha iniziato a seguirti' :
            n.type === 'like'    ? 'ha messo like al tuo post' :
            n.type === 'comment' ? `ha commentato: "${escHtml(n.extra)}"` : escHtml(n.extra)
          }</span>
          <time>${timeAgo(new Date(n.createdAt).getTime())}</time>
        </div>`).join('')}
  `;

  const motiv = document.querySelector('.daily-motiv');
  if (motiv) motiv.parentNode.insertBefore(panel, motiv);
  else document.querySelector('[data-screen="home"]')?.prepend(panel);
};

// ── Home ──────────────────────────────────────────────────────

export function renderHome() {
  updateDashboard();
  const dayIdx = new Date().getDay();
  setEl('daily-motiv', MOTIVS[dayIdx % MOTIVS.length]);
  injectNotifBtn();
  // Ogni volta che si apre Home, ricarica il feed SEMPRE da Supabase
  _feedCache = null;
  loadAndRenderFeed();
}

function injectNotifBtn() {
  const heroTop = document.querySelector('.hero-top');
  if (!heroTop || document.getElementById('notif-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'notif-btn';
  btn.className = 'notif-btn';
  btn.setAttribute('onclick', 'window._toggleNotifPanel?.()');
  btn.innerHTML = `🔔<span class="notif-badge" style="display:none"></span>`;
  heroTop.appendChild(btn);
  renderNotifBadge();
}

// ── Feed ──────────────────────────────────────────────────────

let _feedCache  = null;
let _feedFilter = 'all';
let _feedPage   = 0;
const PAGE_SIZE = 15;

export function setFeedFilter(filter) {
  _feedFilter = filter;
  _feedPage   = 0;
  _feedCache  = null;
  loadAndRenderFeed();
}

export async function loadAndRenderFeed() {
  if (!CUR) return;
  const container = document.getElementById('feed-container');
  if (!container) return;

  if (!_feedCache) {
    container.innerHTML = '<div class="feed-loading" style="text-align:center;padding:2rem;color:var(--text-3)">Caricamento…</div>';

    const { ok, data } = await Feed.get(CUR.id, _feedFilter);
    _feedCache = ok ? data : [];

    // Risolvi username mancanti
    await resolveUsernames(_feedCache);

    // Carica commenti dal DB locale (già sincronizzati)
    // I commenti freschi vengono caricati al click su 💬
  }

  const page = _feedCache.slice(0, (_feedPage + 1) * PAGE_SIZE);
  renderFeed(page, container);
}

async function resolveUsernames(posts) {
  const ids = [...new Set(
    posts
      .filter(p => !DB.users[p.userId]?.username)
      .map(p => p.userId)
  )];
  if (!ids.length) return;
  await Promise.all(ids.map(async id => {
    const { ok, data } = await Users.get(id);
    if (ok) DB.users[id] = data;
  }));
  posts.forEach(p => {
    if (!p.username || p.username === 'Utente') {
      p.username = DB.users[p.userId]?.username || 'Utente';
    }
  });
}

function renderFeed(posts, container) {
  if (!posts.length) {
    container.innerHTML = `<div class="feed-empty" style="text-align:center;padding:3rem 1rem;color:var(--text-3)">
      <p style="font-size:1.5rem">🌟</p>
      <p>Nessuna attività ancora.</p>
      <p style="font-size:0.85rem;margin-top:0.5rem">Completa una quest o una routine per iniziare!</p>
    </div>`;
    return;
  }

  container.innerHTML = posts.map(post => feedCard(post)).join('');

  // Infinite scroll
  const sentinel = document.createElement('div');
  sentinel.id = 'feed-sentinel';
  container.appendChild(sentinel);

  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && _feedCache && (_feedPage + 1) * PAGE_SIZE < _feedCache.length) {
      _feedPage++;
      loadAndRenderFeed();
    }
  }, { threshold: 0.1 }).observe(sentinel);
}

function feedCard(post) {
  const author   = DB.users[post.userId];
  const name     = escHtml(author?.username || post.username || 'Utente');
  const initials = name.slice(0, 2).toUpperCase();
  const avatar   = author?.avatarUrl
    ? `<div class="feed-avatar" style="background-image:url(${author.avatarUrl})"></div>`
    : `<div class="feed-avatar feed-avatar--initials">${initials}</div>`;

  // Leggi likes direttamente dal post (arrivano da post_likes via join in Feed.get)
  const likes    = Array.isArray(post.likes) ? post.likes : [];
  const liked    = likes.includes(CUR?.id);
  const likeCount = likes.length;

  // Commenti: conta dal DB locale, poi aggiorna al click
  const commentCount = DB.comments.filter(c => c.postId === post.id).length;
  const isMyPost     = post.userId === CUR?.id;

  const photo = post.photoUrl
    ? `<div class="feed-photo" onclick="window._openPhotoModal?.('${post.id}')">
         <img src="${post.photoUrl}" alt="foto" loading="lazy">
       </div>` : '';

  const xpBadge = post.xpEarned
    ? `<span class="feed-xp">+${post.xpEarned} XP</span>` : '';

  const deleteBtn = isMyPost
    ? `<button class="feed-btn" style="margin-left:auto;color:#f87171"
               onclick="window._deletePost?.('${post.id}')" title="Elimina">🗑</button>` : '';

  return `
    <article class="feed-card" data-post-id="${post.id}">
      <header class="feed-card__header">
        <div class="feed-card__author" onclick="window._viewProfile?.('${post.userId}')">
          ${avatar}
          <div>
            <strong>@${name}</strong>
            <time>${timeAgo(new Date(post.createdAt).getTime())}</time>
          </div>
        </div>
        ${xpBadge}
        ${deleteBtn}
      </header>
      <p class="feed-card__content">${escHtml(post.content)}</p>
      ${photo}
      <footer class="feed-card__actions">
        <button class="feed-btn feed-btn--like ${liked ? 'feed-btn--liked' : ''}"
                onclick="window._toggleLike?.('${post.id}')">
          ${liked ? '❤️' : '🤍'} <span class="like-count">${likeCount}</span>
        </button>
        <button class="feed-btn" onclick="window._toggleComments?.('${post.id}')">
          💬 <span class="comment-count">${commentCount}</span>
        </button>
      </footer>
      <div id="comments-${post.id}" class="comments-section comments-section--hidden">
        <div class="comments-list" id="comments-list-${post.id}">
          <p class="comments-empty" style="font-size:0.82rem;color:var(--text-3);padding:0.5rem 0">
            Premi 💬 per caricare i commenti.
          </p>
        </div>
        <div class="comment-input-row">
          <input type="text" id="comment-input-${post.id}"
                 placeholder="Scrivi un commento…" maxlength="200">
          <button onclick="window._submitComment?.('${post.id}')">Invia</button>
        </div>
      </div>
    </article>`;
}

// ── Azioni feed ───────────────────────────────────────────────

window._toggleLike = async function(postId) {
  if (!CUR) return;

  // Trova il post nel feed cache
  const cacheIdx = (_feedCache || []).findIndex(p => p.id === postId);
  const post = cacheIdx !== -1 ? _feedCache[cacheIdx] : DB.feedPosts.find(p => p.id === postId);
  if (!post) return;

  const likes    = Array.isArray(post.likes) ? post.likes : [];
  const liked    = likes.includes(CUR.id);
  const newLikes = liked
    ? likes.filter(id => id !== CUR.id)
    : [...likes, CUR.id];

  // 1. Ottimistic update in cache e DOM
  if (cacheIdx !== -1) _feedCache[cacheIdx] = { ...post, likes: newLikes };
  const dbIdx = DB.feedPosts.findIndex(p => p.id === postId);
  if (dbIdx !== -1) DB.feedPosts[dbIdx] = { ...DB.feedPosts[dbIdx], likes: newLikes };
  persist();

  const card = document.querySelector(`[data-post-id="${postId}"]`);
  const btn  = card?.querySelector('.feed-btn--like, .feed-btn');
  if (btn) {
    const nowLiked = !liked;
    btn.className = `feed-btn feed-btn--like ${nowLiked ? 'feed-btn--liked' : ''}`;
    btn.innerHTML = `${nowLiked ? '❤️' : '🤍'} <span class="like-count">${newLikes.length}</span>`;
  }

  playSound(liked ? 'tap' : 'like');

  // 2. Sync su Supabase tramite post_likes
  const { ok, error } = await Feed.toggleLike(postId, CUR.id);
  if (!ok) {
    // Rollback
    if (cacheIdx !== -1) _feedCache[cacheIdx] = { ...post, likes };
    if (dbIdx !== -1) DB.feedPosts[dbIdx] = { ...DB.feedPosts[dbIdx], likes };
    persist();
    // Ripristina DOM
    if (btn) btn.innerHTML = `${liked ? '❤️' : '🤍'} <span class="like-count">${likes.length}</span>`;
    toast('Errore nel like, riprova', 'error');
    console.error('[Like]', error);
    return;
  }

  // 3. Notifica al proprietario
  if (!liked && post.userId !== CUR.id) {
    pushNotification({
      toUserId:     post.userId,
      type:         'like',
      fromUsername: CUR.username,
    });
  }
};

window._toggleComments = async function(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;

  const wasHidden = section.classList.contains('comments-section--hidden');
  section.classList.toggle('comments-section--hidden');

  // Carica commenti da Supabase la prima volta che si apre
  if (wasHidden) {
    const listEl = document.getElementById(`comments-list-${postId}`);
    if (listEl) {
      listEl.innerHTML = '<p style="font-size:0.8rem;color:var(--text-3);padding:0.5rem 0">Caricamento…</p>';
      const { ok, data } = await Feed.getComments(postId);
      const comments = ok ? data : DB.comments.filter(c => c.postId === postId);

      // Aggiorna DB locale
      comments.forEach(c => {
        if (!DB.comments.find(x => x.id === c.id)) DB.comments.push(c);
      });
      persist();

      // Aggiorna contatore
      const card = document.querySelector(`[data-post-id="${postId}"]`);
      const countEl = card?.querySelector('.comment-count');
      if (countEl) countEl.textContent = comments.length;

      renderCommentsList(postId, listEl, comments);
    }
  }
};

function renderCommentsList(postId, container, comments) {
  const isMyPost = (_feedCache || []).find(p => p.id === postId)?.userId === CUR?.id
    || DB.feedPosts.find(p => p.id === postId)?.userId === CUR?.id;

  if (!comments.length) {
    container.innerHTML = '<p class="comments-empty" style="font-size:0.82rem;color:var(--text-3);padding:0.5rem 0">Nessun commento ancora. Sii il primo!</p>';
    return;
  }

  container.innerHTML = comments.map(c => {
    const canDelete = c.userId === CUR?.id || isMyPost;
    return `
      <div class="comment" data-comment-id="${c.id}">
        <strong>@${escHtml(c.username || DB.users[c.userId]?.username || 'Utente')}</strong>
        <span>${escHtml(c.content)}</span>
        <time>${timeAgo(new Date(c.createdAt).getTime())}</time>
        ${canDelete ? `<button class="comment-delete-btn"
          style="margin-left:auto;color:#f87171;font-size:0.75rem;padding:0 0.3rem"
          onclick="window._deleteComment?.('${c.id}','${postId}')">🗑</button>` : ''}
      </div>`;
  }).join('');
}

window._submitComment = async function(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  const text  = input?.value.trim();
  if (!text) return;
  if (checkBannedWords(text, DB.bannedWords)) return toast('Contenuto non consentito', 'error');

  const { ok, data, error } = await Feed.addComment({ postId, content: text });
  if (!ok) {
    console.error('[Comment]', error);
    return toast('Errore nell\'invio del commento', 'error');
  }

  playSound('tap');
  input.value = '';

  // Aggiorna DB locale
  if (!DB.comments.find(c => c.id === data.id)) {
    DB.comments.push(data);
    persist();
  }

  // Aggiorna DOM
  const listEl = document.getElementById(`comments-list-${postId}`);
  if (listEl) {
    const empty = listEl.querySelector('.comments-empty');
    if (empty) empty.remove();
    const div = document.createElement('div');
    div.className = 'comment';
    div.dataset.commentId = data.id;
    div.innerHTML = `
      <strong>@${escHtml(CUR.username)}</strong>
      <span>${escHtml(text)}</span>
      <time>adesso</time>
      <button class="comment-delete-btn"
        style="margin-left:auto;color:#f87171;font-size:0.75rem;padding:0 0.3rem"
        onclick="window._deleteComment?.('${data.id}','${postId}')">🗑</button>`;
    const inputRow = listEl.parentElement.querySelector('.comment-input-row');
    listEl.insertBefore(div, inputRow);
  }

  // Aggiorna contatore
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  const countEl = card?.querySelector('.comment-count');
  if (countEl) countEl.textContent = parseInt(countEl.textContent || '0') + 1;

  // Notifica
  const post = (_feedCache || []).find(p => p.id === postId) || DB.feedPosts.find(p => p.id === postId);
  if (post && post.userId !== CUR.id) {
    pushNotification({
      toUserId:     post.userId,
      type:         'comment',
      fromUsername: CUR.username,
      extra:        text.slice(0, 60),
    });
  }
};

window._deleteComment = async function(commentId, postId) {
  if (!confirm('Eliminare questo commento?')) return;
  const { ok } = await Feed.deleteComment(commentId);
  if (!ok) return toast('Errore nell\'eliminazione', 'error');

  playSound('tap');
  DB.comments = DB.comments.filter(c => c.id !== commentId);
  persist();

  document.querySelector(`[data-comment-id="${commentId}"]`)?.remove();

  const card = document.querySelector(`[data-post-id="${postId}"]`);
  const countEl = card?.querySelector('.comment-count');
  if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent || '1') - 1);

  toast('Commento eliminato', 'info');
};

window._deletePost = async function(postId) {
  if (!confirm('Eliminare questo post?')) return;
  const { ok } = await Feed.deletePost(postId);
  if (!ok) return toast('Errore nell\'eliminazione', 'error');

  playSound('tap');
  DB.feedPosts = DB.feedPosts.filter(p => p.id !== postId);
  if (_feedCache) _feedCache = _feedCache.filter(p => p.id !== postId);
  persist();
  document.querySelector(`[data-post-id="${postId}"]`)?.remove();
  toast('Post eliminato', 'info');
};

window._openPhotoModal = function(postId) {
  const post = (_feedCache || []).find(p => p.id === postId) || DB.feedPosts.find(p => p.id === postId);
  if (!post?.photoUrl) return;
  const overlay = document.createElement('div');
  overlay.className = 'photo-overlay';
  overlay.innerHTML = `<img src="${post.photoUrl}" alt="foto"><button onclick="this.parentElement.remove()">✕</button>`;
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
};

window._viewProfile = function(userId) {
  import('./social.js').then(() => window._viewUserProfile?.(userId));
};

// ── Helpers ───────────────────────────────────────────────────

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
