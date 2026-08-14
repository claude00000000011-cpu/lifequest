// ============================================================
// trophies.js — Definizioni trofei e logica di sblocco
// ============================================================

import { DB, CUR, persist } from './db.js';
import { toast } from './utils.js';
import { playSound } from './audio.js';
import { Users } from './api.js';

// ── Tier ─────────────────────────────────────────────────────
// bronze / silver / gold

export const TROPHY_DEFS = [

  // ── Quest ─────────────────────────────────────────────────
  { id: 'first_quest',   tier: 'bronze', label: '🎯 Prima Quest',        desc: 'Completa la tua prima quest.',              check: u => u._completedQuests >= 1 },
  { id: 'quests_10',     tier: 'bronze', label: '⚔️ Avventuriero',        desc: 'Completa 10 quest.',                        check: u => u._completedQuests >= 10 },
  { id: 'quests_50',     tier: 'silver', label: '🏹 Cacciatore',          desc: 'Completa 50 quest.',                        check: u => u._completedQuests >= 50 },
  { id: 'quests_100',    tier: 'gold',   label: '🗡️ Veterano',            desc: 'Completa 100 quest. Sei un guerriero.',     check: u => u._completedQuests >= 100 },
  { id: 'quests_250',    tier: 'gold',   label: '👑 Leggenda delle Quest', desc: 'Completa 250 quest.',                      check: u => u._completedQuests >= 250 },

  // ── Streak ────────────────────────────────────────────────
  { id: 'streak_3',      tier: 'bronze', label: '🔥 Fiamma Viva',         desc: 'Streak di 3 giorni consecutivi.',           check: u => u.streak >= 3 },
  { id: 'streak_7',      tier: 'silver', label: '🔥 Settimana di Fuoco',  desc: 'Streak di 7 giorni consecutivi.',           check: u => u.streak >= 7 },
  { id: 'streak_14',     tier: 'silver', label: '💥 Fuoco Sacro',         desc: 'Streak di 14 giorni consecutivi.',          check: u => u.streak >= 14 },
  { id: 'streak_30',     tier: 'gold',   label: '🌋 Leggenda Quotidiana', desc: 'Streak di 30 giorni. Inarrestabile.',       check: u => u.streak >= 30 },

  // ── Livello ───────────────────────────────────────────────
  { id: 'level_5',       tier: 'bronze', label: '⭐ Apprendista',          desc: 'Raggiungi il livello 5.',                   check: u => u.level >= 5 },
  { id: 'level_10',      tier: 'bronze', label: '⭐ Guerriero',            desc: 'Raggiungi il livello 10.',                  check: u => u.level >= 10 },
  { id: 'level_25',      tier: 'silver', label: '🌟 Campione',             desc: 'Raggiungi il livello 25.',                  check: u => u.level >= 25 },
  { id: 'level_50',      tier: 'silver', label: '🌟 Maestro',              desc: 'Raggiungi il livello 50.',                  check: u => u.level >= 50 },
  { id: 'level_100',     tier: 'gold',   label: '💫 Gran Maestro',         desc: 'Raggiungi il livello 100.',                 check: u => u.level >= 100 },

  // ── XP ────────────────────────────────────────────────────
  { id: 'xp_1000',       tier: 'bronze', label: '💎 Diamante Verde',       desc: 'Accumula 1.000 XP totali.',                 check: u => u.xp >= 1000 },
  { id: 'xp_10000',      tier: 'silver', label: '💎 Diamante Blu',         desc: 'Accumula 10.000 XP totali.',                check: u => u.xp >= 10000 },
  { id: 'xp_100000',     tier: 'gold',   label: '💎 Diamante Viola',       desc: 'Accumula 100.000 XP totali.',               check: u => u.xp >= 100000 },

  // ── Studio ────────────────────────────────────────────────
  { id: 'first_study',   tier: 'bronze', label: '📚 Prima Sessione',       desc: 'Registra la tua prima sessione di studio.', check: u => u._totalStudySessions >= 1 },
  { id: 'study_10',      tier: 'bronze', label: '🧠 Studioso',             desc: '10 sessioni di studio completate.',         check: u => u._totalStudySessions >= 10 },
  { id: 'study_50',      tier: 'silver', label: '🎓 Accademico',           desc: '50 sessioni di studio completate.',         check: u => u._totalStudySessions >= 50 },
  { id: 'study_hours_24',tier: 'silver', label: '⏱️ 24 Ore di Studio',     desc: 'Accumula 24 ore totali di studio.',         check: u => u._totalStudyMinutes >= 1440 },
  { id: 'study_hours_100',tier:'gold',   label: '🏛️ Erudito Supremo',      desc: 'Accumula 100 ore totali di studio.',        check: u => u._totalStudyMinutes >= 6000 },

  // ── Libri ─────────────────────────────────────────────────
  { id: 'first_book',    tier: 'bronze', label: '📖 Lettore',              desc: 'Completa il tuo primo libro.',              check: u => u._completedBooks >= 1 },
  { id: 'books_5',       tier: 'silver', label: '📚 Bibliofilo',           desc: 'Completa 5 libri.',                         check: u => u._completedBooks >= 5 },
  { id: 'books_20',      tier: 'gold',   label: '🏛️ Erudito',              desc: 'Completa 20 libri.',                        check: u => u._completedBooks >= 20 },

  // ── Routine ───────────────────────────────────────────────
  { id: 'first_routine', tier: 'bronze', label: '⚡ Prima Routine',        desc: 'Completa la tua prima routine.',            check: u => u._totalRoutines >= 1 },
  { id: 'routine_30',    tier: 'bronze', label: '🧘 Abitudini Solide',     desc: '30 routine completate in totale.',          check: u => u._totalRoutines >= 30 },
  { id: 'routine_100',   tier: 'silver', label: '⚡ Costante',             desc: '100 routine completate in totale.',         check: u => u._totalRoutines >= 100 },
  { id: 'routine_365',   tier: 'gold',   label: '🤖 Macchina Perfetta',    desc: '365 routine completate. Sei una forza.',    check: u => u._totalRoutines >= 365 },

  // ── PvP ───────────────────────────────────────────────────
  { id: 'first_pvp',     tier: 'bronze', label: '⚔️ Gladiatore',           desc: 'Vinci la tua prima sfida PvP.',             check: u => u._pvpWins >= 1 },
  { id: 'pvp_5',         tier: 'silver', label: '🏆 Campione PvP',         desc: 'Vinci 5 sfide PvP.',                        check: u => u._pvpWins >= 5 },
  { id: 'pvp_20',        tier: 'gold',   label: '👑 Re dell\'Arena',        desc: 'Vinci 20 sfide PvP.',                       check: u => u._pvpWins >= 20 },

  // ── Social ────────────────────────────────────────────────
  { id: 'first_follow',  tier: 'bronze', label: '👥 Sociale',              desc: 'Segui il tuo primo utente.',                check: u => (u.following?.length || 0) >= 1 },
  { id: 'followers_10',  tier: 'silver', label: '🌟 Influencer',           desc: 'Raggiungi 10 follower.',                    check: u => (u.followers?.length || 0) >= 10 },
  { id: 'followers_50',  tier: 'gold',   label: '🚀 Star',                 desc: 'Raggiungi 50 follower.',                    check: u => (u.followers?.length || 0) >= 50 },
];

