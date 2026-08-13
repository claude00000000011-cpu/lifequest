// ============================================================
// js/settings.js — Schermata Impostazioni LifeQuest
// ============================================================

import { getAudioSettings, updateAudioSettings, playSound } from './audio.js';

const UI_KEY = 'lq_ui_settings';

function loadUiSettings() {
  try { return JSON.parse(localStorage.getItem(UI_KEY)) || {}; }
  catch { return {}; }
}

function saveUiSettings(s) {
  localStorage.setItem(UI_KEY, JSON.stringify(s));
}

let _ui = {
  fontSize:  'normal',
  bgEnabled: true,
  ...loadUiSettings()
};

const FONT_SCALES = { small: '0.85', normal: '1', large: '1.18' };

export function applyFontSize(size) {
  _ui.fontSize = size;
  saveUiSettings(_ui);
  document.documentElement.style.setProperty('--font-scale', FONT_SCALES[size] || '1');
}

const BG_BASE = '/lifequest/assets/backgrounds/';

const BG_SCHEDULE = [
  { from:  6, to: 17, images: ['SFONDO 2 ROTAZIONE (COLORE CHIARO PER GIORNO).png', 'SFONDO 2 ROTAZIONE.png'] },
  { from: 17, to: 21, images: ['SFONDO 1 ROTAZIONE (COLORE CALDO PER CREPUSCOLO).png', 'SFONDO 1 ROTAZIONE.png'] },
  { from: 21, to:  6, images: ['SFONDO 3 ROTAZIONE (COLORE SCURO PER NOTTE).png'] },
];

function getCurrentBgImage() {
  const h = new Date().getHours();
  const slot = BG_SCHEDULE.find(s =>
    s.from < s.to ? h >= s.from && h < s.to : h >= s.from || h < s.to
  ) || BG_SCHEDULE[2];
  const imgs = slot.images;
  return BG_BASE + imgs[Math.floor(Math.random() * imgs.length)];
}

let _bgInterval = null;

export function startBgRotation() {
  if (!_ui.bgEnabled) return;
  _applyBg();
  clearInterval(_bgInterval);
  _bgInterval = setInterval(_applyBg, 60 * 60 * 1000);
}

export function stopBgRotation() {
  clearInterval(_bgInterval);
  _bgInterval = null;
  document.body.style.removeProperty('--lq-bg');
}

function _applyBg() {
  if (!_ui.bgEnabled) return;
  const url = getCurrentBgImage();
  document.body.style.setProperty('--lq-bg', `url("${url}")`);
}

