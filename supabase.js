// ============================================================
// supabase.js — Inizializzazione client Supabase
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://teeknyidgzvloitkajgi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4E0co4gCjsHNnloVZxkkTg_S288BZ3L';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
