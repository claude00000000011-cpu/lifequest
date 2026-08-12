{\rtf1\ansi\ansicpg1252\deff0\nouicompat{\fonttbl{\f0\fnil\fcharset0 Calibri;}{\f1\fnil Calibri;}{\f2\fnil\fcharset1 Segoe UI Symbol;}{\f3\fnil\fcharset1 Cambria Math;}}
{\*\generator Riched20 10.0.19041}{\*\mmathPr\mmathFont3\mwrapIndent1440 }\viewkind4\uc1 
\pard\sa200\sl276\slmult1\f0\fs22\lang16\par
// ============================================================\par
// api.js \f1\emdash  Layer API LifeQuest (Fase 2: Supabase)\par
// ============================================================\par
// CONTRATTO: ogni metodo restituisce Promise<\{ ok, data, error \}>\par
// ============================================================\par
\par
import \{ supabase \} from './supabase.js';\par
import \{ DB, CUR, persist, insert, update, remove, findById, byUser \} from './db.js';\par
import \{ uid, today \} from './utils.js';\par
\par
// \f2\u9472?\u9472?\f0  Helper \f2\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\f0\par
\par
function ok(data)    \{ return \{ ok: true,  data, error: null \}; \}\par
function fail(error) \{ return \{ ok: false, data: null, error \}; \}\par
\par
// Converte snake_case Supabase \f3\u8594?\f0  camelCase locale\par
function toCamel(obj) \{\par
  if (!obj || typeof obj !== 'object') return obj;\par
  const out = \{\};\par
  for (const [k, v] of Object.entries(obj)) \{\par
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());\par
    out[camel] = v;\par
  \}\par
  return out;\par
\}\par
\par
// Converte camelCase \f3\u8594?\f0  snake_case per Supabase\par
function toSnake(obj) \{\par
  if (!obj || typeof obj !== 'object') return obj;\par
  const out = \{\};\par
  for (const [k, v] of Object.entries(obj)) \{\par
    const snake = k.replace(/([A-Z])/g, '_$1').toLowerCase();\par
    out[snake] = v;\par
  \}\par
  return out;\par
\}\par
\par
// \f2\u9472?\u9472?\f0  Auth \f2\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\f0\par
\par
export const Auth = \{\par
  async register(username, passwordHash, pinHash) \{\par
    if (!username || !passwordHash || !pinHash) return fail('Dati mancanti');\par
    if (username.length < 3) return fail('Username troppo corto');\par
\par
    // Controlla se username esiste gi\'e0\par
    const \{ data: existing \} = await supabase\par
      .from('users')\par
      .select('id')\par
      .ilike('username', username)\par
      .maybeSingle();\par
\par
    if (existing) return fail('Username gi\'e0 in uso');\par
\par
    // Registra con Supabase Auth usando email fittizia\par
    const fakeEmail = `$\{username.toLowerCase()\}@lifequest.app`;\par
    const \{ data: authData, error: authErr \} = await supabase.auth.signUp(\{\par
      email: fakeEmail,\par
      password: passwordHash,\par
    \});\par
\par
    if (authErr) return fail(authErr.message);\par
\par
    const userId = authData.user?.id;\par
    if (!userId) return fail('Errore nella creazione account');\par
\par
    // Crea profilo utente\par
    const profile = \{\par
      id:            userId,\par
      username,\par
      password_hash: passwordHash,\par
      pin_hash:      pinHash,\par
      xp:            0,\par
      level:         1,\par
      streak:        0,\par
      last_active:   today(),\par
      rank_title:    'Novizio',\par
      is_public:     true,\par
      languages:     [],\par
      stats:         \{ mente: 0, corpo: 0, cultura: 0, sociale: 0, sfide: 0 \},\par
      trophies:      [],\par
      following:     [],\par
      followers:     [],\par
      created_at:    new Date().toISOString(),\par
    \};\par
\par
    const \{ error: profileErr \} = await supabase.from('users').insert(profile);\par
    if (profileErr) return fail(profileErr.message);\par
\par
    const user = \{ ...toCamel(profile), id: userId \};\par
    DB.users[userId] = user;\par
    persist();\par
\par
    return ok(user);\par
  \},\par
\par
  async login(username, passwordHash) \{\par
    if (!username || !passwordHash) return fail('Dati mancanti');\par
\par
    const fakeEmail = `$\{username.toLowerCase()\}@lifequest.app`;\par
    const \{ data: authData, error: authErr \} = await supabase.auth.signInWithPassword(\{\par
      email: fakeEmail,\par
      password: passwordHash,\par
    \});\par
\par
    if (authErr) \{\par
      // Fallback locale\par
      const user = Object.values(DB.users).find(\par
        u => u.username.toLowerCase() === username.toLowerCase()\par
          && u.passwordHash === passwordHash\par
      );\par
      if (!user) return fail('Credenziali non valide');\par
      return ok(user);\par
    \}\par
\par
    const userId = authData.user?.id;\par
\par
    // Carica profilo da Supabase\par
    const \{ data: profile, error: profileErr \} = await supabase\par
      .from('users')\par
      .select('*')\par
      .eq('id', userId)\par
      .single();\par
\par
    if (profileErr) return fail(profileErr.message);\par
\par
    const user = toCamel(profile);\par
    DB.users[userId] = user;\par
    persist();\par
\par
    return ok(user);\par
  \},\par
\par
  async resetPin(username, pinHash, newPasswordHash) \{\par
    // Cerca utente locale\par
    const user = Object.values(DB.users).find(\par
      u => u.username.toLowerCase() === username.toLowerCase()\par
        && u.pinHash === pinHash\par
    );\par
    if (!user) return fail('PIN o username non validi');\par
\par
    const \{ error \} = await supabase\par
      .from('users')\par
      .update(\{ password_hash: newPasswordHash \})\par
      .eq('id', user.id);\par
\par
    if (error) return fail(error.message);\par
\par
    DB.users[user.id].passwordHash = newPasswordHash;\par
    persist();\par
    return ok(true);\par
  \},\par
\};\par
\par
// \f2\u9472?\u9472?\f0  Users \f2\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\f0\par
\par
export const Users = \{\par
  async get(userId) \{\par
    const \{ data, error \} = await supabase\par
      .from('users')\par
      .select('*')\par
      .eq('id', userId)\par
      .single();\par
\par
    if (error) \{\par
      const local = DB.users[userId];\par
      return local ? ok(local) : fail('Utente non trovato');\par
    \}\par
\par
    const user = toCamel(data);\par
    DB.users[userId] = user;\par
    persist();\par
    return ok(user);\par
  \},\par
\par
  async update(userId, patch) \{\par
    const snakePatch = toSnake(patch);\par
    const \{ error \} = await supabase\par
      .from('users')\par
      .update(snakePatch)\par
      .eq('id', userId);\par
\par
    if (error) return fail(error.message);\par
\par
    DB.users[userId] = \{ ...DB.users[userId], ...patch \};\par
    persist();\par
    return ok(DB.users[userId]);\par
  \},\par
\par
  async search(query) \{\par
    if (!query || query.length < 2) return ok([]);\par
\par
    const \{ data, error \} = await supabase\par
      .from('users')\par
      .select('id, username, level, rank_title, xp, followers, avatar_url, is_public')\par
      .ilike('username', `%$\{query\}%`)\par
      .eq('is_public', true)\par
      .neq('id', CUR?.id)\par
      .limit(20);\par
\par
    if (error) \{\par
      const q = query.toLowerCase();\par
      return ok(Object.values(DB.users)\par
        .filter(u => u.username.toLowerCase().includes(q) && u.id !== CUR?.id)\par
        .slice(0, 20));\par
    \}\par
\par
    return ok(data.map(toCamel));\par
  \},\par
\par
  async getLeaderboard() \{\par
    const \{ data, error \} = await supabase\par
      .from('users')\par
      .select('id, username, xp, level, rank_title, avatar_url')\par
      .eq('is_public', true)\par
      .order('xp', \{ ascending: false \})\par
      .limit(50);\par
\par
    if (error) \{\par
      return ok(Object.values(DB.users)\par
        .filter(u => u.isPublic)\par
        .sort((a, b) => b.xp - a.xp)\par
        .slice(0, 50));\par
    \}\par
\par
    return ok(data.map(toCamel));\par
  \},\par
\par
  async follow(userId, targetId) \{\par
    const user   = DB.users[userId];\par
    const target = DB.users[targetId];\par
\par
    if (!user.following.includes(targetId)) user.following.push(targetId);\par
    if (target && !target.followers.includes(userId)) target.followers.push(userId);\par
\par
    await supabase.from('users').update(\{ following: user.following \}).eq('id', userId);\par
    if (target) await supabase.from('users').update(\{ followers: target.followers \}).eq('id', targetId);\par
\par
    persist();\par
    return ok(true);\par
  \},\par
\par
  async unfollow(userId, targetId) \{\par
    const user   = DB.users[userId];\par
    const target = DB.users[targetId];\par
\par
    user.following = user.following.filter(id => id !== targetId);\par
    if (target) target.followers = target.followers.filter(id => id !== userId);\par
\par
    await supabase.from('users').update(\{ following: user.following \}).eq('id', userId);\par
    if (target) await supabase.from('users').update(\{ followers: target.followers \}).eq('id', targetId);\par
\par
    persist();\par
    return ok(true);\par
  \},\par
\};\par
\par
// \f2\u9472?\u9472?\f0  Quests \f2\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\f0\par
\par
export const Quests = \{\par
  async list(userId) \{\par
    const \{ data, error \} = await supabase\par
      .from('quests')\par
      .select('*')\par
      .eq('user_id', userId)\par
      .order('created_at', \{ ascending: false \});\par
\par
    if (error) return ok(byUser('quests', userId));\par
\par
    const quests = data.map(toCamel);\par
    DB.quests = quests;\par
    persist();\par
    return ok(quests);\par
  \},\par
\par
  async create(payload) \{\par
    const quest = \{\par
      user_id:      CUR.id,\par
      title:        payload.title,\par
      category:     payload.category || 'altro',\par
      difficulty:   payload.difficulty || 1,\par
      xp_value:     payload.xpValue || 10,\par
      photo_url:    payload.photoUrl || null,\par
      completed:    false,\par
      completed_at: null,\par
      type:         payload.type || 'todo',\par
      due_date:     payload.dueDate || null,\par
    \};\par
\par
    const \{ data, error \} = await supabase.from('quests').insert(quest).select().single();\par
    if (error) \{\par
      const local = \{ id: uid(), userId: CUR.id, ...payload, completed: false, createdAt: new Date().toISOString() \};\par
      insert('quests', local);\par
      return ok(local);\par
    \}\par
\par
    const q = toCamel(data);\par
    insert('quests', q);\par
    return ok(q);\par
  \},\par
\par
  async complete(questId) \{\par
    const \{ data, error \} = await supabase\par
      .from('quests')\par
      .update(\{ completed: true, completed_at: today() \})\par
      .eq('id', questId)\par
      .select()\par
      .single();\par
\par
    if (error) \{\par
      update('quests', questId, \{ completed: true, completedAt: today() \});\par
      return ok(DB.quests.find(q => q.id === questId));\par
    \}\par
\par
    const q = toCamel(data);\par
    update('quests', questId, \{ completed: true, completedAt: today() \});\par
    return ok(q);\par
  \},\par
\par
  async delete(questId) \{\par
    await supabase.from('quests').delete().eq('id', questId);\par
    remove('quests', questId);\par
    return ok(true);\par
  \},\par
\};\par
\par
// \f2\u9472?\u9472?\f0  Study \f2\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\f0\par
\par
export const Study = \{\par
  async getExams(userId) \{\par
    const \{ data, error \} = await supabase\par
      .from('exams')\par
      .select('*')\par
      .eq('user_id', userId)\par
      .order('created_at', \{ ascending: false \});\par
\par
    if (error) return ok(byUser('exams', userId));\par
\par
    const exams = data.map(toCamel);\par
    DB.exams = exams;\par
    persist();\par
    return ok(exams);\par
  \},\par
\par
  async createExam(payload) \{\par
    const \{ data, error \} = await supabase\par
      .from('exams')\par
      .insert(\{ user_id: CUR.id, name: payload.name, exam_date: payload.examDate || null, chapters: payload.chapters || [] \})\par
      .select()\par
      .single();\par
\par
    if (error) \{\par
      const local = \{ id: uid(), userId: CUR.id, ...payload, createdAt: new Date().toISOString() \};\par
      insert('exams', local);\par
      return ok(local);\par
    \}\par
\par
    const exam = toCamel(data);\par
    insert('exams', exam);\par
    return ok(exam);\par
  \},\par
\par
  async updateExam(examId, patch) \{\par
    const \{ error \} = await supabase.from('exams').update(toSnake(patch)).eq('id', examId);\par
    if (error) return fail(error.message);\par
    const e = update('exams', examId, patch);\par
    return ok(e);\par
  \},\par
\par
  async logSession(payload) \{\par
    const session = \{\par
      user_id:     CUR.id,\par
      exam_id:     payload.examId || null,\par
      minutes:     payload.minutes,\par
      focus_score: payload.focusScore || 5,\par
      xp_earned:   payload.xpEarned || 0,\par
      notes:       payload.notes || '',\par
      studied_at:  today(),\par
    \};\par
\par
    const \{ data, error \} = await supabase.from('study_sessions').insert(session).select().single();\par
    if (error) \{\par
      const local = \{ id: uid(), userId: CUR.id, ...payload, studiedAt: today(), createdAt: new Date().toISOString() \};\par
      insert('studySessions', local);\par
      return ok(local);\par
    \}\par
\par
    const s = toCamel(data);\par
    insert('studySessions', s);\par
    return ok(s);\par
  \},\par
\};\par
\par
// \f2\u9472?\u9472?\f0  Books \f2\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\f0\par
\par
export const Books = \{\par
  async list(userId) \{\par
    const \{ data, error \} = await supabase\par
      .from('books')\par
      .select('*')\par
      .eq('user_id', userId)\par
      .order('created_at', \{ ascending: false \});\par
\par
    if (error) return ok(byUser('books', userId));\par
\par
    const books = data.map(toCamel);\par
    DB.books = books;\par
    persist();\par
    return ok(books);\par
  \},\par
\par
  async create(payload) \{\par
    const \{ data, error \} = await supabase\par
      .from('books')\par
      .insert(\{\par
        user_id:     CUR.id,\par
        title:       payload.title,\par
        author:      payload.author || '',\par
        genre:       payload.genre || 'narrativa',\par
        difficulty:  payload.difficulty || 1,\par
        total_pages: payload.totalPages || 0,\par
        cover_url:   payload.coverUrl || null,\par
      \})\par
      .select()\par
      .single();\par
\par
    if (error) \{\par
      const local = \{ id: uid(), userId: CUR.id, ...payload, currentPage: 0, completed: false, createdAt: new Date().toISOString() \};\par
      insert('books', local);\par
      return ok(local);\par
    \}\par
\par
    const book = toCamel(data);\par
    insert('books', book);\par
    return ok(book);\par
  \},\par
\par
  async updateProgress(bookId, currentPage) \{\par
    await supabase.from('books').update(\{ current_page: currentPage \}).eq('id', bookId);\par
    const b = update('books', bookId, \{ currentPage \});\par
    return ok(b);\par
  \},\par
\par
  async markDone(bookId) \{\par
    await supabase.from('books').update(\{ completed: true, completed_at: today() \}).eq('id', bookId);\par
    const b = update('books', bookId, \{ completed: true, completedAt: today() \});\par
    return ok(b);\par
  \},\par
\par
  async logReading(payload) \{\par
    const \{ data, error \} = await supabase\par
      .from('reading_sessions')\par
      .insert(\{ user_id: CUR.id, book_id: payload.bookId, pages_read: payload.pagesRead, xp_earned: payload.xpEarned || 0, read_at: today() \})\par
      .select()\par
      .single();\par
\par
    if (error) \{\par
      const local = \{ id: uid(), userId: CUR.id, ...payload, readAt: today(), createdAt: new Date().toISOString() \};\par
      insert('readingSessions', local);\par
      return ok(local);\par
    \}\par
\par
    const s = toCamel(data);\par
    insert('readingSessions', s);\par
    return ok(s);\par
  \},\par
\par
  async getGlobalCatalog(query = '') \{\par
    let q = supabase.from('global_books').select('*').order('created_at', \{ ascending: false \}).limit(100);\par
    if (query) q = q.or(`title.ilike.%$\{query\}%,author.ilike.%$\{query\}%`);\par
\par
    const \{ data, error \} = await q;\par
    if (error) return ok(DB.globalBooks);\par
\par
    const books = data.map(toCamel);\par
    DB.globalBooks = books;\par
    persist();\par
    return ok(books);\par
  \},\par
\par
  async addToGlobalCatalog(payload) \{\par
    const \{ data, error \} = await supabase\par
      .from('global_books')\par
      .insert(\{ title: payload.title, author: payload.author || '', genre: payload.genre || 'narrativa', added_by: CUR.id \})\par
      .select()\par
      .single();\par
\par
    if (error) \{\par
      const local = \{ id: uid(), ...payload, addedBy: CUR.id, createdAt: new Date().toISOString() \};\par
      insert('globalBooks', local);\par
      return ok(local);\par
    \}\par
\par
    const book = toCamel(data);\par
    insert('globalBooks', book);\par
    return ok(book);\par
  \},\par
\};\par
\par
// \f2\u9472?\u9472?\f0  Routines \f2\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\f0\par
\par
export const Routines = \{\par
  async list(userId) \{\par
    const \{ data, error \} = await supabase\par
      .from('routine_logs')\par
      .select('*')\par
      .eq('user_id', userId)\par
      .order('created_at', \{ ascending: false \});\par
\par
    if (error) return ok(byUser('routineLogs', userId));\par
\par
    const logs = data.map(toCamel);\par
    DB.routineLogs = logs;\par
    persist();\par
    return ok(logs);\par
  \},\par
\par
  async log(payload) \{\par
    const \{ data, error \} = await supabase\par
      .from('routine_logs')\par
      .insert(\{ user_id: CUR.id, routine_id: payload.routineId, xp_earned: payload.xpEarned || 5, done_at: today() \})\par
      .select()\par
      .single();\par
\par
    if (error) \{\par
      const local = \{ id: uid(), userId: CUR.id, ...payload, doneAt: today(), createdAt: new Date().toISOString() \};\par
      insert('routineLogs', local);\par
      return ok(local);\par
    \}\par
\par
    const log = toCamel(data);\par
    insert('routineLogs', log);\par
    return ok(log);\par
  \},\par
\par
  async createCustom(payload) \{\par
    const \{ data, error \} = await supabase\par
      .from('routines')\par
      .insert(\{ user_id: CUR.id, name: payload.name, emoji: payload.emoji || '\f2\u9889?\f0 ', category: payload.category || 'routine', xp_value: payload.xpValue || 10, is_default: false \})\par
      .select()\par
      .single();\par
\par
    if (error) \{\par
      const local = \{ id: uid(), userId: CUR.id, ...payload, isDefault: false, createdAt: new Date().toISOString() \};\par
      insert('routines', local);\par
      return ok(local);\par
    \}\par
\par
    const routine = toCamel(data);\par
    insert('routines', routine);\par
    return ok(routine);\par
  \},\par
\};\par
\par
// \f2\u9472?\u9472?\f0  Challenges \f2\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\f0\par
\par
export const Challenges = \{\par
  async list(userId) \{\par
    const \{ data, error \} = await supabase\par
      .from('challenges')\par
      .select('*')\par
      .or(`creator_id.eq.$\{userId\},opponent_id.eq.$\{userId\}`)\par
      .order('created_at', \{ ascending: false \});\par
\par
    if (error) return ok(DB.challenges.filter(c => c.creatorId === userId || c.opponentId === userId));\par
\par
    const challenges = data.map(toCamel);\par
    DB.challenges = [...DB.challenges.filter(c => c.creatorId !== userId && c.opponentId !== userId), ...challenges];\par
    persist();\par
    return ok(challenges);\par
  \},\par
\par
  async listPublic() \{\par
    const \{ data, error \} = await supabase\par
      .from('challenges')\par
      .select('*')\par
      .eq('is_public', true)\par
      .eq('status', 'open')\par
      .order('created_at', \{ ascending: false \});\par
\par
    if (error) return ok(DB.challenges.filter(c => c.isPublic && c.status === 'open'));\par
    return ok(data.map(toCamel));\par
  \},\par
\par
  async create(payload) \{\par
    const challenge = \{\par
      creator_id:  CUR.id,\par
      title:       payload.title,\par
      rules:       payload.rules || '',\par
      stake_xp:    payload.stakeXP || 50,\par
      type:        payload.type || 'mixed',\par
      is_public:   payload.isPublic !== false,\par
      join_code:   payload.isPublic ? null : String(Math.floor(1000 + Math.random() * 9000)),\par
      expires_at:  payload.expiresAt || null,\par
      status:      'open',\par
    \};\par
\par
    const \{ data, error \} = await supabase.from('challenges').insert(challenge).select().single();\par
    if (error) \{\par
      const local = \{ id: uid(), createdAt: new Date().toISOString(), ...toCamel(challenge) \};\par
      insert('challenges', local);\par
      return ok(local);\par
    \}\par
\par
    const c = toCamel(data);\par
    insert('challenges', c);\par
    return ok(c);\par
  \},\par
\par
  async join(challengeId, userId) \{\par
    const \{ data, error \} = await supabase\par
      .from('challenges')\par
      .update(\{ opponent_id: userId, status: 'active' \})\par
      .eq('id', challengeId)\par
      .select()\par
      .single();\par
\par
    if (error) return fail(error.message);\par
    const c = toCamel(data);\par
    update('challenges', challengeId, \{ opponentId: userId, status: 'active' \});\par
    return ok(c);\par
  \},\par
\par
  async declareWinner(challengeId, winnerId) \{\par
    const \{ data, error \} = await supabase\par
      .from('challenges')\par
      .update(\{ winner_id: winnerId, status: 'completed' \})\par
      .eq('id', challengeId)\par
      .select()\par
      .single();\par
\par
    if (error) return fail(error.message);\par
    const c = toCamel(data);\par
    update('challenges', challengeId, \{ winnerId, status: 'completed' \});\par
    return ok(c);\par
  \},\par
\};\par
\par
// \f2\u9472?\u9472?\f0  Feed \f2\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\f0\par
\par
export const Feed = \{\par
  async get(userId, filter = 'all') \{\par
    let query = supabase\par
      .from('feed_posts')\par
      .select('*')\par
      .order('created_at', \{ ascending: false \})\par
      .limit(50);\par
\par
    if (filter === 'following') \{\par
      const following = DB.users[userId]?.following || [];\par
      if (!following.length) return ok([]);\par
      query = query.in('user_id', [...following, userId]);\par
    \}\par
\par
    const \{ data, error \} = await query;\par
    if (error) \{\par
      let posts = [...DB.feedPosts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));\par
      if (filter === 'following') \{\par
        const following = DB.users[userId]?.following || [];\par
        posts = posts.filter(p => following.includes(p.userId) || p.userId === userId);\par
      \}\par
      return ok(posts);\par
    \}\par
\par
    const posts = data.map(p => (\{ ...toCamel(p), username: DB.users[p.user_id]?.username || 'Utente' \}));\par
    DB.feedPosts = posts;\par
    persist();\par
    return ok(posts);\par
  \},\par
