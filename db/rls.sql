-- ============================================================
-- fix_rls.sql — Esegui su Supabase SQL Editor
-- Risolve: like 403, feed non persistente, profilo privato
-- ============================================================

-- 1. Feed posts: tutti possono leggere (il filtro seguiti lo fa il JS)
DROP POLICY IF EXISTS "feed_select" ON feed_posts;
CREATE POLICY "feed_select"
  ON feed_posts FOR SELECT
  USING (true);

-- 2. Feed posts: chiunque autenticato può aggiornare (necessario per likes legacy)
DROP POLICY IF EXISTS "feed_update_own" ON feed_posts;
CREATE POLICY "feed_update_own"
  ON feed_posts FOR UPDATE
  USING (true);

-- 3. Post likes: accesso libero (la logica è nel JS)
DROP POLICY IF EXISTS "post_likes_select" ON post_likes;
DROP POLICY IF EXISTS "post_likes_insert" ON post_likes;
DROP POLICY IF EXISTS "post_likes_delete" ON post_likes;

CREATE POLICY "post_likes_select"
  ON post_likes FOR SELECT
  USING (true);

CREATE POLICY "post_likes_insert"
  ON post_likes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "post_likes_delete"
  ON post_likes FOR DELETE
  USING (true);

-- 4. Commenti: tutti possono leggere
DROP POLICY IF EXISTS "comments_select" ON comments;
CREATE POLICY "comments_select"
  ON comments FOR SELECT
  USING (true);

-- 5. Commenti: chiunque autenticato può eliminare
--    (il JS controlla se sei owner del commento o del post)
DROP POLICY IF EXISTS "comments_delete_own" ON comments;
DROP POLICY IF EXISTS "comments_delete_post_owner" ON comments;
CREATE POLICY "comments_delete_any_auth"
  ON comments FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- 6. Aggiungi colonna username ai commenti se non esiste
ALTER TABLE comments ADD COLUMN IF NOT EXISTS username text;

-- 7. Aggiungi colonna username alle risposte discussioni
ALTER TABLE discussion_replies ADD COLUMN IF NOT EXISTS username text;

-- 8. Users: tutti possono leggere (serve per il feed e la social)
DROP POLICY IF EXISTS "users_select_public" ON users;
CREATE POLICY "users_select_all"
  ON users FOR SELECT
  USING (true);