export function openSettings() {
  document.getElementById('settings-overlay')?.remove();

  const audio = getAudioSettings();

  const overlay = document.createElement('div');
  overlay.id = 'settings-overlay';
  overlay.innerHTML = `
    <div class="settings-panel" id="settings-panel">
      <div class="settings-header">
        <span class="settings-title">⚙️ Impostazioni</span>
        <button class="settings-close" id="settings-close">✕</button>
      </div>

      <!-- BGM -->
      <div class="settings-section">
        <div class="settings-section-title">🎵 Musica (BGM)</div>
        <label class="settings-toggle-row">
          <span>Attiva musica</span>
          <label class="toggle-switch">
            <input type="checkbox" id="set-bgm-enabled" ${audio.bgmEnabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </label>
        <label class="settings-slider-row">
          <span>Volume</span>
          <input type="range" id="set-bgm-vol" min="0" max="1" step="0.05"
                 value="${audio.bgmVolume}" ${!audio.bgmEnabled ? 'disabled' : ''}>
          <span class="set-val" id="set-bgm-val">${Math.round(audio.bgmVolume * 100)}%</span>
        </label>
      </div>

      <!-- SFX -->
      <div class="settings-section">
        <div class="settings-section-title">🔊 Effetti Sonori (SFX)</div>
        <label class="settings-toggle-row">
          <span>Attiva SFX</span>
          <label class="toggle-switch">
            <input type="checkbox" id="set-sfx-enabled" ${audio.sfxEnabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </label>
        <label class="settings-slider-row">
          <span>Volume</span>
          <input type="range" id="set-sfx-vol" min="0" max="1" step="0.05"
                 value="${audio.sfxVolume}" ${!audio.sfxEnabled ? 'disabled' : ''}>
          <span class="set-val" id="set-sfx-val">${Math.round(audio.sfxVolume * 100)}%</span>
        </label>
      </div>

      <!-- SFONDI -->
      <div class="settings-section">
        <div class="settings-section-title">🖼️ Sfondi</div>
        <label class="settings-toggle-row">
          <span>Sfondi rotativi</span>
          <label class="toggle-switch">
            <input type="checkbox" id="set-bg-enabled" ${_ui.bgEnabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </label>
        <div class="settings-hint">Cambiano automaticamente con l'ora del giorno</div>
      </div>

      <!-- FONT SIZE -->
      <div class="settings-section">
        <div class="settings-section-title">🔤 Dimensione Testo</div>
        <div class="settings-font-row">
          <button class="font-size-btn ${_ui.fontSize === 'small'  ? 'active' : ''}" data-size="small">A</button>
          <button class="font-size-btn ${_ui.fontSize === 'normal' ? 'active' : ''}" data-size="normal" style="font-size:1.1em">A</button>
          <button class="font-size-btn ${_ui.fontSize === 'large'  ? 'active' : ''}" data-size="large" style="font-size:1.3em">A</button>
        </div>
        <div class="settings-hint">Piccolo · Normale · Grande</div>
      </div>

      <!-- DISPLAY -->
      <div class="settings-section">
        <div class="settings-section-title">📱 Display</div>
        <button class="btn-fullscreen" onclick="window._toggleFullscreen?.()">
          ⛶ Schermo Intero
        </button>
        <div class="settings-hint">Nasconde la barra del browser</div>
      </div>

    </div>
  `;

  overlay.addEventListener('click', e => { if (e.target === overlay) closeSettings(); });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('settings-overlay--open'));

  document.getElementById('settings-close').onclick = closeSettings;

  document.getElementById('set-bgm-enabled').onchange = e => {
    const en = e.target.checked;
    updateAudioSettings({ bgmEnabled: en });
    document.getElementById('set-bgm-vol').disabled = !en;
    if (!en) { import('./audio.js').then(m => m.pauseBgm()); }
    else      { import('./audio.js').then(m => m.resumeBgm()); }
  };

  document.getElementById('set-bgm-vol').oninput = e => {
    const v = parseFloat(e.target.value);
    updateAudioSettings({ bgmVolume: v });
    document.getElementById('set-bgm-val').textContent = Math.round(v * 100) + '%';
  };

  document.getElementById('set-sfx-enabled').onchange = e => {
    const en = e.target.checked;
    updateAudioSettings({ sfxEnabled: en });
    document.getElementById('set-sfx-vol').disabled = !en;
  };

  document.getElementById('set-sfx-vol').oninput = e => {
    const v = parseFloat(e.target.value);
    updateAudioSettings({ sfxVolume: v });
    document.getElementById('set-sfx-val').textContent = Math.round(v * 100) + '%';
    playSound('tap');
  };

  document.getElementById('set-bg-enabled').onchange = e => {
    _ui.bgEnabled = e.target.checked;
    saveUiSettings(_ui);
    if (_ui.bgEnabled) startBgRotation();
    else stopBgRotation();
  };

  document.querySelectorAll('.font-size-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.font-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFontSize(btn.dataset.size);
      playSound('tap');
    };
  });
}

function closeSettings() {
  const ov = document.getElementById('settings-overlay');
  if (!ov) return;
  ov.classList.remove('settings-overlay--open');
  setTimeout(() => ov.remove(), 300);
}

export function initSettings() {
  applyFontSize(_ui.fontSize);
  if (_ui.bgEnabled) startBgRotation();

  if (!document.getElementById('settings-fab')) {
    const btn = document.createElement('button');
    btn.id = 'settings-fab';
    btn.innerHTML = '⚙️';
    btn.title = 'Impostazioni';
    btn.onclick = openSettings;
    document.body.appendChild(btn);
  }
}

window._toggleFullscreen = function() {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    el.requestFullscreen?.() ||
    el.webkitRequestFullscreen?.() ||
    el.mozRequestFullScreen?.();
  } else {
    document.exitFullscreen?.() ||
    document.webkitExitFullscreen?.();
  }
};
