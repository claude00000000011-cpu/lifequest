// ============================================================
// config.js — Costanti globali di LifeQuest
// ============================================================

export const DB_KEY        = 'lq_db_v5';
export const SESSION_KEY   = 'lq_cur_v5';
export const SESSION_KEYS  = ['lq_cur_v5','lq_cur_v4','lq_cur_v3','lq_cur_v2'];

// Backend — sostituire con URL Supabase nella Fase 2
export const API_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';

// ── Livelli & Ranghi ────────────────────────────────────────
export const RANK_TITLES = [
  'Novizio', 'Apprendista', 'Avventuriero', 'Guerriero',
  'Veterano', 'Campione', 'Leggenda', 'Maestro',
  'Gran Maestro', 'Dio degli Eroi',
];

// ── Libri ───────────────────────────────────────────────────
export const XP_BOOK_PER_PAGE = 0.5;
export const BOOK_DIFF_BONUS  = [1, 1.2, 1.5, 1.8, 2.2];
export const BOOK_GENRE_STAT  = {
  narrativa: 'cultura', saggistica: 'mente', filosofia: 'mente',
  storia: 'cultura', scienza: 'mente', fantasy: 'cultura',
  biografia: 'sociale', economia: 'mente', arte: 'cultura',
  sport: 'corpo', psicologia: 'sociale', tecnologia: 'mente',
};

// ── Difficoltà ──────────────────────────────────────────────
export const DIFF_MULT = [1, 1.3, 1.7, 2.2, 3.0];

// ── Categorie → Statistiche ─────────────────────────────────
export const CAT_STAT = {
  studio: 'mente', lettura: 'cultura', fitness: 'corpo',
  meditazione: 'mente', sociale: 'sociale', creatività: 'cultura',
  lavoro: 'mente', sfida: 'sfide', routine: 'corpo',
};

export const STAT_COLORS = {
  mente:    '#7c3aed',
  corpo:    '#16a34a',
  cultura:  '#d97706',
  sociale:  '#db2777',
  sfide:    '#dc2626',
  produttività: '#0891b2',
};

// ── Frasi motivazionali ─────────────────────────────────────
export const MOTIVS = [
  '🔥 Ogni giorno è un\'opportunità per diventare più forte.',
  '⚔️ Il tuo unico avversario è chi eri ieri.',
  '🌟 Piccoli progressi ogni giorno portano a grandi risultati.',
  '🧠 La disciplina è la libertà più alta.',
  '🏆 Non aspettare il momento perfetto. Agisci ora.',
  '💡 Chi studia non smette mai di crescere.',
  '🌱 Ogni abitudine costruisce il tuo futuro.',
  '⚡ La costanza batte il talento ogni volta.',
  '🎯 Definisci il tuo obiettivo. Inseguilo senza sosta.',
  '🛡️ La resilienza si allena, non si possiede.',
];

// ── Routine predefinite ─────────────────────────────────────
export const ROUTINE_ITEMS = [
  { id: 'meditation',   emoji: '🧘', name: 'Meditazione',      category: 'meditazione', xpValue: 15 },
  { id: 'workout',      emoji: '💪', name: 'Allenamento',       category: 'fitness',     xpValue: 25 },
  { id: 'run',          emoji: '🏃', name: 'Corsa',             category: 'fitness',     xpValue: 20 },
  { id: 'journal',      emoji: '📔', name: 'Diario',            category: 'creatività',  xpValue: 10 },
  { id: 'cold_shower',  emoji: '🚿', name: 'Doccia fredda',     category: 'fitness',     xpValue: 15 },
  { id: 'reading',      emoji: '📚', name: 'Lettura (30 min)',  category: 'lettura',     xpValue: 20 },
  { id: 'gratitude',    emoji: '🙏', name: 'Gratitudine',       category: 'meditazione', xpValue: 10 },
  { id: 'stretch',      emoji: '🤸', name: 'Stretching',        category: 'fitness',     xpValue: 10 },
  { id: 'noscreen',     emoji: '📵', name: 'No schermo (1h)',   category: 'meditazione', xpValue: 20 },
  { id: 'water',        emoji: '💧', name: 'Bevi 2L d\'acqua',  category: 'fitness',     xpValue: 10 },
  { id: 'sleep',        emoji: '😴', name: 'Sonno 8h',          category: 'fitness',     xpValue: 15 },
  { id: 'socialize',    emoji: '👥', name: 'Socializza',        category: 'sociale',     xpValue: 15 },
];

// ── Lingue supportate ───────────────────────────────────────
export const LANGUAGES = [
  '🇮🇹 Italiano', '🇬🇧 English', '🇪🇸 Español', '🇫🇷 Français',
  '🇩🇪 Deutsch',  '🇵🇹 Português', '🇷🇺 Русский', '🇨🇳 中文',
  '🇯🇵 日本語',   '🇦🇷 العربية',  '🇰🇷 한국어',   '🇳🇱 Nederlands',
];

// ── Generi letterari ────────────────────────────────────────
export const BOOK_GENRES = [
  'narrativa','saggistica','filosofia','storia','scienza',
  'fantasy','biografia','economia','arte','sport','psicologia','tecnologia',
];

// ── Trofei ──────────────────────────────────────────────────
// (definiti in trophies.js, qui solo i tipi per reference)
export const TROPHY_CATEGORIES = [
  'quest','streak','level','xp','books','routine','pvp','social',

  
  
];


// ── Sistema XP Scaling ───────────────────────────────────────
// XP base moltiplicato per (1 + livello * LVL_SCALE_FACTOR)
export const LVL_SCALE_FACTOR = 0.15;  // era 0.08

export const DAILY_XP_CAPS = {
  lettura:    { maxUnits: 300,  unitLabel: 'pagine'  },
  studio:     { maxUnits: 240,  unitLabel: 'minuti'  },  // era 180
  fitness:    { maxUnits: 120,  unitLabel: 'minuti'  },
  meditazione:{ maxUnits: 90,   unitLabel: 'minuti'  },  // era 60
  routine:    { maxUnits: 3,    unitLabel: 'volte'   },
  sociale:    { maxUnits: 5,    unitLabel: 'azioni'  },  // era 3
  creatività: { maxUnits: 5,    unitLabel: 'azioni'  },  // era 3
  sfide:      { maxUnits: 9999, unitLabel: ''        },
};
