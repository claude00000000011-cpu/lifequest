// ============================================================
// main.js — Entry point di LifeQuest
// ============================================================
// Importato come <script type="module" src="js/main.js"> in index.html
// ============================================================

import { loadSession, setCUR, DB } from './db.js';
import { initModals } from './modals.js';
import { Moderation } from './api.js';
import { updateDashboard, gotoTab } from './screens/home.js';
import { switchAuthTab, doRegister, doLogin, doResetPin } from './auth.js';

// ── Splash screen ─────────────────────────────────────────────

function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.style.opacity = '0';
  splash.style.transition = 'opacity 0.5s ease';
  setTimeout(() => splash.remove(), 500);
}

// ── Boot ──────────────────────────────────────────────────────

function bootApp(user) {
  document.getElementById('auth-screen')?.classList.add('hidden');
  document.getElementById('app-main')?.classList.remove('hidden');
  gotoTab('home');

  // Carica parole bannate in background
  Moderation.getBannedWords();
}

// ── DOMContentLoaded ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Inizializza sistema modal
  initModals();

  // Splash → nasconde dopo 1.5s
  setTimeout(hideSplash, 1500);

  // Controlla sessione esistente
  const session = loadSession();
  if (session) {
    setCUR(session);
    setTimeout(() => bootApp(session), 1600);
  } else {
    setTimeout(() => {
      hideSplash();
      document.getElementById('auth-screen')?.classList.remove('hidden');
    }, 1500);
  }

  // ── Binding pulsanti globali ──────────────────────────────

  // Auth
  document.getElementById('btn-login')?.addEventListener('click', doLogin);
  document.getElementById('btn-register')?.addEventListener('click', doRegister);
  document.getElementById('btn-reset-pin')?.addEventListener('click', doResetPin);

  document.querySelectorAll('.auth-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
  });

  // Bottom nav
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => gotoTab(btn.dataset.tab));
  });

  // Enter nelle form di auth
  ['login-password', 'reg-pin'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (id === 'login-password') doLogin();
        else doRegister();
      }
    });
  });

  // Refresh manuale (icona nella bottom nav)
  document.getElementById('btn-refresh')?.addEventListener('click', doAppRefresh);

  // ── Esponi su window per uso inline negli HTML generati ───
  window._openAddQuestModal   = () => import('./screens/quest.js').then(m => m.openAddQuestModal?.());
  window._switchQuestTab      = t  => import('./screens/quest.js').then(m => m.switchQuestTab(t));
  window._switchStudyTab      = t  => import('./screens/study.js').then(m => m.switchStudyTab(t));
  window._switchPvPTab        = t  => import('./screens/pvp.js').then(m => m.switchPvPTab(t));
  window._switchLibriTab      = t  => import('./screens/libri.js').then(m => m.switchLibriTab(t));
  window._switchSocialTab     = t  => import('./screens/social.js').then(m => m.switchSocialTab(t));
  window._switchStatsTab      = t  => import('./screens/stats.js').then(m => m.switchStatsTab(t));

  // Quest actions
  window._addQuest            = ()      => import('./screens/quest.js').then(m => m.default?._addQuest?.() || window._addQuest?.());
  window._deleteQuest         = id      => import('./screens/quest.js').then(() => window._deleteQuest?.(id));

  // Study actions
  window._addExam             = ()      => import('./screens/study.js').then(() => window._addExam?.());
  window._logSession          = ()      => import('./screens/study.js').then(() => window._logSession?.());

  // Routine actions
  window._saveCustomRoutine   = ()      => import('./screens/routine.js').then(() => window._saveCustomRoutine?.());

  // PvP actions
  window._createChallenge     = ()      => import('./screens/pvp.js').then(() => window._createChallenge?.());

  // Books actions
  window._addBook             = ()      => import('./screens/books.js').then(() => window._addBook?.());
  window._logReading          = ()      => import('./screens/books.js').then(() => window._logReading?.());

  // Libri actions
  window._addGlobalBook       = ()      => import('./screens/libri.js').then(() => window._addGlobalBook?.());
  window._createDiscussion    = ()      => import('./screens/libri.js').then(() => window._createDiscussion?.());

  // Stats actions
  window._doLogout            = ()      => import('./auth.js').then(m => m.doLogout());
});

// ── App Refresh ───────────────────────────────────────────────

async function doAppRefresh() {
  const { CUR, DB, persist, mergeUserData } = await import('./db.js');
  const { Users, syncCloudDataOnLogin } = await import('./api.js');
  const { toast, setLoading } = await import('./utils.js');

  if (!CUR) return;

  setLoading(true, 'Aggiornamento…');

  try {
    const { ok, data } = await Users.get(CUR.id);
    if (ok && data) {
      const merged = mergeUserData(DB.users[CUR.id] || CUR, data);
      DB.users[CUR.id] = merged;
      persist();
      const { setCUR } = await import('./db.js');
      setCUR(merged);
    }

    await syncCloudDataOnLogin(CUR.id);
    updateDashboard();
    toast('Dati aggiornati ✅', 'success');
  } catch (e) {
    toast('Aggiornamento fallito — sei offline?', 'error');
  } finally {
    setLoading(false);
  }
}

// ── Service Worker ────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('[SW] Registrazione fallita:', err);
    });
  });
}
