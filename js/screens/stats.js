// ============================================================
// screens/stats.js — Statistiche, Leaderboard, Calendario
// ============================================================

import { CUR, DB } from '../db.js';
import { Users } from '../api.js';
import { escHtml, toast, today, pickImage } from '../utils.js';
import { playSound } from '../audio.js';
import { calcLevel, xpBarPct, xpForLevel, rankTitle } from '../xp.js';
import { STAT_COLORS, BOOK_GENRES } from '../config.js';

let _statsTab  = 'mine';   // 'mine' | 'leaderboard' | 'calendar'
let _calMonth  = new Date();
let _calDate   = null;
let _calFilter = 'all';    // 'all' | 'quest' | 'study' | 'routine' | 'pvp'

export function switchStatsTab(t) { _statsTab = t; renderStats(); }

export async function renderStats() {
  if (!CUR) return;
  const container = document.getElementById('screen-stats');
  if (!container) return;

  const tabs = [
    { id: 'mine',        label: '👤 Profilo'   },
    { id: 'leaderboard', label: '🏆 Classifica' },
    { id: 'calendar',   label: '📅 Calendario' },
  ];

  container.innerHTML = `
    <div class="screen-header"><h2>Statistiche</h2></div>
    <div class="tab-row">
      ${tabs.map(t => `
        <button class="tab-btn ${_statsTab === t.id ? 'tab-btn--active' : ''}"
                onclick="window._switchStatsTab?.('${t.id}')">
          ${t.label}
        </button>`).join('')}
    </div>
    <div id="stats-content">Caricamento…</div>
  `;

  switch (_statsTab) {
    case 'mine':        return renderMyStats();
    case 'leaderboard': return renderLeaderboard();
    case 'calendar':    return renderPersonalCalendar();
  }
}

// ── Profilo personale ─────────────────────────────────────────

