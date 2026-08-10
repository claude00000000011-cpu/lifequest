// ============================================================
// screens/libri.js — Catalogo, Discussioni (con filtri), Lettori
// ============================================================

import { CUR, DB } from '../db.js';
import { Books, Discussions, Users } from '../api.js';
import { escHtml, toast, timeAgo, debounce } from '../utils.js';
import { playSound } from '../audio.js';
import { openModal, closeModal } from '../modals.js';

let _libriTab = 'mylibrary';

// Filtri discussioni
let _discSearch     = '';
let _discTypeFilter = 'all';
let _discGenreFilter= '';
let _discAuthorFilter='';
let _discPage       = 0;
const DISC_PAGE     = 10;

// Filtri lettori
let _readersSearch = '';
let _readersLang   = '';

export function switchLibriTab(t) { _libriTab = t; renderLibri(); }

export async function renderLibri() {
  if (!CUR) return;
  const container = document.getElementById('screen-libri');
  if (!container) return;

  container.innerHTML = `
    <div class="screen-header"><h2>Libri</h2></div>
    <div class="tab-row">
      ${['mylibrary','catalog','discussions','readers'].map(t => `
        <button class="tab-btn ${_libriTab === t ? 'tab-btn--active' : ''}"
                onclick="window._switchLibriTab?.('${t}')">
          ${{ mylibrary: '📚 Miei', catalog: '🌐 Catalogo', discussions: '💬 Discussioni', readers: '👥 Lettori' }[t]}
        </button>`).join('')}
    </div>
    <div id="libri-content"><div class="feed-loading">Caricamento…</div></div>
  `;

  if      (_libriTab === 'mylibrary')   await renderMyLibrary();
  else if (_libriTab === 'catalog')     await renderCatalog();
  else if (_libriTab === 'discussions') await renderDiscussions();
  else if (_libriTab === 'readers')     await renderReaders();
}

// ── Mia Libreria ─────────────────────────────────────────────

async function renderMyLibrary() {
  const container = document.getElementById('libri-content');
  if (!container) return;

  // Importa books.js per registrare _openBook, _closeBook, ecc.
  await import('./books.js');


  container.innerHTML = `<div class="feed-loading">Caricamento…</div>`;

  const { ok, data } = await Books.list(CUR.id);
  const list = ok ? data : (DB.books || []).filter(b => b.userId === CUR.id);

  const reading   = list.filter(b => !b.completed);
  const completed = list.filter(b =>  b.completed);

  container.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:0.75rem">
      <button class="btn-add" onclick="window._openAddBookModal?.()">+ Libro</button>
    </div>
    ${!list.length ? `
      <div class="empty-state">
        Nessun libro ancora.<br>
        <small style="color:var(--text-3)">Premi + per aggiungerne uno!</small>
      </div>` : ''}
    ${reading.length ? `
      <h3 class="section-title">📖 In lettura (${reading.length})</h3>
      ${reading.map(b => myBookCard(b)).join('')}` : ''}
    ${completed.length ? `
      <h3 class="section-title">✅ Completati (${completed.length})</h3>
      ${completed.map(b => myBookCard(b)).join('')}` : ''}
  `;
}

function myBookCard(book) {
  const pct = book.totalPages
    ? Math.min(100, Math.round(((book.currentPage || 0) / book.totalPages) * 100))
    : 0;
  return `
    <div class="book-card" onclick="window._openBook?.('${book.id}')" style="margin-bottom:0.75rem">
      <div class="book-card__main">
        <div class="book-cover book-cover--placeholder">
          ${escHtml(book.title.slice(0, 2).toUpperCase())}
        </div>
        <div class="book-card__body">
          <h3>${escHtml(book.title)}</h3>
          <p style="color:var(--text-2);font-size:0.82rem">✍️ ${escHtml(book.author || '—')}</p>
          ${!book.completed ? `
            <div class="progress-bar" style="margin-top:0.4rem">
              <div class="progress-bar__fill" style="width:${pct}%"></div>
            </div>
            <p style="font-size:0.75rem;color:var(--text-3)">${book.currentPage || 0} / ${book.totalPages || '?'} pag. (${pct}%)</p>
          ` : `<p style="color:var(--success);font-size:0.82rem">✅ Completato</p>`}
        </div>
        <span style="align-self:center;color:var(--text-3)">›</span>
      </div>
    </div>`;
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
    <div id="catalog-list">${renderCatalogList(list)}</div>
  `;
}

