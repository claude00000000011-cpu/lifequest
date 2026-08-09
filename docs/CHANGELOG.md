# Changelog — LifeQuest

## [Unreleased] — Fase 1 GitHub Pages

### Aggiunto
- Struttura HTML completa con tutte le sezioni (home, quest, study, routine, pvp, books, libri, social, stats)
- Sistema CSS con custom properties, dark theme, componenti e animazioni
- `config.js` — costanti globali (RANK_TITLES, CAT_STAT, ROUTINE_ITEMS, ecc.)
- `db.js` — database locale su localStorage con CRUD generico e merge cloud
- `api.js` — layer API con implementazione localStorage + fire-and-forget GAS
- `auth.js` — login, registrazione, reset PIN con SHA-256
- `xp.js` — sistema XP, livelli, streak, moltiplicatori
- `trophies.js` — definizioni trofei e controllo automatico
- `utils.js` — funzioni condivise (uid, toast, escHtml, compressImage, ecc.)
- `audio.js` — Web Audio API con 10 suoni
- `modals.js` — sistema modale generico
- `main.js` — boot, session check, binding globali
- Screen: home, quest, study, routine, pvp, books, libri, social, stats
- Schema SQL Supabase completo (schema.sql + rls.sql)
- PWA: manifest.json + service worker
- Deploy automatico via GitHub Actions
- Documentazione: ARCHITECTURE.md, API_CONTRACT.md, LIFEQUEST_AI_CONTEXT.md

### Da fare — Fase 2
- [ ] Setup progetto Supabase
- [ ] Sostituzione api.js con Supabase client
- [ ] Auth JWT nativa Supabase
- [ ] Upload avatar/foto su Supabase Storage
- [ ] Feed live via Supabase Realtime
- [ ] Notifiche push (Web Push API)
- [ ] Leaderboard in tempo reale