// ── Colori tier ───────────────────────────────────────────────
export const TIER_STYLE = {
  bronze: { bg: 'rgba(180,100,30,0.18)', border: '#cd7f32', color: '#e8a96a', label: 'Bronzo' },
  silver: { bg: 'rgba(160,160,180,0.18)', border: '#a8a9ad', color: '#d0d0e0', label: 'Argento' },
  gold:   { bg: 'rgba(200,160,0,0.22)',  border: '#ffd700', color: '#ffd700', label: 'Oro' },
};

// ── Stato derivato ────────────────────────────────────────────

function enrichUser(user) {
  const userId = user.id;

  const completedQuests = DB.quests.filter(q => q.userId === userId && q.completed).length;
  const completedBooks  = DB.books.filter(b => b.userId === userId && b.completed).length;
  const totalRoutines   = DB.routineLogs.filter(r => r.userId === userId).length;
  const pvpWins         = DB.challenges.filter(c => c.winnerId === userId).length;
  const totalStudySessions = DB.studySessions.filter(s => s.userId === userId).length;
  const totalStudyMinutes  = DB.studySessions
    .filter(s => s.userId === userId)
    .reduce((sum, s) => sum + (s.minutes || 0), 0);

  return {
    ...user,
    _completedQuests:    completedQuests,
    _completedBooks:     completedBooks,
    _totalRoutines:      totalRoutines,
    _pvpWins:            pvpWins,
    _totalStudySessions: totalStudySessions,
    _totalStudyMinutes:  totalStudyMinutes,
  };
}

