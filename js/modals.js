// ============================================================
// modals.js — Gestione generica dei modal
// ============================================================

import { playSound } from './audio.js';

/** Stack dei modal aperti (per gestire la chiusura a cascata) */
const _stack = [];

/**
 * Apre un modal per ID.
 * @param {string} id — ID del modal (senza #)
 */
export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.remove('modal--hidden');
  el.classList.add('modal--visible');
  el.setAttribute('aria-hidden', 'false');

  _stack.push(id);
  playSound('open');

  // Blocca lo scroll del body
  if (_stack.length === 1) {
    document.body.classList.add('modal-open');
  }

  // Focus trap: focus sul primo elemento interattivo
  const focusable = el.querySelector('input, button, select, textarea, [tabindex]');
  focusable?.focus();
}

/**
 * Chiude un modal per ID.
 * @param {string} id
 */
export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.add('modal--hidden');
  el.classList.remove('modal--visible');
  el.setAttribute('aria-hidden', 'true');

  const idx = _stack.lastIndexOf(id);
  if (idx !== -1) _stack.splice(idx, 1);

  if (_stack.length === 0) {
    document.body.classList.remove('modal-open');
  }
}

/**
 * Chiude il modal più in cima allo stack.
 */
export function closeTopModal() {
  if (_stack.length > 0) {
    closeModal(_stack[_stack.length - 1]);
  }
}

/**
 * Chiude tutti i modal aperti.
 */
export function closeAllModals() {
  [..._stack].reverse().forEach(id => closeModal(id));
}

/**
 * Inizializza la gestione dei modal al boot.
 * Da chiamare una sola volta in main.js.
 */
export function initModals() {
  // Chiudi al click sullo sfondo
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-overlay')) {
      closeTopModal();
    }
  });

  // Chiudi con Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTopModal();
  });

  // Bottoni [data-close-modal]
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-close-modal]');
    if (btn) {
      const target = btn.dataset.closeModal || _stack[_stack.length - 1];
      closeModal(target);
    }
  });

  // Bottoni [data-open-modal]
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-open-modal]');
    if (btn) {
      openModal(btn.dataset.openModal);
    }
  });
}
