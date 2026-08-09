// ============================================================
// screens/quest.js — Gestione Quest
// ============================================================

import { CUR, DB } from '../db.js';
import { Quests, Feed } from '../api.js';
import { awardXP } from '../xp.js';
import { escHtml, diffStars, toast, pickImage, today } from '../utils.js';
import { playSound } from '../audio.js';
import { openModal, closeModal } from '../modals.js';
import { DIFF_MULT, CAT_STAT } from '../config.js';

let _questTab  = 'todo';   // 'todo' | 'goals' | 'done' | 'calendar'
let _calMonth  = new Date();
let _calDate   = null;
let _pendingPhoto = null;

// ── Navigazione tab ──────────────────────────────────────────

export function switchQuestTab(t) {
  _questTab = t;
  renderQuests();
}

// ── Render principale ────────────────────────────────────────

export function renderQuests() {
  if (!CUR) return;
  const quests = DB.quests.filter(q => q.userId === CUR.id);

  const tabs = [
    { id: 'todo',     label: '📋 To-Do' },
    { id: 'goals',    label: '🎯 Obiettivi' },
    { id: 'done',     label: '✅ Completate' },
    { id: 'calendar', label: '📅 Calendario' },
  ];

  const container = document.getElementById('screen-quest');
  if (!container) return;

  container.innerHTML = `
    <div class="screen-header">
      <h2>Quest</h2>
      <button class="btn-add" onclick="window._openAddQuestModal?.()">+ Nuova</button>
    </div>

    <div class="tab-row">
      ${tabs.map(t => `
        <button class="tab-btn ${_questTab === t.id ? 'tab-btn--active' : ''}"
                onclick="window._switchQuestTab?.('${t.id}')">
          ${t.label}
        </button>`).join('')}
    </div>

    ${_questTab === 'calendar'
      ? renderQuestCalendar(quests)
      : renderQuestList(quests)}
  `;
}

// ── Lista quest ───────────────────────────────────────────────

function renderQuestList(quests) {
  const filtered = quests.filter(q => {
    if (_questTab === 'todo')   return !q.completed && q.type === 'todo';
    if (_questTab === 'goals')  return !q.completed && q.type === 'goal';
    if (_questTab === 'done')   return q.completed;
    return false;
  });

  if (!filtered.length) {
    return `<div class="empty-state">
      <p>Nessuna quest qui.</p>
      <p>Aggiungine una con il tasto +!</p>
    </div>`;
  }

  return `<div class="quest-list">
    ${filtered.map(q => questCard(q)).join('')}
  </div>`;
}

function questCard(q) {
  const stars = diffStars(q.difficulty);
  const photo = q.photoUrl
    ? `<img class="quest-photo" src="${q.photoUrl}" alt="foto quest" loading="lazy">`
    : '';

  const actions = q.completed
    ? `<button class="btn-danger" onclick="window._deleteQuest?.('${q.id}')">🗑️</button>`
    : `
      <button class="btn-primary" onclick="window._toggleQuest?.('${q.id}')">✅ Completa</button>
      <button class="btn-danger"  onclick="window._deleteQuest?.('${q.id}')">🗑️</button>
    `;

  return `
    <div class="quest-card ${q.completed ? 'quest-card--done' : ''}">
      ${photo}
      <div class="quest-card__body">
        <h3>${escHtml(q.title)}</h3>
        <div class="quest-card__meta">
          <span class="quest-stars">${stars}</span>
          <span class="quest-xp">⚡ ${q.xpValue} XP</span>
          <span class="quest-cat">${escHtml(q.category)}</span>
          ${q.dueDate ? `<span class="quest-due">📅 ${q.dueDate}</span>` : ''}
        </div>
      </div>
      <div class="quest-card__actions">${actions}</div>
    </div>`;
}

// ── Calendario ────────────────────────────────────────────────

