// ============================================================
// screens/books.js — Libreria personale, sub-screen libro,
//                    segnalibro, note, autocomplete
// ============================================================

import { CUR, DB, persist } from '../db.js';
import { Books, Feed } from '../api.js';
import { awardXP } from '../xp.js';
import { escHtml, diffStars, toast, debounce, timeAgo, uid } from '../utils.js';
import { playSound } from '../audio.js';
import { openModal, closeModal } from '../modals.js';
import { XP_BOOK_PER_PAGE, BOOK_DIFF_BONUS, BOOK_GENRE_STAT } from '../config.js';

// ── Stato navigazione ─────────────────────────────────────────
// null = lista libri  |  stringa = ID libro aperto
let _currentBookId = null;

// ── Entry point (chiamato da gotoTab) ─────────────────────────

export async function renderBooks() {
  if (!CUR) return;
  const container = document.getElementById('screen-libri') ||
                    document.getElementById('screen-books');
  if (!container) return;

  if (_currentBookId) {
    await renderBookScreen(_currentBookId, container);
  } else {
    await renderBookList(container);
  }
}

// ── Lista libri ───────────────────────────────────────────────

async function renderBookList(container) {
  container.innerHTML = `
    <div class="screen-header">
      <h2>📚 I miei Libri</h2>
      <button class="btn-add" onclick="window._openAddBookModal?.()">+ Libro</button>
    </div>
    <div class="feed-loading">Caricamento…</div>`;

  const { ok, data } = await Books.list(CUR.id);
  const list = ok ? data : DB.books.filter(b => b.userId === CUR.id);

  const reading   = list.filter(b => !b.completed);
  const completed = list.filter(b =>  b.completed);

  container.innerHTML = `
    <div class="screen-header">
      <h2>📚 I miei Libri</h2>
      <button class="btn-add" onclick="window._openAddBookModal?.()">+ Libro</button>
    </div>
    ${!list.length ? `
      <div class="empty-state">
        Nessun libro ancora.<br>
        <small style="color:var(--text-3)">Premi + per aggiungerne uno!</small>
      </div>` : ''}
    ${reading.length ? `
      <h3 class="section-title">📖 In lettura (${reading.length})</h3>
      <div class="book-list">
        ${reading.map(b => bookListCard(b)).join('')}
      </div>` : ''}
    ${completed.length ? `
      <h3 class="section-title">✅ Completati (${completed.length})</h3>
      <div class="book-list">
        ${completed.map(b => bookListCard(b)).join('')}
      </div>` : ''}`;
}

function bookListCard(book) {
  const pct = book.totalPages
    ? Math.min(100, Math.round(((book.currentPage || 0) / book.totalPages) * 100))
    : 0;

  const cover = book.coverUrl
    ? `<img class="book-cover" src="${book.coverUrl}" alt="cover" loading="lazy">`
    : `<div class="book-cover book-cover--placeholder">${escHtml(book.title.slice(0, 2).toUpperCase())}</div>`;

  return `
    <div class="book-card" onclick="window._openBook?.('${book.id}')">
      <div class="book-card__main">
        ${cover}
        <div class="book-card__body">
          <h3>${escHtml(book.title)}</h3>
          <p class="book-author">✍️ ${escHtml(book.author || '—')}</p>
          <div class="book-meta">
            <span class="badge">${escHtml(book.genre || '')}</span>
            <span>${diffStars(book.difficulty)}</span>
          </div>
          ${!book.completed ? `
            <div class="progress-bar" style="margin-top:0.4rem">
              <div class="progress-bar__fill" style="width:${pct}%"></div>
            </div>
            <p class="book-progress">${book.currentPage || 0} / ${book.totalPages || '?'} pag. (${pct}%)</p>
          ` : `<p class="book-progress" style="color:var(--success)">✅ Completato</p>`}
        </div>
        <span style="align-self:center;color:var(--text-3);flex-shrink:0">›</span>
      </div>
    </div>`;
}

// ── Sub-screen libro ──────────────────────────────────────────

