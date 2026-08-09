# LifeQuest — Documento di Contesto per Istanze AI

> Condividi questo file invece dei sorgenti. Contiene tutto il necessario per lavorare sul progetto senza ambiguità.

---

## 1. Cos'è LifeQuest

PWA di gamification della vita quotidiana. L'utente accumula XP completando quest, sessioni di studio, lettura, routine e sfide PvP. Il sistema assegna livelli, streak, statistiche per categoria e trofei.

**Stack attuale (Fase 1):** Vanilla JS ES2022+ con moduli nativi, CSS custom properties, localStorage come database, deploy su GitHub Pages. Nessun bundler, nessun framework.

**Stack futuro (Fase 2):** Supabase (PostgreSQL + Auth + Realtime + Storage) al posto del localStorage. Il codice delle screen e dei moduli non dovrà cambiare — solo `api.js` verrà riscritto.

---

## 2. Struttura file del repository

```
lifequest/
├── index.html                  ← Entry point, struttura DOM minima
├── manifest.json               ← PWA manifest
├── sw.js                       ← Service Worker
├── LIFEQUEST_AI_CONTEXT.md     ← Questo file
│
├── .github/workflows/
│   └── deploy.yml              ← GitHub Actions → GitHub Pages
│
├── css/
│   ├── style.css               ← CSS variables + stili globali
│   ├── components.css          ← Card, modal, toast, bottom nav
│   └── animations.css          ← Keyframes e transizioni
│
├── js/
│   ├── main.js                 ← Boot, DOMContentLoaded, binding globali
│   ├── config.js               ← Costanti globali
│   ├── db.js                   ← LocalDB (localStorage) + sessione
│   ├── api.js                  ← Layer API (oggi localStorage, domani Supabase)
│   ├── auth.js                 ← Login, Register, Logout, PIN reset
│   ├── audio.js                ← Web Audio API + playSound()
│   ├── utils.js                ← uid, ts, today, hashStr, escHtml, toast, ecc.
│   ├── xp.js                   ← awardXP, calcLevel, streakMult, rankTitle
│   ├── trophies.js             ← TROPHY_DEFS, checkTrophies
│   ├── modals.js               ← openModal, closeModal
│   └── screens/
│       ├── home.js             ← renderHome, loadAndRenderFeed, gotoTab
│       ├── quest.js            ← renderQuests, addQuest, toggleQuest
│       ├── study.js            ← renderStudy, renderExams, logSession
│       ├── routine.js          ← renderRoutine, doRoutine, saveCustomRoutine
│       ├── pvp.js              ← renderPvP, createChallenge, joinChallenge
│       ├── books.js            ← renderBooks, addBook, logReading
│       ├── libri.js            ← renderLibri, renderDiscussioni, createDiscussion
│       ├── social.js           ← renderFriendsScreen, searchUsers, follow/unfollow
│       └── stats.js            ← renderStats, renderLeaderboard, renderPersonalCalendar
│
├── assets/
│   ├── audio/                  ← tap.mp3(*), xp.mp3, levelup.mp3, login.mp3, ecc.
│   │   └── README.md           ← note sui file audio
│   ├── icons/                  ← icon-192.png, icon-512.png, icon-512-maskable.png
│   │   └── icon-source.svg     ← sorgente SVG per rigenerare le icone
│   └── img/                    ← logo.svg, avatar-placeholder.svg
│
├── db/
│   ├── schema.sql              ← DDL completo Supabase
│   ├── rls.sql                 ← Row Level Security policies
│   └── seed.sql                ← Dati iniziali
│
└── docs/
    ├── ARCHITECTURE.md         ← Panoramica architettura
    ├── API_CONTRACT.md         ← Contratto API completo con strutture dati
    └── CHANGELOG.md            ← Storico modifiche
```

(*) `tap.mp3` va aggiunto manualmente, vedi `assets/audio/README.md`

