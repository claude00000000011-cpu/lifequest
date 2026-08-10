// ============================================================
// screens/books.js — Libreria personale, sessioni, note
// ============================================================

import { CUR, DB } from '../db.js';
import { Books, Feed } from '../api.js';
import { awardXP } from '../xp.js';
import { escHtml, diffStars, toast, pickImage } from '../utils.js';
import { playSound } from '../audio.js';
import { openModal, closeModal } from '../modals.js';
import { XP_BOOK_PER_PAGE, BOOK_DIFF_BONUS, BOOK_GENRE_STAT } from '../config.js';

let _openBookId = null;  // quale libro ha il dettaglio aperto

export async function renderBooks() {
  if (!CUR) return;
  const container = document.getElementById('screen-books');
  if (!container) return;

  container.innerHTML = `<div class="screen-header"><h2>I miei Libri</h2>
    <button class="btn-add" onclick="window._openAddBookModal?.()">+ Libro</button>
  </div><div class="feed-loading">Caricamento…</div>`;

  const { ok, data: books } = await Books.list(CUR.id);
  const list = ok ? books : DB.books.filter(b => b.userId === CUR.id);

  const reading   = list.filter(b => !b.completed);
  const completed = list.filter(b =>  b.completed);

  container.innerHTML = `
    <div class="screen-header">
      <h2>I miei Libri</h2>
      <button class="btn-add" onclick="window._openAddBookModal?.()">+ Libro</button>
    </div>

    ${!list.length ? `<div class="empty-state">
      Nessun libro ancora. Aggiungine uno con il tasto +!<br>
      <small style="color:var(--text-3)">Puoi anche trovare libri nel catalogo globale (tab Libri)</small>
    </div>` : ''}

    ${reading.length ? `
      <h3 class="section-title">📖 In lettura (${reading.length})</h3>
      <div class="book-list">
        ${reading.map(b => bookCard(b, false)).join('')}
      </div>` : ''}

    ${completed.length ? `
      <h3 class="section-title">✅ Completati (${completed.length})</h3>
      <div class="book-list book-list--done">
        ${completed.map(b => bookCard(b, true)).join('')}
      </div>` : ''}
  `;

  // Apri il dettaglio se era aperto prima del refresh
  if (_openBookId) {
    const el = document.getElementById(`book-detail-${_openBookId}`);
    if (el) el.style.display = 'block';
  }
}

function bookCard(book, done = false) {
  const pct = book.totalPages
    ? Math.min(100, Math.round(((book.currentPage || 0) / book.totalPages) * 100))
    : 0;

  const cover = book.coverUrl
    ? `<img class="book-cover" src="${book.coverUrl}" alt="cover" loading="lazy">`
    : `<div class="book-cover book-cover--placeholder">${escHtml(book.title.slice(0, 2).toUpperCase())}</div>`;

  const isOpen = _openBookId === book.id;

  return `
    <div class="book-card" id="book-card-${book.id}">
      <div class="book-card__main" onclick="window._toggleBookDetail?.('${book.id}')">
        ${cover}
        <div class="book-card__body">
          <h3>${escHtml(book.title)}</h3>
          <p class="book-author">✍️ ${escHtml(book.author || '—')}</p>
          <div class="book-meta">
            <span class="badge">${escHtml(book.genre)}</span>
            <span>${diffStars(book.difficulty)}</span>
          </div>
          ${!done ? `
            <div class="progress-bar">
              <div class="progress-bar__fill" style="width:${pct}%"></div>
            </div>
            <p class="book-progress">${book.currentPage || 0}/${book.totalPages} pag. (${pct}%)</p>
          ` : `<p class="book-progress">✅ ${book.totalPages} pagine — ${book.completedAt || ''}</p>`}
        </div>
        <span style="align-self:center;color:var(--text-3)">${isOpen ? '▲' : '▼'}</span>
      </div>

      <!-- DETTAGLIO LIBRO -->
      <div id="book-detail-${book.id}" style="display:${isOpen ? 'block' : 'none'}">
        <div class="book-actions-row">
          ${!done ? `
            <button class="btn-sm btn-primary" onclick="window._openReadingModal?.('${book.id}')">📖 Leggi</button>
            <button class="btn-sm" onclick="window._markBookDone?.('${book.id}')">✅ Finito</button>
          ` : ''}
          <button class="btn-sm btn-danger" onclick="window._deleteBook?.('${book.id}')">🗑️</button>
        </div>

        <!-- NOTE PERSONALI -->
        <div class="book-notes-section">
          <div class="exam-section__header">
            <h4>📝 Le mie note</h4>
            <button class="btn-add-inline" onclick="window._openAddNoteInline?.('${book.id}')">+ Nota</button>
          </div>
          <div id="book-notes-${book.id}">
            ${renderNotesList(book.id)}
          </div>
          <div id="note-input-${book.id}" class="inline-input-row" style="display:none">
            <input type="text" id="note-text-${book.id}" placeholder="Annotazione, citazione, pensiero…" maxlength="500">
            <button onclick="window._addBookNote?.('${book.id}')">✓</button>
            <button onclick="document.getElementById('note-input-${book.id}').style.display='none'">✕</button>
          </div>
        </div>
      </div>
    </div>`;
}

