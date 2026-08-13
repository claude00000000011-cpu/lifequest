// ============================================================
// main.js — Entry point di LifeQuest
// ============================================================

import { loadSession, setCUR, DB } from './db.js';
import { initModals } from './modals.js';
import { Moderation } from './api.js';
import { updateDashboard, gotoTab } from './screens/home.js';
import { switchAuthTab, doRegister, doLogin, doResetPin } from './auth.js';
import { initSettings } from './settings.js';
import { playBgm } from './audio.js';

// BUG #7 FIX — tiene traccia della tab attiva
let _activeTab = 'home';

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
  playBgm('home');
  Moderation.getBannedWords();
}

// ── DOMContentLoaded ──────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Inizializza impostazioni (font size, sfondi, FAB ⚙️)
  initSettings();

  initModals();

  setTimeout(hideSplash, 1500);

  const session = loadSession();
  if (session) {
    setCUR(session);
    setTimeout(() => bootApp(session), 1600);
  } else {
    setTimeout(() => {
      hideSplash();
      document.getElementById('auth-screen')?.classList.remove('hidden');
      playBgm('home'); // BGM anche sulla schermata login
    }, 1500);
  }

  // Auth
  document.getElementById('btn-login')?.addEventListener('click', doLogin);
  document.getElementById('btn-register')?.addEventListener('click', doRegister);
  document.getElementById('btn-reset-pin')?.addEventListener('click', doResetPin);

  document.querySelectorAll('.auth-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
  });

  // BUG #7 FIX — ogni click sulla nav aggiorna _activeTab + avvia BGM
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _activeTab = btn.dataset.tab;
      gotoTab(_activeTab);

      // BGM: battaglia usa bgm_battle, tutto il resto bgm_village
      if (_activeTab === 'battle') {
        playBgm('village'); // villaggio — in battaglia viene chiamato playBgm('battle') da battle_screen.js
      } else {
        playBgm('home');
      }
    });
  });

  ['login-password', 'reg-pin'].forEach(id => {
    document.getElementById(id)?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (id === 'login-password') doLogin();
        else doRegister();
      }
    });
  });

  document.getElementById('btn-refresh')?.addEventListener('click', doAppRefresh);

  // Esponi su window
  window._openAddQuestModal   = () => import('./screens/quest.js').then(m => m.openAddQuestModal?.());
  window._switchQuestTab      = t  => import('./screens/quest.js').then(m => m.switchQuestTab(t));
  window._switchStudyTab      = t  => import('./screens/study.js').then(m => m.switchStudyTab(t));
  window._switchPvPTab        = t  => import('./screens/pvp.js').then(m => m.switchPvPTab(t));
  window._switchLibriTab      = t  => import('./screens/libri.js').then(m => m.switchLibriTab(t));
  window._switchSocialTab     = t  => import('./screens/social.js').then(m => m.switchSocialTab(t));
  window._switchStatsTab      = t  => import('./screens/stats.js').then(m => m.switchStatsTab(t));

  window._addQuest            = ()  => import('./screens/quest.js').then(m => m.default?._addQuest?.() || window._addQuest?.());
  window._deleteQuest         = id  => import('./screens/quest.js').then(() => window._deleteQuest?.(id));

  window._addExam             = ()  => import('./screens/study.js').then(() => window._addExam?.());
  window._logSession          = ()  => import('./screens/study.js').then(() => window._logSession?.());

  window._saveCustomRoutine   = ()  => import('./screens/routine.js').then(() => window._saveCustomRoutine?.());

  window._createChallenge     = ()  => import('./screens/pvp.js').then(() => window._createChallenge?.());

  window._addBook             = ()  => import('./screens/books.js').then(() => window._addBook?.());
  window._logReading          = ()  => import('./screens/books.js').then(() => window._logReading?.());

  window._addGlobalBook       = ()  => import('./screens/libri.js').then(() => window._addGlobalBook?.());
  window._createDiscussion    = ()  => import('./screens/libri.js').then(() => window._createDiscussion?.());

  window._doLogout            = ()  => import('./auth.js').then(m => m.doLogout());
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
    await gotoTab(_activeTab);

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
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(err => {
      console.warn('[SW] Registrazione fallita:', err);
    });
  });
}
