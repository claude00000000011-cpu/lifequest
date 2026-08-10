// ============================================================
// screens/study.js — Studio, Esami, Sessioni, Capitoli, Nozioni
// ============================================================

import { CUR, DB } from '../db.js';
import { Study, Feed } from '../api.js';
import { awardXP } from '../xp.js';
import { escHtml, toast, today } from '../utils.js';
import { playSound } from '../audio.js';
import { openModal, closeModal } from '../modals.js';

let _studyTab  = 'exams';
let _calMonth  = new Date();
let _calDate   = null;
let _openExamId = null;  // quale esame ha i dettagli aperti

export function switchStudyTab(t) { _studyTab = t; renderStudy(); }

export async function renderStudy() {
  if (!CUR) return;
  const container = document.getElementById('screen-study');
  if (!container) return;

  // Carica esami aggiornati dal cloud alla prima apertura
  if (_studyTab === 'exams' && !DB._examsSynced) {
    await Study.getExams(CUR.id);
    DB._examsSynced = true;
  }

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
    <div id="study-content"></div>
  `;

  const content = document.getElementById('study-content');
  if (_studyTab === 'exams')    content.innerHTML = renderExams();
  if (_studyTab === 'sessions') content.innerHTML = renderSessions();
  if (_studyTab === 'calendar') content.innerHTML = renderStudyCalendar();
}

// ── Esami ─────────────────────────────────────────────────────

function renderExams() {
  const exams = DB.exams.filter(e => e.userId === CUR.id)
    .sort((a, b) => {
      // Prima gli esami con data più vicina
      if (a.examDate && b.examDate) return a.examDate.localeCompare(b.examDate);
      if (a.examDate) return -1;
      if (b.examDate) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  if (!exams.length) return `<div class="empty-state">Nessun esame. Aggiungine uno con il tasto + in alto!</div>`;

  return `<div class="exam-list">
    ${exams.map(exam => renderExamCard(exam)).join('')}
  </div>`;
}

function renderExamCard(exam) {
  const chapters  = exam.chapters || [];
  const done      = chapters.filter(c => c.done).length;
  const pct       = chapters.length ? Math.round((done / chapters.length) * 100) : 0;
  const isOpen    = _openExamId === exam.id;

  // Data esame: colore urgenza
  let dateTag = '';
  if (exam.examDate) {
    const diff = Math.ceil((new Date(exam.examDate) - new Date()) / 86400000);
    const color = diff < 3 ? '#dc2626' : diff < 7 ? '#d97706' : '#16a34a';
    const label = diff < 0 ? 'Passato' : diff === 0 ? 'Oggi!' : `${diff}gg`;
    dateTag = `<span style="color:${color};font-weight:600;font-size:0.8rem">📅 ${exam.examDate} (${label})</span>`;
  }

  const concepts = DB.concepts.filter(c => c.examId === exam.id);

  return `
    <div class="exam-card ${isOpen ? 'exam-card--open' : ''}" id="exam-card-${exam.id}">
      <div class="exam-card__header" onclick="window._toggleExamDetails?.('${exam.id}')">
        <div class="exam-card__title">
          <h3>${escHtml(exam.name)}</h3>
          ${exam.grade ? `<span class="badge badge--green">🎓 ${exam.grade}/30</span>` : ''}
        </div>
        <div class="exam-card__meta">
          ${dateTag}
          ${chapters.length ? `
            <div class="progress-bar" style="margin:0.3rem 0">
              <div class="progress-bar__fill" style="width:${pct}%"></div>
            </div>
            <span style="font-size:0.75rem;color:var(--text-2)">${done}/${chapters.length} capitoli — ${pct}%</span>
          ` : '<span style="font-size:0.75rem;color:var(--text-3)">Nessun capitolo</span>'}
        </div>
        <span class="exam-card__chevron">${isOpen ? '▲' : '▼'}</span>
      </div>

      ${isOpen ? `
      <div class="exam-card__body">
        <div class="exam-actions-row">
          <button class="btn-sm btn-primary" onclick="window._openLogSessionModal?.('${exam.id}')">⏱ Studia</button>
          <button class="btn-sm" onclick="window._openGradeModal?.('${exam.id}')">🎓 Voto</button>
          <button class="btn-sm btn-danger" onclick="window._deleteExam?.('${exam.id}')">🗑️ Elimina</button>
        </div>

        <!-- CAPITOLI -->
        <div class="exam-section">
          <div class="exam-section__header">
            <h4>📖 Capitoli</h4>
            <button class="btn-add-inline" onclick="window._openAddChapterInline?.('${exam.id}')">+ Aggiungi</button>
          </div>
          <div id="chapters-${exam.id}">
            ${renderChaptersList(exam)}
          </div>
          <div id="chapter-input-${exam.id}" class="inline-input-row" style="display:none">
            <input type="text" id="chapter-text-${exam.id}" placeholder="Nome capitolo…" maxlength="100">
            <button onclick="window._addChapter?.('${exam.id}')">✓</button>
            <button onclick="document.getElementById('chapter-input-${exam.id}').style.display='none'">✕</button>
          </div>
        </div>

        <!-- NOZIONI -->
        <div class="exam-section">
          <div class="exam-section__header">
            <h4>💡 Nozioni</h4>
            <button class="btn-add-inline" onclick="window._openAddConceptInline?.('${exam.id}')">+ Aggiungi</button>
          </div>
          <div id="concepts-${exam.id}">
            ${renderConceptsList(exam.id)}
          </div>
          <div id="concept-input-${exam.id}" class="inline-input-row" style="display:none">
            <input type="text" id="concept-text-${exam.id}" placeholder="Cosa hai imparato…" maxlength="300">
            <button onclick="window._addConcept?.('${exam.id}')">✓</button>
            <button onclick="document.getElementById('concept-input-${exam.id}').style.display='none'">✕</button>
          </div>
        </div>
      </div>
      ` : ''}
    </div>`;
}

function renderChaptersList(exam) {
  const chapters = exam.chapters || [];
  if (!chapters.length) return `<p class="empty-mini">Nessun capitolo ancora.</p>`;

  return chapters.map(c => `
    <div class="chapter-item ${c.done ? 'chapter-item--done' : ''}">
      <label class="chapter-checkbox">
        <input type="checkbox" ${c.done ? 'checked' : ''}
               onchange="window._toggleChapter?.('${exam.id}', '${c.id}')">
        <span>${escHtml(c.title)}</span>
      </label>
      <button class="btn-icon-sm" onclick="window._deleteChapter?.('${exam.id}', '${c.id}')">🗑</button>
    </div>`).join('');
}

function renderConceptsList(examId) {
  const concepts = DB.concepts.filter(c => c.examId === examId);
  if (!concepts.length) return `<p class="empty-mini">Nessuna nozione ancora.</p>`;

  return concepts.map(c => `
    <div class="concept-item">
      <span>💡 ${escHtml(c.text)}</span>
      <button class="btn-icon-sm" onclick="window._deleteConcept?.('${c.id}', '${examId}')">🗑</button>
    </div>`).join('');
}

// ── Sessioni ──────────────────────────────────────────────────

function renderSessions() {
  const sessions = DB.studySessions
    .filter(s => s.userId === CUR.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);

  if (!sessions.length) return `<div class="empty-state">Nessuna sessione registrata ancora.</div>`;

  // Raggruppa per data
  const byDay = {};
  sessions.forEach(s => {
    const d = s.studiedAt || s.createdAt?.slice(0, 10) || '?';
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(s);
  });

  return `<div class="session-list">
    ${Object.entries(byDay).map(([date, list]) => `
      <div class="session-day-group">
        <div class="session-day-label">📅 ${date}</div>
        ${list.map(s => {
          const exam = DB.exams.find(e => e.id === s.examId);
          return `
            <div class="session-card">
              <span class="session-exam">${exam ? escHtml(exam.name) : '—'}</span>
              <span class="session-mins">⏱ ${s.minutes} min</span>
              <span class="session-focus">🎯 ${s.focusScore}/10</span>
              <span class="session-xp badge badge--purple">+${s.xpEarned} XP</span>
            </div>`;
        }).join('')}
      </div>`).join('')}
  </div>`;
}

// ── Calendario ────────────────────────────────────────────────

function renderStudyCalendar() {
  const year  = _calMonth.getFullYear();
  const month = _calMonth.getMonth();
  const days  = new Date(year, month + 1, 0).getDate();
  const first = new Date(year, month, 1).getDay(); // 0=Dom

  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  // Sessioni di studio per giorno
  const studyByDay = {};
  DB.studySessions
    .filter(s => s.userId === CUR.id && (s.studiedAt || '').startsWith(prefix))
    .forEach(s => (studyByDay[s.studiedAt] ??= []).push(s));

  // Date esame nel mese
  const examDates = {};
  DB.exams
    .filter(e => e.userId === CUR.id && (e.examDate || '').startsWith(prefix))
    .forEach(e => (examDates[e.examDate] ??= []).push(e));

  const title = _calMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  // Lunedì primo: se domenica (0) → 6 celle vuote, altrimenti (giorno - 1)
  const emptyCells = first === 0 ? 6 : first - 1;
  let cells = '<td></td>'.repeat(emptyCells);

  for (let d = 1; d <= days; d++) {
    const dateStr = `${prefix}-${String(d).padStart(2, '0')}`;
    const sessions = studyByDay[dateStr] || [];
    const exams    = examDates[dateStr]  || [];
    const active   = _calDate === dateStr ? 'cal-day--active' : '';
    const hasStudy = sessions.length > 0;
    const hasExam  = exams.length > 0;

    cells += `
      <td class="cal-day ${hasStudy ? 'cal-day--has-events' : ''} ${hasExam ? 'cal-day--exam' : ''} ${active}"
          onclick="window._selectStudyDate?.('${dateStr}')">
        ${d}
        ${hasStudy ? `<span class="cal-badge cal-badge--study">${sessions.length}</span>` : ''}
        ${hasExam  ? `<span class="cal-badge cal-badge--exam">📅</span>` : ''}
      </td>`;
    if ((emptyCells + d) % 7 === 0) cells += '</tr><tr>';
  }

  // Dettaglio giorno selezionato
  let detail = '';
  if (_calDate) {
    const daySessions = studyByDay[_calDate] || [];
    const dayExams    = examDates[_calDate]  || [];
    const totalMin    = daySessions.reduce((s, x) => s + (x.minutes || 0), 0);

    detail = `
      <div class="cal-detail">
        <h4>📅 ${_calDate}</h4>
        ${dayExams.length ? dayExams.map(e => `
          <div class="cal-exam-item">
            <span>🎓 Esame: <strong>${escHtml(e.name)}</strong></span>
          </div>`).join('') : ''}
        ${daySessions.length ? `
          <p style="font-size:0.8rem;color:var(--text-2)">Totale: ${totalMin} min studiati</p>
          ${daySessions.map(s => {
            const exam = DB.exams.find(e => e.id === s.examId);
            return `
              <div class="cal-quest-item">
                <span>${exam ? escHtml(exam.name) : 'Studio libero'} — ${s.minutes} min (focus ${s.focusScore}/10)</span>
                <span class="quest-xp">+${s.xpEarned} XP</span>
              </div>`;
          }).join('')}
        ` : '<p style="color:var(--text-3);font-size:0.85rem">Nessuna sessione in questo giorno.</p>'}
      </div>`;
  }

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
      <div style="display:flex;gap:0.5rem;margin:0.5rem 0;font-size:0.75rem;color:var(--text-2)">
        <span><span style="display:inline-block;width:10px;height:10px;background:var(--accent);border-radius:50%;margin-right:4px"></span>Sessione</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:#dc2626;border-radius:50%;margin-right:4px"></span>Esame</span>
      </div>
      ${detail}
    </div>`;
}

