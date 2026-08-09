// ============================================================
// api.js — Layer di astrazione API
// ============================================================
// Fase 1: tutte le chiamate sono local-only (localStorage).
// Fase 2: sostituire le implementazioni con Supabase client
//         senza toccare nulla nel resto del codice.
//
// CONTRATTO: ogni metodo restituisce una Promise<{ ok, data, error }>.
// ============================================================

import { API_URL } from './config.js';
import { DB, CUR, insert, update, remove, findById, byUser, persist } from './db.js';
import { uid, today } from './utils.js';

// ── Helper interno ───────────────────────────────────────────

function ok(data)    { return { ok: true,  data, error: null  }; }
function fail(error) { return { ok: false, data: null, error  }; }

/**
 * Chiamata GET verso Google Apps Script (legacy — usata solo se API_URL è valorizzato).
 * Nella Fase 2 verrà sostituito dal client Supabase.
 */
async function gasCall(action, payload = {}) {
  try {
    const params = new URLSearchParams({ action, payload: JSON.stringify(payload) });
    const res = await fetch(`${API_URL}?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('[API] gasCall failed — offline mode:', e.message);
    return null;
  }
}

// ── Auth ─────────────────────────────────────────────────────

export const Auth = {
  /** Registra un nuovo utente. */
  async register(username, passwordHash, pinHash) {
    if (!username || !passwordHash || !pinHash) return fail('Dati mancanti');
    if (username.length < 3) return fail('Username troppo corto (min 3 caratteri)');

    const existing = Object.values(DB.users).find(
      u => u.username.toLowerCase() === username.toLowerCase()
    );
    if (existing) return fail('Username già in uso');

    const user = {
      id:           uid(),
      username,
      passwordHash,
      pinHash,
      xp:           0,
      level:        1,
      streak:       0,
      lastActive:   today(),
      rankTitle:    'Novizio',
      isPublic:     true,
      languages:    [],
      stats:        { mente: 0, corpo: 0, cultura: 0, sociale: 0, sfide: 0 },
      trophies:     [],
      following:    [],
      followers:    [],
      avatarUrl:    null,
      createdAt:    new Date().toISOString(),
    };

    DB.users[user.id] = user;
    persist();

    // Fire-and-forget verso il cloud
    gasCall('REGISTER', { username, passwordHash, pinHash });

    return ok(user);
  },

  /** Esegue il login. */
  async login(username, passwordHash) {
    if (!username || !passwordHash) return fail('Dati mancanti');

    // Prima prova il cloud
    const remote = await gasCall('LOGIN', { username, passwordHash });
    if (remote?.user) {
      // Aggiorna/inserisce nel DB locale
      DB.users[remote.user.id] = { ...(DB.users[remote.user.id] || {}), ...remote.user };
      persist();
      return ok(remote.user);
    }

    // Fallback locale (offline)
    const user = Object.values(DB.users).find(
      u => u.username.toLowerCase() === username.toLowerCase()
        && u.passwordHash === passwordHash
    );
    if (!user) return fail('Credenziali non valide');
    return ok(user);
  },

  /** Reset password tramite PIN. */
  async resetPin(username, pinHash, newPasswordHash) {
    const remote = await gasCall('RESET_PIN', { username, pinHash, newPasswordHash });
    if (remote?.ok) {
      const user = Object.values(DB.users).find(
        u => u.username.toLowerCase() === username.toLowerCase()
      );
      if (user) {
        DB.users[user.id].passwordHash = newPasswordHash;
        persist();
      }
      return ok(true);
    }

    // Fallback locale
    const user = Object.values(DB.users).find(
      u => u.username.toLowerCase() === username.toLowerCase()
        && u.pinHash === pinHash
    );
    if (!user) return fail('PIN o username non validi');
    DB.users[user.id].passwordHash = newPasswordHash;
    persist();
    return ok(true);
  },
};

// ── Users ────────────────────────────────────────────────────

export const Users = {
  async get(userId) {
    const local = DB.users[userId];
    if (!local) return fail('Utente non trovato');
    return ok(local);
  },

  async update(userId, patch) {
    if (!DB.users[userId]) return fail('Utente non trovato');
    DB.users[userId] = { ...DB.users[userId], ...patch };
    persist();
    gasCall('UPDATE_USER', { userId, ...patch });
    return ok(DB.users[userId]);
  },

  async search(query) {
    if (!query || query.length < 2) return ok([]);
    const q = query.toLowerCase();
    const results = Object.values(DB.users)
      .filter(u => u.username.toLowerCase().includes(q) && u.id !== CUR?.id)
      .slice(0, 20);
    return ok(results);
  },

  async getLeaderboard() {
    const remote = await gasCall('GET_LEADERBOARD');
    if (remote?.users) return ok(remote.users);
    // Fallback locale
    const sorted = Object.values(DB.users)
      .filter(u => u.isPublic)
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 50);
    return ok(sorted);
  },

  async follow(userId, targetId) {
    const user   = DB.users[userId];
    const target = DB.users[targetId];
    if (!user || !target) return fail('Utente non trovato');

    if (!user.following.includes(targetId)) {
      user.following.push(targetId);
    }
    if (!target.followers.includes(userId)) {
      target.followers.push(userId);
    }
    persist();
    gasCall('FOLLOW', { userId, targetId });
    return ok(true);
  },

  async unfollow(userId, targetId) {
    const user   = DB.users[userId];
    const target = DB.users[targetId];
    if (!user || !target) return fail('Utente non trovato');

    user.following   = user.following.filter(id => id !== targetId);
    target.followers = target.followers.filter(id => id !== userId);
    persist();
    gasCall('UNFOLLOW', { userId, targetId });
    return ok(true);
  },
};

// ── Quests ───────────────────────────────────────────────────

export const Quests = {
  async list(userId) {
    return ok(byUser('quests', userId));
  },

  async create(payload) {
    const quest = {
      id:          uid(),
      userId:      CUR.id,
      title:       payload.title,
      category:    payload.category || 'altro',
      difficulty:  payload.difficulty || 1,
      xpValue:     payload.xpValue || 10,
      photoUrl:    payload.photoUrl || null,
      completed:   false,
      completedAt: null,
      type:        payload.type || 'todo',
      dueDate:     payload.dueDate || null,
      createdAt:   new Date().toISOString(),
    };
    insert('quests', quest);
    gasCall('CREATE_QUEST', quest);
    return ok(quest);
  },

  async complete(questId) {
    const q = update('quests', questId, { completed: true, completedAt: today() });
    if (!q) return fail('Quest non trovata');
    gasCall('UPDATE_QUEST', { id: questId, completed: true, completedAt: today() });
    return ok(q);
  },

  async delete(questId) {
    remove('quests', questId);
    gasCall('DELETE_QUEST', { id: questId });
    return ok(true);
  },
};

// ── Study ────────────────────────────────────────────────────

export const Study = {
  async getExams(userId) {
    return ok(byUser('exams', userId));
  },

  async createExam(payload) {
    const exam = {
      id:        uid(),
      userId:    CUR.id,
      name:      payload.name,
      chapters:  payload.chapters || [],
      examDate:  payload.examDate || null,
      grade:     null,
      createdAt: new Date().toISOString(),
    };
    insert('exams', exam);
    gasCall('CREATE_EXAM', exam);
    return ok(exam);
  },

  async updateExam(examId, patch) {
    const e = update('exams', examId, patch);
    if (!e) return fail('Esame non trovato');
    gasCall('UPDATE_EXAM', { id: examId, ...patch });
    return ok(e);
  },

  async logSession(payload) {
    const session = {
      id:          uid(),
      userId:      CUR.id,
      examId:      payload.examId || null,
      minutes:     payload.minutes,
      focusScore:  payload.focusScore || 5,
      xpEarned:    payload.xpEarned || 0,
      notes:       payload.notes || '',
      studiedAt:   today(),
      createdAt:   new Date().toISOString(),
    };
    insert('studySessions', session);
    gasCall('LOG_STUDY', session);
    return ok(session);
  },
};

// ── Books ────────────────────────────────────────────────────

export const Books = {
  async list(userId) {
    return ok(byUser('books', userId));
  },

  async create(payload) {
    const book = {
      id:           uid(),
      userId:       CUR.id,
      title:        payload.title,
      author:       payload.author || '',
      genre:        payload.genre || 'narrativa',
      difficulty:   payload.difficulty || 1,
      totalPages:   payload.totalPages || 0,
      currentPage:  0,
      completed:    false,
      completedAt:  null,
      coverUrl:     payload.coverUrl || null,
      createdAt:    new Date().toISOString(),
    };
    insert('books', book);
    gasCall('CREATE_BOOK', book);
    return ok(book);
  },

  async updateProgress(bookId, currentPage) {
    const b = update('books', bookId, { currentPage });
    if (!b) return fail('Libro non trovato');
    gasCall('UPDATE_BOOK', { id: bookId, currentPage });
    return ok(b);
  },

  async markDone(bookId) {
    const b = update('books', bookId, { completed: true, completedAt: today() });
    if (!b) return fail('Libro non trovato');
    gasCall('UPDATE_BOOK', { id: bookId, completed: true, completedAt: today() });
    return ok(b);
  },

  async logReading(payload) {
    const session = {
      id:         uid(),
      userId:     CUR.id,
      bookId:     payload.bookId,
      pagesRead:  payload.pagesRead,
      xpEarned:   payload.xpEarned || 0,
      readAt:     today(),
      createdAt:  new Date().toISOString(),
    };
    insert('readingSessions', session);
    gasCall('LOG_READING', session);
    return ok(session);
  },

  // Catalogo globale
  async getGlobalCatalog(query = '') {
    const remote = await gasCall('GET_GLOBAL_BOOKS', { query });
    if (remote?.books) return ok(remote.books);
    const q = query.toLowerCase();
    const local = DB.globalBooks.filter(b =>
      !q || b.title.toLowerCase().includes(q) || b.author?.toLowerCase().includes(q)
    );
    return ok(local);
  },

  async addToGlobalCatalog(payload) {
    const book = {
      id:        uid(),
      title:     payload.title,
      author:    payload.author || '',
      genre:     payload.genre || 'narrativa',
      coverUrl:  payload.coverUrl || null,
      addedBy:   CUR.id,
      createdAt: new Date().toISOString(),
    };
    insert('globalBooks', book);
    gasCall('ADD_GLOBAL_BOOK', book);
    return ok(book);
  },
};

// ── Routines ─────────────────────────────────────────────────

export const Routines = {
  async list(userId) {
    return ok(byUser('routineLogs', userId));
  },

  async log(payload) {
    const log = {
      id:         uid(),
      userId:     CUR.id,
      routineId:  payload.routineId,
      doneAt:     today(),
      xpEarned:   payload.xpEarned || 5,
      createdAt:  new Date().toISOString(),
    };
    insert('routineLogs', log);
    gasCall('LOG_ROUTINE', log);
    return ok(log);
  },

  async createCustom(payload) {
    const routine = {
      id:         uid(),
      userId:     CUR.id,
      name:       payload.name,
      emoji:      payload.emoji || '⚡',
      category:   payload.category || 'routine',
      xpValue:    payload.xpValue || 10,
      isDefault:  false,
      createdAt:  new Date().toISOString(),
    };
    insert('routines', routine);
    gasCall('CREATE_ROUTINE', routine);
    return ok(routine);
  },
};

// ── PvP Challenges ───────────────────────────────────────────

export const Challenges = {
  async list(userId) {
    return ok(DB.challenges.filter(
      c => c.creatorId === userId || c.opponentId === userId
    ));
  },

  async listPublic() {
    return ok(DB.challenges.filter(c => c.isPublic && c.status === 'open'));
  },

  async create(payload) {
    const challenge = {
      id:          uid(),
      creatorId:   CUR.id,
      opponentId:  payload.opponentId || null,
      title:       payload.title,
      rules:       payload.rules || '',
      stakeXP:     payload.stakeXP || 50,
      type:        payload.type || 'mixed',
      isPublic:    payload.isPublic !== false,
      joinCode:    payload.isPublic ? null : String(Math.floor(1000 + Math.random() * 9000)),
      expiresAt:   payload.expiresAt || null,
      status:      'open',
      winnerId:    null,
      createdAt:   new Date().toISOString(),
    };
    insert('challenges', challenge);
    gasCall('CREATE_CHALLENGE', challenge);
    return ok(challenge);
  },

  async join(challengeId, userId) {
    const c = update('challenges', challengeId, { opponentId: userId, status: 'active' });
    if (!c) return fail('Sfida non trovata');
    gasCall('JOIN_CHALLENGE', { id: challengeId, userId });
    return ok(c);
  },

  async declareWinner(challengeId, winnerId) {
    const c = update('challenges', challengeId, { winnerId, status: 'completed' });
    if (!c) return fail('Sfida non trovata');
    gasCall('DECLARE_WINNER', { id: challengeId, winnerId });
    return ok(c);
  },
};

// ── Feed & Social ────────────────────────────────────────────

export const Feed = {
  async get(userId, filter = 'all') {
    const remote = await gasCall('GET_FEED', { userId, filter });
    if (remote?.posts) {
      // Merge con posts locali
      const remoteIds = new Set(remote.posts.map(p => p.id));
      const localOnly = DB.feedPosts.filter(p => !remoteIds.has(p.id));
      return ok([...remote.posts, ...localOnly].sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      ));
    }
    // Fallback locale
    let posts = [...DB.feedPosts].sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    if (filter === 'following') {
      const following = DB.users[userId]?.following || [];
      posts = posts.filter(p => following.includes(p.userId) || p.userId === userId);
    }
    return ok(posts);
  },

  async create(payload) {
    const post = {
      id:        uid(),
      userId:    CUR.id,
      username:  CUR.username,
      content:   payload.content,
      photoUrl:  payload.photoUrl || null,
      category:  payload.category || null,
      xpEarned:  payload.xpEarned || 0,
      likes:     [],
      lang:      CUR.languages?.[0]?.slice(0, 2).toLowerCase() || 'it',
      refType:   payload.refType || null,
      refId:     payload.refId   || null,
      createdAt: new Date().toISOString(),
    };
    insert('feedPosts', post);
    gasCall('CREATE_POST', post);
    return ok(post);
  },

  async toggleLike(postId, userId) {
    const post = findById('feedPosts', postId);
    if (!post) return fail('Post non trovato');
    const liked = post.likes.includes(userId);
    const likes = liked
      ? post.likes.filter(id => id !== userId)
      : [...post.likes, userId];
    update('feedPosts', postId, { likes });
    gasCall('TOGGLE_LIKE', { postId, userId });
    return ok({ liked: !liked, count: likes.length });
  },

  async getComments(postId) {
    return ok(DB.comments.filter(c => c.postId === postId));
  },

  async addComment(payload) {
    const comment = {
      id:        uid(),
      postId:    payload.postId,
      userId:    CUR.id,
      username:  CUR.username,
      content:   payload.content,
      createdAt: new Date().toISOString(),
    };
    insert('comments', comment);
    gasCall('ADD_COMMENT', comment);
    return ok(comment);
  },
};

// ── Discussioni ──────────────────────────────────────────────

export const Discussions = {
  async list(bookId) {
    const remote = await gasCall('GET_DISCUSSIONS', { bookId });
    if (remote?.discussions) return ok(remote.discussions);
    return ok(DB.discussions.filter(d => !bookId || d.bookId === bookId));
  },

  async create(payload) {
    const disc = {
      id:        uid(),
      bookId:    payload.bookId || null,
      userId:    CUR.id,
      username:  CUR.username,
      title:     payload.title || '',
      content:   payload.content,
      type:      payload.type || 'discussion',
      likes:     [],
      createdAt: new Date().toISOString(),
    };
    insert('discussions', disc);
    gasCall('CREATE_DISCUSSION', disc);
    return ok(disc);
  },

  async addReply(payload) {
    const reply = {
      id:             uid(),
      discussionId:   payload.discussionId,
      userId:         CUR.id,
      username:       CUR.username,
      content:        payload.content,
      createdAt:      new Date().toISOString(),
    };
    insert('discussionReplies', reply);
    gasCall('ADD_DISC_REPLY', reply);
    return ok(reply);
  },

  async toggleLike(discussionId, userId) {
    const disc = findById('discussions', discussionId);
    if (!disc) return fail('Discussione non trovata');
    const liked = disc.likes.includes(userId);
    const likes = liked
      ? disc.likes.filter(id => id !== userId)
      : [...disc.likes, userId];
    update('discussions', discussionId, { likes });
    gasCall('TOGGLE_DISC_LIKE', { discussionId, userId });
    return ok({ liked: !liked, count: likes.length });
  },
};

// ── Moderazione ──────────────────────────────────────────────

export const Moderation = {
  async getBannedWords() {
    const remote = await gasCall('GET_BANNED_WORDS');
    if (remote?.words) {
      DB.bannedWords = remote.words;
      persist();
      return ok(remote.words);
    }
    return ok(DB.bannedWords);
  },
};

// ── Sync cloud ───────────────────────────────────────────────

/**
 * Scarica e riconcilia tutti i dati dell'utente dal cloud.
 * Chiamata dopo il login.
 * @param {string} userId
 */
export async function syncCloudDataOnLogin(userId) {
  const res = await gasCall('SYNC_USER', { userId });
  if (!res) return; // offline

  if (res.quests)          DB.quests         = [...DB.quests,        ...res.quests       ].filter(dedup('id'));
  if (res.books)           DB.books          = [...DB.books,         ...res.books        ].filter(dedup('id'));
  if (res.studySessions)   DB.studySessions  = [...DB.studySessions, ...res.studySessions].filter(dedup('id'));
  if (res.readingSessions) DB.readingSessions = [...DB.readingSessions,...res.readingSessions].filter(dedup('id'));
  if (res.exams)           DB.exams          = [...DB.exams,         ...res.exams        ].filter(dedup('id'));

  persist();
}

/** Helper per il filtro di deduplicazione per campo chiave */
function dedup(key) {
  const seen = new Set();
  return item => {
    if (seen.has(item[key])) return false;
    seen.add(item[key]);
    return true;
  };
}
