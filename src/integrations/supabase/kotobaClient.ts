/**
 * Separate Supabase client for invoking edge functions on the Kotoba project.
 * Database operations continue to use the default client from ./client.ts
 *
 * The anon key below is a *publishable* key — safe to include in client code.
 */
import { createClient } from '@supabase/supabase-js';

const KOTOBA_URL = 'https://rxczgtazoyvbdtlwnidu.supabase.co';
const KOTOBA_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4Y3pndGF6b3l2YmR0bHduaWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NTAxMDgsImV4cCI6MjA5MDIyNjEwOH0.Qk7wat0QVqLXORw9cu7th2EWg8BgYIAAJ35yujRYDjU';

export const kotobaSupabase = createClient(KOTOBA_URL, KOTOBA_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: false,
    autoRefreshToken: false,
  },
});