function renderNotesList(bookId) {
  const notes = (DB.bookNotes || []).filter(n => n.bookId === bookId && n.userId === CUR.id);
  if (!notes.length) return `<p class="empty-mini">Nessuna nota ancora. Aggiungine una!</p>`;

  return `<div class="notes-list">
    ${notes.map(n => `
      <div class="note-item" data-note-id="${n.id}">
        <p>${escHtml(n.text)}</p>
        <div class="note-item__footer">
          <time>${n.createdAt?.slice(0, 10) || ''}</time>
          <button class="btn-icon-sm" onclick="window._deleteBookNote?.('${n.id}', '${bookId}')">🗑</button>
        </div>
      </div>`).join('')}
  </div>`;
}

// ── Azioni ────────────────────────────────────────────────────

window._toggleBookDetail = async function(bookId) {
  if (_openBookId === bookId) {
    _openBookId = null;
  } else {
    _openBookId = bookId;
    // Carica note dal cloud in background
    Books.getNotes(bookId).then(({ ok, data }) => {
      if (ok) {
        const el = document.getElementById(`book-notes-${bookId}`);
        if (el) el.innerHTML = renderNotesList(bookId);
      }
    });
  }
  // Toggle display senza ri-renderizzare tutto
  document.querySelectorAll('[id^="book-detail-"]').forEach(el => {
    const id = el.id.replace('book-detail-', '');
    el.style.display = id === bookId && _openBookId === bookId ? 'block' : 'none';
  });
  // Aggiorna chevron
  document.querySelectorAll('[id^="book-card-"]').forEach(card => {
    const id = card.id.replace('book-card-', '');
    const chevron = card.querySelector('span[style*="align-self"]');
    if (chevron) chevron.textContent = (id === bookId && _openBookId === bookId) ? '▲' : '▼';
  });
};

window._openAddNoteInline = function(bookId) {
  const row = document.getElementById(`note-input-${bookId}`);
  if (row) {
    row.style.display = 'flex';
    document.getElementById(`note-text-${bookId}`)?.focus();
  }
};

window._addBookNote = async function(bookId) {
  const input = document.getElementById(`note-text-${bookId}`);
  const text  = input?.value.trim();
  if (!text) return;

  const { ok } = await Books.addNote(bookId, text);
  if (!ok) return toast('Errore nel salvataggio', 'error');

  input.value = '';
  document.getElementById(`note-input-${bookId}`).style.display = 'none';
  playSound('tap');
  toast('Nota salvata! 📝', 'success');

  const el = document.getElementById(`book-notes-${bookId}`);
  if (el) el.innerHTML = renderNotesList(bookId);
};

window._deleteBookNote = async function(noteId, bookId) {
  await Books.deleteNote(noteId);
  playSound('tap');
  const el = document.getElementById(`book-notes-${bookId}`);
  if (el) el.innerHTML = renderNotesList(bookId);
};

