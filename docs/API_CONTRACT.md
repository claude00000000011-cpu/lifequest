# API Contract — LifeQuest

Ogni metodo di `api.js` restituisce `Promise<{ ok: boolean, data: any, error: string|null }>`.

## Auth

| Metodo | Parametri | `data` restituito |
|--------|-----------|-------------------|
| `Auth.register(username, passwordHash, pinHash)` | stringhe SHA-256 | `UserObject` |
| `Auth.login(username, passwordHash)` | stringhe SHA-256 | `UserObject` |
| `Auth.resetPin(username, pinHash, newPasswordHash)` | stringhe SHA-256 | `true` |

## Users

| Metodo | Parametri | `data` restituito |
|--------|-----------|-------------------|
| `Users.get(userId)` | uuid | `UserObject` |
| `Users.update(userId, patch)` | uuid, oggetto parziale | `UserObject` aggiornato |
| `Users.search(query)` | stringa min 2 char | `UserObject[]` max 20 |
| `Users.getLeaderboard()` | — | `UserObject[]` max 50, ordinati per XP |
| `Users.follow(userId, targetId)` | uuid, uuid | `true` |
| `Users.unfollow(userId, targetId)` | uuid, uuid | `true` |

## Quests

| Metodo | Parametri | `data` restituito |
|--------|-----------|-------------------|
| `Quests.list(userId)` | uuid | `Quest[]` |
| `Quests.create(payload)` | `{ title, category?, difficulty?, xpValue?, photoUrl?, type?, dueDate? }` | `Quest` |
| `Quests.complete(questId)` | uuid | `Quest` aggiornato |
| `Quests.delete(questId)` | uuid | `true` |

## Study

| Metodo | Parametri | `data` restituito |
|--------|-----------|-------------------|
| `Study.getExams(userId)` | uuid | `Exam[]` |
| `Study.createExam(payload)` | `{ name, chapters?, examDate? }` | `Exam` |
| `Study.updateExam(examId, patch)` | uuid, oggetto parziale | `Exam` aggiornato |
| `Study.logSession(payload)` | `{ examId?, minutes, focusScore?, notes? }` | `StudySession` |

## Books

| Metodo | Parametri | `data` restituito |
|--------|-----------|-------------------|
| `Books.list(userId)` | uuid | `Book[]` |
| `Books.create(payload)` | `{ title, author?, genre?, difficulty?, totalPages?, coverUrl? }` | `Book` |
| `Books.update(bookId, patch)` | uuid, oggetto parziale | `Book` aggiornato |
| `Books.logReading(payload)` | `{ bookId, pagesRead }` | `ReadingSession` |
| `Books.getGlobalBooks(query?)` | stringa opzionale | `GlobalBook[]` |
| `Books.addGlobalBook(payload)` | `{ title, author?, genre?, coverUrl? }` | `GlobalBook` |

## Routines

| Metodo | Parametri | `data` restituito |
|--------|-----------|-------------------|
| `Routines.list(userId)` | uuid | `RoutineLog[]` |
| `Routines.log(payload)` | `{ routineId, xpEarned? }` | `RoutineLog` |
| `Routines.createCustom(payload)` | `{ name, emoji?, category?, xpValue? }` | `Routine` |

## Challenges (PvP)

| Metodo | Parametri | `data` restituito |
|--------|-----------|-------------------|
| `Challenges.list(userId)` | uuid | `Challenge[]` (creator o opponent) |
| `Challenges.listPublic()` | — | `Challenge[]` status `open` e pubbliche |
| `Challenges.create(payload)` | `{ title, rules?, stakeXP?, type?, isPublic?, opponentId?, expiresAt? }` | `Challenge` |
| `Challenges.join(challengeId, userId)` | uuid, uuid | `Challenge` aggiornato |
| `Challenges.declareWinner(challengeId, winnerId)` | uuid, uuid | `Challenge` aggiornato |

## Feed & Social

| Metodo | Parametri | `data` restituito |
|--------|-----------|-------------------|
| `Feed.get(userId, filter?)` | uuid, `'all'`\|`'following'` | `FeedPost[]` ordinati per data |
| `Feed.create(payload)` | `{ content, photoUrl?, category?, xpEarned?, refType?, refId? }` | `FeedPost` |
| `Feed.toggleLike(postId, userId)` | uuid, uuid | `{ liked: boolean, count: number }` |
| `Feed.getComments(postId)` | uuid | `Comment[]` |
| `Feed.addComment(payload)` | `{ postId, content }` | `Comment` |

