// ============================================================
// screens/libri.js — Catalogo globale, Discussioni, Lettori
// ============================================================
// BUG FIXATI:
// 1. discCard era async dentro .map() → ora usiamo Promise.all
// 2. Like/commenti non aggiornati → ottimistic update diretto sul DOM
// 3. Filtri tipo e libro ora funzionano correttamente
// 4. Eliminazione risposte proprie
// 5. Lettori per libro con follow inline
// ============================================================

import { CUR, DB } from '../db.js';
import { Books, Discussions, Users } from '../api.js';
import { escHtml, toast, timeAgo, debounce } from '../utils.js';
import { playSound } from '../audio.js';
import { openModal, closeModal } from '../modals.js';

let _libriTab       = 'catalog';
let _discPage       = 0;
const DISC_PAGE     = 10;
let _discSearch     = '';
let _discTypeFilter = 'all';
let _discBookFilter = '';

export function switchLibriTab(t) { _libriTab = t; renderLibri(); }

export async function renderLibri() {
  if (!CUR) return;
  const container = document.getElementById('screen-libri');
  if (!container) return;

  container.innerHTML = `
    <div class="screen-header"><h2>Libri</h2></div>
    <div class="tab-row">
      ${['catalog','discussions','readers'].map(t => `
        <button class="tab-btn ${_libriTab === t ? 'tab-btn--active' : ''}"
                onclick="window._switchLibriTab?.('${t}')">
          ${{ catalog: '🌐 Catalogo', discussions: '💬 Discussioni', readers: '👥 Lettori' }[t]}
        </button>`).join('')}
    </div>
    <div id="libri-content">
      <div class="feed-loading">Caricamento…</div>
    </div>
  `;

  if (_libriTab === 'catalog')     await renderCatalog();
  else if (_libriTab === 'discussions') await renderDiscussions();
  else if (_libriTab === 'readers')     await renderReaders();
}

// ── Catalogo ─────────────────────────────────────────────────

async function renderCatalog() {
  const container = document.getElementById('libri-content');
  if (!container) return;

  const { ok, data: books } = await Books.getGlobalCatalog();
  const list = ok ? books : DB.globalBooks;

  container.innerHTML = `
    <div class="catalog-toolbar">
      <input type="text" id="catalog-search" placeholder="Cerca titolo o autore…"
             oninput="window._filterCatalog?.(this.value)">
      <button class="btn-add" onclick="window._openAddGlobalBookModal?.()">+ Aggiungi</button>
    </div>
    <div id="catalog-list">
      ${renderCatalogList(list)}
    </div>
  `;
}

function renderCatalogList(books) {
  if (!books.length) return `<div class="empty-state">Nessun libro nel catalogo.</div>`;

  return books.map(b => `
    <div class="catalog-card">
      <div class="catalog-card__top">
        ${b.coverUrl
          ? `<img class="catalog-cover" src="${b.coverUrl}" alt="cover" loading="lazy">`
          : `<div class="catalog-cover catalog-cover--placeholder">${escHtml(b.title.slice(0, 2).toUpperCase())}</div>`}
        <div class="catalog-card__body">
          <h3>${escHtml(b.title)}</h3>
          <p>${escHtml(b.author || '—')}</p>
          <span class="badge">${escHtml(b.genre || '—')}</span>
        </div>
      </div>
      <div class="catalog-card__action">
        <button onclick="window._addBookFromCatalog?.('${b.id}')">+ La mia lista</button>
        <button onclick="window._showBookReaders?.('${b.id}')" style="margin-left:0.5rem">👥 Lettori</button>
      </div>
    </div>`).join('');
}

// ── Discussioni ───────────────────────────────────────────────