async function renderBookScreen(bookId, container) {
  const book = DB.books.find(b => b.id === bookId);
  if (!book) { _currentBookId = null; return renderBooks(); }

  const pct = book.totalPages
    ? Math.min(100, Math.round(((book.currentPage || 0) / book.totalPages) * 100))
    : 0;

  const xpPerPage = (2 * (BOOK_DIFF_BONUS[(book.difficulty || 1) - 1] || 1)).toFixed(1);

  // Carica sessioni da Supabase
await Books.getReadingSessions(bookId);

// Sessioni di lettura di questo libro
const sessions = (DB.readingSessions || [])
  .filter(s => s.bookId === bookId)
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Note
  await Books.getNotes(bookId);
  const notes = (DB.bookNotes || [])
    .filter(n => n.bookId === bookId && n.userId === CUR.id);

  container.innerHTML = `
    <!-- Header con back -->
    <div class="screen-header" style="gap:0.5rem">
      <button class="btn-icon-sm" style="font-size:1.2rem;color:var(--text-2)"
              onclick="window._closeBook?.()">← </button>
      <h2 style="flex:1;font-size:1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${escHtml(book.title)}
      </h2>
      ${!book.completed ? `
        <button class="btn-sm btn-primary" onclick="window._openReadingModal?.('${book.id}')">
          📖 Leggi
        </button>` : ''}
    </div>

    <!-- Hero libro -->
    <div class="book-hero">
      <div class="book-hero__cover">
        ${book.coverUrl
          ? `<img src="${book.coverUrl}" alt="cover">`
          : `<div class="book-cover book-cover--placeholder book-cover--lg">
               ${escHtml(book.title.slice(0, 2).toUpperCase())}
             </div>`}
      </div>
      <div class="book-hero__info">
        <h3>${escHtml(book.title)}</h3>
        <p style="color:var(--text-2);font-size:0.85rem">✍️ ${escHtml(book.author || '—')}</p>
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.3rem">
          <span class="badge">${escHtml(book.genre || '')}</span>
          <span class="badge">${diffStars(book.difficulty)}</span>
        </div>
        <p style="font-size:0.78rem;color:var(--accent-light);margin-top:0.4rem">
          ✨ ${xpPerPage} XP/pagina
        </p>
      </div>
    </div>

    <!-- Progress segnalibro -->
    ${!book.completed ? `
      <div class="reading-progress-card" style="margin-bottom:1rem">
        <div class="reading-progress-card__top">
          <strong>📍 Pagina ${book.currentPage || 0} di ${book.totalPages || '?'}</strong>
          <span class="reading-progress-card__pct">${pct}%</span>
        </div>
        <div class="progress-bar" style="margin:0.4rem 0">
          <div class="progress-bar__fill" style="width:${pct}%"></div>
        </div>
        <div style="display:flex;gap:0.5rem;margin-top:0.5rem">
          <button class="btn-sm btn-primary" style="flex:1"
                  onclick="window._openReadingModal?.('${book.id}')">
            + Sessione di lettura
          </button>
          <button class="btn-sm" onclick="window._markBookDone?.('${book.id}')">
            ✅ Finito
          </button>
        </div>
      </div>` : `
      <div class="reading-progress-card" style="margin-bottom:1rem;border-color:var(--success)">
        <div style="text-align:center;color:var(--success);font-weight:700">
          🏆 Libro completato! ${book.completedAt ? `(${book.completedAt})` : ''}
        </div>
      </div>`}

    <!-- Sessioni di lettura -->
    <div class="exam-section" style="margin-bottom:1rem">
      <div class="exam-section__header">
        <h4>📅 Sessioni di lettura (${sessions.length})</h4>
      </div>
      ${!sessions.length
        ? `<p class="empty-mini">Nessuna sessione ancora. Inizia a leggere!</p>`
        : `<div class="session-list">
            ${sessions.map(s => `
              <div class="session-item">
                <div style="display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:0.85rem;font-weight:600">
                    📖 ${s.pagesRead} pagine lette
                  </span>
                  <span style="font-size:0.75rem;color:var(--accent-light)">
                    +${s.xpEarned} XP
                  </span>
                </div>
                <div style="font-size:0.75rem;color:var(--text-3);margin-top:0.15rem">
                  ${s.readAt || s.createdAt?.slice(0, 10) || ''}
                  ${s.createdAt ? ` · ${timeAgo(new Date(s.createdAt).getTime())}` : ''}
                </div>
              </div>`).join('')}
           </div>`}
    </div>

    <!-- Note personali -->
    <div class="exam-section" style="margin-bottom:1rem">
      <div class="exam-section__header">
        <h4>📝 Le mie note</h4>
        <button class="btn-add-inline" onclick="window._toggleNoteInput?.('${book.id}')">
          + Nota
        </button>
      </div>
      <div id="note-input-${book.id}" class="inline-input-row" style="display:none">
        <input type="text" id="note-text-${book.id}"
               placeholder="Citazione, pensiero, cosa ho imparato…" maxlength="500">
        <button onclick="window._addBookNote?.('${book.id}')">✓</button>
        <button onclick="window._toggleNoteInput?.('${book.id}')">✕</button>
      </div>
      <div id="book-notes-${book.id}">
        ${renderNotesList(notes)}
      </div>
    </div>

    <!-- Azioni pericolose -->
    <div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
      <button class="btn-sm btn-danger" onclick="window._deleteBook?.('${book.id}')">
        🗑 Rimuovi dalla libreria
      </button>
    </div>`;
}

