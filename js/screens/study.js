// ============================================================
// screens/study.js — Studio, Esami, Sessioni
// ============================================================

import { CUR, DB } from '../db.js';
import { Study, Feed } from '../api.js';
import { awardXP } from '../xp.js';
import { escHtml, toast, today } from '../utils.js';
import { playSound } from '../audio.js';
import { openModal, closeModal } from '../modals.js';

let _studyTab = 'exams';  // 'exams' | 'sessions' | 'calendar'
let _calMonth = new Date();
let _calDate  = null;

export function switchStudyTab(t) { _studyTab = t; renderStudy(); }

export function renderStudy() {
  if (!CUR) return;
  const container = document.getElementById('screen-study');
  if (!container) return;

  container.innerHTML = `
    <div class="screen-header">
      <h2>Studio</h2>
      <button class="btn-add" onclick="window._openAddExamModal?.()">+ Esame</button>
    </div>
    <div class="tab-row">
      ${['exams','sessions','calendar'].map(t => `
        <button class="tab-btn ${_studyTab === t ? 'tab-btn--active' : ''}"
                onclick="window._switchStudyTab?.('${t}')">
          ${{ exams: '📚 Esami', sessions: '⏱ Sessioni', calendar: '📅 Calendario' }[t]}
        </button>`).join('')}
    </div>
    ${{
      exams:    renderExams(),
      sessions: renderSessions(),
      calendar: renderStudyCalendar(),
    }[_studyTab]}
  `;
}

// ── Esami ─────────────────────────────────────────────────────

function renderExams() {
  const exams = DB.exams.filter(e => e.userId === CUR.id);
  if (!exams.length) return `<div class="empty-state">Nessun esame. Aggiungine uno!</div>`;

  return `<div class="exam-list">
    ${exams.map(exam => {
      const chapters  = exam.chapters || [];
      const done      = chapters.filter(c => c.done).length;
      const pct       = chapters.length ? Math.round((done / chapters.length) * 100) : 0;

      return `
        <div class="exam-card">
          <div class="exam-card__header">
            <h3>${escHtml(exam.name)}</h3>
            ${exam.examDate ? `<span>📅 ${exam.examDate}</span>` : ''}
            ${exam.grade    ? `<span>🎓 ${exam.grade}/30</span>` : ''}
          </div>
          <div class="progress-bar">
            <div class="progress-bar__fill" style="width:${pct}%"></div>
          </div>
          <p class="exam-progress">${done}/${chapters.length} capitoli — ${pct}%</p>
          <div class="exam-card__actions">
            <button onclick="window._openLogSessionModal?.('${exam.id}')">⏱ Studia</button>
            <button onclick="window._openChaptersModal?.('${exam.id}')">📖 Capitoli</button>
            <button onclick="window._deleteExam?.('${exam.id}')">🗑️</button>
          </div>
        </div>`;
    }).join('')}
  </div>`;
}

// ── Sessioni ──────────────────────────────────────────────────

function renderSessions() {
  const sessions = DB.studySessions
    .filter(s => s.userId === CUR.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 30);

  if (!sessions.length) return `<div class="empty-state">Nessuna sessione registrata.</div>`;

  return `<div class="session-list">
    ${sessions.map(s => {
      const exam = DB.exams.find(e => e.id === s.examId);
      return `
        <div class="session-card">
          <span class="session-date">${s.studiedAt}</span>
          <span class="session-exam">${exam ? escHtml(exam.name) : '—'}</span>
          <span class="session-mins">⏱ ${s.minutes} min</span>
          <span class="session-focus">🎯 ${s.focusScore}/10</span>
          <span class="session-xp">+${s.xpEarned} XP</span>
        </div>`;
    }).join('')}
  </div>`;
}

// ── Calendario studio ─────────────────────────────────────────

