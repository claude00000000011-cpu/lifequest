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

export function isAdmin() {
  return CUR?.username === 'alexandervertigo';
}

export function switchStatsTab(t) { _statsTab = t; renderStats(); }

export async function renderStats() {
  if (!CUR) return;
  const container = document.getElementById('screen-stats');
  if (!container) return;

  const tabs = [
    { id: 'mine',        label: '👤 Profilo'   },
    { id: 'leaderboard', label: '🏆 Classifica' },
    { id: 'calendar',    label: '📅 Calendario' },
    ...(isAdmin() ? [{ id: 'admin', label: '⚙️ Admin' }] : []),
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
    case 'admin':       return isAdmin() ? renderAdminPanel() : renderMyStats();
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

      <div class="stats-grid stats-grid--inline">
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




 <h3 class="section-title">🏆 Trofei (${trophies.length})</h3>
    <button onclick="window._openTrophiesModal?.()" 
      style="width:100%;background:rgba(200,160,0,0.12);border:1px solid var(--gold-dark);
             padding:0.6rem;font-family:var(--font-pixel);font-size:0.35rem;
             color:var(--gold);cursor:pointer;margin-bottom:0.75rem;letter-spacing:0.5px">
      ${trophies.length === 0 ? 'Nessun trofeo ancora' : `Vedi tutti i ${trophies.length} trofei →`}
    </button>







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



// ── Render pannello admin ─────────────────────────────────────

function renderAdminPanel() {
  const container = document.getElementById('stats-content');
  if (!container) return;

  const user = DB.users[CUR.id] || CUR;
  const bc   = DB.battleCharacters?.[CUR.id] || {};

  container.innerHTML = `
    <div style="background:var(--surface-1);border:2px solid var(--text-accent);
                border-radius:12px;padding:1rem;margin-bottom:1rem">
      <div style="font-size:0.75rem;color:var(--text-accent);font-weight:700;
                  letter-spacing:0.08em;margin-bottom:0.5rem">
        ⚙️ PANNELLO AMMINISTRATORE
      </div>

      <!-- IMMORTALITÀ -->
      <div id="admin-immortal-bar" style="display:flex;align-items:center;
           gap:0.75rem;padding:0.75rem;background:var(--bg-danger);
           border-radius:8px;margin-bottom:1rem">
        <span style="font-size:1.5rem">🛡️</span>
        <div style="flex:1">
          <div style="font-weight:600">Modalità Immortale</div>
          <div style="font-size:0.78rem;color:var(--text-secondary)">
            In battaglia gli HP non scendono mai sotto 1
          </div>
        </div>
        <label style="position:relative;display:inline-block;width:44px;height:24px">
          <input type="checkbox" id="admin-immortal-toggle"
                 ${window._adminImmortal ? 'checked' : ''}
                 onchange="window._toggleImmortal?.(this.checked)"
                 style="opacity:0;width:0;height:0">
          <span id="admin-immortal-slider" style="
            position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;
            background:${window._adminImmortal ? 'var(--text-accent)' : 'var(--border-strong)'};
            border-radius:24px;transition:.3s">
            <span style="
              position:absolute;content:'';height:18px;width:18px;left:${window._adminImmortal ? '22px' : '3px'};
              bottom:3px;background:white;border-radius:50%;transition:.3s;display:block">
            </span>
          </span>
        </label>
      </div>

      <!-- SEZIONE: STATISTICHE UTENTE -->
      <div style="font-weight:600;margin-bottom:0.5rem">📊 Statistiche utente</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1rem">
        ${_adminStatField('XP totale', 'xp', user.xp || 0)}
        ${_adminStatField('Livello', 'level', user.level || 1)}
        ${_adminStatField('Streak', 'streak', user.streak || 0)}
        ${Object.entries(user.stats || {}).map(([k, v]) =>
          _adminStatField(k.charAt(0).toUpperCase() + k.slice(1), `stat_${k}`, v)
        ).join('')}
      </div>
      <button class="btn-primary" style="width:100%;margin-bottom:1rem"
              onclick="window._adminApplyUserStats?.()">
        💾 Applica statistiche utente
      </button>

      <!-- SEZIONE: PERSONAGGIO BATTAGLIA -->
      <div style="font-weight:600;margin-bottom:0.5rem">⚔️ Personaggio battaglia</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1rem">
        ${_adminStatField('Gold', 'bc_gold', bc.gold || 0)}
        ${_adminStatField('HP correnti', 'bc_hp', bc.hp_current || bc.hp_base || 100)}
        ${_adminStatField('HP massimi', 'bc_hp_base', bc.hp_base || 100)}
        ${_adminStatField('Mana corrente', 'bc_mana', bc.mana_current || bc.mana_max || 30)}
        ${_adminStatField('Mana massimo', 'bc_mana_max', bc.mana_max || 30)}
        ${_adminStatField('Attacco', 'bc_attack', bc.attack || 10)}
        ${_adminStatField('Difesa', 'bc_defense', bc.defense || 5)}
        ${_adminStatField('Velocità', 'bc_speed', bc.speed || 5)}
        ${_adminStatField('Fortuna %', 'bc_luck', bc.luck_pct || 3)}
        ${_adminStatField('Punti Abilità', 'bc_sp', bc.skill_points || 0)}
      </div>
      <button class="btn-primary" style="width:100%;margin-bottom:1rem"
              onclick="window._adminApplyBattleStats?.()">
        💾 Applica stat battaglia
      </button>

      <!-- SEZIONE: AZIONI RAPIDE -->
      <div style="font-weight:600;margin-bottom:0.5rem">⚡ Azioni rapide</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1rem">
        <button class="btn-secondary" onclick="window._adminAddGold?.(1000)">+1000 Gold</button>
        <button class="btn-secondary" onclick="window._adminAddGold?.(10000)">+10.000 Gold</button>
        <button class="btn-secondary" onclick="window._adminAddXP?.(1000)">+1.000 XP</button>
        <button class="btn-secondary" onclick="window._adminAddXP?.(100000)">+100.000 XP</button>
        <button class="btn-secondary" onclick="window._adminAddXP?.(1000000)">+1.000.000 XP</button>
        <button class="btn-secondary" onclick="window._adminFullHeal?.()">❤️ Full Heal</button>
        <button class="btn-secondary" onclick="window._adminResetDailyCap?.()">🔄 Reset cap giornaliero</button>
        <button class="btn-secondary" onclick="window._adminAddSkillPoints?.(10)">+10 Punti Abilità</button>
        <button class="btn-secondary" onclick="window._adminResetDungeonProgress?.()">🗺️ Reset Dungeon</button>
        <button class="btn-secondary" onclick="window._adminSetLevel?.(1)">📉 Setta Lv 1</button>
        <button class="btn-secondary" onclick="window._adminSetLevel?.(10)">📈 Setta Lv 10</button>
        <button class="btn-secondary" onclick="window._adminSetLevel?.(30)">📈 Setta Lv 30</button>
        <button class="btn-secondary" onclick="window._adminInvalidateCache?.()">🔄 Invalida Cache</button>
      </div>

      <!-- SEZIONE: MODERAZIONE -->
      <div style="font-weight:600;margin-bottom:0.5rem">🛡️ Moderazione</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1rem">
        <button class="btn-secondary" onclick="window._adminViewAllUsers?.()">👥 Tutti gli utenti</button>
        <button class="btn-secondary" onclick="window._adminViewAllPosts?.()">📋 Tutti i post</button>
        <button class="btn-secondary" onclick="window._adminClearFeed?.()">🗑️ Svuota feed</button>
        <button class="btn-secondary" onclick="window._adminViewBanned?.()">🚫 Parole vietate</button>
      </div>

      <!-- Output moderazione -->
      <div id="admin-mod-output" style="margin-top:0.5rem"></div>
    </div>
  `;
}

function _adminStatField(label, key, value) {
  return `
    <div style="background:var(--surface-0);border-radius:8px;padding:0.5rem">
      <div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:0.25rem">
        ${label}
      </div>
      <input type="number" id="admin-field-${key}" value="${value}"
             style="width:100%;background:transparent;border:none;border-bottom:1px solid var(--border);
                    color:var(--text-primary);font-size:0.95rem;padding:0.15rem 0;outline:none">
    </div>`;
}

// ── Toggle immortalità ─────────────────────────────────────────

window._adminImmortal = false;

window._toggleImmortal = function(on) {
  window._adminImmortal = on;
  // Aggiorna visivamente lo slider
  const slider = document.getElementById('admin-immortal-slider');
  if (slider) {
    slider.style.background = on ? 'var(--text-accent)' : 'var(--border-strong)';
    const knob = slider.querySelector('span');
    if (knob) knob.style.left = on ? '22px' : '3px';
  }
  toast(on ? '🛡️ Immortalità attivata' : '💀 Immortalità disattivata', on ? 'success' : 'info');
};

// ── Applica stat utente ────────────────────────────────────────

window._adminApplyUserStats = async function() {
  if (!isAdmin()) return;
  const { setCUR, persist } = await import('../db.js');
  const { calcLevel, rankTitle } = await import('../xp.js');
  const { Users } = await import('../api.js');

  const get = id => parseInt(document.getElementById(`admin-field-${id}`)?.value || '0');

  const user    = DB.users[CUR.id] || {};
  const newXP   = get('xp');
  const newLv   = get('level') || calcLevel(newXP);
  const newStats = { ...user.stats };

  Object.keys(user.stats || {}).forEach(k => {
    const val = get(`stat_${k}`);
    if (!isNaN(val)) newStats[k] = val;
  });

  const updated = {
    ...user,
    xp:        newXP,
    level:     newLv,
    streak:    get('streak'),
    rankTitle: rankTitle(newLv),
    stats:     newStats,
  };

  DB.users[CUR.id] = updated;
  setCUR(updated);
  persist();


  
 // Allinea XP al livello impostato se il livello è stato cambiato manualmente
  const { xpForLevel } = await import('../xp.js');
  const xpForNewLv = xpForLevel ? xpForLevel(newLv) : newXP;
  const finalXP = get('level') > 0 ? Math.max(newXP, xpForNewLv) : newXP;
  DB.users[CUR.id] = { ...updated, xp: finalXP };
  setCUR({ ...updated, xp: finalXP });
  persist();
  Users.update(CUR.id, { xp: finalXP, level: newLv, stats: newStats });
  toast('✅ Statistiche utente aggiornate!', 'success');
  renderAdminPanel();
};

// ── Applica stat battaglia ─────────────────────────────────────

window._adminApplyBattleStats = async function() {
  if (!isAdmin()) return;
  const { supabase } = await import('../../supabase.js');
  const { persist }  = await import('../db.js');

  const get = id => parseInt(document.getElementById(`admin-field-${id}`)?.value || '0');

  const patch = {
    gold:          get('bc_gold'),
    hp_current:    get('bc_hp'),
    hp_base:       get('bc_hp_base'),
    mana_current:  get('bc_mana'),
    mana_max:      get('bc_mana_max'),
    attack:        get('bc_attack'),
    defense:       get('bc_defense'),
    speed:         get('bc_speed'),
    luck_pct:      get('bc_luck'),
    skill_points:  get('bc_sp'),
  };

  if (DB.battleCharacters) {
    DB.battleCharacters[CUR.id] = { ...(DB.battleCharacters[CUR.id] || {}), ...patch };
    persist();
  }

  const bc = DB.battleCharacters?.[CUR.id];
  if (bc?.id) {
    await supabase.from('battle_characters').update(patch).eq('id', bc.id);
  }

  toast('✅ Stat battaglia aggiornate!', 'success');
  renderAdminPanel();
};









window._adminResetDungeonProgress = async function() {
  if (!isAdmin()) return;
  const { supabase } = await import('../../supabase.js');
  await supabase.from('user_dungeon_progress').delete().eq('user_id', CUR.id);
  toast('🗺️ Progresso dungeon resettato!', 'success');
};

window._adminSetLevel = async function(targetLevel) {
  if (!isAdmin()) return;
  const { setCUR, persist } = await import('../db.js');
  const { Users } = await import('../api.js');
  // Calcola XP minima per il livello target
  let xp = 0;
  if (targetLevel <= 20)       xp = Math.floor(50  * Math.pow(targetLevel, 1.2));
  else if (targetLevel <= 50)  xp = Math.floor(35  * Math.pow(targetLevel, 1.5));
  else if (targetLevel <= 100) xp = Math.floor(20  * Math.pow(targetLevel, 1.7));
  else                         xp = Math.floor(10  * Math.pow(targetLevel, 1.9));
  const user = DB.users[CUR.id] || {};
  const updated = { ...user, xp, level: targetLevel };
  DB.users[CUR.id] = updated;
  setCUR(updated);
  persist();
  Users.update(CUR.id, { xp, level: targetLevel });
  toast(`📈 Livello impostato a ${targetLevel} (XP: ${xp.toLocaleString()})`, 'success');
  renderAdminPanel();
};

window._adminInvalidateCache = function() {
  if (!isAdmin()) return;
  // Invalida cache DB in memoria
  if (window.DB) {
    delete window.DB._cache;
    if (window.DB.characterEquipment) window.DB.characterEquipment = {};
  }
  // Invalida cache dungeonMap
  import('../screens/dungeon_map.js').then(m => {
    if (m._invalidateProgressCache) m._invalidateProgressCache();
  });
  toast('🔄 Cache invalidata — ricarica la pagina', 'info');
};














// ── Azioni rapide ──────────────────────────────────────────────

window._adminAddGold = async function(amount) {
  if (!isAdmin()) return;
  const { updateGold } = await import('../battle/character.js');
  await updateGold(CUR.id, amount, 'admin');
  toast(`+${amount} Gold aggiunto!`, 'success');
  renderAdminPanel();
};

window._adminAddXP = async function(amount) {
  if (!isAdmin()) return;
  const { Users } = await import('../api.js');
  const { calcLevel, rankTitle } = await import('../xp.js');
  const { setCUR, persist } = await import('../db.js');

  const user   = DB.users[CUR.id] || {};
  const newXP  = (user.xp || 0) + amount;
  const newLv  = calcLevel(newXP);

  const updated = { ...user, xp: newXP, level: newLv, rankTitle: rankTitle(newLv) };
  DB.users[CUR.id] = updated;
  setCUR(updated);
  persist();
  Users.update(CUR.id, { xp: newXP, level: newLv });

  toast(`+${amount.toLocaleString()} XP aggiunto! → Lv.${newLv}`, 'success');
  renderAdminPanel();
};

window._adminFullHeal = async function() {
  if (!isAdmin()) return;
  const { supabase } = await import('../../supabase.js');
  const { persist }  = await import('../db.js');

  const bc = DB.battleCharacters?.[CUR.id];
  if (!bc) return toast('Personaggio battaglia non trovato', 'error');

  const patch = { hp_current: bc.hp_base, mana_current: bc.mana_max };
  DB.battleCharacters[CUR.id] = { ...bc, ...patch };
  persist();
  if (bc.id) await supabase.from('battle_characters').update(patch).eq('id', bc.id);

  toast('❤️ HP e Mana ripristinati al massimo!', 'success');
  renderAdminPanel();
};

window._adminResetDailyCap = async function() {
  if (!isAdmin()) return;
  const { setCUR, persist } = await import('../db.js');
  const user = DB.users[CUR.id];
  if (!user) return;
  DB.users[CUR.id] = { ...user, dailyXP: { date: '1970-01-01' } };
  setCUR(DB.users[CUR.id]);
  persist();
  toast('🔄 Cap giornaliero azzerato!', 'success');
};

window._adminAddSkillPoints = async function(amount) {
  if (!isAdmin()) return;
  const { supabase } = await import('../../supabase.js');
  const { persist }  = await import('../db.js');

  const bc = DB.battleCharacters?.[CUR.id];
  if (!bc) return toast('Personaggio battaglia non trovato', 'error');

  const newSP = (bc.skill_points || 0) + amount;
  DB.battleCharacters[CUR.id].skill_points = newSP;
  persist();
  if (bc.id) await supabase.from('battle_characters').update({ skill_points: newSP }).eq('id', bc.id);

  toast(`+${amount} Punti Abilità aggiunti!`, 'success');
  renderAdminPanel();
};

// ── Moderazione ────────────────────────────────────────────────

window._adminViewAllUsers = async function() {
  if (!isAdmin()) return;
  const { Users } = await import('../api.js');
  const { ok, data } = await Users.getLeaderboard();
  const users = ok ? data : Object.values(DB.users);
  const out = document.getElementById('admin-mod-output');
  if (!out) return;

  out.innerHTML = `
    <div style="font-weight:600;margin-bottom:0.5rem">👥 Utenti registrati (${users.length})</div>
    <div style="max-height:300px;overflow-y:auto">
      ${users.map(u => `
        <div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;
                    border-bottom:1px solid var(--border)">
          <span style="flex:1;font-size:0.85rem">@${escHtml(u.username)} — Lv.${u.level || 1}</span>
          <button class="btn-sm" style="background:var(--bg-danger);color:var(--text-danger);font-size:0.75rem"
                  onclick="window._adminBanUser?.('${u.id}', '${escHtml(u.username)}')">
            🚫 Ban
          </button>
        </div>`).join('')}
    </div>`;
};

window._adminBanUser = async function(userId, username) {
  if (!isAdmin()) return;
  if (!confirm(`Bannare @${username}? Questa azione è irreversibile.`)) return;
  const { supabase } = await import('../../supabase.js');
  await supabase.from('users').update({ banned: true }).eq('id', userId);
  toast(`@${username} bannato.`, 'success');
  window._adminViewAllUsers?.();
};

window._adminViewAllPosts = async function() {
  if (!isAdmin()) return;
  const out = document.getElementById('admin-mod-output');
  if (!out) return;

  const posts = (DB.feedPosts || []).slice(-50).reverse();
  out.innerHTML = `
    <div style="font-weight:600;margin-bottom:0.5rem">📋 Ultimi post nel feed (${posts.length})</div>
    <div style="max-height:300px;overflow-y:auto">
      ${posts.map(p => `
        <div style="padding:0.4rem 0;border-bottom:1px solid var(--border);
                    display:flex;align-items:flex-start;gap:0.5rem">
          <div style="flex:1;font-size:0.8rem">
            <strong>@${escHtml(p.username || '?')}</strong>
            <span style="color:var(--text-secondary)"> · ${(p.createdAt || '').slice(0,10)}</span>
            <div>${escHtml((p.content || '').slice(0, 100))}</div>
          </div>
          <button class="btn-sm" style="background:var(--bg-danger);color:var(--text-danger);
                  font-size:0.75rem;flex-shrink:0"
                  onclick="window._adminDeletePost?.('${p.id}')">
            🗑
          </button>
        </div>`).join('')}
    </div>`;
};

window._adminDeletePost = async function(postId) {
  if (!isAdmin()) return;
  const { supabase } = await import('../../supabase.js');
  DB.feedPosts = (DB.feedPosts || []).filter(p => p.id !== postId);
  await supabase.from('feed_posts').delete().eq('id', postId);
  toast('Post eliminato.', 'success');
  window._adminViewAllPosts?.();
};

window._adminClearFeed = async function() {
  if (!isAdmin()) return;
  if (!confirm('Svuotare TUTTO il feed globale? Azione irreversibile.')) return;
  const { supabase } = await import('../../supabase.js');
  DB.feedPosts = [];
  await supabase.from('feed_posts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  toast('Feed svuotato.', 'success');
};

window._adminViewBanned = function() {
  if (!isAdmin()) return;
  const out = document.getElementById('admin-mod-output');
  if (!out) return;
  const words = DB.bannedWords || [];
  out.innerHTML = `
    <div style="font-weight:600;margin-bottom:0.5rem">🚫 Parole vietate (${words.length})</div>
    <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem">
      <input type="text" id="admin-new-word" placeholder="Nuova parola…"
             style="flex:1;padding:0.4rem;border-radius:6px;border:1px solid var(--border);
                    background:var(--surface-0);color:var(--text-primary)">
      <button class="btn-primary" onclick="window._adminAddBannedWord?.()">+ Aggiungi</button>
    </div>
    <div style="max-height:200px;overflow-y:auto;display:flex;flex-wrap:wrap;gap:0.35rem">
      ${words.map(w => `
        <span style="background:var(--bg-danger);color:var(--text-danger);padding:0.2rem 0.5rem;
                     border-radius:20px;font-size:0.8rem;display:flex;align-items:center;gap:0.3rem">
          ${escHtml(w)}
          <button onclick="window._adminRemoveBannedWord?.('${escHtml(w)}')"
                  style="background:none;border:none;cursor:pointer;color:inherit;font-size:0.9rem">×</button>
        </span>`).join('')}
    </div>`;
};

window._adminAddBannedWord = async function() {
  if (!isAdmin()) return;
  const input = document.getElementById('admin-new-word');
  const word  = input?.value.trim().toLowerCase();
  if (!word) return;
  const { Moderation } = await import('../api.js');
  await Moderation.addBannedWord(word);
  if (!DB.bannedWords) DB.bannedWords = [];
  if (!DB.bannedWords.includes(word)) DB.bannedWords.push(word);
  input.value = '';
  toast(`"${word}" aggiunto alle parole vietate.`, 'success');
  window._adminViewBanned?.();
};

window._adminRemoveBannedWord = async function(word) {
  if (!isAdmin()) return;
  DB.bannedWords = (DB.bannedWords || []).filter(w => w !== word);
  const { supabase } = await import('../../supabase.js');
  await supabase.from('banned_words').delete().eq('word', word);
  toast(`"${word}" rimosso.`, 'success');
  window._adminViewBanned?.();
};





window._openTrophiesModal = async function() {
  const { renderTrophiesModal } = await import('../trophies.js');
  const user = DB.users[CUR.id] || CUR;
  renderTrophiesModal(user.trophies || [], user.username);
  document.getElementById('modal-trophies')?.classList.remove('modal--hidden');
};

