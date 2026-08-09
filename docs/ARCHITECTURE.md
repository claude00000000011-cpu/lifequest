# LifeQuest — Architettura

Vedi `LIFEQUEST_AI_CONTEXT.md` nella root per il documento di contesto completo.

## Stack

- **Frontend:** Vanilla JS ES2022+ (moduli nativi), zero bundler
- **CSS:** Custom properties, mobile-first, nessun framework
- **Storage (Fase 1):** localStorage via `db.js`
- **Storage (Fase 2):** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Deploy (Fase 1):** GitHub Pages via GitHub Actions
- **Deploy (Fase 2):** Vercel (frontend) + Supabase (backend)

## Flusso dati

```
UI (screen/*.js)
    ↓ chiama
api.js (contratto stabile)
    ↓ legge/scrive
db.js (localStorage) ←→ cloud (GAS oggi, Supabase in Fase 2)
```

## Pattern chiave

- **Optimistic UI:** aggiorna locale + UI subito, poi sync cloud
- **Lazy import:** le screen usano `import()` dinamico per evitare cicli
- **Single source of truth:** `DB` e `CUR` in `db.js`
- **XP centralizzato:** solo `awardXP()` in `xp.js` modifica `DB.users.xp`

Per dettagli su ogni modulo, strutture dati e convenzioni vedi `LIFEQUEST_AI_CONTEXT.md`.
