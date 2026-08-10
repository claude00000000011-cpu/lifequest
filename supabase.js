import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL  = 'https://teeknyidgzvloitkajgi.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlZWtueWlkZ3p2bG9pdGthamdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNDkzOTgsImV4cCI6MjEwMTgyNTM5OH0.w4ordBlgMfAePdk9wHwALcIuWMMCDnfPdjvCwIHRJMA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:     true,
    autoRefreshToken:   true,
    detectSessionInUrl: false,
  },
});
