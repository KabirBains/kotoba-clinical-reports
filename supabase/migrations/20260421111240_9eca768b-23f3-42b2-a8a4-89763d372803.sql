-- =============================================================
-- Email whitelist enforcement (idempotent)
-- =============================================================

-- A. Whitelist table
CREATE TABLE IF NOT EXISTS public.whitelisted_emails (
  email      text PRIMARY KEY,
  added_at   timestamptz NOT NULL DEFAULT now(),
  note       text
);

ALTER TABLE public.whitelisted_emails ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only access.

-- B. Helper: case-insensitive whitelist check
CREATE OR REPLACE FUNCTION public.is_email_whitelisted(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.whitelisted_emails
    WHERE lower(email) = lower(_email)
  );
$$;

-- C. Trigger function that blocks non-whitelisted signups
CREATE OR REPLACE FUNCTION public.enforce_whitelist_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NULL OR NOT public.is_email_whitelisted(NEW.email) THEN
    RAISE EXCEPTION 'This email address is not authorised for Kotoba access. Please contact the administrator to request access.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

-- D. Attach trigger to auth.users (idempotent)
DROP TRIGGER IF EXISTS before_user_insert_check_whitelist ON auth.users;
CREATE TRIGGER before_user_insert_check_whitelist
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_whitelist_on_signup();

-- E. Seed the exact allowlist (wipe any prior entries first)
TRUNCATE public.whitelisted_emails;
INSERT INTO public.whitelisted_emails (email, note) VALUES
  ('kabirbains99@hotmail.com',           'founding clinician'),
  ('kabirbains9999@gmail.com',           'founder / admin'),
  ('tinkoo.malhi@gmail.com',             'founding clinician'),
  ('kyle@livingwithmeaning.com.au',      'founding clinician'),
  ('sara@livingwithmeaning.com.au',      'founding clinician');

-- F. Revoke access from any existing non-whitelisted users.
-- Cascades to profiles, clients, reports, collateral_interviews via
-- ownership (user_id) — whitelisted users keep all their data.
DELETE FROM public.collateral_interviews
  WHERE user_id IN (
    SELECT id FROM auth.users
    WHERE email IS NULL OR lower(email) NOT IN (
      'kabirbains99@hotmail.com',
      'kabirbains9999@gmail.com',
      'tinkoo.malhi@gmail.com',
      'kyle@livingwithmeaning.com.au',
      'sara@livingwithmeaning.com.au'
    )
  );

DELETE FROM public.reports
  WHERE user_id IN (
    SELECT id FROM auth.users
    WHERE email IS NULL OR lower(email) NOT IN (
      'kabirbains99@hotmail.com',
      'kabirbains9999@gmail.com',
      'tinkoo.malhi@gmail.com',
      'kyle@livingwithmeaning.com.au',
      'sara@livingwithmeaning.com.au'
    )
  );

DELETE FROM public.clients
  WHERE user_id IN (
    SELECT id FROM auth.users
    WHERE email IS NULL OR lower(email) NOT IN (
      'kabirbains99@hotmail.com',
      'kabirbains9999@gmail.com',
      'tinkoo.malhi@gmail.com',
      'kyle@livingwithmeaning.com.au',
      'sara@livingwithmeaning.com.au'
    )
  );

DELETE FROM public.profiles
  WHERE user_id IN (
    SELECT id FROM auth.users
    WHERE email IS NULL OR lower(email) NOT IN (
      'kabirbains99@hotmail.com',
      'kabirbains9999@gmail.com',
      'tinkoo.malhi@gmail.com',
      'kyle@livingwithmeaning.com.au',
      'sara@livingwithmeaning.com.au'
    )
  );

DELETE FROM auth.users
  WHERE email IS NULL OR lower(email) NOT IN (
    'kabirbains99@hotmail.com',
    'kabirbains9999@gmail.com',
    'tinkoo.malhi@gmail.com',
    'kyle@livingwithmeaning.com.au',
    'sara@livingwithmeaning.com.au'
  );
