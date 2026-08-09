// ============================================================
// screens/libri.js — Catalogo globale e Discussioni
// ============================================================

import { CUR, DB } from '../db.js';
import { Books, Discussions } from '../api.js';
import { escHtml, toast, timeAgo, debounce } from '../utils.js';
import { playSound } from '../audio.js';
import { openModal, closeModal } from '../modals.js';

let _libriTab    = 'catalog';  // 'catalog' | 'discussions'
let _discPage    = 0;
const DISC_PAGE  = 10;
let _discSearch  = '';

export function switchLibriTab(t) { _libriTab = t; renderLibri(); }

export async function renderLibri() {
  if (!CUR) return;
  const container = document.getElementById('screen-libri');
  if (!container) return;

  container.innerHTML = `
    <div class="screen-header">
      <h2>Libri</h2>
    </div>
    <div class="tab-row">
      ${['catalog','discussions'].map(t => `
        <button class="tab-btn ${_libriTab === t ? 'tab-btn--active' : ''}"
                onclick="window._switchLibriTab?.('${t}')">
          ${{ catalog: '🌐 Catalogo', discussions: '💬 Discussioni' }[t]}
        </button>`).join('')}
    </div>
    <div id="libri-content">Caricamento…</div>
  `;

  if (_libriTab === 'catalog') {
    await renderCatalog();
  } else {
    await renderDiscussions();
  }
}

// ── Catalogo globale ──────────────────────────────────────────

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
      ${b.coverUrl
        ? `<img class="catalog-cover" src="${b.coverUrl}" alt="cover" loading="lazy">`
        : `<div class="catalog-cover catalog-cover--placeholder">${escHtml(b.title.slice(0, 2).toUpperCase())}</div>`}
      <div class="catalog-card__body">
        <h3>${escHtml(b.title)}</h3>
        <p>${escHtml(b.author || '—')}</p>
        <span class="badge">${escHtml(b.genre || '—')}</span>
      </div>
      <button class="btn-primary" onclick="window._addBookFromCatalog?.('${b.id}')">
        + La mia lista
      </button>
    </div>`).join('');
}

window._switchLibriTab = switchLibriTab;

window._filterCatalog = debounce(async function(query) {
  const { ok, data } = await Books.getGlobalCatalog(query);
  const container = document.getElementById('catalog-list');
  if (container) container.innerHTML = renderCatalogList(ok ? data : []);
}, 300);

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
    totalPages: 300, // placeholder — utente dovrà aggiornare
  });

  if (!ok) return toast('Errore nell\'aggiunta', 'error');

  playSound('tap');
  toast(`"${gb.title}" aggiunto alla tua lista! ✅`, 'success');
};

// ── Discussioni ───────────────────────────────────────────────

async function renderDiscussions() {
  const container = document.getElementById('libri-content');
  if (!container) return;

  const { ok, data: discs } = await Discussions.list();
  const list = ok ? discs : DB.discussions;

  const filtered = _discSearch
    ? list.filter(d =>
        d.title?.toLowerCase().includes(_discSearch) ||
        d.content.toLowerCase().includes(_discSearch))
    : list;

  const page = filtered.slice(0, (_discPage + 1) * DISC_PAGE);

  container.innerHTML = `
    <div class="catalog-toolbar">
      <input type="text" id="disc-search" placeholder="Cerca discussioni…"
             value="${escHtml(_discSearch)}"
             oninput="window._filterDiscs?.(this.value)">
      <button class="btn-add" onclick="window._openCreateDiscModal?.()">+ Nuova</button>
    </div>

    <div id="disc-list">
      ${page.length
        ? page.map(d => discCard(d)).join('')
        : '<div class="empty-state">Nessuna discussione. Inizia la prima!</div>'}
    </div>

    ${filtered.length > page.length
      ? `<button class="btn-load-more" onclick="window._loadMoreDiscs?.()">Carica altri</button>`
      : ''}
  `;
}

function discCard(d) {
  const author  = DB.users[d.userId];
  const likes   = d.likes?.length || 0;
  const liked   = d.likes?.includes(CUR?.id);
  const replies = DB.discussionReplies.filter(r => r.discussionId === d.id).length;

  return `
    <div class="disc-card">
      <div class="disc-card__header">
        <span class="badge badge--${d.type === 'help' ? 'yellow' : 'blue'}">
          ${d.type === 'help' ? '❓ Aiuto' : '💬 Discussione'}
        </span>
        <time>${timeAgo(new Date(d.createdAt).getTime())}</time>
      </div>
      ${d.title ? `<h3>${escHtml(d.title)}</h3>` : ''}
      <p>${escHtml(d.content)}</p>
      <div class="disc-card__meta">
        <span>@${escHtml(author?.username || d.username || '?')}</span>
      </div>
      <div class="disc-card__actions">
        <button class="${liked ? 'btn-liked' : ''}"
                onclick="window._toggleDiscLike?.('${d.id}')">
          ${liked ? '❤️' : '🤍'} ${likes}
        </button>
        <button onclick="window._toggleDiscReplies?.('${d.id}')">
          💬 ${replies}
        </button>
      </div>
      <div id="disc-replies-${d.id}" class="disc-replies disc-replies--hidden">
        ${renderReplies(d.id)}
        <div class="reply-input-row">
          <input type="text" id="disc-reply-input-${d.id}"
                 placeholder="Scrivi una risposta…" maxlength="300">
          <button onclick="window._replyToDisc?.('${d.id}')">Invia</button>
        </div>
      </div>
    </div>`;
}

function renderReplies(discId) {
  const replies = DB.discussionReplies.filter(r => r.discussionId === discId);
  if (!replies.length) return '<p class="empty-replies">Nessuna risposta.</p>';
  return replies.map(r => `
    <div class="disc-reply">
      <strong>@${escHtml(r.username)}</strong>
      <span>${escHtml(r.content)}</span>
      <time>${timeAgo(new Date(r.createdAt).getTime())}</time>
    </div>`).join('');
}

// ── Azioni discussioni ────────────────────────────────────────

window._filterDiscs = debounce(function(query) {
  _discSearch = query.toLowerCase();
  _discPage   = 0;
  renderLibri();
}, 300);

window._loadMoreDiscs = function() {
  _discPage++;
  renderLibri();
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
  renderLibri();
};

window._toggleDiscLike = async function(discId) {
  const { ok, data } = await Discussions.toggleLike(discId, CUR.id);
  if (!ok) return;
  playSound(data.liked ? 'like' : 'tap');
  const btn = document.querySelector(`[onclick="_toggleDiscLike?.('${discId}')"]`);
  if (btn) btn.innerHTML = `${data.liked ? '❤️' : '🤍'} ${data.count}`;
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

  const repliesEl = document.getElementById(`disc-replies-${discId}`);
  if (repliesEl) {
    const empty = repliesEl.querySelector('.empty-replies');
    if (empty) empty.remove();
    const row = repliesEl.querySelector('.reply-input-row');
    const div = document.createElement('div');
    div.className = 'disc-reply';
    div.innerHTML = `<strong>@${escHtml(CUR.username)}</strong><span>${escHtml(content)}</span><time>adesso</time>`;
    repliesEl.insertBefore(div, row);
  }
};