---

## 3. config.js — Costanti globali

```js
DB_KEY       = 'lq_db_v5'      // chiave localStorage del DB
SESSION_KEY  = 'lq_cur_v5'     // chiave sessione utente corrente
SESSION_KEYS = ['lq_cur_v5', 'lq_cur_v4', ...]  // per migrazione versioni

RANK_TITLES  // array 10 titoli: 'Novizio' → 'Dio degli Eroi'
             // assegnati ogni 10 livelli

DIFF_MULT    // [1, 1.3, 1.7, 2.2, 3.0] — moltiplicatori difficoltà 1-5

CAT_STAT     // mappa categoria → statistica
             // es. 'studio'→'mente', 'fitness'→'corpo', 'lettura'→'cultura'

STAT_COLORS  // { mente:'#7c3aed', corpo:'#16a34a', cultura:'#d97706',
             //   sociale:'#db2777', sfide:'#dc2626' }

XP_BOOK_PER_PAGE = 0.5
BOOK_DIFF_BONUS  = [1, 1.2, 1.5, 1.8, 2.2]
BOOK_GENRE_STAT  // mappa genere letterario → statistica

ROUTINE_ITEMS    // 12 routine predefinite con { id, emoji, name, category, xp }

MOTIVS           // array 10 frasi motivazionali
LANGUAGES        // 12 lingue con flag emoji
BOOK_GENRES      // 12 generi letterari
TROPHY_CATEGORIES // ['quest','streak','level','xp','books','routine','pvp','social']
```

---

## 4. db.js — Database locale

### Struttura del DB (localStorage, chiave `lq_db_v5`)

```js
DB = {
  version: 5,
  users:            {},   // { [userId]: UserObject }
  quests:           [],
  exams:            [],
  studySessions:    [],
  books:            [],
  readingSessions:  [],
  challenges:       [],
  feedPosts:        [],
  routines:         [],   // include le 12 default + custom
  routineLogs:      [],
  comments:         [],
  globalBooks:      [],
  discussions:      [],
  discussionReplies:[],
  bannedWords:      [],
}
```

### Struttura UserObject

```js
{
  id, username, passwordHash, pinHash,
  xp, level, streak, lastActive,   // lastActive: 'YYYY-MM-DD'
  rankTitle, isPublic,
  languages: [],
  stats: { mente, corpo, cultura, sociale, sfide },
  trophies: [],
  following: [],
  followers: [],
  avatarUrl: null,
  createdAt: ISO string
}
```

### Export principali di db.js

```js
DB, CUR                           // singleton globali
persist()                         // salva DB su localStorage
setCUR(user)                      // aggiorna CUR + sessione
refreshCUR()                      // rilegge CUR da DB.users[CUR.id]
findById(collection, id)
insert(collection, record)
update(collection, id, patch)     // ritorna record aggiornato
remove(collection, id)            // ritorna bool
byUser(collection, userId)
mergeUserData(local, remote)      // numeri→MAX, array→UNION
byDate(collection, dateStr)
uniqueDates(collection)
```

---

## 5. api.js — Layer API

**Contratto:** ogni metodo restituisce `Promise<{ ok, data, error }>`.

```js
Auth         // register, login, resetPin
Users        // get, update, search, getLeaderboard, follow, unfollow
Quests       // list, create, complete, delete
Study        // getExams, createExam, updateExam, logSession
Books        // list, create, update, logReading, getGlobalBooks, addGlobalBook
Routines     // list, log, createCustom
Challenges   // list, listPublic, create, join, declareWinner
Feed         // get, create, toggleLike, getComments, addComment
Discussions  // list, create, addReply, toggleLike
Moderation   // getBannedWords
syncCloudDataOnLogin(userId)
```

Per strutture dati complete vedi `docs/API_CONTRACT.md`.

---

## 6. xp.js