function renderCatalogList(books) {
  if (!books.length) return `<div class="empty-state">Nessun libro nel catalogo.</div>`;
  return books.map(b => `
    <div class="catalog-card">
      <div class="catalog-card__top">
        ${b.coverUrl
          ? `<img class="catalog-cover" src="${b.coverUrl}" alt="cover" loading="lazy">`
          : `<div class="catalog-cover catalog-cover--placeholder">${escHtml(b.title.slice(0,2).toUpperCase())}</div>`}
        <div class="catalog-card__body">
          <h3>${escHtml(b.title)}</h3>
          <p>${escHtml(b.author || '—')}</p>
          <span class="badge">${escHtml(b.genre || '—')}</span>
        </div>
      </div>
      <div class="catalog-card__action">
        <button onclick="window._addBookFromCatalog?.('${b.id}')">+ La mia lista</button>
        <button onclick="window._showBookReaders?.('${b.id}')" style="margin-left:0.5rem;background:var(--surface);color:var(--text);border:1px solid var(--border)">👥 Lettori</button>
      </div>
    </div>`).join('');
}

// ── Discussioni ───────────────────────────────────────────────

async function renderDiscussions() {
  const container = document.getElementById('libri-content');
  if (!container) return;

  const { ok, data: discs } = await Discussions.list();
  const list = ok ? discs : DB.discussions;

  // Raccogli autori e generi unici dai libri in catalogo
  const allGenres  = [...new Set((DB.globalBooks || []).map(b => b.genre).filter(Boolean))];
  const allAuthors = [...new Set((DB.globalBooks || []).map(b => b.author).filter(Boolean))].slice(0, 30);

  const filtered = list.filter(d => {
    const matchText   = !_discSearch   || d.title?.toLowerCase().includes(_discSearch) || d.content?.toLowerCase().includes(_discSearch);
    const matchType   = _discTypeFilter === 'all' || d.type === _discTypeFilter;
    // Filtra per genere/autore tramite il libro associato
    let matchGenre = true, matchAuthor = true;
    if (_discGenreFilter || _discAuthorFilter) {
      const book = DB.globalBooks.find(b => b.id === d.bookId) || DB.books.find(b => b.id === d.bookId);
      if (_discGenreFilter)  matchGenre  = book?.genre?.toLowerCase()  === _discGenreFilter.toLowerCase();
      if (_discAuthorFilter) matchAuthor = book?.author?.toLowerCase() === _discAuthorFilter.toLowerCase();
    }
    return matchText && matchType && matchGenre && matchAuthor;
  });

  const page     = filtered.slice(0, (_discPage + 1) * DISC_PAGE);
  // Carica profili mancanti degli autori delle discussioni
const missingIds = [...new Set(page.map(d => d.userId).filter(id => id && !DB.users[id]))];
if (missingIds.length) await Promise.all(missingIds.map(id => Users.get(id)));

const cardHtmls = await Promise.all(page.map(d => discCard(d)));

  container.innerHTML = `
    <div class="catalog-toolbar">
      <input type="text" id="disc-search" placeholder="Cerca discussioni…"
             value="${escHtml(_discSearch)}"
             oninput="window._filterDiscs?.(this.value)">
      <button class="btn-add" onclick="window._openCreateDiscModal?.()">+ Nuova</button>
    </div>

    <div class="disc-filters">
      <!-- Tipo -->
      <div class="disc-filters-row">
        ${['all','discussion','help'].map(t => `
          <button class="filter-chip ${_discTypeFilter === t ? 'filter-chip--active' : ''}"
                  onclick="window._setDiscTypeFilter?.('${t}')">
            ${{ all:'Tutti', discussion:'💬 Discussione', help:'❓ Aiuto' }[t]}
          </button>`).join('')}
      </div>

      <!-- Genere -->
      ${allGenres.length ? `
        <select class="disc-filter-select" onchange="window._setDiscGenreFilter?.(this.value)">
          <option value="">📚 Tutti i generi</option>
          ${allGenres.map(g => `<option value="${escHtml(g)}" ${_discGenreFilter === g ? 'selected' : ''}>${escHtml(g)}</option>`).join('')}
        </select>` : ''}

      <!-- Autore -->
      ${allAuthors.length ? `
        <select class="disc-filter-select" onchange="window._setDiscAuthorFilter?.(this.value)">
          <option value="">✍️ Tutti gli autori</option>
          ${allAuthors.map(a => `<option value="${escHtml(a)}" ${_discAuthorFilter === a ? 'selected' : ''}>${escHtml(a)}</option>`).join('')}
        </select>` : ''}
    </div>

    <div id="disc-list">
      ${cardHtmls.length
        ? cardHtmls.join('')
        : '<div class="empty-state">Nessuna discussione trovata.</div>'}
    </div>
    ${filtered.length > page.length
      ? `<button class="btn-load-more" onclick="window._loadMoreDiscs?.()">Carica altri</button>` : ''}
  `;
}