// ── Azioni ────────────────────────────────────────────────────

window._switchStudyTab = switchStudyTab;

window._toggleExamDetails = function(examId) {
  _openExamId = _openExamId === examId ? null : examId;
  // Re-render solo la lista esami per non perdere lo scroll
  const content = document.getElementById('study-content');
  if (content && _studyTab === 'exams') content.innerHTML = renderExams();
};

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
  document.getElementById('exam-name').value = '';
  document.getElementById('exam-date').value = '';
  renderStudy();
};

window._deleteExam = async function(examId) {
  if (!confirm('Eliminare questo esame e tutti i suoi dati?')) return;
  const { remove: rm } = await import('../db.js');
  rm('exams', examId);
  // Elimina anche le nozioni associate
  DB.concepts = DB.concepts.filter(c => c.examId !== examId);
  const { persist: p } = await import('../db.js');
  p();
  // Sync cloud in background
  const { supabase } = await import('../supabase.js').catch(() => ({ supabase: null }));
  if (supabase) {
    supabase.from('exams').delete().eq('id', examId);
    supabase.from('concepts').delete().eq('exam_id', examId);
  }
  _openExamId = null;
  playSound('tap');
  renderStudy();
};

window._openGradeModal = function(examId) {
  const exam = DB.exams.find(e => e.id === examId);
  if (!exam) return;
  const grade = prompt(`Voto per "${exam.name}" (1-30):`);
  if (!grade) return;
  const n = parseInt(grade);
  if (isNaN(n) || n < 1 || n > 30) return toast('Voto non valido (1-30)', 'error');
  Study.updateExam(examId, { grade: n });
  toast(`Voto ${n}/30 salvato! 🎓`, 'success');
  playSound('trophy');
  renderStudy();
};

