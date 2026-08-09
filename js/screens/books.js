// ============================================================
// screens/books.js — Libreria personale e sessioni di lettura
// ============================================================

import { CUR, DB } from '../db.js';
import { Books, Feed } from '../api.js';
import { awardXP } from '../xp.js';
import { escHtml, diffStars, toast, pickImage } from '../utils.js';
import { playSound } from '../audio.js';
import { openModal, closeModal } from '../modals.js';
import { XP_BOOK_PER_PAGE, BOOK_DIFF_BONUS, BOOK_GENRE_STAT } from '../config.js';

export async function renderBooks() {
  if (!CUR) return;
  const container = document.getElementById('screen-books');
  if (!container) return;

  const { ok, data: books } = await Books.list(CUR.id);
  const list = ok ? books : DB.books.filter(b => b.userId === CUR.id);

  const reading   = list.filter(b => !b.completed);
  const completed = list.filter(b =>  b.completed);

  container.innerHTML = `
    <div class="screen-header">
      <h2>I miei Libri</h2>
      <button class="btn-add" onclick="window._openAddBookModal?.()">+ Libro</button>
    </div>

    ${reading.length ? `
      <h3 class="section-title">📖 In lettura</h3>
      <div class="book-list">
        ${reading.map(b => bookCard(b)).join('')}
      </div>` : ''}

    ${completed.length ? `
      <h3 class="section-title">✅ Completati (${completed.length})</h3>
      <div class="book-list book-list--done">
        ${completed.map(b => bookCard(b, true)).join('')}
      </div>` : ''}

    ${!list.length ? `<div class="empty-state">
      Nessun libro ancora. Aggiungine uno!
    </div>` : ''}

    <div id="similar-users-section"></div>
  `;

  renderSimilarUsers(list);
}

function bookCard(book, done = false) {
  const pct = book.totalPages
    ? Math.min(100, Math.round((book.currentPage / book.totalPages) * 100))
    : 0;

  const cover = book.coverUrl
    ? `<img class="book-cover" src="${book.coverUrl}" alt="cover" loading="lazy">`
    : `<div class="book-cover book-cover--placeholder">${escHtml(book.title.slice(0, 2).toUpperCase())}</div>`;

  const actions = done
    ? `<span class="badge badge--green">✅ Completato</span>`
    : `
      <button onclick="window._openReadingModal?.('${book.id}')">📖 Leggi</button>
      <button onclick="window._markBookDone?.('${book.id}')">✅ Finito</button>
    `;

  return `
    <div class="book-card">
      ${cover}
      <div class="book-card__body">
        <h3>${escHtml(book.title)}</h3>
        <p class="book-author">${escHtml(book.author || '—')}</p>
        <div class="book-meta">
          <span>${escHtml(book.genre)}</span>
          <span>${diffStars(book.difficulty)}</span>
        </div>
        ${!done ? `
          <div class="progress-bar">
            <div class="progress-bar__fill" style="width:${pct}%"></div>
          </div>
          <p class="book-progress">${book.currentPage}/${book.totalPages} pagine (${pct}%)</p>
        ` : `<p class="book-progress">${book.totalPages} pagine — ${book.completedAt}</p>`}
        <div class="book-card__actions">${actions}</div>
      </div>
    </div>`;
}

function renderSimilarUsers(myBooks) {
  const container = document.getElementById('similar-users-section');
  if (!container || !myBooks.length) return;

  const myTitles = new Set(myBooks.map(b => b.title.toLowerCase()));

  const similar = Object.values(DB.users)
    .filter(u => u.id !== CUR?.id && u.isPublic)
    .map(u => {
      const theirBooks = DB.books.filter(b => b.userId === u.id);
      const common = theirBooks.filter(b => myTitles.has(b.title.toLowerCase()));
      return { user: u, common: common.length };
    })
    .filter(x => x.common > 0)
    .sort((a, b) => b.common - a.common)
    .slice(0, 5);

  if (!similar.length) return;

  container.innerHTML = `
    <h3 class="section-title">👥 Lettori simili a te</h3>
    <div class="similar-users">
      ${similar.map(({ user, common }) => `
        <div class="similar-user" onclick="window._viewUserProfile?.('${user.id}')">
          <strong>@${escHtml(user.username)}</strong>
          <span>${common} libri in comune</span>
        </div>`).join('')}
    </div>`;
}

// ── Modal aggiunta libro ──────────────────────────────────────

window._openAddBookModal = function() {
  openModal('modal-add-book');
};

window._addBook = async function() {
  const title      = document.getElementById('book-title')?.value.trim();
  const author     = document.getElementById('book-author')?.value.trim();
  const genre      = document.getElementById('book-genre')?.value || 'narrativa';
  const difficulty = parseInt(document.getElementById('book-difficulty')?.value || '1');
  const totalPages = parseInt(document.getElementById('book-pages')?.value || '0');

  if (!title)       return toast('Inserisci il titolo', 'error');
  if (!totalPages)  return toast('Inserisci il numero di pagine', 'error');

  const { ok, error } = await Books.create({ title, author, genre, difficulty, totalPages });
  if (!ok) return toast(error || 'Errore', 'error');

  playSound('quest');
  toast('Libro aggiunto! 📖', 'success');
  closeModal('modal-add-book');
  renderBooks();
};

// ── Modal sessione di lettura ─────────────────────────────────

window._openReadingModal = function(bookId) {
  const el = document.getElementById('reading-book-id');
  if (el) el.value = bookId;
  openModal('modal-log-reading');
};

window._logReading = async function() {
  const bookId   = document.getElementById('reading-book-id')?.value;
  const pages    = parseInt(document.getElementById('reading-pages')?.value || '0');

  if (!pages || pages < 1) return toast('Inserisci le pagine lette', 'error');

  const book = DB.books.find(b => b.id === bookId);
  if (!book) return toast('Libro non trovato', 'error');

  // Calcolo XP
  const diffBonus = BOOK_DIFF_BONUS[book.difficulty - 1] || 1;
  const baseXP    = Math.round(pages * XP_BOOK_PER_PAGE * diffBonus);
  const statKey   = BOOK_GENRE_STAT[book.genre] || 'cultura';
  const earned    = await awardXP(baseXP, statKey === 'cultura' ? 'lettura' : 'studio');

  // Aggiorna progresso libro
  const newPage = Math.min(book.totalPages, (book.currentPage || 0) + pages);
  await Books.updateProgress(bookId, newPage);
  await Books.logReading({ bookId, pagesRead: pages, xpEarned: earned });

  // Post feed
  await Feed.create({
    content:  `📚 Letto: ${pages} pagine di "${book.title}"`,
    category: 'lettura',
    xpEarned: earned,
    refType:  'book',
    refId:    bookId,
  });

  playSound('xp');
  toast(`+${earned} XP — ${pages} pagine lette!`, 'success');
  closeModal('modal-log-reading');

  // Auto-completa se finito
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

  // Bonus XP completamento
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
  renderBooks();
};