\par
  async create(payload) \{\par
    const post = \{\par
      user_id:   CUR.id,\par
      content:   payload.content,\par
      photo_url: payload.photoUrl || null,\par
      category:  payload.category || null,\par
      xp_earned: payload.xpEarned || 0,\par
      likes:     [],\par
      lang:      'it',\par
      ref_type:  payload.refType || null,\par
      ref_id:    payload.refId || null,\par
    \};\par
\par
    const \{ data, error \} = await supabase.from('feed_posts').insert(post).select().single();\par
    if (error) \{\par
      const local = \{ id: uid(), userId: CUR.id, username: CUR.username, ...payload, likes: [], createdAt: new Date().toISOString() \};\par
      insert('feedPosts', local);\par
      return ok(local);\par
    \}\par
\par
    const p = \{ ...toCamel(data), username: CUR.username \};\par
    insert('feedPosts', p);\par
    return ok(p);\par
  \},\par
\par
  async toggleLike(postId, userId) \{\par
    const post = findById('feedPosts', postId);\par
    const liked = post?.likes?.includes(userId);\par
    const likes = liked\par
      ? (post.likes || []).filter(id => id !== userId)\par
      : [...(post?.likes || []), userId];\par
\par
    await supabase.from('feed_posts').update(\{ likes \}).eq('id', postId);\par
    update('feedPosts', postId, \{ likes \});\par
    return ok(\{ liked: !liked, count: likes.length \});\par
  \},\par