// Capitoli
window._openAddChapterInline = function(examId) {
  const row = document.getElementById(`chapter-input-${examId}`);
  if (row) {
    row.style.display = 'flex';
    document.getElementById(`chapter-text-${examId}`)?.focus();
  }
};

window._addChapter = async function(examId) {
  const input = document.getElementById(`chapter-text-${examId}`);
  const title = input?.value.trim();
  if (!title) return;

  const { ok } = await Study.addChapter(examId, title);
  if (!ok) return toast('Errore nel salvataggio', 'error');

  input.value = '';
  document.getElementById(`chapter-input-${examId}`).style.display = 'none';
  playSound('tap');

  // Aggiorna solo la sezione capitoli senza rifare tutto il render
  const exam = DB.exams.find(e => e.id === examId);
  const chapEl = document.getElementById(`chapters-${examId}`);
  if (chapEl && exam) chapEl.innerHTML = renderChaptersList(exam);
};

window._toggleChapter = async function(examId, chapterId) {
  await Study.toggleChapter(examId, chapterId);
  const exam = DB.exams.find(e => e.id === examId);
  const chapEl = document.getElementById(`chapters-${examId}`);
  if (chapEl && exam) chapEl.innerHTML = renderChaptersList(exam);
  playSound('tap');
};

window._deleteChapter = async function(examId, chapterId) {
  await Study.deleteChapter(examId, chapterId);
  const exam = DB.exams.find(e => e.id === examId);
  const chapEl = document.getElementById(`chapters-${examId}`);
  if (chapEl && exam) chapEl.innerHTML = renderChaptersList(exam);
  playSound('tap');
};

