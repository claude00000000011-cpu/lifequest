-- ============================================================
-- schema.sql — Schema PostgreSQL per LifeQuest (Supabase)
-- Fase 2: sostituisce il localStorage come database principale
-- ============================================================

-- Estensioni
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- ricerca full-text veloce

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username        TEXT        UNIQUE NOT NULL,
  password_hash   TEXT        NOT NULL,
  pin_hash        TEXT        NOT NULL,
  avatar_url      TEXT,
  xp              INTEGER     DEFAULT 0    NOT NULL,
  level           INTEGER     DEFAULT 1    NOT NULL,
  streak          INTEGER     DEFAULT 0    NOT NULL,
  last_active     DATE,
  rank_title      TEXT        DEFAULT 'Novizio',
  is_public       BOOLEAN     DEFAULT true NOT NULL,
  languages       TEXT[]      DEFAULT '{}',
  favorite_genres TEXT[]      DEFAULT '{}',
  stats           JSONB       DEFAULT '{"mente":0,"corpo":0,"cultura":0,"sociale":0,"sfide":0}',
  trophies        TEXT[]      DEFAULT '{}',
  following       UUID[]      DEFAULT '{}',
  followers       UUID[]      DEFAULT '{}',
  banned          BOOLEAN     DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_username     ON users USING gin(username gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_xp           ON users(xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_is_public    ON users(is_public);

-- ── Quests ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  category     TEXT        DEFAULT 'altro',
  difficulty   SMALLINT    DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  xp_value     INTEGER     DEFAULT 10,
  photo_url    TEXT,
  completed    BOOLEAN     DEFAULT false,
  completed_at DATE,
  type         TEXT        DEFAULT 'todo' CHECK (type IN ('todo','goal')),
  due_date     DATE,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quests_user_id    ON quests(user_id);
CREATE INDEX IF NOT EXISTS idx_quests_completed  ON quests(user_id, completed);

-- ── Exams ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exams (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  chapters   JSONB       DEFAULT '[]',
  exam_date  DATE,
  grade      SMALLINT    CHECK (grade BETWEEN 18 AND 30),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exams_user_id ON exams(user_id);

-- ── Study Sessions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS study_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id     UUID        REFERENCES exams(id) ON DELETE SET NULL,
  minutes     INTEGER     NOT NULL CHECK (minutes > 0),
  focus_score SMALLINT    DEFAULT 5 CHECK (focus_score BETWEEN 1 AND 10),
  xp_earned   INTEGER     DEFAULT 0,
  notes       TEXT,
  studied_at  DATE        DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id   ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_studied_at ON study_sessions(user_id, studied_at);

-- ── Books ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS books (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  author       TEXT,
  genre        TEXT        DEFAULT 'narrativa',
  difficulty   SMALLINT    DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
  total_pages  INTEGER     DEFAULT 0,
  current_page INTEGER     DEFAULT 0,
  completed    BOOLEAN     DEFAULT false,
  completed_at DATE,
  cover_url    TEXT,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_books_user_id   ON books(user_id);
CREATE INDEX IF NOT EXISTS idx_books_title     ON books USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_books_completed ON books(user_id, completed);

-- ── Reading Sessions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reading_sessions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id    UUID        NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  pages_read INTEGER     NOT NULL CHECK (pages_read > 0),
  xp_earned  INTEGER     DEFAULT 0,
  read_at    DATE        DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reading_sessions_user_id ON reading_sessions(user_id);

-- ── Routines ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS routines (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  emoji      TEXT        DEFAULT '⚡',
  category   TEXT        DEFAULT 'routine',
  xp_value   INTEGER     DEFAULT 5,
  is_default BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS routine_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  routine_id UUID        NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  done_at    DATE        DEFAULT CURRENT_DATE,
  xp_earned  INTEGER     DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_routine_logs_user_id ON routine_logs(user_id, done_at);

-- ── Challenges (PvP) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenges (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  title       TEXT        NOT NULL,
  rules       TEXT,
  stake_xp    INTEGER     DEFAULT 50 NOT NULL,
  type        TEXT        DEFAULT 'mixed' CHECK (type IN ('athletic','mental','mixed')),
  is_public   BOOLEAN     DEFAULT true,
  join_code   TEXT,
  expires_at  DATE,
  status      TEXT        DEFAULT 'open' CHECK (status IN ('open','active','completed')),
  winner_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_challenges_creator  ON challenges(creator_id);
CREATE INDEX IF NOT EXISTS idx_challenges_public   ON challenges(is_public, status);

-- ── Feed Posts ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_posts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  photo_url  TEXT,
  category   TEXT,
  xp_earned  INTEGER     DEFAULT 0,
  likes      UUID[]      DEFAULT '{}',
  lang       TEXT        DEFAULT 'it',
  ref_type   TEXT        CHECK (ref_type IN ('quest','book','study','routine','challenge')),
  ref_id     UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_user_id    ON feed_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_lang       ON feed_posts(lang);

-- ── Comments ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);

-- ── Global Books (catalogo condiviso) ────────────────────────
CREATE TABLE IF NOT EXISTS global_books (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT        NOT NULL,
  author     TEXT,
  genre      TEXT        DEFAULT 'narrativa',
  cover_url  TEXT,
  added_by   UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_global_books_title  ON global_books USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_global_books_author ON global_books USING gin(author gin_trgm_ops);

-- ── Discussions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discussions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id    UUID        REFERENCES global_books(id) ON DELETE SET NULL,
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT,
  content    TEXT        NOT NULL,
  type       TEXT        DEFAULT 'discussion' CHECK (type IN ('discussion','help')),
  likes      UUID[]      DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_discussions_book_id ON discussions(book_id);
CREATE INDEX IF NOT EXISTS idx_discussions_created ON discussions(created_at DESC);

-- ── Discussion Replies ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS discussion_replies (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID        NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_disc_replies_disc_id ON discussion_replies(discussion_id);

-- ── Banned Words ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banned_words (
  id   SERIAL PRIMARY KEY,
  word TEXT UNIQUE NOT NULL
);
