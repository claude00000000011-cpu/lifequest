// ============================================================
// screens/home.js — Home, Feed sociale, Navigazione
// ============================================================

import { CUR, DB, persist } from '../db.js';
import { escHtml, timeAgo, toast, checkBannedWords } from '../utils.js';
import { playSound } from '../audio.js';
import { calcLevel, xpBarPct, rankTitle, xpForLevel } from '../xp.js';
import { Feed, Users } from '../api.js';
import { MOTIVS, STAT_COLORS } from '../config.js';

// ── Navigazione ──────────────────────────────────────────────

const TABS = ['home','quest','study','routine','pvp','libri','social','stats'];

export async function gotoTab(tabId) {
  playSound('tap');

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('nav-btn--active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('screen--hidden', s.dataset.screen !== tabId);
  });

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
    const bar = document.getElementById(`stat-bar-${key}`);
    if (bar) {
      const pct = Math.min(100, Math.round((val / Math.max(val, 1000)) * 100));
      bar.style.width = `${pct}%`;
      bar.style.background = STAT_COLORS[key] || '#7c3aed';
    }
  });
}

// ── Home ──────────────────────────────────────────────────────

export function renderHome() {
  updateDashboard();
  const dayIdx = new Date().getDay();
  setEl('daily-motiv', MOTIVS[dayIdx % MOTIVS.length]);
  loadAndRenderFeed();
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
    container.innerHTML = '<div class="feed-loading">Caricamento…</div>';
    const { ok, data } = await Feed.get(CUR.id, _feedFilter);
    _feedCache = ok ? data : [];
  }

  const page = _feedCache.slice(0, (_feedPage + 1) * PAGE_SIZE);
  renderFeed(page, container);
}