// Nozioni
window._openAddConceptInline = function(examId) {
  const row = document.getElementById(`concept-input-${examId}`);
  if (row) {
    row.style.display = 'flex';
    document.getElementById(`concept-text-${examId}`)?.focus();
  }
};

window._addConcept = async function(examId) {
  const input = document.getElementById(`concept-text-${examId}`);
  const text  = input?.value.trim();
  if (!text) return;

  const { ok } = await Study.addConcept(examId, text);
  if (!ok) return toast('Errore nel salvataggio', 'error');

  input.value = '';
  document.getElementById(`concept-input-${examId}`).style.display = 'none';
  playSound('tap');
  toast('Nozione salvata! 💡', 'success');

  // Aggiorna solo la sezione nozioni
  const conceptEl = document.getElementById(`concepts-${examId}`);
  if (conceptEl) conceptEl.innerHTML = renderConceptsList(examId);
};

window._deleteConcept = async function(conceptId, examId) {
  await Study.deleteConcept(conceptId);
  const conceptEl = document.getElementById(`concepts-${examId}`);
  if (conceptEl) conceptEl.innerHTML = renderConceptsList(examId);
  playSound('tap');
};

// Sessione
window._openLogSessionModal = function(examId) {
  const el = document.getElementById('session-exam-id');
  if (el) el.value = examId || '';
  openModal('modal-log-session');
};

window._logSession = async function() {
  const examId  = document.getElementById('session-exam-id')?.value;
  const minutes = parseInt(document.getElementById('session-minutes')?.value || '0');
  const focus   = parseInt(document.getElementById('session-focus')?.value || '5');
  const notes   = document.getElementById('session-notes')?.value?.trim() || '';

  if (!minutes || minutes < 1) return toast('Inserisci i minuti di studio', 'error');
  if (focus < 1 || focus > 10) return toast('Focus deve essere tra 1 e 10', 'error');

  const baseXP = Math.round(minutes * 0.5 * (focus / 5));
  const earned = await awardXP(baseXP, 'studio');

  const { ok } = await Study.logSession({ examId: examId || null, minutes, focusScore: focus, xpEarned: earned, notes });
  if (!ok) return toast('Errore nel salvataggio', 'error');

  const exam = examId ? DB.exams.find(e => e.id === examId) : null;
  await Feed.create({
    content:  `📚 Sessione di studio: ${minutes} min (focus ${focus}/10)${exam ? ` — ${exam.name}` : ''}`,
    category: 'studio',
    xpEarned: earned,
    refType:  'study',
    refId:    examId || null,
  });

  playSound('xp');
  toast(`Sessione registrata! +${earned} XP`, 'success');
  closeModal('modal-log-session');
  document.getElementById('session-minutes').value = '';
  renderStudy();
};

window._studyCalNav = function(dir) {
  _calMonth = new Date(_calMonth.getFullYear(), _calMonth.getMonth() + dir, 1);
  _calDate  = null;
  renderStudy();
};

window._selectStudyDate = function(dateStr) {
  _calDate = _calDate === dateStr ? null : dateStr;
  const content = document.getElementById('study-content');
  if (content) content.innerHTML = renderStudyCalendar();
};