\par
  async getComments(postId) \{\par
    const \{ data, error \} = await supabase\par
      .from('comments')\par
      .select('*')\par
      .eq('post_id', postId)\par
      .order('created_at', \{ ascending: true \});\par
\par
    if (error) return ok(DB.comments.filter(c => c.postId === postId));\par
    return ok(data.map(toCamel));\par
  \},\par
\par
  async addComment(payload) \{\par
    const \{ data, error \} = await supabase\par
      .from('comments')\par
      .insert(\{ post_id: payload.postId, user_id: CUR.id, content: payload.content \})\par
      .select()\par
      .single();\par
\par
    if (error) \{\par
      const local = \{ id: uid(), postId: payload.postId, userId: CUR.id, username: CUR.username, content: payload.content, createdAt: new Date().toISOString() \};\par
      insert('comments', local);\par
      return ok(local);\par
    \}\par
\par
    const c = \{ ...toCamel(data), username: CUR.username \};\par
    insert('comments', c);\par
    return ok(c);\par
  \},\par
\};\par
\par
// \f2\u9472?\u9472?\f0  Discussions \f2\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\f0\par
\par
export const Discussions = \{\par
  async list(bookId) \{\par
    let query = supabase.from('discussions').select('*').order('created_at', \{ ascending: false \}).limit(50);\par
    if (bookId) query = query.eq('book_id', bookId);\par
\par
    const \{ data, error \} = await query;\par
    if (error) return ok(DB.discussions.filter(d => !bookId || d.bookId === bookId));\par
\par
    const discs = data.map(d => (\{ ...toCamel(d), username: DB.users[d.user_id]?.username || 'Utente' \}));\par
    DB.discussions = discs;\par
    persist();\par
    return ok(discs);\par
  \},\par
\par
  async create(payload) \{\par
    const \{ data, error \} = await supabase\par
      .from('discussions')\par
      .insert(\{ user_id: CUR.id, book_id: payload.bookId || null, title: payload.title || '', content: payload.content, type: payload.type || 'discussion', likes: [] \})\par
      .select()\par
      .single();\par
\par
    if (error) \{\par
      const local = \{ id: uid(), userId: CUR.id, username: CUR.username, ...payload, likes: [], createdAt: new Date().toISOString() \};\par
      insert('discussions', local);\par
      return ok(local);\par
    \}\par
\par
    const d = \{ ...toCamel(data), username: CUR.username \};\par
    insert('discussions', d);\par
    return ok(d);\par
  \},\par
\par
  async addReply(payload) \{\par
    const \{ data, error \} = await supabase\par
      .from('discussion_replies')\par
      .insert(\{ discussion_id: payload.discussionId, user_id: CUR.id, content: payload.content \})\par
      .select()\par
      .single();\par
\par
    if (error) \{\par
      const local = \{ id: uid(), discussionId: payload.discussionId, userId: CUR.id, username: CUR.username, content: payload.content, createdAt: new Date().toISOString() \};\par
      insert('discussionReplies', local);\par
      return ok(local);\par
    \}\par
\par
    const r = \{ ...toCamel(data), username: CUR.username \};\par
    insert('discussionReplies', r);\par
    return ok(r);\par
  \},\par
\par
  async toggleLike(discussionId, userId) \{\par
    const disc = findById('discussions', discussionId);\par
    const liked = disc?.likes?.includes(userId);\par
    const likes = liked\par
      ? (disc.likes || []).filter(id => id !== userId)\par
      : [...(disc?.likes || []), userId];\par
\par
    await supabase.from('discussions').update(\{ likes \}).eq('id', discussionId);\par
    update('discussions', discussionId, \{ likes \});\par
    return ok(\{ liked: !liked, count: likes.length \});\par
  \},\par
\};\par
\par
// \f2\u9472?\u9472?\f0  Moderation \f2\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\f0\par
\par
export const Moderation = \{\par
  async getBannedWords() \{\par
    const \{ data, error \} = await supabase.from('banned_words').select('word');\par
    if (error) return ok(DB.bannedWords);\par
\par
    const words = data.map(r => r.word);\par
    DB.bannedWords = words;\par
    persist();\par
    return ok(words);\par
  \},\par
\};\par
\par
// \f2\u9472?\u9472?\f0  Sync \f2\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\u9472?\f0\par
\par
export async function syncCloudDataOnLogin(userId) \{\par
  try \{\par
    const [quests, books, sessions, exams] = await Promise.all([\par
      supabase.from('quests').select('*').eq('user_id', userId),\par
      supabase.from('books').select('*').eq('user_id', userId),\par
      supabase.from('study_sessions').select('*').eq('user_id', userId),\par
      supabase.from('exams').select('*').eq('user_id', userId),\par
    ]);\par
\par
    if (quests.data)   DB.quests        = quests.data.map(toCamel);\par
    if (books.data)    DB.books         = books.data.map(toCamel);\par
    if (sessions.data) DB.studySessions = sessions.data.map(toCamel);\par
    if (exams.data)    DB.exams         = exams.data.map(toCamel);\par
\par
    persist();\par
  \} catch (e) \{\par
    console.warn('[Sync] Errore sync:', e);\par
  \}\par
\}\par
\par
}
 