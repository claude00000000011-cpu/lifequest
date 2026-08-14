// ============================================================
// auth.js — Autenticazione: login, registrazione, PIN reset
// ============================================================

import { Auth as AuthAPI, syncCloudDataOnLogin, Moderation } from './api.js';
import { setCUR, DB, persist } from './db.js';
import { hashStr, toast, setLoading } from './utils.js';
import { playSound } from './audio.js';
import { updateDashboard } from './screens/home.js';
import { mergeUserData } from './db.js';

// ── Tab switcher ─────────────────────────────────────────────

/**
 * Mostra il tab Login o Registrazione nel pannello auth.
 * @param {'login'|'register'} tab
 */
export function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab-btn').forEach(btn => {
    btn.classList.toggle('auth-tab-btn--active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.auth-panel').forEach(panel => {
    panel.classList.toggle('auth-panel--hidden', panel.dataset.panel !== tab);
  });
}

// ── Registrazione ────────────────────────────────────────────

export async function doRegister() {
  const username = document.getElementById('reg-username')?.value.trim();
  const password = document.getElementById('reg-password')?.value;
  const pin      = document.getElementById('reg-pin')?.value;

  // Validazioni client-side
  if (!username || username.length < 3) {
    return toast('Username troppo corto (min 3 caratteri)', 'error');
  }
  if (!password || password.length < 6) {
    return toast('Password troppo corta (min 6 caratteri)', 'error');
  }
  if (!/^\d{4}$/.test(pin)) {
    return toast('Il PIN deve essere di 4 cifre numeriche', 'error');
  }

  setLoading(true, 'Creazione account…');
  playSound('open');

  try {
    const [passwordHash, pinHash] = await Promise.all([
      hashStr(password),
      hashStr(pin),
    ]);

    const { ok, data, error } = await AuthAPI.register(username, passwordHash, pinHash);

    if (!ok) {
      toast(error || 'Errore nella registrazione', 'error');
      return;
    }

    // Login automatico dopo la registrazione
    setCUR(data);
    DB.users[data.id] = data;
    persist();

    playSound('login');
    toast(`Benvenuto, ${data.username}! ⚔️`, 'success');
    bootApp();

  } catch (e) {
    console.error('[Auth] doRegister error:', e);
    toast('Errore imprevisto. Riprova.', 'error');
  } finally {
    setLoading(false);
  }
}

// ── Login ────────────────────────────────────────────────────

export async function doLogin() {
  const username = document.getElementById('login-username')?.value.trim();
  const password = document.getElementById('login-password')?.value;

  if (!username || !password) {
    return toast('Inserisci username e password', 'error');
  }

  setLoading(true, 'Accesso in corso…');

  try {
    const passwordHash = await hashStr(password);
    const { ok, data, error } = await AuthAPI.login(username, passwordHash);

    if (!ok) {
      toast(error || 'Credenziali non valide', 'error');
      return;
    }

    // Merge dati locali con quelli del cloud
    const localUser  = DB.users[data.id] || {};
    const merged     = mergeUserData(localUser, data);
    DB.users[data.id] = merged;
    persist();

   setCUR(merged);
    console.log('[Auth] doLogin → setCUR ok, utente:', merged.username);
    playSound('login');
    toast(`Bentornato, ${merged.username}! 🔥`, 'success');
    console.log('[Auth] → chiamo bootApp()');
    bootApp();

    // Sync asincrono post-login
    console.log('[Auth] → syncCloudDataOnLogin avviato');
    syncCloudDataOnLogin(merged.id);
    Moderation.getBannedWords();

  } catch (e) {
    console.error('[Auth] doLogin error:', e);
    toast('Errore di rete. Accesso offline.', 'info');
  } finally {
    setLoading(false);
  }
}

// ── PIN Reset ────────────────────────────────────────────────

export async function doResetPin() {
  const username    = document.getElementById('reset-username')?.value.trim();
  const pin         = document.getElementById('reset-pin')?.value;
  const newPassword = document.getElementById('reset-newpass')?.value;

  if (!username || !pin || !newPassword) {
    return toast('Compila tutti i campi', 'error');
  }
  if (!/^\d{4}$/.test(pin)) {
    return toast('PIN non valido (4 cifre)', 'error');
  }
  if (newPassword.length < 6) {
    return toast('La nuova password deve avere almeno 6 caratteri', 'error');
  }

  setLoading(true, 'Reset in corso…');

  try {
    const [pinHash, newPasswordHash] = await Promise.all([
      hashStr(pin),
      hashStr(newPassword),
    ]);

    const { ok, error } = await AuthAPI.resetPin(username, pinHash, newPasswordHash);

    if (!ok) {
      toast(error || 'PIN o username non validi', 'error');
      return;
    }

    toast('Password aggiornata! Effettua il login.', 'success');
    closeModal('modal-reset-pin');
    switchAuthTab('login');

  } catch (e) {
    console.error('[Auth] doResetPin error:', e);
    toast('Errore imprevisto', 'error');
  } finally {
    setLoading(false);
  }
}

// ── Logout ───────────────────────────────────────────────────

export function doLogout() {
  import('./db.js').then(({ setCUR }) => {
    setCUR(null);
  });

  // Pulisce cache feed
  window._feedCache = null;

  // Mostra l'auth, nasconde l'app
  document.getElementById('app-main')?.classList.add('hidden');
  document.getElementById('auth-screen')?.classList.remove('hidden');

  // Reset form
  ['login-username','login-password','reg-username','reg-password','reg-pin']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

  switchAuthTab('login');
  toast('Disconnesso.', 'info');
}

// ── Boot app (post-login) ─────────────────────────────────────

/**
 * Avvia l'interfaccia principale dopo login/registrazione.
 */
function bootApp() {
  document.getElementById('auth-screen')?.classList.add('hidden');
  document.getElementById('app-main')?.classList.remove('hidden');

  // Avvia dalla Home
  import('./screens/home.js').then(({ gotoTab }) => gotoTab('home'));
}
