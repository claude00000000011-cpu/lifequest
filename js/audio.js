// ============================================================
// js/audio.js — Sistema audio LifeQuest
// BGM: file MP3 con rotazione e fallback
// SFX: file MP3 con fallback Web Audio API synth
// Impostazioni: volume BGM/SFX, mute, persistenza localStorage
// ============================================================

// ── Impostazioni (persistite in localStorage) ────────────────
const AUDIO_KEY = 'lq_audio_settings';

function loadAudioSettings() {
  try {
    return JSON.parse(localStorage.getItem(AUDIO_KEY)) || {};
  } catch { return {}; }
}

function saveAudioSettings(s) {
  localStorage.setItem(AUDIO_KEY, JSON.stringify(s));
}

let _settings = {
  bgmVolume: 0.4,
  sfxVolume: 0.7,
  bgmEnabled: true,
  sfxEnabled: true,
  ...loadAudioSettings()
};

export function getAudioSettings() { return { ..._settings }; }

export function updateAudioSettings(patch) {
  _settings = { ..._settings, ...patch };
  saveAudioSettings(_settings);
  _applyBgmVolume();
}

// ── Path asset ────────────────────────────────────────────────
const AUDIO_BASE = '/lifequest/assets/audio/';

// ── Mappa SFX: nome → file MP3 ───────────────────────────────
const SFX_MAP = {
  // Combattimento
  attack:          'sfx_attack.mp3',
  attack_enemy:    'sfx_attack_enemy.mp3',
  ability:         'sfx_ability.mp3',
  crit:            'sfx_crit.mp3',
  guard:           'sfx_guard.mp3',
  hit:             'sfx_hit.mp3',
  poison:          'sfx_poison.mp3',
  heal:            'sfx_heal.mp3',
  mana:            'sfx_mana.mp3',
  stun:            'sfx_stun.mp3',
  buff:            'sfx_buff.mp3',
  phase2:          'sfx_phase2.mp3',
  immunity:        'sfx_immunity.mp3',
  victory:         'sfx_victory.mp3',
  defeat:          'sfx_defeat.mp3',
  flee:            'sfx_flee.mp3',
  // Villaggio
  buy:             'sfx_buy.mp3',
  sell:            'sfx_sell.mp3',
  lootbox:         'sfx_lootbox.mp3',
  loot_rare:       'sfx_loot_rare.mp3',
  enhance:         'sfx_enhance.mp3',
  repair:          'sfx_repair.mp3',
  equip:           'sfx_equip.mp3',
  learn:           'sfx_learn.mp3',
  dungeon_enter:   'sfx_dungeon_enter.mp3',
  dungeon_complete:'sfx_dungeon_complete.mp3',
  next_room:       'sfx_next_room.mp3',
  // Sistema
  tap:             'sfx_tap.mp3',
  levelup:         'sfx_levelup.mp3',
  error:           'sfx_error.mp3',
  gold:            'sfx_gold.mp3',
  class_select:    'sfx_class_select.mp3',
  // Alias usati nel codice esistente
  xp:              'sfx_levelup.mp3',
  trophy:          'sfx_lootbox.mp3',
  challenge:       'sfx_dungeon_enter.mp3',
  login:           'sfx_tap.mp3',
  open:            'sfx_tap.mp3',
  quest:           'sfx_tap.mp3',
  like:            'sfx_tap.mp3',
};

// ── BGM: tracce per schermata ─────────────────────────────────
// Se una traccia manca → si usa l'altra in rotazione
const BGM_TRACKS = {
  village:  ['bgm_village .mp3'],   // nota: spazio nel nome tuo file!
  battle:   ['bgm_battle.mp3'],
  // Per ora solo 2 BGM — le schermate non-battle usano bgm_village
  // Quando aggiungi i file mancanti, aggiungi qui:
  // merchant: ['bgm_merchant.mp3'],
  // smith:    ['bgm_smith.mp3'],
  // dungeon:  ['bgm_dungeon.mp3'],
  // boss:     ['bgm_boss.mp3'],
};

// Mappa schermata/tab → quale BGM usare
const SCREEN_BGM = {
  // Tab village
  map:       'village',
  merchant:  'village',   // fallback finché non hai bgm_merchant
  port:      'village',   // fallback finché non hai bgm_dungeon
  smith:     'village',   // fallback finché non hai bgm_smith
  academy:   'village',
  inventory: 'village',
  // Combattimento
  battle:    'battle',
  boss:      'battle',    // fallback finché non hai bgm_boss
  // Schermate app principale
  home:      'village',
  quest:     'village',
  study:     'village',
  routine:   'village',
  pvp:       'village',
  libri:     'village',
  social:    'village',
  stats:     'village',
};

// ── Stato BGM ─────────────────────────────────────────────────
let _bgmAudio    = null;
let _bgmCurrent  = null;   // chiave in BGM_TRACKS
let _bgmTrackIdx = 0;

function _getBgmSrc(key) {
  const tracks = BGM_TRACKS[key];
  if (!tracks?.length) return null;
  // Rotazione se più tracce
  const idx = _bgmTrackIdx % tracks.length;
  return AUDIO_BASE + tracks[idx];
}