// ── Check e assegnazione ──────────────────────────────────────

export function checkTrophies() {
  if (!CUR) return;
  const user = DB.users[CUR.id];
  if (!user) return;

  const enriched = enrichUser(user);
  const current  = new Set(user.trophies || []);
  const newOnes  = [];

  for (const def of TROPHY_DEFS) {
    if (current.has(def.id)) continue;
    try { if (def.check(enriched)) newOnes.push(def.id); } catch { }
  }

  if (!newOnes.length) return;

  const updatedTrophies = [...current, ...newOnes];
  DB.users[CUR.id].trophies = updatedTrophies;
  persist();

  newOnes.forEach((id, i) => {
    const def = TROPHY_DEFS.find(d => d.id === id);
    if (!def) return;
    const ts = TIER_STYLE[def.tier];
    setTimeout(() => {
      playSound('trophy');
      toast(`${def.label} — ${def.desc}`, 'success');
    }, i * 800);
  });

  Users.update(CUR.id, { trophies: updatedTrophies });
}

// ── Render modale trofei ──────────────────────────────────────

export function renderTrophiesModal(trophyIds = [], username = '') {
  const container = document.getElementById('modal-trophies-content');
  if (!container) return;

  const byTier = { gold: [], silver: [], bronze: [] };
  for (const id of trophyIds) {
    const def = TROPHY_DEFS.find(d => d.id === id);
    if (def) byTier[def.tier].push(def);
  }

  container.innerHTML = `
    <div style="font-family:var(--font-pixel);font-size:0.35rem;color:var(--text-3);margin-bottom:0.75rem;letter-spacing:0.5px">
      ${username ? `Trofei di @${username}` : 'I tuoi trofei'} — totale: ${trophyIds.length}
    </div>
    ${['gold','silver','bronze'].map(tier => {
      const defs = byTier[tier];
      if (!defs.length) return '';
      const ts = TIER_STYLE[tier];
      return `
        <div style="margin-bottom:1rem">
          <div style="font-family:var(--font-pixel);font-size:0.32rem;color:${ts.color};
                      letter-spacing:0.5px;margin-bottom:0.4rem;text-transform:uppercase">
            ── ${ts.label} (${defs.length}) ──
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${defs.map(def => `
              <button onclick="window._showTrophyDetail?.('${def.id}')"
                style="background:${ts.bg};border:1px solid ${ts.border};
                       padding:0.4rem 0.6rem;cursor:pointer;
                       font-family:var(--font-pixel);font-size:0.7rem;
                       color:${ts.color};position:relative"
                title="${def.label} — ${def.desc}">
                ${def.label.split(' ')[0]}
              </button>`).join('')}
          </div>
        </div>`;
    }).join('')}
    <div id="trophy-detail-box" style="display:none;margin-top:0.75rem;
         background:rgba(10,10,26,0.9);border:1px solid var(--gold-dark);padding:0.75rem">
    </div>
  `;
}

window._showTrophyDetail = function(id) {
  const def = TROPHY_DEFS.find(d => d.id === id);
  if (!def) return;
  const ts  = TIER_STYLE[def.tier];
  const box = document.getElementById('trophy-detail-box');
  if (!box) return;
  box.style.display = 'block';
  box.style.borderColor = ts.border;
  box.innerHTML = `
    <div style="font-family:var(--font-pixel);font-size:0.55rem;color:${ts.color};
                margin-bottom:0.35rem;text-shadow:1px 1px 0 #000">
      ${def.label}
    </div>
    <div style="font-family:var(--font-pixel);font-size:0.32rem;color:var(--text-2);
                line-height:2;letter-spacing:0.3px">
      ${def.desc}
    </div>
    <div style="font-family:var(--font-pixel);font-size:0.28rem;color:${ts.color};
                margin-top:0.35rem;opacity:0.7">
      Tier: ${ts.label}
    </div>
  `;
};