function renderNotesList(notes) {
  if (!notes.length) return `<p class="empty-mini">Nessuna nota ancora.</p>`;
  return `<div class="notes-list">
    ${notes.map(n => `
      <div class="note-item" data-note-id="${n.id}">
        <p>${escHtml(n.text)}</p>
        <div class="note-item__footer">
          <time>${n.createdAt?.slice(0, 10) || ''}</time>
          <button class="btn-icon-sm"
                  onclick="window._deleteBookNote?.('${n.id}', '${n.bookId}')">🗑</button>
        </div>
      </div>`).join('')}
  </div>`;
}

// ── Navigazione libro ──────────────────────────────────────────

window._openBook = function(bookId) {
  _currentBookId = bookId;
  renderBooks();
};

window._closeBook = function() {
  _currentBookId = null;
  renderBooks();
};

// ── Azioni note ───────────────────────────────────────────────

window._toggleNoteInput = function(bookId) {
  const row = document.getElementById(`note-input-${bookId}`);
  if (!row) return;
  const isHidden = row.style.display === 'none';
  row.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) document.getElementById(`note-text-${bookId}`)?.focus();
};

window._addBookNote = async function(bookId) {
  const input = document.getElementById(`note-text-${bookId}`);
  const text  = input?.value.trim();
  if (!text) return;

  const { ok } = await Books.addNote(bookId, text);
  if (!ok) return toast('Errore nel salvataggio', 'error');

  input.value = '';
  window._toggleNoteInput?.(bookId);
  playSound('tap');
  toast('Nota salvata! 📝', 'success');

  // Aggiorna lista note inline senza re-render completo
  const notes = (DB.bookNotes || [])
    .filter(n => n.bookId === bookId && n.userId === CUR.id);
  const el = document.getElementById(`book-notes-${bookId}`);
  if (el) el.innerHTML = renderNotesList(notes);
};






window._deleteBookNote = async function(noteId, bookId) {
  await Books.deleteNote(noteId);
  playSound('tap');
  const notes = (DB.bookNotes || [])
    .filter(n => n.bookId === bookId && n.userId === CUR.id);
  const el = document.getElementById(`book-notes-${bookId}`);
  if (el) el.innerHTML = renderNotesList(notes);
};

// ── Aggiungi libro con autocomplete ───────────────────────────

window._openAddBookModal = async function() {
  if (!DB.globalBooks?.length) await Books.getGlobalCatalog();
  openModal('modal-add-book');
  setTimeout(() => {
    setupBookAutocomplete();
    setupAuthorAutocomplete();
  }, 150);
};