## Discussions

| Metodo | Parametri | `data` restituito |
|--------|-----------|-------------------|
| `Discussions.list(bookId?)` | uuid opzionale | `Discussion[]` |
| `Discussions.create(payload)` | `{ bookId?, title?, content, type? }` | `Discussion` |
| `Discussions.addReply(payload)` | `{ discussionId, content }` | `DiscussionReply` |
| `Discussions.toggleLike(discussionId, userId)` | uuid, uuid | `{ liked: boolean, count: number }` |

## Moderation

| Metodo | Parametri | `data` restituito |
|--------|-----------|-------------------|
| `Moderation.getBannedWords()` | — | `string[]` |

## Sync

| Funzione | Parametri | Note |
|----------|-----------|------|
| `syncCloudDataOnLogin(userId)` | uuid | Fire-and-forget, merge quests/books/sessions/exams dal cloud |

---

## Strutture dati complete

### UserObject
```json
{
  "id": "uuid",
  "username": "string",
  "passwordHash": "sha256-hex",
  "pinHash": "sha256-hex",
  "xp": 0,
  "level": 1,
  "streak": 0,
  "lastActive": "YYYY-MM-DD",
  "rankTitle": "Novizio",
  "isPublic": true,
  "languages": [],
  "stats": { "mente": 0, "corpo": 0, "cultura": 0, "sociale": 0, "sfide": 0 },
  "trophies": [],
  "following": [],
  "followers": [],
  "avatarUrl": null,
  "createdAt": "ISO string"
}
```

### Quest
```json
{
  "id": "uuid", "userId": "uuid",
  "title": "string", "category": "string",
  "difficulty": 1, "xpValue": 10, "photoUrl": null,
  "completed": false, "completedAt": null,
  "type": "todo", "dueDate": null, "createdAt": "ISO"
}
```

### Exam
```json
{
  "id": "uuid", "userId": "uuid",
  "name": "string", "chapters": [],
  "examDate": null, "grade": null, "createdAt": "ISO"
}
```

### StudySession
```json
{
  "id": "uuid", "userId": "uuid", "examId": "uuid|null",
  "minutes": 0, "focusScore": null, "xpEarned": 0,
  "notes": null, "studiedAt": "YYYY-MM-DD", "createdAt": "ISO"
}
```

### Book
```json
{
  "id": "uuid", "userId": "uuid",
  "title": "string", "author": null, "genre": null,
  "difficulty": 1, "totalPages": 0, "currentPage": 0,
  "completed": false, "completedAt": null,
  "coverUrl": null, "createdAt": "ISO"
}
```

### ReadingSession
```json
{
  "id": "uuid", "userId": "uuid", "bookId": "uuid",
  "pagesRead": 0, "xpEarned": 0,
  "readAt": "YYYY-MM-DD", "createdAt": "ISO"
}
```

### Challenge
```json
{
  "id": "uuid", "creatorId": "uuid", "opponentId": null,
  "title": "string", "rules": "", "stakeXP": 50,
  "type": "mixed", "isPublic": true, "joinCode": null,
  "expiresAt": null, "status": "open", "winnerId": null,
  "createdAt": "ISO"
}
```

### FeedPost
```json
{
  "id": "uuid", "userId": "uuid", "username": "string",
  "content": "string", "photoUrl": null, "category": null,
  "xpEarned": 0, "likes": [], "lang": "it",
  "refType": null, "refId": null, "createdAt": "ISO"
}
```

### Comment
```json
{
  "id": "uuid", "postId": "uuid",
  "userId": "uuid", "username": "string",
  "content": "string", "createdAt": "ISO"
}
```

### Discussion
```json
{
  "id": "uuid", "bookId": null,
  "userId": "uuid", "username": "string",
  "title": "", "content": "string",
  "type": "discussion", "likes": [], "createdAt": "ISO"
}
```

### DiscussionReply
```json
{
  "id": "uuid", "discussionId": "uuid",
  "userId": "uuid", "username": "string",
  "content": "string", "createdAt": "ISO"
}
```