function renderQuestCalendar(quests) {
  const year  = _calMonth.getFullYear();
  const month = _calMonth.getMonth();
  const days  = new Date(year, month + 1, 0).getDate();
  const first = new Date(year, month, 1).getDay();

  // Raggruppa quest completate per giorno
  const byDay = {};
  quests.filter(q => q.completed && q.completedAt).forEach(q => {
    const d = q.completedAt.slice(0, 10);
    if (d.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
      (byDay[d] ??= []).push(q);
    }
  });

  const prevBtn = `<button onclick="window._calNav?.(-1)">◀</button>`;
  const nextBtn = `<button onclick="window._calNav?.(1)">▶</button>`;
  const title   = _calMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

  let cells = '<td></td>'.repeat(first === 0 ? 6 : first - 1);
  for (let d = 1; d <= days; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const count   = byDay[dateStr]?.length || 0;
    const active  = _calDate === dateStr ? 'cal-day--active' : '';
    cells += `
      <td class="cal-day ${count ? 'cal-day--has-events' : ''} ${active}"
          onclick="window._selectQuestDate?.('${dateStr}')">
        ${d}
        ${count ? `<span class="cal-badge">${count}</span>` : ''}
      </td>`;
    if ((first === 0 ? d + 6 : d + first - 1) % 7 === 0) cells += '</tr><tr>';
  }

  const detail = _calDate && byDay[_calDate]
    ? `<div class="cal-detail">
        <h4>📅 ${_calDate}</h4>
        ${byDay[_calDate].map(q => `
          <div class="cal-quest-item">
            <span>${escHtml(q.title)}</span>
            <span class="quest-xp">+${q.xpValue} XP</span>
          </div>`).join('')}
      </div>`
    : '';

  return `
    <div class="calendar">
      <div class="calendar__nav">
        ${prevBtn}<h3>${title}</h3>${nextBtn}
      </div>
      <table class="calendar__grid">
        <thead><tr>
          <th>Lu</th><th>Ma</th><th>Me</th>
          <th>Gi</th><th>Ve</th><th>Sa</th><th>Do</th>
        </tr></thead>
        <tbody><tr>${cells}</tr></tbody>
      </table>
      ${detail}
    </div>`;
}

// ── Modal aggiunta quest ──────────────────────────────────────

window._openAddQuestModal = function() {
  _pendingPhoto = null;
  openModal('modal-add-quest');
  const photoBtn = document.getElementById('quest-attach-btn');
  const photoPreview = document.getElementById('quest-photo-preview');
  if (photoBtn)    photoBtn.onclick = window._attachQuestPhoto;
  if (photoPreview) photoPreview.src = '';
};

window._attachQuestPhoto = async function() {
  const url = await pickImage();
  if (!url) return;
  _pendingPhoto = url;
  const preview = document.getElementById('quest-photo-preview');
  if (preview) { preview.src = url; preview.classList.remove('hidden'); }
};

window._addQuest = async function() {
  const title      = document.getElementById('quest-title')?.value.trim();
  const category   = document.getElementById('quest-category')?.value || 'altro';
  const difficulty = parseInt(document.getElementById('quest-difficulty')?.value || '1');
  const type       = document.getElementById('quest-type')?.value || 'todo';
  const dueDate    = document.getElementById('quest-due')?.value || null;

  if (!title) return toast('Inserisci un titolo', 'error');

  const baseXP  = 10;
  const xpValue = Math.round(baseXP * DIFF_MULT[difficulty - 1]);

  const { ok, data, error } = await Quests.create({
    title, category, difficulty, xpValue, type, dueDate,
    photoUrl: _pendingPhoto,
  });

  if (!ok) return toast(error || 'Errore nella creazione', 'error');

  playSound('quest');
  toast(`Quest aggiunta! ⚡ ${xpValue} XP in palio`, 'success');
  closeModal('modal-add-quest');
  renderQuests();
};

// ── Azioni quest ──────────────────────────────────────────────

window._switchQuestTab = switchQuestTab;

window._toggleQuest = async function(questId) {
  const quest = DB.quests.find(q => q.id === questId);
  if (!quest || quest.completed) return;

  const { ok } = await Quests.complete(questId);
  if (!ok) return toast('Errore nel completamento', 'error');

  const earned = await awardXP(quest.xpValue, CAT_STAT[quest.category] ? quest.category : null);

  // Post nel feed
  await Feed.create({
    content:  `✅ Ho completato: "${quest.title}"`,
    category: quest.category,
    xpEarned: earned,
    photoUrl: quest.photoUrl,
    refType:  'quest',
    refId:    quest.id,
  });

  playSound('quest');
  toast(`Quest completata! +${earned} XP 🎉`, 'success');
  renderQuests();
};

window._deleteQuest = async function(questId) {
  if (!confirm('Eliminare questa quest?')) return;
  const { ok } = await Quests.delete(questId);
  if (!ok) return toast('Errore nell\'eliminazione', 'error');
  playSound('tap');
  renderQuests();
};

// ── Calendario nav ────────────────────────────────────────────

window._calNav = function(dir) {
  _calMonth.setMonth(_calMonth.getMonth() + dir);
  _calDate = null;
  renderQuests();
};

window._selectQuestDate = function(dateStr) {
  _calDate = _calDate === dateStr ? null : dateStr;
  renderQuests();
};