function renderMyStats() {
  const container = document.getElementById('stats-content');
  if (!container || !CUR) return;

  const user   = DB.users[CUR.id] || CUR;
  const xp     = user.xp || 0;
  const level  = calcLevel(xp);
  const pct    = xpBarPct(xp);
  const next   = xpForLevel(level + 1);
  const rank   = rankTitle(level);
  const initials = user.username.slice(0, 2).toUpperCase();

  const avatar = user.avatarUrl
    ? `<div class="profile-big-avatar" style="background-image:url(${user.avatarUrl})"
           onclick="window._changeAvatar?.()"></div>`
    : `<div class="profile-big-avatar profile-big-avatar--initials"
           onclick="window._changeAvatar?.()">
         ${initials}
         <span class="avatar-edit">✏️</span>
       </div>`;

  const trophies  = user.trophies || [];
  const languages = user.languages || [];

  container.innerHTML = `
    <div class="profile-section">
      ${avatar}
      <h2>@${escHtml(user.username)}</h2>
      <p class="profile-rank">${rank} — Lv. ${level}</p>

      <div class="xp-bar-wrapper">
        <div class="xp-bar">
          <div class="xp-bar__fill" style="width:${pct}%; background: var(--accent)"></div>
        </div>
        <p class="xp-bar__label">${xp.toLocaleString()} / ${next.toLocaleString()} XP</p>
      </div>

      <div class="profile-social-row">
        <div><strong>${(user.following || []).length}</strong><span>Seguiti</span></div>
        <div><strong>${(user.followers || []).length}</strong><span>Follower</span></div>
        <div><strong>🔥 ${user.streak || 0}</strong><span>Streak</span></div>
      </div>
    </div>

    <h3 class="section-title">📊 Statistiche</h3>
    <div class="stats-grid">
      ${Object.entries(user.stats || {}).map(([key, val]) => `
        <div class="stat-card" style="border-color:${STAT_COLORS[key] || '#7c3aed'}">
          <div class="stat-card__label">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
          <div class="stat-card__value" style="color:${STAT_COLORS[key] || '#7c3aed'}">
            ${val.toLocaleString()}
          </div>
          <div class="progress-bar">
            <div class="progress-bar__fill"
                 style="width:${Math.min(100, Math.round(val / 100))}%;
                        background:${STAT_COLORS[key] || '#7c3aed'}">
            </div>
          </div>
        </div>`).join('')}
    </div>

    <h3 class="section-title">📚 Generi preferiti</h3>
    <div class="genre-grid">
      ${BOOK_GENRES.map(g => {
        const sel = (user.favoriteGenres || []).includes(g);
        return `<button class="genre-chip ${sel ? 'genre-chip--active' : ''}"
                        onclick="window._toggleGenre?.('${g}')">
          ${g}
        </button>`;
      }).join('')}
    </div>

    ${trophies.length ? `
      <h3 class="section-title">🏆 Trofei (${trophies.length})</h3>
      <div class="trophy-grid">
        ${trophies.map(id => {
          const { TROPHY_DEFS } = window._trophyDefs || {};
          return `<div class="trophy-chip" title="${id}">🏆 ${id}</div>`;
        }).join('')}
      </div>` : ''}

    <h3 class="section-title">🌍 Lingue</h3>
    <div class="lang-chips">
      ${languages.length
        ? languages.map(l => `<span class="lang-chip">${escHtml(l)}</span>`).join('')
        : '<p class="empty-note">Nessuna lingua impostata.</p>'}
      <button onclick="window._openLangsModal?.()">✏️ Modifica</button>
    </div>

<h3 class="section-title">🔒 Privacy</h3>
    <div class="privacy-section" style="background:var(--bg-2);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;margin-bottom:1rem">
      <p style="font-size:0.82rem;color:var(--text-3);margin-bottom:0.75rem">
        Scegli cosa non vuoi mostrare nel feed pubblico:
      </p>
      ${['lettura','studio','routine','quest','sfide'].map(cat => {
        const hidden = (user.privacySettings?.hiddenCategories || []).includes(cat);
        const labels = { lettura:'📖 Attività libri', studio:'📚 Attività studio', routine:'⚡ Routine', quest:'⚔️ Quest', sfide:'🏆 Sfide PvP' };
        return `
          <label class="toggle-row" style="margin-bottom:0.5rem">
            <span style="font-size:0.88rem">${labels[cat]}</span>
            <input type="checkbox" ${hidden ? 'checked' : ''}
                   onchange="window._togglePrivacyCategory?.('${cat}', this.checked)">
          </label>`;
      }).join('')}
    </div>

    <div class="profile-actions">
      <label class="toggle-row">
        <span>Profilo pubblico</span>
        <input type="checkbox" ${user.isPublic ? 'checked' : ''}
               onchange="window._togglePublicProfile?.(this.checked)">
      </label>
      <button class="btn-danger" onclick="window._doLogout?.()">🚪 Logout</button>
    </div>
  `;
}

// ── Leaderboard ───────────────────────────────────────────────

async function renderLeaderboard() {
  const container = document.getElementById('stats-content');
  if (!container) return;
  container.innerHTML = '<p>Caricamento classifica…</p>';

  const { ok, data } = await Users.getLeaderboard();
  const users = ok ? data : [];

  container.innerHTML = `
    <div class="leaderboard">
      ${users.map((u, i) => {
        const isMe  = u.id === CUR?.id;
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        return `
          <div class="leaderboard-row ${isMe ? 'leaderboard-row--me' : ''}"
               onclick="window._viewUserProfile?.('${u.id}')">
            <span class="leaderboard-rank">${medal}</span>
            <div class="leaderboard-user">
              <strong>@${escHtml(u.username)}</strong>
              <span>${escHtml(u.rankTitle || 'Novizio')} — Lv. ${u.level || 1}</span>
            </div>
            <span class="leaderboard-xp">${(u.xp || 0).toLocaleString()} XP</span>
          </div>`;
      }).join('')}
    </div>`;
}