function setupBookAutocomplete() {
  const input = document.getElementById('book-title');
  if (!input || input._autocompleteReady) return;
  input._autocompleteReady = true;

  let dd = document.getElementById('book-title-dropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'book-title-dropdown';
    dd.className = 'autocomplete-dropdown';
    dd.style.display = 'none';
    input.parentNode.appendChild(dd);
  }

  input.addEventListener('input', debounce(() => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { dd.style.display = 'none'; return; }

    const matches = (DB.globalBooks || [])
      .filter(b => b.title?.toLowerCase().includes(q))
      .slice(0, 8);

    if (!matches.length) { dd.style.display = 'none'; return; }

    dd.style.display = 'block';
    dd.innerHTML = matches.map(b => `
      <div class="autocomplete-item"
           onclick="window._selectBookFromCatalog?.('${b.id}')">
        <strong>${escHtml(b.title)}</strong>
        <span>${escHtml(b.author || '—')} · ${escHtml(b.genre || '')}</span>
      </div>`).join('');
  }, 200));

  document.addEventListener('click', e => {
    if (!dd.contains(e.target) && e.target !== input) dd.style.display = 'none';
  });
}

function setupAuthorAutocomplete() {
  const input = document.getElementById('book-author');
  if (!input || input._autocompleteReady) return;
  input._autocompleteReady = true;

  let dd = document.getElementById('book-author-dropdown');
  if (!dd) {
    dd = document.createElement('div');
    dd.id = 'book-author-dropdown';
    dd.className = 'autocomplete-dropdown';
    dd.style.display = 'none';
    input.parentNode.appendChild(dd);
  }

  input.addEventListener('input', debounce(() => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { dd.style.display = 'none'; return; }

    const authors = [...new Set(
      (DB.globalBooks || [])
        .map(b => b.author)
        .filter(a => a?.toLowerCase().includes(q))
    )].slice(0, 6);

    if (!authors.length) { dd.style.display = 'none'; return; }

    dd.style.display = 'block';
    dd.innerHTML = authors.map(a => `
      <div class="autocomplete-item"
           onclick="document.getElementById('book-author').value='${escHtml(a)}';
                    document.getElementById('book-author-dropdown').style.display='none'">
        <strong>${escHtml(a)}</strong>
      </div>`).join('');
  }, 200));

  document.addEventListener('click', e => {
    if (!dd.contains(e.target) && e.target !== input) dd.style.display = 'none';
  });
}

window._selectBookFromCatalog = function(globalBookId) {
  const gb = DB.globalBooks.find(b => b.id === globalBookId);
  if (!gb) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('book-title',  gb.title);
  set('book-author', gb.author || '');
  set('book-genre',  gb.genre  || 'narrativa');
  const dd = document.getElementById('book-title-dropdown');
  if (dd) dd.style.display = 'none';
};

