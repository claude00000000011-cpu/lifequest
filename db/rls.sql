-- ============================================================
-- rls.sql — Row Level Security policies per LifeQuest
-- Da applicare dopo schema.sql su Supabase
-- ============================================================

-- Abilita RLS su tutte le tabelle
ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests             ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE books              ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_books       ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE discussion_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_words       ENABLE ROW LEVEL SECURITY;

-- ── USERS ────────────────────────────────────────────────────

-- Chiunque può vedere i profili pubblici
CREATE POLICY "users_select_public"
  ON users FOR SELECT
  USING (is_public = true OR id = auth.uid());

-- Solo l'utente stesso può aggiornare il proprio profilo
CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- Solo il sistema può creare utenti (via funzione RPC)
CREATE POLICY "users_insert_rpc"
  ON users FOR INSERT
  WITH CHECK (id = auth.uid());

-- ── QUESTS ───────────────────────────────────────────────────

CREATE POLICY "quests_select_own"
  ON quests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "quests_insert_own"
  ON quests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "quests_update_own"
  ON quests FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "quests_delete_own"
  ON quests FOR DELETE
  USING (user_id = auth.uid());

-- ── EXAMS ────────────────────────────────────────────────────

CREATE POLICY "exams_select_own"  ON exams FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "exams_insert_own"  ON exams FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "exams_update_own"  ON exams FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "exams_delete_own"  ON exams FOR DELETE USING (user_id = auth.uid());

-- ── STUDY SESSIONS ───────────────────────────────────────────

CREATE POLICY "study_select_own"  ON study_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "study_insert_own"  ON study_sessions FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── BOOKS (personali) ────────────────────────────────────────

CREATE POLICY "books_select_own"  ON books FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "books_insert_own"  ON books FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "books_update_own"  ON books FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "books_delete_own"  ON books FOR DELETE USING (user_id = auth.uid());

-- ── READING SESSIONS ─────────────────────────────────────────

CREATE POLICY "reading_select_own" ON reading_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "reading_insert_own" ON reading_sessions FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── ROUTINES ─────────────────────────────────────────────────

-- Le routine di default (user_id NULL) sono visibili a tutti
CREATE POLICY "routines_select"
  ON routines FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "routines_insert_own"
  ON routines FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "routines_delete_own"
  ON routines FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "routine_logs_select_own" ON routine_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "routine_logs_insert_own" ON routine_logs FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── CHALLENGES ───────────────────────────────────────────────

-- Le sfide pubbliche sono visibili a tutti; quelle private solo ai partecipanti
CREATE POLICY "challenges_select"
  ON challenges FOR SELECT
  USING (
    is_public = true
    OR creator_id  = auth.uid()
    OR opponent_id = auth.uid()
  );

CREATE POLICY "challenges_insert_own"
  ON challenges FOR INSERT
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "challenges_update_participants"
  ON challenges FOR UPDATE
  USING (creator_id = auth.uid() OR opponent_id = auth.uid());

-- ── FEED POSTS ───────────────────────────────────────────────

-- Post visibili se: l'autore ha profilo pubblico, o sei tu
CREATE POLICY "feed_select"
  ON feed_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = feed_posts.user_id
        AND (u.is_public = true OR u.id = auth.uid())
    )
  );

CREATE POLICY "feed_insert_own"
  ON feed_posts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "feed_update_own"
  ON feed_posts FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "feed_delete_own"
  ON feed_posts FOR DELETE
  USING (user_id = auth.uid());

-- ── COMMENTS ─────────────────────────────────────────────────

-- Commenti visibili se il post è visibile
CREATE POLICY "comments_select"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM feed_posts fp
      JOIN users u ON u.id = fp.user_id
      WHERE fp.id = comments.post_id
        AND (u.is_public = true OR u.id = auth.uid())
    )
  );

CREATE POLICY "comments_insert_own"
  ON comments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "comments_delete_own"
  ON comments FOR DELETE
  USING (user_id = auth.uid());

-- ── GLOBAL BOOKS ─────────────────────────────────────────────

-- Il catalogo globale è pubblico in lettura
CREATE POLICY "global_books_select_all"
  ON global_books FOR SELECT
  USING (true);

CREATE POLICY "global_books_insert_auth"
  ON global_books FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── DISCUSSIONS ──────────────────────────────────────────────

CREATE POLICY "discussions_select_all"
  ON discussions FOR SELECT
  USING (true);

CREATE POLICY "discussions_insert_auth"
  ON discussions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "discussions_delete_own"
  ON discussions FOR DELETE
  USING (user_id = auth.uid());

-- ── DISCUSSION REPLIES ───────────────────────────────────────

CREATE POLICY "disc_replies_select_all"
  ON discussion_replies FOR SELECT
  USING (true);

CREATE POLICY "disc_replies_insert_auth"
  ON discussion_replies FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ── BANNED WORDS ─────────────────────────────────────────────

-- Solo lettura pubblica; scrittura riservata agli admin (service_role)
CREATE POLICY "banned_words_select_all"
  ON banned_words FOR SELECT
  USING (true);
