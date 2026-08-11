// ============================================================
// api.js — Layer API LifeQuest (Fase 2: Supabase)
// ============================================================
// CONTRATTO: ogni metodo restituisce Promise<{ ok, data, error }>
// FIX: toggleLike usa tabella post_likes (no RLS block)
//      Feed.get fa join con post_likes per conteggio corretto
//      addComment salva username denormalizzato
// ============================================================

import { supabase } from '../supabase.js';
import { DB, CUR, persist, insert, update, remove, findById, byUser } from './db.js';
import { uid, today } from './utils.js';

// ── Helper ───────────────────────────────────────────────────

function ok(data)    { return { ok: true,  data, error: null }; }
function fail(error) { return { ok: false, data: null, error }; }

function toCamel(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  return out;
}

function toSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(/([A-Z])/g, '_$1').toLowerCase();
    out[snake] = v;
  }
  return out;
}

// ── Auth ─────────────────────────────────────────────────────

export const Auth = {
  async register(username, passwordHash, pinHash) {
    if (!username || !passwordHash || !pinHash) return fail('Dati mancanti');
    if (username.length < 3) return fail('Username troppo corto');

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    if (existing) return fail('Username già in uso');

    const fakeEmail = `${username.toLowerCase()}@lifequest.app`;
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email:    fakeEmail,
      password: passwordHash,
    });

    if (authErr) return fail(authErr.message);

    const userId = authData.user?.id;
    if (!userId) return fail('Errore nella creazione account');

    const profile = {
      id:            userId,
      username,
      password_hash: passwordHash,
      pin_hash:      pinHash,
      xp:            0,
      level:         1,
      streak:        0,
      last_active:   today(),
      rank_title:    'Novizio',
      is_public:     true,
      languages:     [],
      stats:         { mente: 0, corpo: 0, cultura: 0, sociale: 0, sfide: 0 },
      trophies:      [],
      following:     [],
      followers:     [],
      created_at:    new Date().toISOString(),
    };

    const { error: profileErr } = await supabase.from('users').insert(profile);
    if (profileErr) return fail(profileErr.message);

    const user = { ...toCamel(profile), id: userId };
    DB.users[userId] = user;
    persist();
    return ok(user);
  },

  async login(username, passwordHash) {
    if (!username || !passwordHash) return fail('Dati mancanti');

    const fakeEmail = `${username.toLowerCase()}@lifequest.app`;
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email:    fakeEmail,
      password: passwordHash,
    });

    if (authErr) {
      const user = Object.values(DB.users).find(
        u => u.username.toLowerCase() === username.toLowerCase()
          && u.passwordHash === passwordHash
      );
      if (!user) return fail('Credenziali non valide');
      return ok(user);
    }

    const userId = authData.user?.id;

    const { data: profile, error: profileErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileErr) return fail(profileErr.message);

    const user = toCamel(profile);
    DB.users[userId] = user;
    persist();
    return ok(user);
  },

  async resetPin(username, pinHash, newPasswordHash) {
    const user = Object.values(DB.users).find(
      u => u.username.toLowerCase() === username.toLowerCase()
        && u.pinHash === pinHash
    );
    if (!user) return fail('PIN o username non validi');

    const { error } = await supabase
      .from('users')
      .update({ password_hash: newPasswordHash })
      .eq('id', user.id);

    if (error) return fail(error.message);

    DB.users[user.id].passwordHash = newPasswordHash;
    persist();
    return ok(true);
  },
};

// ── Users ────────────────────────────────────────────────────

