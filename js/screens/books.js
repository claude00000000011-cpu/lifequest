// ============================================================
// screens/books.js — Libreria personale, segnalibro, note, autocomplete
// ============================================================

import { CUR, DB, persist } from '../db.js';
import { Books, Feed } from '../api.js';
import { awardXP } from '../xp.js';
import { escHtml, diffStars, toast, debounce } from '../utils.js';
import { playSound } from '../audio.js';
import { openModal, closeModal } from '../modals.js';
import { XP_BOOK_PER_PAGE, BOOK_DIFF_BONUS, BOOK_GENRE_STAT } from '../config.js';

let _openBookId = null;

// ── Render principale ─────────────────────────────────────────

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
      Nessun libro ancora.<br>
      <small style="color:var(--text-3)">Premi + per aggiungerne uno!</small>
    </div>` : ''}
    ${reading.length ? `
      <h3 class="section-title">📖 In lettura (${reading.length})</h3>
      <div class="book-list">${reading.map(b => bookCard(b, false)).join('')}</div>` : ''}
    ${completed.length ? `
      <h3 class="section-title">✅ Completati (${completed.length})</h3>
      <div class="book-list book-list--done">${completed.map(b => bookCard(b, true)).join('')}</div>` : ''}
  `;

  if (_openBookId) {
    const detail = document.getElementById(`book-detail-${_openBookId}`);
    if (detail) detail.style.display = 'block';
  }
}

// ── Render card ───────────────────────────────────────────────

function bookCard(book, done = false) {
  const pct = book.totalPages
    ? Math.min(100, Math.round(((book.currentPage || 0) / book.totalPages) * 100))
    : 0;

  const cover = book.coverUrl
    ? `<img class="book-cover" src="${book.coverUrl}" alt="cover" loading="lazy">`
    : `<div class="book-cover book-cover--placeholder">${escHtml(book.title.slice(0, 2).toUpperCase())}</div>`;

  const isOpen = _openBookId === book.id;

  return `
    <div class="book-card ${isOpen ? 'book-card--open' : ''}" id="book-card-${book.id}">
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
            <div class="progress-bar" style="margin-top:0.4rem">
              <div class="progress-bar__fill" style="width:${pct}%"></div>
            </div>
            <p class="book-progress">${book.currentPage || 0}/${book.totalPages || '?'} pag. (${pct}%)</p>
          ` : `<p class="book-progress">✅ Completato — ${book.completedAt || ''}</p>`}
        </div>
        <span style="align-self:center;color:var(--text-3);flex-shrink:0">${isOpen ? '▲' : '▼'}</span>
      </div>

      <!-- DETTAGLIO -->
      <div id="book-detail-${book.id}" class="book-detail" style="display:${isOpen ? 'block' : 'none'}">

        <!-- Azioni principali -->
        <div class="book-actions-row">
          ${!done ? `
            <button class="btn-sm btn-primary" onclick="window._openReadingModal?.('${book.id}')">📖 Leggi</button>
            <button class="btn-sm" onclick="window._markBookDone?.('${book.id}')">✅ Finito</button>
          ` : ''}
          <button class="btn-sm btn-danger" onclick="window._deleteBook?.('${book.id}')">🗑 Rimuovi</button>
        </div>

        <!-- Progress segnalibro -->
        ${!done && book.totalPages ? `
          <div class="reading-progress-card">
            <div class="reading-progress-card__top">
              <strong>📍 Pagina ${book.currentPage || 0} di ${book.totalPages}</strong>
              <span class="reading-progress-card__pct">${pct}% completato</span>
            </div>
            <div class="progress-bar">
              <div class="progress-bar__fill" style="width:${pct}%"></div>
            </div>
            <div style="font-size:0.75rem;color:var(--text-3);margin-top:0.2rem">
              +${(2 * (BOOK_DIFF_BONUS[book.difficulty - 1] || 1)).toFixed(1)} XP per pagina
            </div>
          </div>` : ''}

        <!-- Note personali -->
        <div class="book-notes-section">
          <div class="exam-section__header">
            <h4>📝 Note personali</h4>
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
  if (!notes.length) return `<p class="empty-mini">Nessuna nota. Aggiungine una!</p>`;
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
  _openBookId = (_openBookId === bookId) ? null : bookId;

  document.querySelectorAll('[id^="book-detail-"]').forEach(el => {
    const id = el.id.replace('book-detail-', '');
    el.style.display = (id === bookId && _openBookId === bookId) ? 'block' : 'none';
  });
  document.querySelectorAll('[id^="book-card-"]').forEach(card => {
    const id = card.id.replace('book-card-', '');
    card.classList.toggle('book-card--open', id === bookId && _openBookId === bookId);
    const chevron = card.querySelector('.book-card__main > span:last-child');
    if (chevron) chevron.textContent = (id === bookId && _openBookId === bookId) ? '▲' : '▼';
  });

  if (_openBookId === bookId) {
    Books.getNotes(bookId).then(({ ok, data }) => {
      if (ok) {
        const el = document.getElementById(`book-notes-${bookId}`);
        if (el) el.innerHTML = renderNotesList(bookId);
      }
    });
  }
};

