# Audio Assets — LifeQuest

File audio usati da `js/audio.js` via `playSound(name)`.

| File | Evento | Note |
|------|--------|-------|
| `tap.mp3` | Tocco generico UI | **MANCANTE** — aggiungere manualmente |
| `xp.mp3` | XP guadagnato | ⚠️ rinominare `xp.mp3.mp3` → `xp.mp3` |
| `levelup.mp3` | Level up | ✅ |
| `login.mp3` | Login / registrazione | ✅ |
| `quest.mp3` | Quest completata | ✅ |
| `trophy.mp3` | Trofeo sbloccato | ✅ |
| `like.mp3` | Like su post | ✅ |
| `challenge.mp3` | Sfida PvP creata/accettata | ✅ |
| `open.mp3` | Apertura modale / azione | ✅ |
| `error.mp3` | Errore | ✅ |

## Note

- `tap.mp3` — suono breve (~50ms) per feedback tocco. Fonte consigliata: [Mixkit](https://mixkit.co/free-sound-effects/click/) oppure generarlo con [jsfxr](https://sfxr.me/).
- `xp.mp3.mp3` va rinominato in `xp.mp3` per funzionare correttamente.
- Tutti i file devono essere MP3, consigliato ≤ 100KB per caricamento veloce.