async function renderDiscussions() {
  const container = document.getElementById('libri-content');
  if (!container) return;

  const { ok, data: discs } = await Discussions.list();
  const list = ok ? discs : DB.discussions;

  const filtered = list.filter(d => {
    const matchText = !_discSearch ||
      d.title?.toLowerCase().includes(_discSearch) ||
      d.content?.toLowerCase().includes(_discSearch);
    const matchType = _discTypeFilter === 'all' || d.type === _discTypeFilter;
    const matchBook = !_discBookFilter || d.bookId === _discBookFilter;
    return matchText && matchType && matchBook;
  });

  const page = filtered.slice(0, (_discPage + 1) * DISC_PAGE);

  const bookIds = [...new Set(list.map(d => d.bookId).filter(Boolean))];
  const bookOptions = bookIds.map(id => {
    const b = DB.globalBooks.find(gb => gb.id === id) || DB.books.find(b => b.id === id);
    return b
      ? `<option value="${id}" ${_discBookFilter === id ? 'selected' : ''}>${escHtml(b.title)}</option>`
      : '';
  }).join('');

  // FIX: discCard è async → usiamo Promise.all per risolvere tutti prima di joinare
  const cardHtmls = await Promise.all(page.map(d => discCard(d)));

  container.innerHTML = `
    <div class="catalog-toolbar">
      <input type="text" id="disc-search" placeholder="Cerca discussioni…"
             value="${escHtml(_discSearch)}"
             oninput="window._filterDiscs?.(this.value)">
      <button class="btn-add" onclick="window._openCreateDiscModal?.()">+ Nuova</button>
    </div>

    <div class="filter-chips" style="margin-bottom:0.75rem">
      <button class="filter-chip ${_discTypeFilter === 'all'        ? 'filter-chip--active' : ''}"
              onclick="window._setDiscTypeFilter?.('all')">Tutti</button>
      <button class="filter-chip ${_discTypeFilter === 'discussion' ? 'filter-chip--active' : ''}"
              onclick="window._setDiscTypeFilter?.('discussion')">💬 Discussioni</button>
      <button class="filter-chip ${_discTypeFilter === 'help'       ? 'filter-chip--active' : ''}"
              onclick="window._setDiscTypeFilter?.('help')">❓ Aiuto</button>
    </div>

    ${bookOptions ? `
    <div style="margin-bottom:0.75rem">
      <select id="disc-book-filter"
              style="width:100%;padding:0.5rem;background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:0.85rem"
              onchange="window._setDiscBookFilter?.(this.value)">
        <option value="">📚 Tutti i libri</option>
        ${bookOptions}
      </select>
    </div>` : ''}

    <div id="disc-list">
      ${cardHtmls.length
        ? cardHtmls.join('')
        : '<div class="empty-state">Nessuna discussione trovata.</div>'}
    </div>

    ${filtered.length > page.length
      ? `<button class="btn-load-more" onclick="window._loadMoreDiscs?.()">Carica altri</button>`
      : ''}
  `;
}

async function discCard(d) {
  const author = DB.users[d.userId];
  const likes  = d.likes?.length || 0;
  const liked  = d.likes?.includes(CUR?.id);

  // Carica risposte: prima dalla cache locale, poi dal cloud se vuota
  let replies = DB.discussionReplies.filter(r => r.discussionId === d.id);
  if (!replies.length) {
    const { ok, data } = await Discussions.getReplies(d.id);
    if (ok && data.length) {
      const existing = new Set(DB.discussionReplies.map(r => r.id));
      data.forEach(r => { if (!existing.has(r.id)) DB.discussionReplies.push(r); });
      replies = data;
    }
  }

  const isOwner = d.userId === CUR?.id;

  return `
    <div class="disc-card" data-disc-id="${d.id}">
      <div class="disc-card__header">
        <span class="badge badge--${d.type === 'help' ? 'yellow' : 'blue'}">
          ${d.type === 'help' ? '❓ Aiuto' : '💬 Discussione'}
        </span>
        <time>${timeAgo(new Date(d.createdAt).getTime())}</time>
        ${isOwner ? `<button class="btn-icon-sm" style="margin-left:auto;color:#f87171"
          onclick="window._deleteDiscussion?.('${d.id}')">🗑</button>` : ''}
      </div>
      ${d.title ? `<h3>${escHtml(d.title)}</h3>` : ''}
      <p>${escHtml(d.content)}</p>
      <div class="disc-card__meta">
        <span>@${escHtml(author?.username || d.username || '?')}</span>
      </div>
      <div class="disc-card__actions">
        <button class="disc-like-btn ${liked ? 'btn-liked' : ''}"
                onclick="window._toggleDiscLike?.('${d.id}')">
          ${liked ? '❤️' : '🤍'} <span class="disc-like-count">${likes}</span>
        </button>
        <button onclick="window._toggleDiscReplies?.('${d.id}')">
          💬 <span class="disc-reply-count">${replies.length}</span>
        </button>
      </div>
      <div id="disc-replies-${d.id}" class="disc-replies disc-replies--hidden">
        <div class="disc-replies__list">
          ${renderReplies(d.id, isOwner)}
        </div>
        <div class="reply-input-row">
          <input type="text" id="disc-reply-input-${d.id}"
                 placeholder="Scrivi una risposta…" maxlength="300">
          <button onclick="window._replyToDisc?.('${d.id}')">Invia</button>
        </div>
      </div>
    </div>`;
}