window._openAddNoteInline = function(bookId) {
  const row = document.getElementById(`note-input-${bookId}`);
  if (row) { row.style.display = 'flex'; document.getElementById(`note-text-${bookId}`)?.focus(); }
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
  if (!confirm('Rimuovere questo libro e tutte le sue note?')) return;
  const { remove: rm, persist: p } = await import('../db.js');
  rm('books', bookId);
  if (DB.bookNotes) DB.bookNotes = DB.bookNotes.filter(n => n.bookId !== bookId);
  p();
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

// ── Aggiungi libro con autocomplete ───────────────────────────

window._openAddBookModal = async function() {
  // Pre-carica catalogo globale per autocomplete
  if (!DB.globalBooks?.length) await Books.getGlobalCatalog();
  openModal('modal-add-book');

  // Attiva autocomplete dopo apertura modale
  setTimeout(() => {
    setupBookAutocomplete('book-title', 'book-author', 'book-title-dropdown');
    setupAuthorAutocomplete('book-author', 'book-author-dropdown');
  }, 150);
};

function setupBookAutocomplete(titleId, authorId, dropdownId) {
  const input = document.getElementById(titleId);
  if (!input) return;

  // Crea wrapper se non esiste
  if (!document.getElementById(dropdownId)) {
    const wrap = input.parentNode;
    wrap.style.position = 'relative';
    const dd = document.createElement('div');
    dd.id = dropdownId;
    dd.className = 'autocomplete-dropdown';
    dd.style.display = 'none';
    wrap.appendChild(dd);
  }

  input.addEventListener('input', debounce(() => {
    const q   = input.value.trim().toLowerCase();
    const dd  = document.getElementById(dropdownId);
    if (!dd) return;

    if (q.length < 2) { dd.style.display = 'none'; return; }

    const matches = (DB.globalBooks || []).filter(b =>
      b.title?.toLowerCase().includes(q)
    ).slice(0, 8);

    if (!matches.length) { dd.style.display = 'none'; return; }

    dd.style.display = 'block';
    dd.innerHTML = matches.map(b => `
      <div class="autocomplete-item" onclick="window._selectBookFromCatalog?.('${b.id}')">
        <strong>${escHtml(b.title)}</strong>
        <span>${escHtml(b.author || '—')} · ${escHtml(b.genre || '')}</span>
      </div>`).join('');
  }, 200));

  // Chiudi dropdown cliccando fuori
  document.addEventListener('click', e => {
    const dd = document.getElementById(dropdownId);
    if (dd && !dd.contains(e.target) && e.target !== input) dd.style.display = 'none';
  }, { once: false });
}

function setupAuthorAutocomplete(authorId, dropdownId) {
  const input = document.getElementById(authorId);
  if (!input) return;

  if (!document.getElementById(dropdownId)) {
    const wrap = input.parentNode;
    wrap.style.position = 'relative';
    const dd = document.createElement('div');
    dd.id = dropdownId;
    dd.className = 'autocomplete-dropdown';
    dd.style.display = 'none';
    wrap.appendChild(dd);
  }

  input.addEventListener('input', debounce(() => {
    const q  = input.value.trim().toLowerCase();
    const dd = document.getElementById(dropdownId);
    if (!dd || q.length < 2) { if (dd) dd.style.display = 'none'; return; }

    const authors = [...new Set(
      (DB.globalBooks || [])
        .map(b => b.author)
        .filter(a => a?.toLowerCase().includes(q))
    )].slice(0, 6);

    if (!authors.length) { dd.style.display = 'none'; return; }

    dd.style.display = 'block';
    dd.innerHTML = authors.map(a => `
      <div class="autocomplete-item" onclick="document.getElementById('${authorId}').value='${escHtml(a)}';this.parentNode.style.display='none'">
        <strong>${escHtml(a)}</strong>
      </div>`).join('');
  }, 200));
}

window._selectBookFromCatalog = function(globalBookId) {
  const gb = DB.globalBooks.find(b => b.id === globalBookId);
  if (!gb) return;
  const titleEl  = document.getElementById('book-title');
  const authorEl = document.getElementById('book-author');
  const genreEl  = document.getElementById('book-genre');
  if (titleEl)  titleEl.value  = gb.title;
  if (authorEl) authorEl.value = gb.author || '';
  if (genreEl)  genreEl.value  = gb.genre  || 'narrativa';
  // Chiudi dropdown
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

  // Aggiungi al catalogo globale se non esiste già
  const exists = (DB.globalBooks || []).some(b =>
    b.title?.toLowerCase() === title.toLowerCase());
  if (!exists) {
    await Books.addToGlobalCatalog({ title, author, genre });
  }

  const { ok, error } = await Books.create({ title, author, genre, difficulty, totalPages });
  if (!ok) return toast(error || 'Errore', 'error');

  playSound('quest');
  toast(`"${title}" aggiunto! 📖`, 'success');
  closeModal('modal-add-book');
  ['book-title','book-author','book-pages'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderBooks();
};

// ── Modal lettura (segnalibro) ────────────────────────────────

window._openReadingModal = function(bookId) {
  const book = DB.books.find(b => b.id === bookId);
  if (!book) return;

  const el = document.getElementById('reading-book-id');
  if (el) el.value = bookId;

  const labelEl = document.getElementById('reading-book-name');
  if (labelEl) labelEl.textContent = `"${book.title}" — pagina attuale: ${book.currentPage || 0}/${book.totalPages}`;

  // Aggiorna placeholder dell'input pagine
  const pagesInput = document.getElementById('reading-pages');
  if (pagesInput) {
    pagesInput.placeholder = `es. ${Math.min((book.currentPage || 0) + 20, book.totalPages)}`;
    pagesInput.max = book.totalPages;
  }

  openModal('modal-log-reading');
};

// FIX segnalibro: le pagine inserite sono la pagina TARGET (fino a dove hai letto)
// oppure il numero di pagine lette nella sessione. Usiamo "pagine lette nella sessione".
window._logReading = async function() {
  const bookId   = document.getElementById('reading-book-id')?.value;
  const pagesRaw = parseInt(document.getElementById('reading-pages')?.value || '0');

  if (!pagesRaw || pagesRaw < 1) return toast('Inserisci le pagine lette', 'error');

  const book = DB.books.find(b => b.id === bookId);
  if (!book) return toast('Libro non trovato', 'error');

  const diffBonus = BOOK_DIFF_BONUS[(book.difficulty || 1) - 1] || 1;
  const baseXP    = Math.round(pagesRaw * XP_BOOK_PER_PAGE * diffBonus);
  const statCat   = BOOK_GENRE_STAT[book.genre] ? 'lettura' : 'lettura';
  const earned    = await awardXP(baseXP, statCat);

  // Aggiorna segnalibro: newPage = currentPage + pagesRead, capped a totalPages
  const newPage = Math.min(book.totalPages || 9999, (book.currentPage || 0) + pagesRaw);
  await Books.updateProgress(bookId, newPage);
  await Books.logReading({ bookId, pagesRead: pagesRaw, xpEarned: earned });

  await Feed.create({
    content:  `📚 Letto ${pagesRaw} pagine di "${book.title}" (p. ${newPage}/${book.totalPages})`,
    category: 'lettura',
    xpEarned: earned,
    refType:  'book',
    refId:    bookId,
  });

  playSound('xp');
  toast(`+${earned} XP — sei a pagina ${newPage}! 📍`, 'success');
  closeModal('modal-log-reading');
  document.getElementById('reading-pages').value = '';

  if (newPage >= (book.totalPages || 0) && book.totalPages > 0) {
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
  _openBookId = null;
  renderBooks();
};
