/**
 * Separate Supabase client for invoking edge functions on the Kotoba project.
 * Database operations continue to use the default client from ./client.ts
 */
import { createClient } from '@supabase/supabase-js';

const KOTOBA_URL = import.meta.env.VITE_KOTOBA_SUPABASE_URL;
const KOTOBA_ANON_KEY = import.meta.env.VITE_KOTOBA_SUPABASE_ANON_KEY;

if (!KOTOBA_URL || !KOTOBA_ANON_KEY) {
  console.warn(
    'Kotoba Supabase credentials not set — edge function calls will fall back to the default client.'
  );
}

export const kotobaSupabase = createClient(
  KOTOBA_URL || import.meta.env.VITE_SUPABASE_URL,
  KOTOBA_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: false,   // no auth session needed for function invocations
      autoRefreshToken: false,
    },
  }
);