// ── Calendario personale ──────────────────────────────────────

function renderPersonalCalendar() {
  const container = document.getElementById('stats-content');
  if (!container || !CUR) return;

  const year   = _calMonth.getFullYear();
  const month  = _calMonth.getMonth();
  const days   = new Date(year, month + 1, 0).getDate();
  const first  = new Date(year, month, 1).getDay();
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  // Raccoglie tutti gli eventi per data
  const allEvents = {};

  const addEvent = (dateStr, type, label, xp) => {
    if (!dateStr?.startsWith(prefix)) return;
    (allEvents[dateStr] ??= []).push({ type, label, xp });
  };

  DB.quests.filter(q => q.userId === CUR.id && q.completed)
    .forEach(q => addEvent(q.completedAt, 'quest', q.title, q.xpValue));

  DB.studySessions.filter(s => s.userId === CUR.id)
    .forEach(s => addEvent(s.studiedAt, 'study', `Studio ${s.minutes}min`, s.xpEarned));

  DB.readingSessions.filter(r => r.userId === CUR.id)
    .forEach(r => {
      const book = DB.books.find(b => b.id === r.bookId);
      addEvent(r.readAt, 'book', `Lettura: ${book?.title || '?'}`, r.xpEarned);
    });

  DB.routineLogs.filter(r => r.userId === CUR.id)
    .forEach(r => {
      const routine = DB.routines.find(rt => rt.id === r.routineId);
      addEvent(r.doneAt, 'routine', routine?.name || 'Routine', r.xpEarned);
    });

  DB.challenges.filter(c => c.creatorId === CUR.id || c.opponentId === CUR.id)
    .forEach(c => addEvent(c.createdAt?.slice(0, 10), 'pvp', c.title, 0));

  // Filtra per tipo
  const filtered = {};
  Object.entries(allEvents).forEach(([date, events]) => {
    const f = _calFilter === 'all'
      ? events
      : events.filter(e => e.type === _calFilter);
    if (f.length) filtered[date] = f;
  });

  const title = _calMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  let cells   = '<td></td>'.repeat(first === 0 ? 6 : first - 1);

  for (let d = 1; d <= days; d++) {
    const dateStr = `${prefix}-${String(d).padStart(2, '0')}`;
    const count   = filtered[dateStr]?.length || 0;
    const active  = _calDate === dateStr ? 'cal-day--active' : '';
    cells += `
      <td class="cal-day ${count ? 'cal-day--has-events' : ''} ${active}"
          onclick="window._selectCalDate?.('${dateStr}')">
        ${d}${count ? `<span class="cal-badge">${count}</span>` : ''}
      </td>`;
    if ((first === 0 ? d + 6 : d + first - 1) % 7 === 0) cells += '</tr><tr>';
  }

  const filters = ['all','quest','study','routine','book','pvp'];
  const filterLabels = { all: 'Tutto', quest: '⚔️ Quest', study: '📚 Studio', routine: '⚡ Routine', book: '📖 Libri', pvp: '🏆 Sfide' };

  const detail = _calDate && filtered[_calDate] ? `
    <div class="cal-detail">
      <h4>📅 ${_calDate}</h4>
      ${filtered[_calDate].map(e => `
        <div class="cal-quest-item">
          <span>${escHtml(e.label)}</span>
          ${e.xp ? `<span class="quest-xp">+${e.xp} XP</span>` : ''}
        </div>`).join('')}
    </div>` : '';

  container.innerHTML = `
    <div class="filter-chips">
      ${filters.map(f => `
        <button class="filter-chip ${_calFilter === f ? 'filter-chip--active' : ''}"
                onclick="window._setCalFilter?.('${f}')">
          ${filterLabels[f]}
        </button>`).join('')}
    </div>
    <div class="calendar">
      <div class="calendar__nav">
        <button onclick="window._statsCalNav?.(-1)">◀</button>
        <h3>${title}</h3>
        <button onclick="window._statsCalNav?.(1)">▶</button>
      </div>
      <table class="calendar__grid">
        <thead><tr><th>Lu</th><th>Ma</th><th>Me</th><th>Gi</th><th>Ve</th><th>Sa</th><th>Do</th></tr></thead>
        <tbody><tr>${cells}</tr></tbody>
      </table>
      ${detail}
    </div>`;
}