window._deleteBook = async function(bookId) {
  if (!confirm('Eliminare questo libro e tutte le sue note?')) return;
  const { remove } = await import('../db.js');
  remove('books', bookId);
  // Rimuovi note locali
  if (DB.bookNotes) DB.bookNotes = DB.bookNotes.filter(n => n.bookId !== bookId);
  const { persist } = await import('../db.js');
  persist();
  // Sync cloud
  const { supabase } = await import('../supabase.js').catch(() => ({ supabase: null }));
  if (supabase) {
    supabase.from('books').delete().eq('id', bookId);
    supabase.from('book_notes').delete().eq('book_id', bookId);
  }
  _openBookId = null;
  playSound('tap');
  toast('Libro rimosso', 'info');
  renderBooks();
};

window._openAddBookModal = function() { openModal('modal-add-book'); };

window._addBook = async function() {
  const title      = document.getElementById('book-title')?.value.trim();
  const author     = document.getElementById('book-author')?.value.trim();
  const genre      = document.getElementById('book-genre')?.value || 'narrativa';
  const difficulty = parseInt(document.getElementById('book-difficulty')?.value || '1');
  const totalPages = parseInt(document.getElementById('book-pages')?.value || '0');

  if (!title)      return toast('Inserisci il titolo', 'error');
  if (!totalPages) return toast('Inserisci il numero di pagine', 'error');

  const { ok, error } = await Books.create({ title, author, genre, difficulty, totalPages });
  if (!ok) return toast(error || 'Errore', 'error');

  playSound('quest');
  toast('Libro aggiunto! 📖', 'success');
  closeModal('modal-add-book');
  document.getElementById('book-title').value = '';
  document.getElementById('book-author').value = '';
  document.getElementById('book-pages').value = '';
  renderBooks();
};

window._openReadingModal = function(bookId) {
  const el = document.getElementById('reading-book-id');
  if (el) el.value = bookId;

  // Mostra il nome del libro nel modal
  const book = DB.books.find(b => b.id === bookId);
  const labelEl = document.getElementById('reading-book-name');
  if (labelEl && book) labelEl.textContent = book.title;

  openModal('modal-log-reading');
};

window._logReading = async function() {
  const bookId = document.getElementById('reading-book-id')?.value;
  const pages  = parseInt(document.getElementById('reading-pages')?.value || '0');

  if (!pages || pages < 1) return toast('Inserisci le pagine lette', 'error');

  const book = DB.books.find(b => b.id === bookId);
  if (!book) return toast('Libro non trovato', 'error');

  const diffBonus = BOOK_DIFF_BONUS[book.difficulty - 1] || 1;
  const baseXP    = Math.round(pages * XP_BOOK_PER_PAGE * diffBonus);
  const statKey   = BOOK_GENRE_STAT[book.genre] || 'cultura';
  const earned    = await awardXP(baseXP, statKey === 'cultura' ? 'lettura' : 'studio');

  const newPage = Math.min(book.totalPages, (book.currentPage || 0) + pages);
  await Books.updateProgress(bookId, newPage);
  await Books.logReading({ bookId, pagesRead: pages, xpEarned: earned });

  await Feed.create({
    content:  `📚 Letto ${pages} pagine di "${book.title}"`,
    category: 'lettura',
    xpEarned: earned,
    refType:  'book',
    refId:    bookId,
  });

  playSound('xp');
  toast(`+${earned} XP — ${pages} pagine lette!`, 'success');
  closeModal('modal-log-reading');
  document.getElementById('reading-pages').value = '';

  if (newPage >= book.totalPages) {
    await window._markBookDone?.(bookId, true);
  } else {
    renderBooks();
  }
};

window._markBookDone = async function(bookId, auto = false) {
  if (!auto && !confirm('Segnare il libro come completato?')) return;

  const book = DB.books.find(b => b.id === bookId);
  if (!book) return;

  const { ok } = await Books.markDone(bookId);
  if (!ok) return toast('Errore', 'error');

  const bonus  = Math.round(book.totalPages * 0.2);
  const earned = await awardXP(bonus, 'lettura');

  await Feed.create({
    content:  `🏆 Ho finito "${book.title}" di ${book.author || '?'}!`,
    category: 'lettura',
    xpEarned: earned,
    refType:  'book',
    refId:    bookId,
  });

  playSound('trophy');
  toast(`📚 Libro completato! +${earned} XP bonus!`, 'success');
  _openBookId = null;
  renderBooks();
};