function renderStudyCalendar() {
  const year  = _calMonth.getFullYear();
  const month = _calMonth.getMonth();
  const days  = new Date(year, month + 1, 0).getDate();
  const first = new Date(year, month, 1).getDay();

  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const byDay  = {};
  DB.studySessions
    .filter(s => s.userId === CUR.id && (s.studiedAt || '').startsWith(prefix))
    .forEach(s => (byDay[s.studiedAt] ??= []).push(s));

  const title = _calMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  let cells   = '<td></td>'.repeat(first === 0 ? 6 : first - 1);

  for (let d = 1; d <= days; d++) {
    const dateStr = `${prefix}-${String(d).padStart(2, '0')}`;
    const count   = byDay[dateStr]?.length || 0;
    const active  = _calDate === dateStr ? 'cal-day--active' : '';
    cells += `
      <td class="cal-day ${count ? 'cal-day--has-events' : ''} ${active}"
          onclick="window._selectStudyDate?.('${dateStr}')">
        ${d}${count ? `<span class="cal-badge">${count}</span>` : ''}
      </td>`;
    if ((first === 0 ? d + 6 : d + first - 1) % 7 === 0) cells += '</tr><tr>';
  }

  const detail = _calDate && byDay[_calDate]
    ? `<div class="cal-detail">
        <h4>📅 ${_calDate}</h4>
        ${byDay[_calDate].map(s => `
          <div class="cal-quest-item">
            <span>${s.minutes} min — focus ${s.focusScore}/10</span>
            <span class="quest-xp">+${s.xpEarned} XP</span>
          </div>`).join('')}
      </div>`
    : '';

  return `
    <div class="calendar">
      <div class="calendar__nav">
        <button onclick="window._studyCalNav?.(-1)">◀</button>
        <h3>${title}</h3>
        <button onclick="window._studyCalNav?.(1)">▶</button>
      </div>
      <table class="calendar__grid">
        <thead><tr><th>Lu</th><th>Ma</th><th>Me</th><th>Gi</th><th>Ve</th><th>Sa</th><th>Do</th></tr></thead>
        <tbody><tr>${cells}</tr></tbody>
      </table>
      ${detail}
    </div>`;
}

// ── Azioni ────────────────────────────────────────────────────

window._switchStudyTab = switchStudyTab;

window._openAddExamModal = function() { openModal('modal-add-exam'); };

window._addExam = async function() {
  const name     = document.getElementById('exam-name')?.value.trim();
  const examDate = document.getElementById('exam-date')?.value || null;
  if (!name) return toast('Inserisci il nome dell\'esame', 'error');

  const { ok, error } = await Study.createExam({ name, examDate });
  if (!ok) return toast(error || 'Errore', 'error');

  playSound('quest');
  toast('Esame aggiunto!', 'success');
  closeModal('modal-add-exam');
  renderStudy();
};

window._deleteExam = async function(examId) {
  if (!confirm('Eliminare questo esame?')) return;
  const { update: u } = await import('../db.js');
  // remove exam
  const { remove } = await import('../db.js');
  remove('exams', examId);
  playSound('tap');
  renderStudy();
};

window._openLogSessionModal = function(examId) {
  const el = document.getElementById('session-exam-id');
  if (el) el.value = examId;
  openModal('modal-log-session');
};

window._logSession = async function() {
  const examId    = document.getElementById('session-exam-id')?.value;
  const minutes   = parseInt(document.getElementById('session-minutes')?.value || '0');
  const focus     = parseInt(document.getElementById('session-focus')?.value || '5');

  if (!minutes || minutes < 1) return toast('Inserisci i minuti di studio', 'error');
  if (focus < 1 || focus > 10) return toast('Focus 1–10', 'error');

  const baseXP  = Math.round(minutes * 0.5 * (focus / 5));
  const earned  = await awardXP(baseXP, 'studio');

  const { ok } = await Study.logSession({ examId, minutes, focusScore: focus, xpEarned: earned });
  if (!ok) return toast('Errore nel salvataggio', 'error');

  await Feed.create({
    content:  `📚 Sessione di studio: ${minutes} min (focus ${focus}/10)`,
    category: 'studio',
    xpEarned: earned,
    refType:  'study',
    refId:    examId,
  });

  playSound('xp');
  toast(`Sessione registrata! +${earned} XP`, 'success');
  closeModal('modal-log-session');
  renderStudy();
};

window._studyCalNav = function(dir) {
  _calMonth.setMonth(_calMonth.getMonth() + dir);
  _calDate = null;
  renderStudy();
};

window._selectStudyDate = function(dateStr) {
  _calDate = _calDate === dateStr ? null : dateStr;
  renderStudy();
};

// Placeholder capitoli (da espandere)
window._openChaptersModal = function(examId) {
  toast('Gestione capitoli — prossimamente!', 'info');
};