window._addBook = async function() {
  const title      = document.getElementById('book-title')?.value.trim();
  const author     = document.getElementById('book-author')?.value.trim();
  const genre      = document.getElementById('book-genre')?.value || 'narrativa';
  const difficulty = parseInt(document.getElementById('book-difficulty')?.value || '1');
  const totalPages = parseInt(document.getElementById('book-pages')?.value || '0');

  if (!title)      return toast('Inserisci il titolo', 'error');
  if (!totalPages) return toast('Inserisci il numero di pagine', 'error');

  // Aggiungi al catalogo globale se non esiste
  const exists = (DB.globalBooks || []).some(
    b => b.title?.toLowerCase() === title.toLowerCase()
  );
  if (!exists) await Books.addToGlobalCatalog({ title, author, genre });

  const { ok, error } = await Books.create({ title, author, genre, difficulty, totalPages });
  if (!ok) return toast(error || 'Errore', 'error');

  playSound('quest');
  toast(`"${title}" aggiunto! 📖`, 'success');
  closeModal('modal-add-book');
  ['book-title', 'book-author', 'book-pages'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  renderBooks();
};

// ── Modal sessione di lettura ─────────────────────────────────

window._openReadingModal = function(bookId) {
  const book = DB.books.find(b => b.id === bookId);
  if (!book) return;

  const el = document.getElementById('reading-book-id');
  if (el) el.value = bookId;

  const labelEl = document.getElementById('reading-book-name');
  if (labelEl) {
    labelEl.textContent = `"${book.title}" — pagina ${book.currentPage || 0} di ${book.totalPages}`;
  }

  const pagesInput = document.getElementById('reading-pages');
  if (pagesInput) {
    pagesInput.placeholder = `es. ${Math.min((book.currentPage || 0) + 20, book.totalPages || 999)}`;
    pagesInput.max = book.totalPages || 9999;
    pagesInput.value = '';
  }

  openModal('modal-log-reading');
};

window._logReading = async function() {
  const bookId   = document.getElementById('reading-book-id')?.value;
  const pagesRaw = parseInt(document.getElementById('reading-pages')?.value || '0');

  if (!pagesRaw || pagesRaw < 1) return toast('Inserisci le pagine lette', 'error');

  const book = DB.books.find(b => b.id === bookId);
  if (!book) return toast('Libro non trovato', 'error');

  const diffBonus = BOOK_DIFF_BONUS[(book.difficulty || 1) - 1] || 1;
  const baseXP    = Math.round(pagesRaw * XP_BOOK_PER_PAGE * diffBonus);
  const earned    = await awardXP(baseXP, 'lettura');

  // Aggiorna segnalibro
  const newPage = Math.min(book.totalPages || 9999, (book.currentPage || 0) + pagesRaw);
  await Books.updateProgress(bookId, newPage);
  await Books.logReading({ bookId, pagesRead: pagesRaw, xpEarned: earned });

  await Feed.create({
    content:  `📚 Letto ${pagesRaw} pagine di "${book.title}" (p. ${newPage}/${book.totalPages || '?'})`,
    category: 'lettura',
    xpEarned: earned,
    refType:  'book',
    refId:    bookId,
  });

  playSound('xp');
  toast(`+${earned} XP — pagina ${newPage}! 📍`, 'success');
  closeModal('modal-log-reading');
  document.getElementById('reading-pages').value = '';

  // Completa automaticamente se finito
  if (book.totalPages > 0 && newPage >= book.totalPages) {
    await window._markBookDone?.(bookId, true);
  } else {
    // Re-render sub-screen aggiornata
    const container = document.getElementById('screen-libri') ||
                      document.getElementById('screen-books');
    if (container && _currentBookId === bookId) {
      await renderBookScreen(bookId, container);
    }
  }
};

window._markBookDone = async function(bookId, auto = false) {
  if (!auto && !confirm('Segnare il libro come completato?')) return;
  const book = DB.books.find(b => b.id === bookId);
  if (!book) return;

  const { ok } = await Books.markDone(bookId);
  if (!ok) return toast('Errore', 'error');

  const bonus  = Math.round((book.totalPages || 100) * 0.2);
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
  _currentBookId = null;
  renderBooks();
};

window._deleteBook = async function(bookId) {
  if (!confirm('Rimuovere questo libro e tutte le sue note?')) return;

  const { remove: rm, persist: p } = await import('../db.js');
  rm('books', bookId);
  if (DB.bookNotes)       DB.bookNotes       = DB.bookNotes.filter(n => n.bookId !== bookId);
  if (DB.readingSessions) DB.readingSessions = DB.readingSessions.filter(s => s.bookId !== bookId);
  p();

  // Sync Supabase
  import('../supabase.js').then(({ supabase }) => {
    supabase.from('books').delete().eq('id', bookId);
    supabase.from('book_notes').delete().eq('book_id', bookId);
    supabase.from('reading_sessions').delete().eq('book_id', bookId);
  }).catch(() => {});

  _currentBookId = null;
  playSound('tap');
  toast('Libro rimosso', 'info');
  renderBooks();
};