```js
xpForLevel(lvl)      // floor(100 * lvl^1.5)
calcLevel(xp)        // livello da XP totale
xpBarPct(xp)         // % 0-100 verso prossimo livello
rankTitle(lvl)       // stringa da RANK_TITLES
streakMult(streak)   // 3d→1.1 | 7d→1.2 | 14d→1.35 | 30d→1.5
awardXP(baseXP, category)
  // aggiorna streak → applica mult → aggiorna user → feedback visivo → sync
buildUserPayload(user)  // strip passwordHash/pinHash
```

---

## 7. utils.js

```js
uid(), ts(), today(), timeAgo(timestamp)
hashStr(str)              // Promise<sha256-hex>
escHtml(str)              // sanitizza XSS
diffStars(level)          // '★★★☆☆'
toast(msg, type)          // 'success'|'error'|'info'
setLoading(show, msg)
spawnXPFloat(xp, color)
compressImage(file, maxW, quality)
pickImage(maxMB)
checkBannedWords(text, bannedWords)
clamp(val, min, max)
capitalize(str)
debounce(fn, wait)
groupBy(arr, key)
```

---

## 8. auth.js

```js
switchAuthTab('login'|'register')
doRegister()    // #reg-username, #reg-password, #reg-pin
doLogin()       // #login-username, #login-password
doResetPin()    // #reset-username, #reset-pin, #reset-newpass
doLogout()
```

---

## 9. main.js — Boot e DOM richiesto

**Flusso boot:** DOMContentLoaded → initModals → hideSplash(1.5s) → loadSession → bootApp o auth-screen

**ID DOM richiesti:**
- `#splash`, `#auth-screen`, `#app-main`
- `#btn-login`, `#btn-register`, `#btn-reset-pin`
- `.auth-tab-btn[data-tab]`, `.auth-panel[data-panel]`
- `.nav-btn[data-tab]`
- `#login-username`, `#login-password`, `#reg-username`, `#reg-password`, `#reg-pin`

**Funzioni globali `window._*`:** vedi main.js per lista completa.

---

## 10. CSS — Variables principali

```css
--bg:#0f0f1a  --bg-2:#16162a  --bg-3:#1e1e35
--surface:#252540  --border:#3a3a60
--accent:#7c3aed  --accent-light:#9f67ff
--success:#16a34a  --warning:#d97706  --danger:#dc2626
--text:#f0f0ff  --text-2:#a0a0c0  --text-3:#6060a0
--nav-height:64px  --radius:12px  --radius-lg:20px  --radius-sm:8px
```

**Classi chiave:** `.screen`, `.screen--hidden`, `.screen-header`, `.bottom-nav`, `.nav-btn--active`, `.hero-card`, `.xp-bar__fill`, `.stats-mini`, `.section-title`, `.empty-state`, `.toast--visible`

---

## 11. Audio

```js
playSound('tap')       // feedback tocco (⚠️ tap.mp3 mancante)
playSound('xp')        // XP guadagnato
playSound('levelup')   // level up
playSound('login')     // login/registrazione
playSound('quest')     // quest completata
playSound('trophy')    // trofeo sbloccato
playSound('like')      // like su post
playSound('challenge') // sfida PvP
playSound('open')      // apertura modale
playSound('error')     // errore
```

---

## 12. Convenzioni

1. Non modificare il contratto di `api.js` — solo le implementazioni
2. Zero dipendenze esterne, zero bundler in Fase 1
3. Import relativi sempre (`./db.js`, `../api.js`)
4. Sempre `escHtml()` su input utente nell'HTML
5. Sempre `persist()` dopo aver modificato `DB`
6. `index.html` è solo struttura — tutto iniettato da JS
7. Le screen non importano da altre screen
8. I modali si aprono solo con `openModal(id)`
9. `awardXP()` è l'unico punto di assegnazione XP
10. Feedback: `toast()` + `spawnXPFloat()` + `playSound()`