function _applyBgmVolume() {
  if (_bgmAudio) {
    _bgmAudio.volume = _settings.bgmEnabled ? _settings.bgmVolume : 0;
  }
}

/**
 * Avvia la BGM per una schermata/tab.
 * Se è già in play la stessa traccia, non fa nulla.
 * @param {string} screen — chiave in SCREEN_BGM
 */
export function playBgm(screen) {
  if (!_settings.bgmEnabled) return;

  const bgmKey = SCREEN_BGM[screen] || 'village';
  if (_bgmCurrent === bgmKey && _bgmAudio && !_bgmAudio.paused) return;

  _bgmCurrent = bgmKey;
  const src = _getBgmSrc(bgmKey);
  if (!src) return;

  if (_bgmAudio) {
    _bgmAudio.pause();
    _bgmAudio.src = '';
  }

  _bgmAudio = new Audio(src);
  _bgmAudio.loop = true;
  _bgmAudio.volume = _settings.bgmVolume;
  _bgmAudio.play().catch(() => {
    // Autoplay bloccato — riprova al prossimo click utente
    const resume = () => {
      _bgmAudio?.play().catch(() => {});
      document.removeEventListener('click', resume);
      document.removeEventListener('touchstart', resume);
    };
    document.addEventListener('click', resume, { once: true });
    document.addEventListener('touchstart', resume, { once: true });
  });

  // Rotazione traccia per la prossima volta
  _bgmAudio.addEventListener('ended', () => {
    _bgmTrackIdx++;
    playBgm(screen);
  });
}

export function stopBgm() {
  if (_bgmAudio) {
    _bgmAudio.pause();
    _bgmAudio.src = '';
    _bgmAudio = null;
    _bgmCurrent = null;
  }
}

export function pauseBgm() {
  _bgmAudio?.pause();
}

export function resumeBgm() {
  if (_settings.bgmEnabled && _bgmAudio) {
    _bgmAudio.play().catch(() => {});
  }
}

// ── SFX cache ─────────────────────────────────────────────────
const _sfxCache = {};

function _getSfxAudio(name) {
  const file = SFX_MAP[name];
  if (!file) return null;
  if (!_sfxCache[name]) {
    _sfxCache[name] = new Audio(AUDIO_BASE + file);
  }
  return _sfxCache[name];
}

// ── Synth fallback ────────────────────────────────────────────
let _ctx = null;

function getCtx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

const SYNTH_DEFS = {
  tap:       { freq: 440,  dur: 0.08, type: 'sine',     vol: 0.15 },
  xp:        { freq: 523,  dur: 0.15, type: 'triangle', vol: 0.20, sweep: 660 },
  levelup:   { freq: 523,  dur: 0.6,  type: 'triangle', vol: 0.30, sweep: 1047, arp: [523,659,784,1047] },
  trophy:    { freq: 660,  dur: 0.5,  type: 'triangle', vol: 0.25, sweep: 880 },
  like:      { freq: 480,  dur: 0.10, type: 'sine',     vol: 0.12, sweep: 560 },
  error:     { freq: 220,  dur: 0.20, type: 'sawtooth', vol: 0.15 },
  open:      { freq: 380,  dur: 0.12, type: 'sine',     vol: 0.10, sweep: 420 },
  quest:     { freq: 600,  dur: 0.20, type: 'triangle', vol: 0.20, sweep: 750 },
  challenge: { freq: 300,  dur: 0.30, type: 'sawtooth', vol: 0.18, sweep: 450 },
  login:     { freq: 440,  dur: 0.40, type: 'triangle', vol: 0.20, sweep: 660, arp: [440,550,660] },
};

function _playSynth(name) {
  const def = SYNTH_DEFS[name];
  if (!def) return;
  const ctx = getCtx();
  if (def.arp) {
    const stepDur = def.dur / def.arp.length;
    def.arp.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = def.type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * stepDur);
      gain.gain.setValueAtTime(def.vol * _settings.sfxVolume, ctx.currentTime + i * stepDur);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (i + 1) * stepDur);
      osc.start(ctx.currentTime + i * stepDur);
      osc.stop(ctx.currentTime + (i + 1) * stepDur);
    });
    return;
  }
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = def.type;
  osc.frequency.setValueAtTime(def.freq, ctx.currentTime);
  if (def.sweep) osc.frequency.exponentialRampToValueAtTime(def.sweep, ctx.currentTime + def.dur);
  gain.gain.setValueAtTime(def.vol * _settings.sfxVolume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + def.dur);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + def.dur + 0.05);
}

// ── API pubblica ──────────────────────────────────────────────
/**
 * Riproduce un SFX per nome.
 * Tenta il file MP3, poi cade sul synth.
 */
export function playSound(name) {
  if (!_settings.sfxEnabled) return;

  const audio = _getSfxAudio(name);
  if (audio) {
    audio.volume = _settings.sfxVolume;
    audio.currentTime = 0;
    audio.play().catch(() => {
      try { _playSynth(name); } catch(e) {}
    });
    return;
  }
  try { _playSynth(name); } catch(e) {}
}