export const Users = {
  async get(userId) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      const local = DB.users[userId];
      return local ? ok(local) : fail('Utente non trovato');
    }

    const user = toCamel(data);
    DB.users[userId] = user;
    persist();
    return ok(user);
  },

  async update(userId, patch) {
    const snakePatch = toSnake(patch);
    const { error } = await supabase
      .from('users')
      .update(snakePatch)
      .eq('id', userId);

    if (error) return fail(error.message);

    DB.users[userId] = { ...DB.users[userId], ...patch };
    persist();
    return ok(DB.users[userId]);
  },

  async search(query) {
    if (!query || query.length < 2) return ok([]);

    const { data, error } = await supabase
      .from('users')
      .select('id, username, level, rank_title, xp, followers, avatar_url, is_public')
      .ilike('username', `%${query}%`)
      .eq('is_public', true)
      .neq('id', CUR?.id)
      .limit(20);

    if (error) {
      const q = query.toLowerCase();
      return ok(Object.values(DB.users)
        .filter(u => u.username.toLowerCase().includes(q) && u.id !== CUR?.id)
        .slice(0, 20));
    }

    return ok(data.map(toCamel));
  },

  async getLeaderboard() {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, xp, level, rank_title, avatar_url')
      .eq('is_public', true)
      .order('xp', { ascending: false })
      .limit(50);

    if (error) {
      return ok(Object.values(DB.users)
        .filter(u => u.isPublic)
        .sort((a, b) => b.xp - a.xp)
        .slice(0, 50));
    }

    return ok(data.map(toCamel));
  },

async follow(userId, targetId) {
    const user   = DB.users[userId]   || {};
    const target = DB.users[targetId] || {};

    const newFollowing = user.following?.includes(targetId)
      ? user.following
      : [...(user.following  || []), targetId];
    const newFollowers = target.followers?.includes(userId)
      ? target.followers
      : [...(target.followers || []), userId];

    const r1 = await supabase.from('users').update({ following: newFollowing }).eq('id', userId);
    const r2 = await supabase.from('users').update({ followers: newFollowers }).eq('id', targetId);

    console.log('[follow] r1 error:', r1.error);
    console.log('[follow] r2 error:', r2.error);
    console.log('[follow] newFollowers:', newFollowers);
    console.log('[follow] targetId:', targetId);

    DB.users[userId]   = { ...user,   following: newFollowing };
    DB.users[targetId] = { ...target, followers: newFollowers };
    persist();

    if (!r1.error && !r2.error) {
      await Promise.all([Users.get(userId), Users.get(targetId)]);
    }

    return ok(true);
  },
  
  async unfollow(userId, targetId) {
    const user   = DB.users[userId]   || {};
    const target = DB.users[targetId] || {};

    const newFollowing = (user.following  || []).filter(id => id !== targetId);
    const newFollowers = (target.followers || []).filter(id => id !== userId);

    const [r1, r2] = await Promise.all([
      supabase.from('users').update({ following: newFollowing }).eq('id', userId),
      supabase.from('users').update({ followers: newFollowers }).eq('id', targetId),
    ]);

    DB.users[userId]   = { ...user,   following: newFollowing };
    DB.users[targetId] = { ...target, followers: newFollowers };
    persist();

    if (!r1.error && !r2.error) {
      await Promise.all([Users.get(userId), Users.get(targetId)]);
    }

    return ok(true);
  },
};

// ── Quests ───────────────────────────────────────────────────