// ── Azioni ────────────────────────────────────────────────────

window._switchStatsTab = switchStatsTab;

window._statsCalNav = function(dir) {
  _calMonth.setMonth(_calMonth.getMonth() + dir);
  _calDate = null;
  renderStats();
};

window._selectCalDate = function(dateStr) {
  _calDate = _calDate === dateStr ? null : dateStr;
  renderPersonalCalendar();
};

window._setCalFilter = function(f) {
  _calFilter = f;
  _calDate   = null;
  renderPersonalCalendar();
};

window._togglePublicProfile = async function(isPublic) {
  const { ok } = await Users.update(CUR.id, { isPublic });
  if (!ok) return toast('Errore', 'error');
  DB.users[CUR.id].isPublic = isPublic;
  toast(isPublic ? 'Profilo pubblico' : 'Profilo privato', 'success');
};

window._changeAvatar = async function() {
  const { pickImage } = await import('../utils.js');
  const url = await pickImage();
  if (!url) return;
  const { ok } = await Users.update(CUR.id, { avatarUrl: url });
  if (!ok) return toast('Errore nel salvataggio', 'error');
  DB.users[CUR.id].avatarUrl = url;
  playSound('tap');
  toast('Avatar aggiornato!', 'success');
  renderMyStats();
};

window._toggleGenre = async function(genre) {
  const user   = DB.users[CUR.id];
  const genres = user.favoriteGenres || [];
  const next   = genres.includes(genre)
    ? genres.filter(g => g !== genre)
    : [...genres, genre];
  DB.users[CUR.id].favoriteGenres = next;
  await Users.update(CUR.id, { favoriteGenres: next });
  renderMyStats();
};

window._openLangsModal = async function() {
  const { openModal } = await import('../modals.js');
  renderNationsModal();
  openModal('modal-languages');
};

function renderNationsModal() {
  const { LANGUAGES } = window._config || {};
  const container = document.getElementById('modal-languages-content');
  if (!container) return;
  import('../config.js').then(({ LANGUAGES }) => {
    const user = DB.users[CUR.id];
    const sel  = user.languages || [];
    container.innerHTML = LANGUAGES.map(lang => `
      <button class="lang-option ${sel.includes(lang) ? 'lang-option--active' : ''}"
              onclick="window._toggleLanguage?.('${lang}')">
        ${lang}
      </button>`).join('');
  });
}

window._toggleLanguage = async function(lang) {
  const user  = DB.users[CUR.id];
  const langs = user.languages || [];
  const next  = langs.includes(lang)
    ? langs.filter(l => l !== lang)
    : [...langs, lang];
  DB.users[CUR.id].languages = next;
  await Users.update(CUR.id, { languages: next });
  renderNationsModal();
};

window._doLogout = async function() {
  const { doLogout } = await import('../auth.js');
  doLogout();
};

window._togglePrivacyCategory = async function(category, hide) {
  const user = DB.users[CUR.id] || {};
  const current = user.privacySettings?.hiddenCategories || [];
  const next = hide
    ? [...new Set([...current, category])]
    : current.filter(c => c !== category);

  const privacySettings = { ...(user.privacySettings || {}), hiddenCategories: next };
  DB.users[CUR.id].privacySettings = privacySettings;

  await Users.update(CUR.id, { privacySettings });
  toast(hide ? `Attività "${category}" nascoste dal feed` : `Attività "${category}" visibili`, 'success');
};