async function discCard(d) {
  const author = DB.users[d.userId];
  const likes  = d.likes?.length || 0;
  const liked  = d.likes?.includes(CUR?.id);
  const isOwner = d.userId === CUR?.id;

  let replies = DB.discussionReplies.filter(r => r.discussionId === d.id);
  if (!replies.length) {
    const { ok, data } = await Discussions.getReplies(d.id);
    if (ok && data.length) {
      const ex = new Set(DB.discussionReplies.map(r => r.id));
      data.forEach(r => { if (!ex.has(r.id)) DB.discussionReplies.push(r); });
      replies = data;
    }
  }

  // Libro associato
  const bookInfo = d.bookId
    ? DB.globalBooks.find(b => b.id === d.bookId) || DB.books.find(b => b.id === d.bookId)
    : null;

  return `
    <div class="disc-card" data-disc-id="${d.id}">
      <div class="disc-card__header">
        <span class="badge badge--${d.type === 'help' ? 'yellow' : 'blue'}">
          ${d.type === 'help' ? '❓ Aiuto' : '💬 Discussione'}
        </span>
        ${bookInfo ? `<span class="badge" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(bookInfo.title)}">📖 ${escHtml(bookInfo.title)}</span>` : ''}
        <time style="margin-left:auto">${timeAgo(new Date(d.createdAt).getTime())}</time>
        ${isOwner ? `<button class="btn-icon-sm" style="color:#f87171"
          onclick="window._deleteDiscussion?.('${d.id}')">🗑</button>` : ''}
      </div>
      ${d.title ? `<h3>${escHtml(d.title)}</h3>` : ''}
      <p>${escHtml(d.content)}</p>
      <div class="disc-card__meta"><span>@${escHtml(author?.username || d.username || '?')}</span></div>
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
        <div class="disc-replies__list">${renderReplies(d.id, isOwner)}</div>
        <div class="reply-input-row">
          <input type="text" id="disc-reply-input-${d.id}" placeholder="Scrivi una risposta…" maxlength="300">
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

  const myBooks  = DB.books.filter(b => b.userId === CUR.id);
  if (!myBooks.length) {
    container.innerHTML = `<div class="empty-state">
      Aggiungi prima qualche libro per trovare lettori con gusti simili!
    </div>`;
    return;
  }

  const myTitles = new Set(myBooks.map(b => b.title.toLowerCase()));
  const allLangs = [...new Set(Object.values(DB.users).flatMap(u => u.languages || []))].filter(Boolean);

  // Filtra lettori simili
  let similar = Object.values(DB.users)
    .filter(u => u.id !== CUR.id && u.isPublic !== false)
    .map(u => {
      const theirBooks = DB.books.filter(b => b.userId === u.id);
      const common = theirBooks.filter(b => myTitles.has(b.title.toLowerCase()));
      return { user: u, common: common.length, commonTitles: common.map(b => b.title) };
    })
    .filter(x => x.common > 0)
    .sort((a, b) => b.common - a.common);

  // Applica filtri
  if (_readersSearch) {
    const q = _readersSearch.toLowerCase();
    similar = similar.filter(x => x.user.username?.toLowerCase().includes(q));
  }
  if (_readersLang) {
    similar = similar.filter(x => (x.user.languages || []).some(l => l.includes(_readersLang)));
  }

  const myFollowing = DB.users[CUR.id]?.following || [];

  container.innerHTML = `
    <div class="readers-toolbar">
      <input type="text" placeholder="🔍 Cerca per username…" value="${escHtml(_readersSearch)}"
             oninput="window._filterReaders?.(this.value)">
      ${allLangs.length ? `
        <select onchange="window._filterReadersLang?.(this.value)">
          <option value="">🌍 Tutte le lingue</option>
          ${allLangs.map(l => `<option value="${escHtml(l)}" ${_readersLang === l ? 'selected' : ''}>${escHtml(l)}</option>`).join('')}
        </select>` : ''}
    </div>

    ${!similar.length ? `<div class="empty-state">
      ${_readersSearch || _readersLang ? 'Nessun lettore trovato con questi filtri.' : 'Nessun lettore simile trovato ancora.'}
    </div>` : `
    <p style="color:var(--text-3);font-size:0.82rem;margin-bottom:0.75rem">
      ${similar.length} lettori con gusti simili
    </p>
    <div class="user-list">
      ${similar.slice(0, 20).map(({ user, common, commonTitles }) => {
        const iFollow  = myFollowing.includes(user.id);
        const initials = user.username.slice(0, 2).toUpperCase();
        const avatar   = user.avatarUrl
          ? `<div class="user-card__avatar" style="background-image:url(${user.avatarUrl})"></div>`
          : `<div class="user-card__avatar user-card__avatar--initials">${initials}</div>`;
        return `
          <div class="user-card">
            ${avatar}
            <div class="user-card__info" onclick="window._viewUserProfile?.('${user.id}')">
              <strong>@${escHtml(user.username)}</strong>
              <span>Lv. ${user.level || 1} — ${common} libri in comune</span>
              <span style="font-size:0.72rem;color:var(--text-3)">${commonTitles.slice(0,2).map(t => escHtml(t)).join(', ')}</span>
              ${user.languages?.length ? `<span style="font-size:0.72rem;color:var(--text-3)">${user.languages.slice(0,2).join(' ')}</span>` : ''}
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

window._setDiscGenreFilter = function(genre) {
  _discGenreFilter = genre;
  _discPage = 0;
  renderLibri();
};

window._setDiscAuthorFilter = function(author) {
  _discAuthorFilter = author;
  _discPage = 0;
  renderLibri();
};

window._loadMoreDiscs = function() { _discPage++; renderLibri(); };

window._filterReaders = debounce(function(q) {
  _readersSearch = q;
  renderLibri();
}, 300);

window._filterReadersLang = function(lang) {
  _readersLang = lang;
  renderLibri();
};

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

  // Chiedi le pagine se non note
  const pages = parseInt(prompt(`Quante pagine ha "${gb.title}"? (inserisci 0 se non sai)`) || '0');

  const { ok } = await Books.create({
    title:      gb.title,
    author:     gb.author,
    genre:      gb.genre,
    difficulty: 2,
    totalPages: pages || gb.totalPages || 0,
  });
  if (!ok) return toast('Errore nell\'aggiunta', 'error');
  playSound('tap');
  toast(`"${gb.title}" aggiunto alla tua lista! ✅`, 'success');
};

window._showBookReaders = async function(globalBookId) {
  _libriTab = 'readers';
  await renderLibri();
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
            <div class="user-card__info" onclick="window._viewUserProfile?.('${u.id}')">
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

window._toggleDiscLike = async function(discId) {
  const { ok, data } = await Discussions.toggleLike(discId, CUR.id);
  if (!ok) return;
  playSound(data.liked ? 'like' : 'tap');
  const card    = document.querySelector(`.disc-card[data-disc-id="${discId}"]`);
  const btn     = card?.querySelector('.disc-like-btn');
  const countEl = btn?.querySelector('.disc-like-count');
  if (btn && countEl) {
    countEl.textContent = data.count;
    btn.innerHTML = `${data.liked ? '❤️' : '🤍'} <span class="disc-like-count">${data.count}</span>`;
    btn.classList.toggle('btn-liked', data.liked);
  }
};

window._toggleDiscReplies = function(discId) {
  document.getElementById(`disc-replies-${discId}`)?.classList.toggle('disc-replies--hidden');
};

window._replyToDisc = async function(discId) {
  const input   = document.getElementById(`disc-reply-input-${discId}`);
  const content = input?.value.trim();
  if (!content) return;
  const { ok, data } = await Discussions.addReply({ discussionId: discId, content });
  if (!ok) return toast('Errore nell\'invio', 'error');
  playSound('tap');
  input.value = '';

  const listEl = document.querySelector(`#disc-replies-${discId} .disc-replies__list`);
  if (listEl) {
    listEl.querySelector('.empty-replies')?.remove();
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
    listEl.appendChild(div);
  }
  const card    = document.querySelector(`.disc-card[data-disc-id="${discId}"]`);
  const countEl = card?.querySelector('.disc-reply-count');
  if (countEl) countEl.textContent = parseInt(countEl.textContent || '0') + 1;
};

window._deleteDiscReply = async function(replyId, discId) {
  if (!confirm('Eliminare questa risposta?')) return;
  await Discussions.deleteReply(replyId);
  document.querySelector(`[data-reply-id="${replyId}"]`)?.remove();
  const card    = document.querySelector(`.disc-card[data-disc-id="${discId}"]`);
  const countEl = card?.querySelector('.disc-reply-count');
  if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
  playSound('tap');
};

// Follow inline lettori (delegato a social.js per evitare cicli)
window._toggleFollow = async function(targetId, currentlyFollowing) {
  if (!CUR || targetId === CUR.id) return;
  const { _socialToggleFollow } = await import('./social.js').catch(() => ({}));
  if (_socialToggleFollow) {
    await window._socialToggleFollow?.(targetId, currentlyFollowing);
  } else {
    const { Users } = await import('../api.js');
    if (currentlyFollowing) await Users.unfollow(CUR.id, targetId);
    else await Users.follow(CUR.id, targetId);
    toast(currentlyFollowing ? 'Non segui più.' : 'Stai seguendo! 👥', currentlyFollowing ? 'info' : 'success');
  }
  // Aggiorna solo il bottone
  const btn = document.querySelector(`[onclick*="_toggleFollow?.('${targetId}'"]`);
  if (btn) {
    const now = !currentlyFollowing;
    btn.className   = now ? 'btn-unfollow' : 'btn-follow';
    btn.textContent = now ? 'Unfollow' : 'Follow';
    btn.setAttribute('onclick', `window._toggleFollow?.('${targetId}', ${now})`);
  }
  playSound('tap');
};
