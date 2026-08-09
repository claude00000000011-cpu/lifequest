// ============================================================
// audio.js — Sistema audio (Web Audio API + fallback synth)
// ============================================================

let _ctx = null;

/** Inizializza o restituisce l'AudioContext (lazy, sblocca su user gesture) */
function getCtx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (_ctx.state === 'suspended') {
    _ctx.resume();
  }
  return _ctx;
}

// ── Definizioni dei suoni sintetici ─────────────────────────

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

/**
 * Riproduce una nota sintetizzata.
 * @param {string} name — chiave in SYNTH_DEFS
 */
function _playSynth(name) {
  const def = SYNTH_DEFS[name];
  if (!def) return;

  const ctx = getCtx();

  if (def.arp) {
    // Arpeggio
    const stepDur = def.dur / def.arp.length;
    def.arp.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = def.type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * stepDur);
      gain.gain.setValueAtTime(def.vol, ctx.currentTime + i * stepDur);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (i + 1) * stepDur);
      osc.start(ctx.currentTime + i * stepDur);
      osc.stop(ctx.currentTime + (i + 1) * stepDur);
    });
    return;
  }

  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = def.type;
  osc.frequency.setValueAtTime(def.freq, ctx.currentTime);
  if (def.sweep) {
    osc.frequency.exponentialRampToValueAtTime(def.sweep, ctx.currentTime + def.dur);
  }

  gain.gain.setValueAtTime(def.vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + def.dur);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + def.dur + 0.05);
}

/**
 * Riproduce un suono per nome.
 * Prima tenta l'elemento <audio> (se presente nel DOM),
 * poi cade sul sintetizzatore.
 * @param {string} name — es. 'tap', 'xp', 'levelup'
 */
export function playSound(name) {
  // Tenta elemento audio precaricato
  const el = document.getElementById(`snd-${name}`);
  if (el) {
    el.currentTime = 0;
    el.play().catch(() => _playSynth(name));
    return;
  }
  // Fallback sintetizzatore
  try {
    _playSynth(name);
  } catch (e) {
    // Audio non supportato — ignora silenziosamente
    console.debug('[Audio] playSound failed:', e.message);
  }
}
