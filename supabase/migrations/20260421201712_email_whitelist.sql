-- ============================================================================
-- Email whitelist for app access control
-- ============================================================================
-- Only emails listed in public.whitelisted_emails can sign up or sign in.
-- Enforcement happens at three layers:
--   1. Client-side pre-check before signUp (good UX — clear error before auth)
--   2. Database trigger on auth.users INSERT (defence-in-depth — catches any
--      signup that bypasses the client check, e.g. direct REST API calls)
--   3. Client-side post-login check (offboarding — if email is removed from
--      whitelist while user is still logged in, they're signed out on next
--      attempted auth action)
--
-- Admin workflow (for now): add emails via SQL
--   INSERT INTO public.whitelisted_emails (email, note)
--   VALUES ('name@example.com', 'Beta tester — Kotoba') ON CONFLICT (email) DO NOTHING;
--
-- Remove access via SQL
--   DELETE FROM public.whitelisted_emails WHERE email = 'name@example.com';
--
-- A later PR can add an admin UI once there are enough users to justify it.
-- ============================================================================

-- ── Table ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whitelisted_emails (
  email      TEXT PRIMARY KEY,
  added_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  note       TEXT
);

COMMENT ON TABLE public.whitelisted_emails IS
  'Allowlist of email addresses permitted to sign up or sign in to Kotoba. Case-insensitive match on email.';

-- ── RPC: is_email_whitelisted (callable from client pre-signup) ─────────────
-- SECURITY DEFINER so it bypasses RLS and can read the table even from the
-- anonymous role before the user has authenticated. Returns boolean only —
-- never leaks the full whitelist.
CREATE OR REPLACE FUNCTION public.is_email_whitelisted(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.whitelisted_emails
    WHERE lower(email) = lower(check_email)
  );
$$;

COMMENT ON FUNCTION public.is_email_whitelisted(TEXT) IS
  'Returns true if the given email is on the signup/signin whitelist. Case-insensitive. Safe to call from the anonymous role.';

GRANT EXECUTE ON FUNCTION public.is_email_whitelisted(TEXT) TO anon, authenticated;

-- ── Trigger: defence-in-depth on auth.users INSERT ─────────────────────────
-- If anyone bypasses the client-side check (e.g. calls the Supabase REST
-- signUp endpoint directly), this trigger blocks the insert at the database
-- layer. Raises a clear error that Supabase Auth will surface back to the
-- caller.
CREATE OR REPLACE FUNCTION public.enforce_whitelist_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;  -- Allow system inserts without email (edge case; magic-link / anonymous); client UX enforces email presence.
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM public.whitelisted_emails
    WHERE lower(email) = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'This email address is not authorised for Kotoba access. Please contact the administrator to request access.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_user_insert_check_whitelist ON auth.users;
CREATE TRIGGER before_user_insert_check_whitelist
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_whitelist_on_signup();

-- ── RLS: whitelist table is admin-write only, readable for RPC ──────────────
-- The RPC uses SECURITY DEFINER so it doesn't need direct table access. We
-- lock the table down entirely for non-service-role users. Adds/removes
-- happen via service role (SQL editor or future admin tool).
ALTER TABLE public.whitelisted_emails ENABLE ROW LEVEL SECURITY;

-- Drop any legacy policies before recreating (idempotent re-apply).
DROP POLICY IF EXISTS "whitelist_public_read_blocked" ON public.whitelisted_emails;

-- No SELECT/INSERT/UPDATE/DELETE policies for anon/authenticated — the
-- table is effectively private. Only service_role can modify (service_role
-- bypasses RLS by default in Supabase).

-- ── Seed: first whitelisted email (Kabir — founder) ────────────────────────
INSERT INTO public.whitelisted_emails (email, note)
VALUES ('kabirbains99@hotmail.com', 'Founder / admin — seeded in first whitelist migration')
ON CONFLICT (email) DO NOTHING;