export const Quests = {
  async list(userId) {
    const { data, error } = await supabase
      .from('quests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return ok(byUser('quests', userId));

    const quests = data.map(toCamel);
    DB.quests = quests;
    persist();
    return ok(quests);
  },

  async create(payload) {
    const quest = {
      user_id:      CUR.id,
      title:        payload.title,
      category:     payload.category || 'altro',
      difficulty:   payload.difficulty || 1,
      xp_value:     payload.xpValue || 10,
      photo_url:    payload.photoUrl || null,
      completed:    false,
      completed_at: null,
      type:         payload.type || 'todo',
      due_date:     payload.dueDate || null,
    };

    const { data, error } = await supabase.from('quests').insert(quest).select().single();
    if (error) {
      const local = { id: uid(), userId: CUR.id, ...payload, completed: false, createdAt: new Date().toISOString() };
      insert('quests', local);
      return ok(local);
    }

    const q = toCamel(data);
    insert('quests', q);
    return ok(q);
  },

  async complete(questId) {
    const { data, error } = await supabase
      .from('quests')
      .update({ completed: true, completed_at: today() })
      .eq('id', questId)
      .select()
      .single();

    if (error) {
      update('quests', questId, { completed: true, completedAt: today() });
      return ok(DB.quests.find(q => q.id === questId));
    }

    const q = toCamel(data);
    update('quests', questId, { completed: true, completedAt: today() });
    return ok(q);
  },

  async delete(questId) {
    await supabase.from('quests').delete().eq('id', questId);
    remove('quests', questId);
    return ok(true);
  },
};

// ── Study ────────────────────────────────────────────────────

export const Study = {
  async getExams(userId) {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return ok(byUser('exams', userId));

    const exams = data.map(toCamel);
    DB.exams = exams;
    persist();
    return ok(exams);
  },

  async createExam(payload) {
    const { data, error } = await supabase
      .from('exams')
      .insert({
        user_id:   CUR.id,
        name:      payload.name,
        exam_date: payload.examDate || null,
        chapters:  [],
      })
      .select()
      .single();

    if (error) {
      const local = { id: uid(), userId: CUR.id, ...payload, chapters: [], createdAt: new Date().toISOString() };
      insert('exams', local);
      return ok(local);
    }

    const exam = toCamel(data);
    insert('exams', exam);
    return ok(exam);
  },

  async updateExam(examId, patch) {
    const { error } = await supabase.from('exams').update(toSnake(patch)).eq('id', examId);
    if (error) return fail(error.message);
    const e = update('exams', examId, patch);
    return ok(e);
  },

  async logSession(payload) {
    const session = {
      user_id:     CUR.id,
      exam_id:     payload.examId || null,
      minutes:     payload.minutes,
      focus_score: payload.focusScore || 5,
      xp_earned:   payload.xpEarned || 0,
      notes:       payload.notes || '',
      studied_at:  today(),
    };

    const { data, error } = await supabase.from('study_sessions').insert(session).select().single();
    if (error) {
      const local = { id: uid(), userId: CUR.id, ...payload, studiedAt: today(), createdAt: new Date().toISOString() };
      insert('studySessions', local);
      return ok(local);
    }

    const s = toCamel(data);
    insert('studySessions', s);
    return ok(s);
  },

  async addChapter(examId, title) {
    const chapter = {
      id:        uid(),
      examId,
      title,
      done:      false,
      createdAt: new Date().toISOString(),
    };

    const exam = DB.exams.find(e => e.id === examId);
    const newChapters = [...(exam?.chapters || []), chapter];

    const { error } = await supabase
      .from('exams')
      .update({ chapters: newChapters })
      .eq('id', examId);

    update('exams', examId, { chapters: newChapters });
    if (error) persist();
    return ok(chapter);
  },

  async toggleChapter(examId, chapterId) {
    const exam = DB.exams.find(e => e.id === examId);
    if (!exam) return fail('Esame non trovato');

    const newChapters = (exam.chapters || []).map(c =>
      c.id === chapterId ? { ...c, done: !c.done } : c
    );

    await supabase.from('exams').update({ chapters: newChapters }).eq('id', examId);
    update('exams', examId, { chapters: newChapters });
    return ok(true);
  },

  async deleteChapter(examId, chapterId) {
    const exam = DB.exams.find(e => e.id === examId);
    if (!exam) return fail('Esame non trovato');

    const newChapters = (exam.chapters || []).filter(c => c.id !== chapterId);
    await supabase.from('exams').update({ chapters: newChapters }).eq('id', examId);
    update('exams', examId, { chapters: newChapters });
    return ok(true);
  },

  async addConcept(examId, text) {
    const concept = {
      id:        uid(),
      examId,
      userId:    CUR.id,
      text,
      createdAt: new Date().toISOString(),
    };
    insert('concepts', concept);

    supabase.from('concepts')
      .insert({ id: concept.id, exam_id: examId, user_id: CUR.id, text, created_at: concept.createdAt })
      .then(({ error }) => { if (error) console.warn('[Study] concept sync:', error.message); });

    return ok(concept);
  },

  async deleteConcept(conceptId) {
    remove('concepts', conceptId);
    await supabase.from('concepts').delete().eq('id', conceptId);
    return ok(true);
  },

  async getConcepts(examId) {
    const { data, error } = await supabase
      .from('concepts')
      .select('*')
      .eq('exam_id', examId)
      .order('created_at', { ascending: true });

    if (error) {
      return ok((DB.concepts || []).filter(c => c.examId === examId));
    }

    const concepts = data.map(toCamel);
    const existing = new Set((DB.concepts || []).map(c => c.id));
    concepts.forEach(c => { if (!existing.has(c.id)) DB.concepts.push(c); });
    persist();
    return ok(concepts);
  },
};

// ── Books ────────────────────────────────────────────────────

export const Books = {
  async list(userId) {
    const { data, error } = await supabase
      .from('books')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return ok(byUser('books', userId));

    const books = data.map(toCamel);
    DB.books = books;
    persist();
    return ok(books);
  },

  async create(payload) {
    const { data, error } = await supabase
      .from('books')
      .insert({
        user_id:     CUR.id,
        title:       payload.title,
        author:      payload.author || '',
        genre:       payload.genre || 'narrativa',
        difficulty:  payload.difficulty || 1,
        total_pages: payload.totalPages || 0,
        cover_url:   payload.coverUrl || null,
      })
      .select()
      .single();

    if (error) {
      const local = {
        id:          uid(),
        userId:      CUR.id,
        currentPage: 0,
        completed:   false,
        createdAt:   new Date().toISOString(),
        ...payload,
      };
      insert('books', local);
      return ok(local);
    }

    const book = toCamel(data);
    insert('books', book);
    return ok(book);
  },

  async updateProgress(bookId, currentPage) {
    await supabase.from('books').update({ current_page: currentPage }).eq('id', bookId);
    const b = update('books', bookId, { currentPage });
    return ok(b);
  },

  async markDone(bookId) {
    await supabase.from('books').update({ completed: true, completed_at: today() }).eq('id', bookId);
    const b = update('books', bookId, { completed: true, completedAt: today() });
    return ok(b);
  },

 async logReading(payload) {
    const { data, error } = await supabase
      .from('reading_sessions')
      .insert({
        user_id:    CUR.id,
        book_id:    payload.bookId,
        pages_read: payload.pagesRead,
        xp_earned:  payload.xpEarned || 0,
        read_at:    today(),
      })
      .select()
      .single();
    if (error) {
      const local = { id: uid(), userId: CUR.id, ...payload, readAt: today(), createdAt: new Date().toISOString() };
      insert('readingSessions', local);
      return ok(local);
    }
    const s = toCamel(data);
    insert('readingSessions', s);
    return ok(s);
  },

  async getReadingSessions(bookId) {
    const { data, error } = await supabase
      .from('reading_sessions')
      .select('*')
      .eq('book_id', bookId)
      .eq('user_id', CUR.id)
      .order('created_at', { ascending: false });

    if (error) return ok((DB.readingSessions || []).filter(s => s.bookId === bookId));

    const sessions = data.map(toCamel);
    if (!DB.readingSessions) DB.readingSessions = [];
    const existing = new Set(DB.readingSessions.map(s => s.id));
    sessions.forEach(s => { if (!existing.has(s.id)) DB.readingSessions.push(s); });
    persist();
    return ok(sessions);
  },
  async getGlobalCatalog(query = '') {
    let q = supabase
      .from('global_books')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (query) q = q.or(`title.ilike.%${query}%,author.ilike.%${query}%`);

    const { data, error } = await q;
    if (error) return ok(DB.globalBooks || []);

    const books = data.map(toCamel);
    DB.globalBooks = books;
    persist();
    return ok(books);
  },

  async addToGlobalCatalog(payload) {
    const { data, error } = await supabase
      .from('global_books')
      .insert({
        title:    payload.title,
        author:   payload.author || '',
        genre:    payload.genre || 'narrativa',
        added_by: CUR.id,
      })
      .select()
      .single();

    if (error) {
      const local = { id: uid(), ...payload, addedBy: CUR.id, createdAt: new Date().toISOString() };
      insert('globalBooks', local);
      return ok(local);
    }

    const book = toCamel(data);
    insert('globalBooks', book);
    return ok(book);
  },

  async addNote(bookId, text) {
    const note = {
      id:        uid(),
      bookId,
      userId:    CUR.id,
      text,
      createdAt: new Date().toISOString(),
    };
    insert('bookNotes', note);

    supabase.from('book_notes')
      .insert({ id: note.id, book_id: bookId, user_id: CUR.id, text, created_at: note.createdAt })
      .then(({ error }) => { if (error) console.warn('[Books] note sync:', error.message); });

    return ok(note);
  },

  async deleteNote(noteId) {
    remove('bookNotes', noteId);
    await supabase.from('book_notes').delete().eq('id', noteId);
    return ok(true);
  },

  async getNotes(bookId) {
    const { data, error } = await supabase
      .from('book_notes')
      .select('*')
      .eq('book_id', bookId)
      .eq('user_id', CUR.id)
      .order('created_at', { ascending: true });

    if (error) {
      return ok((DB.bookNotes || []).filter(n => n.bookId === bookId && n.userId === CUR.id));
    }

    const notes = data.map(toCamel);
    if (!DB.bookNotes) DB.bookNotes = [];
    const existing = new Set(DB.bookNotes.map(n => n.id));
    notes.forEach(n => { if (!existing.has(n.id)) DB.bookNotes.push(n); });
    persist();
    return ok(notes);
  },

  async getReadersOfBook(globalBookId) {
    const gb = DB.globalBooks.find(b => b.id === globalBookId);
    if (!gb) return ok([]);

    const { data, error } = await supabase
      .from('books')
      .select('user_id, title, author')
      .ilike('title', gb.title)
      .neq('user_id', CUR.id);

    if (error) {
      const readers = Object.values(DB.users).filter(u =>
        u.id !== CUR.id &&
        DB.books.some(b => b.userId === u.id && b.title.toLowerCase() === gb.title.toLowerCase())
      );
      return ok(readers);
    }

    const userIds = [...new Set(data.map(r => r.user_id))];
    const readers = await Promise.all(userIds.map(async id => {
      if (DB.users[id]) return DB.users[id];
      const { ok: o, data: u } = await Users.get(id);
      return o ? u : null;
    }));

    return ok(readers.filter(Boolean));
  },
};

// ── Routines ─────────────────────────────────────────────────

export const Routines = {
  async list(userId) {
    const { data, error } = await supabase
      .from('routine_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return ok(byUser('routineLogs', userId));

    const logs = data.map(toCamel);
    DB.routineLogs = logs;
    persist();
    return ok(logs);
  },

  async log(payload) {
    const { data, error } = await supabase
      .from('routine_logs')
      .insert({
        user_id:    CUR.id,
        routine_id: payload.routineId,
        xp_earned:  payload.xpEarned || 5,
        done_at:    today(),
      })
      .select()
      .single();

    if (error) {
      const local = { id: uid(), userId: CUR.id, ...payload, doneAt: today(), createdAt: new Date().toISOString() };
      insert('routineLogs', local);
      return ok(local);
    }

    const log = toCamel(data);
    insert('routineLogs', log);
    return ok(log);
  },

  async createCustom(payload) {
    const { data, error } = await supabase
      .from('routines')
      .insert({
        user_id:    CUR.id,
        name:       payload.name,
        emoji:      payload.emoji || '⚡',
        category:   payload.category || 'routine',
        xp_value:   payload.xpValue || 10,
        is_default: false,
      })
      .select()
      .single();

    if (error) {
      const local = { id: uid(), userId: CUR.id, ...payload, isDefault: false, createdAt: new Date().toISOString() };
      insert('routines', local);
      return ok(local);
    }

    const routine = toCamel(data);
    insert('routines', routine);
    return ok(routine);
  },
};

// ── Challenges ───────────────────────────────────────────────
export const Challenges = {
  async list(userId) {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .or(`creator_id.eq.${userId},opponent_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error) return ok(DB.challenges.filter(c => c.creatorId === userId || c.opponentId === userId));
    const challenges = data.map(toCamel);
    DB.challenges = [
      ...DB.challenges.filter(c => c.creatorId !== userId && c.opponentId !== userId),
      ...challenges,
    ];
    persist();
    return ok(challenges);
  },

  async listPublic() {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('is_public', true)
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (error) return ok(DB.challenges.filter(c => c.isPublic && c.status === 'open'));
    return ok(data.map(toCamel));
  },

  async findByCode(code) {
    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('join_code', code)
      .eq('status', 'open')
      .limit(1);
    if (error || !data?.length) return fail('Sfida non trovata');
    const c = toCamel(data[0]);
    if (!DB.challenges.find(x => x.id === c.id)) DB.challenges.push(c);
    persist();
    return ok(c);
  },

  async create(payload) {
    const challenge = {
      creator_id: CUR.id,
      title:      payload.title,
      rules:      payload.rules || '',
      stake_xp:   payload.stakeXP || 50,
      type:       payload.type || 'mixed',
      is_public:  payload.isPublic !== false,
      join_code:  payload.isPublic ? null : String(Math.floor(1000 + Math.random() * 9000)),
      expires_at: payload.expiresAt || null,
      status:     'open',
    };
    const { data, error } = await supabase.from('challenges').insert(challenge).select().single();
    if (error) {
      const local = { id: uid(), createdAt: new Date().toISOString(), ...toCamel(challenge) };
      insert('challenges', local);
      return ok(local);
    }
    const c = toCamel(data);
    insert('challenges', c);
    return ok(c);
  },

  async join(challengeId, userId) {
    const { data, error } = await supabase
      .from('challenges')
      .update({ opponent_id: userId, status: 'active', joined_at: new Date().toISOString() })
      .eq('id', challengeId)
      .select()
      .single();
    if (error) return fail(error.message);
    const c = toCamel(data);
    update('challenges', challengeId, {
      opponentId: userId,
      status:     'active',
      joinedAt:   c.joinedAt,
    });
    return ok(c);
  },

  // Dichiara il vincitore provvisorio — aspetta conferma dell'avversario
  async claimWinner(challengeId, claimedWinnerId) {
    // Ottimistic update locale immediato
    update('challenges', challengeId, { claimedWinnerId });

    const { error } = await supabase
      .from('challenges')
      .update({ claimed_winner_id: claimedWinnerId })
      .eq('id', challengeId);
    if (error) {
      // Rollback
      update('challenges', challengeId, { claimedWinnerId: null });
      return fail(error.message);
    }
    return ok(null);
  },

  // Chiude la sfida con il vincitore definitivo (o pareggio se winnerId è null)
  async declareWinner(challengeId, winnerId) {
    const { data, error } = await supabase
      .from('challenges')
      .update({
        winner_id:         winnerId,
        status:            'completed',
        claimed_winner_id: null,   // pulisce la claim provvisoria
      })
      .eq('id', challengeId)
      .select()
      .single();
    if (error) return fail(error.message);
    const c = toCamel(data);
    update('challenges', challengeId, {
      winnerId:        c.winnerId,
      status:          'completed',
      claimedWinnerId: null,
    });
    return ok(c);
  },
};

// ── Feed ─────────────────────────────────────────────────────

export const Feed = {

  // FIX: join con post_likes per conteggio like corretto
  async get(userId, filter = 'all') {
    let query = supabase
      .from('feed_posts')
      .select(`
        *,
        post_likes ( user_id )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (filter === 'following') {
      const following = DB.users[userId]?.following || [];
      if (!following.length) return ok([]);
      // Mostra post dei seguiti + propri, indipendentemente da is_public
      query = query.in('user_id', [...following, userId]);
    }

    const { data, error } = await query;

    if (error) {
      let posts = [...DB.feedPosts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (filter === 'following') {
        const following = DB.users[userId]?.following || [];
        posts = posts.filter(p => following.includes(p.userId) || p.userId === userId);
      }
      return ok(posts);
    }

    const posts = data.map(p => {
      // Costruisci array likes dagli id nella tabella post_likes
      const likesList = (p.post_likes || []).map(l => l.user_id);
      return {
        ...toCamel(p),
        likes:    likesList,
        username: DB.users[p.user_id]?.username || 'Utente',
      };
    });

    DB.feedPosts = posts;
    persist();
    return ok(posts);
  },

 async create(payload) {
    const hiddenCats = DB.users[CUR.id]?.privacySettings?.hiddenCategories || [];
    console.log('[Privacy] categoria:', payload.category, 'nascoste:', hiddenCats);
    if (payload.category && hiddenCats.includes(payload.category)) {
      return ok(null);
    }
    const post = {
      user_id:   CUR.id,
      content:   payload.content,
      photo_url: payload.photoUrl || null,
      category:  payload.category || null,
      xp_earned: payload.xpEarned || 0,
      lang:      CUR.languages?.[0]?.slice(0, 2).toLowerCase() || 'it',
      ref_type:  payload.refType || null,
      ref_id:    payload.refId || null,
    };

    const { data, error } = await supabase.from('feed_posts').insert(post).select().single();
    if (error) {
      const local = {
        id:        uid(),
        userId:    CUR.id,
        username:  CUR.username,
        likes:     [],
        createdAt: new Date().toISOString(),
        ...payload,
      };
      insert('feedPosts', local);
      return ok(local);
    }

    const p = { ...toCamel(data), username: CUR.username, likes: [] };
    insert('feedPosts', p);
    return ok(p);
  },

  // FIX: usa post_likes invece di UPDATE su feed_posts (nessun blocco RLS)
  async toggleLike(postId, userId) {
    // Controlla se il like esiste già
    const { data: existing, error: checkErr } = await supabase
      .from('post_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkErr) return fail(checkErr.message);

    let liked;

    if (existing) {
      // Rimuovi like
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) return fail(error.message);
      liked = false;
    } else {
      // Aggiungi like
      const { error } = await supabase
        .from('post_likes')
        .insert({ post_id: postId, user_id: userId });

      if (error) return fail(error.message);
      liked = true;
    }

    // Aggiorna DB locale
    const postIdx = DB.feedPosts.findIndex(p => p.id === postId);
    if (postIdx !== -1) {
      const current = DB.feedPosts[postIdx].likes || [];
      DB.feedPosts[postIdx].likes = liked
        ? [...current, userId]
        : current.filter(id => id !== userId);
      persist();
    }

    const count = DB.feedPosts[postIdx]?.likes?.length || 0;
    return ok({ liked, count });
  },

  async getComments(postId) {
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) return ok(DB.comments.filter(c => c.postId === postId));
    return ok(data.map(toCamel));
  },

  // FIX: salva username denormalizzato così non serve join
  async addComment(payload) {
    const { data, error } = await supabase
      .from('comments')
      .insert({
        post_id:  payload.postId,
        user_id:  CUR.id,
        username: CUR.username,
        content:  payload.content,
      })
      .select()
      .single();

    if (error) {
      const local = {
        id:        uid(),
        postId:    payload.postId,
        userId:    CUR.id,
        username:  CUR.username,
        content:   payload.content,
        createdAt: new Date().toISOString(),
      };
      insert('comments', local);
      return ok(local);
    }

    const c = { ...toCamel(data), username: CUR.username };
    insert('comments', c);
    return ok(c);
  },

  async deleteComment(commentId) {
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    remove('comments', commentId);
    if (error) return fail(error.message);
    return ok(true);
  },

  async deletePost(postId) {
    await supabase.from('comments').delete().eq('post_id', postId);
    await supabase.from('post_likes').delete().eq('post_id', postId);
    DB.comments = DB.comments.filter(c => c.postId !== postId);

    const { error } = await supabase.from('feed_posts').delete().eq('id', postId);
    remove('feedPosts', postId);
    if (error) return fail(error.message);
    return ok(true);
  },
};

// ── Discussions ──────────────────────────────────────────────

export const Discussions = {
  async list(bookId) {
    let query = supabase
      .from('discussions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (bookId) query = query.eq('book_id', bookId);

    const { data, error } = await query;
    if (error) return ok(DB.discussions.filter(d => !bookId || d.bookId === bookId));

    const discs = data.map(d => ({
      ...toCamel(d),
      username: DB.users[d.user_id]?.username || 'Utente',
    }));
    DB.discussions = discs;
    persist();
    return ok(discs);
  },

  async create(payload) {
    const { data, error } = await supabase
      .from('discussions')
      .insert({
        user_id:  CUR.id,
        book_id:  payload.bookId || null,
        title:    payload.title || '',
        content:  payload.content,
        type:     payload.type || 'discussion',
        likes:    [],
      })
      .select()
      .single();

    if (error) {
      const local = {
        id:        uid(),
        userId:    CUR.id,
        username:  CUR.username,
        likes:     [],
        createdAt: new Date().toISOString(),
        ...payload,
      };
      insert('discussions', local);
      return ok(local);
    }

    const d = { ...toCamel(data), username: CUR.username };
    insert('discussions', d);
    return ok(d);
  },

  async addReply(payload) {
    const { data, error } = await supabase
      .from('discussion_replies')
      .insert({
        discussion_id: payload.discussionId,
        user_id:       CUR.id,
        username:      CUR.username,
        content:       payload.content,
      })
      .select()
      .single();

    if (error) {
      const local = {
        id:            uid(),
        discussionId:  payload.discussionId,
        userId:        CUR.id,
        username:      CUR.username,
        content:       payload.content,
        createdAt:     new Date().toISOString(),
      };
      insert('discussionReplies', local);
      return ok(local);
    }

    const r = { ...toCamel(data), username: CUR.username };
    insert('discussionReplies', r);
    return ok(r);
  },

  async getReplies(discussionId) {
    const { data, error } = await supabase
      .from('discussion_replies')
      .select('*')
      .eq('discussion_id', discussionId)
      .order('created_at', { ascending: true });

    if (error) return ok(DB.discussionReplies.filter(r => r.discussionId === discussionId));
    return ok(data.map(r => ({
      ...toCamel(r),
      username: r.username || DB.users[r.user_id]?.username || 'Utente',
    })));
  },

  async deleteReply(replyId) {
    await supabase.from('discussion_replies').delete().eq('id', replyId);
    remove('discussionReplies', replyId);
    return ok(true);
  },

  async toggleLike(discussionId, userId) {
    const disc  = findById('discussions', discussionId);
    const liked = disc?.likes?.includes(userId);
    const likes = liked
      ? (disc.likes || []).filter(id => id !== userId)
      : [...(disc?.likes || []), userId];

    await supabase.from('discussions').update({ likes }).eq('id', discussionId);
    update('discussions', discussionId, { likes });
    return ok({ liked: !liked, count: likes.length });
  },
};

// ── Moderation ───────────────────────────────────────────────

export const Moderation = {
  async getBannedWords() {
    const { data, error } = await supabase.from('banned_words').select('word');
    if (error) return ok(DB.bannedWords);

    const words = data.map(r => r.word);
    DB.bannedWords = words;
    persist();
    return ok(words);
  },
};

export async function syncCloudDataOnLogin(userId) {
  try {
    const [freshProfile, quests, books, sessions, exams, concepts, bookNotes, feedPosts, comments] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      supabase.from('quests').select('*').eq('user_id', userId),
      supabase.from('books').select('*').eq('user_id', userId),
      supabase.from('study_sessions').select('*').eq('user_id', userId),
      supabase.from('exams').select('*').eq('user_id', userId),
      supabase.from('concepts').select('*').eq('user_id', userId),
      supabase.from('book_notes').select('*').eq('user_id', userId),
      supabase.from('feed_posts')
        .select('*, post_likes(user_id)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('comments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    if (freshProfile.data) {
      DB.users[userId] = { ...DB.users[userId], ...toCamel(freshProfile.data) };
      persist();
    }
    if (quests.data)    DB.quests        = quests.data.map(toCamel);
    if (books.data)     DB.books         = books.data.map(toCamel);
    if (sessions.data)  DB.studySessions = sessions.data.map(toCamel);
    if (exams.data)     DB.exams         = exams.data.map(toCamel);
    if (concepts.data)  DB.concepts      = concepts.data.map(toCamel);
    if (bookNotes.data) DB.bookNotes     = bookNotes.data.map(toCamel);
    if (feedPosts.data) {
      DB.feedPosts = feedPosts.data.map(p => ({
        ...toCamel(p),
        likes: (p.post_likes || []).map(l => l.user_id),
      }));
    }
    if (comments.data) {
      DB.comments = comments.data.map(c => ({
        ...toCamel(c),
        username: c.username || DB.users[c.user_id]?.username || 'Utente',
      }));
    }
    persist();

    // Sync personaggio battle (fire-and-forget)
    import('./battle/character.js').then(({ syncBattleCharacter }) => {
      syncBattleCharacter(userId);
    });

  } catch (e) {
    console.warn('[Sync] Errore sync:', e);
  }
}
