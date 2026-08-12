// ============================================================
// screens/routine.js — Routine giornaliere
// ============================================================

import { CUR, DB } from '../db.js';
import { Routines, Feed } from '../api.js';
import { awardXP } from '../xp.js';
import { escHtml, toast, today } from '../utils.js';
import { playSound } from '../audio.js';
import { openModal, closeModal } from '../modals.js';
import { ROUTINE_ITEMS } from '../config.js';

const MAX_DAILY = 3;  // max attivazioni per tipo al giorno

export function renderRoutine() {
  if (!CUR) return;
  const container = document.getElementById('screen-routine');
  if (!container) return;

  const todayLogs = DB.routineLogs.filter(
    r => r.userId === CUR.id && r.doneAt === today()
  );

  // Tutte le routine (default + custom utente)
  const userCustom = DB.routines.filter(
    r => !r.isDefault && r.userId === CUR.id
  );
  const allRoutines = [...ROUTINE_ITEMS, ...userCustom];

  container.innerHTML = `
    <div class="screen-header">
      <h2>Routine</h2>
      <button class="btn-add" onclick="window._openAddRoutineModal?.()">+ Custom</button>
    </div>

    <div class="routine-summary">
      <span>✅ Oggi: <strong>${todayLogs.length}</strong> routine</span>
      <span>⚡ XP: <strong>${todayLogs.reduce((s, r) => s + (r.xpEarned || 0), 0)}</strong></span>
    </div>

    <div class="routine-grid">
      ${allRoutines.map(r => {
        const countToday = todayLogs.filter(l => l.routineId === r.id).length;
        const exhausted  = countToday >= MAX_DAILY;
        return `
          <button class="routine-tile ${exhausted ? 'routine-tile--done' : ''}"
                  onclick="window._doRoutine?.('${r.id}')"
                  ${exhausted ? 'disabled' : ''}>
            <span class="routine-tile__emoji">${r.emoji || '⚡'}</span>
            <span class="routine-tile__name">${escHtml(r.name)}</span>
            <span class="routine-tile__xp">+${r.xpValue} XP</span>
            ${countToday ? `<span class="routine-tile__count">×${countToday}</span>` : ''}
          </button>`;
      }).join('')}
    </div>
  `;
}

// ── Azioni ────────────────────────────────────────────────────

window._doRoutine = async function(routineId) {
  if (!CUR) return;

  const routine = [...ROUTINE_ITEMS, ...DB.routines].find(r => r.id === routineId);
  if (!routine) return;

  // Max 1 volta al giorno per item (già gestito dal cap DAILY_XP_CAPS.routine)
  const todayLogs = DB.routineLogs.filter(
    r => r.userId === CUR.id && r.routineId === routineId && r.doneAt === today()
  );
  if (todayLogs.length >= 1) {
    return toast('Hai già fatto questa routine oggi!', 'info');
  }

  // Passa 1 come unità (una routine = 1 "slot" del cap giornaliero per item)
  const earned = await awardXP(routine.xpValue, routine.category, 1);

  const { ok } = await Routines.log({ routineId, xpEarned: earned });
  if (!ok) return toast('Errore nel salvataggio', 'error');

  await Feed.create({
    content:  `${routine.emoji || '⚡'} Routine: ${routine.name}`,
    category: routine.category,
    xpEarned: earned,
    refType:  'routine',
    refId:    routineId,
  });

  playSound('tap');
  toast(`+${earned} XP — ${routine.name} ✅`, 'success');
  renderRoutine();
};

window._openAddRoutineModal = function() { openModal('modal-add-routine'); };

window._saveCustomRoutine = async function() {
  const name   = document.getElementById('routine-name')?.value.trim();
  const xpVal  = parseInt(document.getElementById('routine-xp')?.value || '10');
  const emoji  = document.getElementById('routine-emoji')?.value.trim() || '⚡';

  if (!name) return toast('Inserisci un nome', 'error');
  if (xpVal < 1 || xpVal > 100) return toast('XP tra 1 e 100', 'error');

  const { ok } = await Routines.createCustom({ name, xpValue: xpVal, emoji });
  if (!ok) return toast('Errore nel salvataggio', 'error');

  playSound('quest');
  toast('Routine personalizzata aggiunta!', 'success');
  closeModal('modal-add-routine');
  renderRoutine();
};