function renderFeed(posts, container) {
  if (!posts.length) {
    container.innerHTML = `
      <div class="feed-empty">
        <p>Nessuna attività ancora.</p>
        <p>Completa una quest o una routine per iniziare! 🚀</p>
      </div>`;
    return;
  }

  container.innerHTML = posts.map(post => feedCard(post)).join('');

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

// BUG #6 FIX — feedCard ora mostra il tasto 🗑 elimina post
// solo se il post appartiene all'utente corrente.
function feedCard(post) {
  const author   = DB.users[post.userId];
  const name     = escHtml(author?.username || post.username || 'Utente');
  const initials = name.slice(0, 2).toUpperCase();
  const avatar   = author?.avatarUrl
    ? `<div class="feed-avatar" style="background-image:url(${author.avatarUrl})"></div>`
    : `<div class="feed-avatar feed-avatar--initials">${initials}</div>`;

  const likes    = post.likes?.length || 0;
  const liked    = post.likes?.includes(CUR?.id);
  const comments = DB.comments.filter(c => c.postId === post.id).length;
  const isMyPost = post.userId === CUR?.id;

  const photo = post.photoUrl
    ? `<div class="feed-photo" onclick="window._openPhotoModal?.('${post.id}')">
         <img src="${post.photoUrl}" alt="foto" loading="lazy">
       </div>`
    : '';

  const xpBadge = post.xpEarned
    ? `<span class="feed-xp">+${post.xpEarned} XP</span>`
    : '';

  // Tasto elimina post: visibile solo se è il mio post
  const deletePostBtn = isMyPost
    ? `<button class="feed-btn" style="margin-left:auto;color:#f87171"
               onclick="window._deletePost?.('${post.id}')" title="Elimina post">🗑</button>`
    : '';

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
        ${deletePostBtn}
      </header>

      <p class="feed-card__content">${escHtml(post.content)}</p>
      ${photo}

      <footer class="feed-card__actions">
        <button class="feed-btn feed-btn--like ${liked ? 'feed-btn--liked' : ''}"
                onclick="window._toggleLike?.('${post.id}')">
          ${liked ? '❤️' : '🤍'} <span>${likes}</span>
        </button>
        <button class="feed-btn" onclick="window._toggleComments?.('${post.id}')">
          💬 <span>${comments}</span>
        </button>
      </footer>

      <div id="comments-${post.id}" class="comments-section comments-section--hidden">
        ${renderComments(post.id, isMyPost)}
        <div class="comment-input-row">
          <input type="text" id="comment-input-${post.id}"
                 placeholder="Scrivi un commento…" maxlength="200">
          <button onclick="window._submitComment?.('${post.id}')">Invia</button>
        </div>
      </div>
    </article>`;
}

// BUG #6 FIX — renderComments mostra 🗑 su ogni commento
// se il commento è mio OPPURE se il post è mio (moderazione).
function renderComments(postId, isMyPost) {
  const comments = DB.comments.filter(c => c.postId === postId);
  if (!comments.length) return '<p class="comments-empty">Nessun commento.</p>';

  return comments.map(c => {
    const canDelete = c.userId === CUR?.id || isMyPost;
    const deleteBtn = canDelete
      ? `<button class="comment-delete-btn" style="margin-left:auto;color:#f87171;font-size:0.75rem;padding:0 0.3rem"
                 onclick="window._deleteComment?.('${c.id}', '${postId}')" title="Elimina">🗑</button>`
      : '';
    return `
      <div class="comment" data-comment-id="${c.id}">
        <strong>@${escHtml(c.username)}</strong>
        <span>${escHtml(c.content)}</span>
        <time>${timeAgo(new Date(c.createdAt).getTime())}</time>
        ${deleteBtn}
      </div>`;
  }).join('');
}

// ── Azioni feed ───────────────────────────────────────────────

window._toggleLike = async function(postId) {
  if (!CUR) return;
  const { ok, data } = await Feed.toggleLike(postId, CUR.id);
  if (!ok) return;
  playSound(data.liked ? 'like' : 'tap');
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  const btn  = card?.querySelector('.feed-btn--like');
  if (btn) {
    btn.classList.toggle('feed-btn--liked', data.liked);
    btn.innerHTML = `${data.liked ? '❤️' : '🤍'} <span>${data.count}</span>`;
  }
};

window._toggleComments = function(postId) {
  const section = document.getElementById(`comments-${postId}`);
  if (!section) return;
  section.classList.toggle('comments-section--hidden');
};

window._submitComment = async function(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  const text  = input?.value.trim();
  if (!text) return;

  if (checkBannedWords(text, DB.bannedWords)) {
    return toast('Contenuto non consentito', 'error');
  }

  const { ok, data } = await Feed.addComment({ postId, content: text });
  if (!ok) return toast('Errore nell\'invio', 'error');

  playSound('tap');
  input.value = '';

  const section = document.getElementById(`comments-${postId}`);
  if (section) {
    const empty = section.querySelector('.comments-empty');
    if (empty) empty.remove();
    const row = section.querySelector('.comment-input-row');
    const div = document.createElement('div');
    div.className = 'comment';
    div.dataset.commentId = data.id;
    // Il commento è mio → mostro subito il tasto elimina
    div.innerHTML = `
      <strong>@${escHtml(CUR.username)}</strong>
      <span>${escHtml(text)}</span>
      <time>adesso</time>
      <button class="comment-delete-btn" style="margin-left:auto;color:#f87171;font-size:0.75rem;padding:0 0.3rem"
              onclick="window._deleteComment?.('${data.id}', '${postId}')" title="Elimina">🗑</button>`;
    section.insertBefore(div, row);

    const card    = document.querySelector(`[data-post-id="${postId}"]`);
    const countEl = card?.querySelector('.feed-btn:nth-child(2) span');
    if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;
  }
};

// BUG #6 — elimina un singolo commento dal feed
window._deleteComment = async function(commentId, postId) {
  if (!confirm('Eliminare questo commento?')) return;

  const { ok } = await Feed.deleteComment(commentId);
  if (!ok) return toast('Errore nell\'eliminazione', 'error');

  playSound('tap');

  // Rimuovi dalla cache locale
  DB.comments = DB.comments.filter(c => c.id !== commentId);
  persist();

  // Rimuovi il nodo dal DOM
  const el = document.querySelector(`[data-comment-id="${commentId}"]`);
  if (el) {
    el.remove();
    // Aggiorna contatore
    const card    = document.querySelector(`[data-post-id="${postId}"]`);
    const countEl = card?.querySelector('.feed-btn:nth-child(2) span');
    if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
  }

  toast('Commento eliminato', 'info');
};

// BUG #6 — elimina un post intero (solo il proprietario)
window._deletePost = async function(postId) {
  if (!confirm('Eliminare questo post?')) return;

  const { ok } = await Feed.deletePost(postId);
  if (!ok) return toast('Errore nell\'eliminazione', 'error');

  playSound('tap');

  // Rimuovi dalla cache locale e dal DOM
  DB.feedPosts = DB.feedPosts.filter(p => p.id !== postId);
  if (_feedCache) _feedCache = _feedCache.filter(p => p.id !== postId);
  persist();

  const card = document.querySelector(`[data-post-id="${postId}"]`);
  card?.remove();

  toast('Post eliminato', 'info');
};

window._openPhotoModal = function(postId) {
  const post = DB.feedPosts.find(p => p.id === postId);
  if (!post?.photoUrl) return;
  const overlay = document.createElement('div');
  overlay.className = 'photo-overlay';
  overlay.innerHTML = `<img src="${post.photoUrl}" alt="foto"><button onclick="this.parentElement.remove()">✕</button>`;
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
};

// ── Helpers ───────────────────────────────────────────────────

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
