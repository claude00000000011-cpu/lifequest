-- ============================================================
-- seed.sql — Dati iniziali per LifeQuest (Supabase / PostgreSQL)
-- ============================================================
-- Eseguire DOPO schema.sql e rls.sql
-- ============================================================

-- ── Parole bannate ───────────────────────────────────────────
INSERT INTO banned_words (word) VALUES
  ('spam'), ('casino'), ('scommesse'), ('scommessa'),
  ('pornografia'), ('porno'), ('xxx'), ('droga'),
  ('cocaina'), ('eroina'), ('metanfetamina'),
  ('suicidio'), ('autolesionismo'), ('odio'), ('razzismo'),
  ('nazista'), ('fascista'), ('terrorismo'), ('bomba')
ON CONFLICT (word) DO NOTHING;

-- ── Libri globali di esempio ─────────────────────────────────
-- (opzionale — rimuovere in produzione se non desiderato)
INSERT INTO global_books (id, title, author, genre) VALUES
  (gen_random_uuid(), 'Atomic Habits',            'James Clear',        'saggistica'),
  (gen_random_uuid(), 'Deep Work',                'Cal Newport',        'saggistica'),
  (gen_random_uuid(), 'Il Signore degli Anelli',  'J.R.R. Tolkien',     'fantasy'),
  (gen_random_uuid(), 'Sapiens',                  'Yuval Noah Harari',  'storia'),
  (gen_random_uuid(), 'Il Nome della Rosa',        'Umberto Eco',        'narrativa'),
  (gen_random_uuid(), 'Thinking, Fast and Slow',  'Daniel Kahneman',    'psicologia'),
  (gen_random_uuid(), '1984',                      'George Orwell',      'narrativa'),
  (gen_random_uuid(), 'The Pragmatic Programmer', 'Hunt & Thomas',      'tecnologia'),
  (gen_random_uuid(), 'Meditazioni',              'Marco Aurelio',      'filosofia'),
  (gen_random_uuid(), 'Zero to One',              'Peter Thiel',        'economia')
ON CONFLICT DO NOTHING;