function renderReplies(discId, isDiscOwner = false) {
  const replies = DB.discussionReplies.filter(r => r.discussionId === discId);
  if (!replies.length) return '<p class="empty-replies">Nessuna risposta ancora.</p>';

  return replies.map(r => {
    const canDelete = r.userId === CUR?.id || isDiscOwner;
    return `
      <div class="disc-reply" data-reply-id="${r.id}">
        <strong>@${escHtml(r.username || '?')}</strong>
        <span>${escHtml(r.content)}</span>
        <div style="display:flex;align-items:center;gap:0.5rem">
          <time>${timeAgo(new Date(r.createdAt).getTime())}</time>
          ${canDelete ? `<button class="btn-icon-sm" style="color:#f87171;font-size:0.7rem"
            onclick="window._deleteDiscReply?.('${r.id}', '${discId}')">🗑</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── Lettori ───────────────────────────────────────────────────

async function renderReaders() {
  const container = document.getElementById('libri-content');
  if (!container) return;

  // Mostra i miei libri come punto di partenza per trovare lettori
  const myBooks = DB.books.filter(b => b.userId === CUR.id);

  if (!myBooks.length) {
    container.innerHTML = `<div class="empty-state">
      Aggiungi prima qualche libro alla tua lista per trovare lettori con gusti simili!
    </div>`;
    return;
  }

  const myTitles = new Set(myBooks.map(b => b.title.toLowerCase()));

  // Trova utenti con libri in comune dal DB locale
  const similar = Object.values(DB.users)
    .filter(u => u.id !== CUR.id && u.isPublic !== false)
    .map(u => {
      const theirBooks = DB.books.filter(b => b.userId === u.id);
      const common = theirBooks.filter(b => myTitles.has(b.title.toLowerCase()));
      return { user: u, common: common.length, commonTitles: common.map(b => b.title) };
    })
    .filter(x => x.common > 0)
    .sort((a, b) => b.common - a.common)
    .slice(0, 20);

  const myFollowing = DB.users[CUR.id]?.following || [];

  container.innerHTML = `
    <div class="readers-header">
      <p style="color:var(--text-2);font-size:0.9rem;margin-bottom:1rem">
        Utenti che hanno letto gli stessi libri tuoi
      </p>
    </div>

    ${!similar.length ? `<div class="empty-state">
      Nessun lettore simile trovato ancora. La community sta crescendo!
    </div>` : `
    <div class="user-list">
      ${similar.map(({ user, common, commonTitles }) => {
        const iFollow   = myFollowing.includes(user.id);
        const initials  = user.username.slice(0, 2).toUpperCase();
        const avatar    = user.avatarUrl
          ? `<div class="user-card__avatar" style="background-image:url(${user.avatarUrl})"></div>`
          : `<div class="user-card__avatar user-card__avatar--initials">${initials}</div>`;

        return `
          <div class="user-card">
            ${avatar}
            <div class="user-card__info" onclick="window._viewUserProfile?.('${user.id}')">
              <strong>@${escHtml(user.username)}</strong>
              <span>Lv. ${user.level || 1} — ${common} libri in comune</span>
              <span style="font-size:0.75rem;color:var(--text-3)">${commonTitles.slice(0, 2).map(t => escHtml(t)).join(', ')}</span>
            </div>
            <button class="${iFollow ? 'btn-unfollow' : 'btn-follow'}"
                    onclick="window._toggleFollow?.('${user.id}', ${iFollow})">
              ${iFollow ? 'Unfollow' : 'Follow'}
            </button>
          </div>`;
      }).join('')}
    </div>`}

    <div id="book-readers-detail"></div>
  `;
}

// ── Azioni ────────────────────────────────────────────────────

window._switchLibriTab = switchLibriTab;

window._filterCatalog = debounce(async function(query) {
  const { ok, data } = await Books.getGlobalCatalog(query);
  const el = document.getElementById('catalog-list');
  if (el) el.innerHTML = renderCatalogList(ok ? data : []);
}, 300);

window._filterDiscs = debounce(function(query) {
  _discSearch = query.toLowerCase();
  _discPage   = 0;
  renderLibri();
}, 300);

window._setDiscTypeFilter = function(type) {
  _discTypeFilter = type;
  _discPage = 0;
  renderLibri();
};

window._setDiscBookFilter = function(bookId) {
  _discBookFilter = bookId;
  _discPage = 0;
  renderLibri();
};

window._loadMoreDiscs = function() { _discPage++; renderLibri(); };

window._openAddGlobalBookModal = function() { openModal('modal-add-global-book'); };

window._addGlobalBook = async function() {
  const title  = document.getElementById('gb-title')?.value.trim();
  const author = document.getElementById('gb-author')?.value.trim();
  const genre  = document.getElementById('gb-genre')?.value || 'narrativa';
  if (!title) return toast('Inserisci il titolo', 'error');

  const { ok, error } = await Books.addToGlobalCatalog({ title, author, genre });
  if (!ok) return toast(error || 'Errore', 'error');

  playSound('quest');
  toast('Libro aggiunto al catalogo!', 'success');
  closeModal('modal-add-global-book');
  renderLibri();
};

window._addBookFromCatalog = async function(globalBookId) {
  const gb = DB.globalBooks.find(b => b.id === globalBookId);
  if (!gb) return toast('Libro non trovato', 'error');

  const { ok } = await Books.create({
    title:      gb.title,
    author:     gb.author,
    genre:      gb.genre,
    difficulty: 2,
    totalPages: gb.totalPages || 300,
  });

  if (!ok) return toast('Errore nell\'aggiunta', 'error');
  playSound('tap');
  toast(`"${gb.title}" aggiunto alla tua lista! ✅`, 'success');
};

window._showBookReaders = async function(globalBookId) {
  _libriTab = 'readers';
  await renderLibri();
  // Mostra il dettaglio per quel libro
  const { ok, data: readers } = await Books.getReadersOfBook(globalBookId);
  const gb = DB.globalBooks.find(b => b.id === globalBookId);
  const el = document.getElementById('book-readers-detail');
  if (!el) return;

  if (!ok || !readers.length) {
    el.innerHTML = `<p style="color:var(--text-3);text-align:center;padding:1rem">
      Nessun altro lettore trovato per "${gb?.title || '?'}".</p>`;
    return;
  }

  const myFollowing = DB.users[CUR.id]?.following || [];
  el.innerHTML = `
    <h4 style="margin:1rem 0 0.5rem">📖 Lettori di "${escHtml(gb?.title || '?')}"</h4>
    <div class="user-list">
      ${readers.map(u => {
        const iFollow  = myFollowing.includes(u.id);
        const initials = u.username.slice(0, 2).toUpperCase();
        const avatar   = u.avatarUrl
          ? `<div class="user-card__avatar" style="background-image:url(${u.avatarUrl})"></div>`
          : `<div class="user-card__avatar user-card__avatar--initials">${initials}</div>`;
        return `
          <div class="user-card">
            ${avatar}
            <div class="user-card__info">
              <strong>@${escHtml(u.username)}</strong>
              <span>Lv. ${u.level || 1}</span>
            </div>
            <button class="${iFollow ? 'btn-unfollow' : 'btn-follow'}"
                    onclick="window._toggleFollow?.('${u.id}', ${iFollow})">
              ${iFollow ? 'Unfollow' : 'Follow'}
            </button>
          </div>`;
      }).join('')}
    </div>`;
};

window._openCreateDiscModal = function() { openModal('modal-create-disc'); };

window._createDiscussion = async function() {
  const title   = document.getElementById('disc-title')?.value.trim();
  const content = document.getElementById('disc-content')?.value.trim();
  const type    = document.getElementById('disc-type')?.value || 'discussion';
  if (!content) return toast('Scrivi qualcosa!', 'error');

  const { ok, error } = await Discussions.create({ title, content, type });
  if (!ok) return toast(error || 'Errore', 'error');

  playSound('quest');
  toast('Discussione creata!', 'success');
  closeModal('modal-create-disc');
  document.getElementById('disc-title').value   = '';
  document.getElementById('disc-content').value = '';
  renderLibri();
};

window._deleteDiscussion = async function(discId) {
  if (!confirm('Eliminare questa discussione?')) return;
  const { remove } = await import('../db.js');
  remove('discussions', discId);
  const { supabase } = await import('../supabase.js').catch(() => ({ supabase: null }));
  if (supabase) supabase.from('discussions').delete().eq('id', discId);
  playSound('tap');
  toast('Discussione eliminata', 'info');
  renderLibri();
};

// Like discussione — ottimistic update diretto sul DOM
window._toggleDiscLike = async function(discId) {
  const { ok, data } = await Discussions.toggleLike(discId, CUR.id);
  if (!ok) return;
  playSound(data.liked ? 'like' : 'tap');

  const card     = document.querySelector(`.disc-card[data-disc-id="${discId}"]`);
  const btn      = card?.querySelector('.disc-like-btn');
  const countEl  = btn?.querySelector('.disc-like-count');
  if (btn && countEl) {
    countEl.textContent = data.count;
    btn.innerHTML       = `${data.liked ? '❤️' : '🤍'} <span class="disc-like-count">${data.count}</span>`;
    btn.classList.toggle('btn-liked', data.liked);
  }
};

window._toggleDiscReplies = function(discId) {
  const el = document.getElementById(`disc-replies-${discId}`);
  if (el) el.classList.toggle('disc-replies--hidden');
};

window._replyToDisc = async function(discId) {
  const input   = document.getElementById(`disc-reply-input-${discId}`);
  const content = input?.value.trim();
  if (!content) return;

  const { ok, data } = await Discussions.addReply({ discussionId: discId, content });
  if (!ok) return toast('Errore nell\'invio', 'error');

  playSound('tap');
  input.value = '';

  // Aggiorna il DOM direttamente senza ri-renderizzare tutto
  const repliesListEl = document.querySelector(`#disc-replies-${discId} .disc-replies__list`);
  if (repliesListEl) {
    const emptyEl = repliesListEl.querySelector('.empty-replies');
    if (emptyEl) emptyEl.remove();

    const div = document.createElement('div');
    div.className = 'disc-reply';
    div.dataset.replyId = data.id;
    div.innerHTML = `
      <strong>@${escHtml(CUR.username)}</strong>
      <span>${escHtml(content)}</span>
      <div style="display:flex;align-items:center;gap:0.5rem">
        <time>adesso</time>
        <button class="btn-icon-sm" style="color:#f87171;font-size:0.7rem"
          onclick="window._deleteDiscReply?.('${data.id}', '${discId}')">🗑</button>
      </div>`;
    repliesListEl.appendChild(div);
  }

  // Aggiorna contatore
  const card     = document.querySelector(`.disc-card[data-disc-id="${discId}"]`);
  const countEl  = card?.querySelector('.disc-reply-count');
  if (countEl) countEl.textContent = parseInt(countEl.textContent || '0') + 1;
};

window._deleteDiscReply = async function(replyId, discId) {
  if (!confirm('Eliminare questa risposta?')) return;
  await Discussions.deleteReply(replyId);

  const el = document.querySelector(`[data-reply-id="${replyId}"]`);
  if (el) {
    el.remove();
    const card    = document.querySelector(`.disc-card[data-disc-id="${discId}"]`);
    const countEl = card?.querySelector('.disc-reply-count');
    if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
  }
  playSound('tap');
};

// Follow inline dalla schermata lettori
window._toggleFollow = async function(targetId, currentlyFollowing) {
  if (!CUR || targetId === CUR.id) return;

  const { Users } = await import('../api.js');
  if (currentlyFollowing) {
    await Users.unfollow(CUR.id, targetId);
    toast('Non segui più questo utente.', 'info');
  } else {
    await Users.follow(CUR.id, targetId);
    toast('Stai seguendo questo utente! 👥', 'success');
  }
  playSound('tap');
  // Aggiorna solo il bottone nel DOM senza ri-renderizzare tutto
  const btn = document.querySelector(`[onclick*="_toggleFollow?.('${targetId}'"]`);
  if (btn) {
    const nowFollowing = !currentlyFollowing;
    btn.className = nowFollowing ? 'btn-unfollow' : 'btn-follow';
    btn.textContent = nowFollowing ? 'Unfollow' : 'Follow';
    btn.setAttribute('onclick', `window._toggleFollow?.('${targetId}', ${nowFollowing})`);
  }
};
