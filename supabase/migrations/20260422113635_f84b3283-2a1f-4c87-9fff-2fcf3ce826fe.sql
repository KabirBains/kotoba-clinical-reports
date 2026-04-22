
-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.app_collab_role AS ENUM ('owner', 'editor', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. report_collaborators
CREATE TABLE IF NOT EXISTS public.report_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.app_collab_role NOT NULL,
  added_by uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_report_collaborators_user ON public.report_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_report_collaborators_report ON public.report_collaborators(report_id);
ALTER TABLE public.report_collaborators ENABLE ROW LEVEL SECURITY;

-- 3. report_activity
CREATE TABLE IF NOT EXISTS public.report_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_activity_report_created ON public.report_activity(report_id, created_at DESC);
ALTER TABLE public.report_activity ENABLE ROW LEVEL SECURITY;

-- 4. Helper functions (SECURITY DEFINER, fixed search_path)
CREATE OR REPLACE FUNCTION public.is_report_collaborator(_report uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.report_collaborators
    WHERE report_id = _report AND user_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.report_role(_report uuid, _user uuid)
RETURNS public.app_collab_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.report_collaborators
  WHERE report_id = _report AND user_id = _user
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.find_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid;
BEGIN
  IF _email IS NULL OR NOT public.is_email_whitelisted(_email) THEN
    RETURN NULL;
  END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
  RETURN _uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_collaborator_emails(_report uuid)
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_report_collaborator(_report, auth.uid()) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT rc.user_id, u.email::text
  FROM public.report_collaborators rc
  JOIN auth.users u ON u.id = rc.user_id
  WHERE rc.report_id = _report;
END;
$$;

CREATE OR REPLACE FUNCTION public.last_editor_for_report(_report uuid)
RETURNS TABLE(user_id uuid, email text, clinician_name text, edited_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_report_collaborator(_report, auth.uid()) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT ra.user_id, u.email::text, p.clinician_name, ra.created_at
  FROM public.report_activity ra
  LEFT JOIN auth.users u ON u.id = ra.user_id
  LEFT JOIN public.profiles p ON p.user_id = ra.user_id
  WHERE ra.report_id = _report
    AND ra.user_id <> auth.uid()
    AND ra.action IN ('edited_section', 'regenerated_section', 'generated_full_report')
  ORDER BY ra.created_at DESC
  LIMIT 1;
END;
$$;

-- get_accessible_clients: clients owned OR where user is a collaborator on any report
CREATE OR REPLACE FUNCTION public.get_accessible_clients()
RETURNS TABLE(
  id uuid,
  client_name text,
  ndis_number text,
  status text,
  updated_at timestamptz,
  owner_user_id uuid,
  is_shared boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (c.id)
    c.id, c.client_name, c.ndis_number, c.status, c.updated_at, c.user_id AS owner_user_id,
    (c.user_id <> auth.uid()) AS is_shared
  FROM public.clients c
  WHERE c.user_id = auth.uid()
     OR EXISTS (
       SELECT 1 FROM public.reports r
       JOIN public.report_collaborators rc ON rc.report_id = r.id
       WHERE r.client_id = c.id AND rc.user_id = auth.uid()
     )
  ORDER BY c.id, c.updated_at DESC;
$$;

-- 5. Trigger: seed owner + creation activity on new report
CREATE OR REPLACE FUNCTION public.seed_report_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.report_collaborators (report_id, user_id, role, added_by)
  VALUES (NEW.id, NEW.user_id, 'owner', NEW.user_id)
  ON CONFLICT (report_id, user_id) DO NOTHING;

  INSERT INTO public.report_activity (report_id, user_id, action, metadata)
  VALUES (NEW.id, NEW.user_id, 'created', '{}'::jsonb);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_insert_reports_seed_owner ON public.reports;
CREATE TRIGGER after_insert_reports_seed_owner
AFTER INSERT ON public.reports
FOR EACH ROW
EXECUTE FUNCTION public.seed_report_owner();

-- 6. Backfill existing reports with owner rows
INSERT INTO public.report_collaborators (report_id, user_id, role, added_by)
SELECT r.id, r.user_id, 'owner', r.user_id
FROM public.reports r
ON CONFLICT (report_id, user_id) DO NOTHING;

-- 7. Replace RLS policies on reports
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can insert own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can update own reports" ON public.reports;
DROP POLICY IF EXISTS "Users can delete own reports" ON public.reports;

CREATE POLICY "Collaborators can view reports"
ON public.reports FOR SELECT
USING (public.is_report_collaborator(id, auth.uid()));

CREATE POLICY "Users can insert own reports"
ON public.reports FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners and editors can update reports"
ON public.reports FOR UPDATE
USING (public.report_role(id, auth.uid()) IN ('owner', 'editor'));

CREATE POLICY "Owners can delete reports"
ON public.reports FOR DELETE
USING (public.report_role(id, auth.uid()) = 'owner');

-- 8. Replace RLS policies on collateral_interviews
DROP POLICY IF EXISTS "Users can view own collateral interviews" ON public.collateral_interviews;
DROP POLICY IF EXISTS "Users can insert own collateral interviews" ON public.collateral_interviews;
DROP POLICY IF EXISTS "Users can update own collateral interviews" ON public.collateral_interviews;
DROP POLICY IF EXISTS "Users can delete own collateral interviews" ON public.collateral_interviews;

CREATE POLICY "Collaborators can view collateral interviews"
ON public.collateral_interviews FOR SELECT
USING (public.is_report_collaborator(report_id, auth.uid()));

CREATE POLICY "Owners and editors can insert collateral interviews"
ON public.collateral_interviews FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.report_role(report_id, auth.uid()) IN ('owner', 'editor')
);

CREATE POLICY "Owners and editors can update collateral interviews"
ON public.collateral_interviews FOR UPDATE
USING (public.report_role(report_id, auth.uid()) IN ('owner', 'editor'));

CREATE POLICY "Owners can delete collateral interviews"
ON public.collateral_interviews FOR DELETE
USING (public.report_role(report_id, auth.uid()) = 'owner');

-- 9. RLS on report_collaborators
DROP POLICY IF EXISTS "Collaborators can view collaborators" ON public.report_collaborators;
DROP POLICY IF EXISTS "Owners can insert collaborators" ON public.report_collaborators;
DROP POLICY IF EXISTS "Owners can update collaborators" ON public.report_collaborators;
DROP POLICY IF EXISTS "Owners can delete collaborators" ON public.report_collaborators;

CREATE POLICY "Collaborators can view collaborators"
ON public.report_collaborators FOR SELECT
USING (public.is_report_collaborator(report_id, auth.uid()));

CREATE POLICY "Owners can insert collaborators"
ON public.report_collaborators FOR INSERT
WITH CHECK (public.report_role(report_id, auth.uid()) = 'owner');

CREATE POLICY "Owners can update collaborators"
ON public.report_collaborators FOR UPDATE
USING (
  public.report_role(report_id, auth.uid()) = 'owner'
  AND user_id <> auth.uid()
);

CREATE POLICY "Owners can delete collaborators"
ON public.report_collaborators FOR DELETE
USING (
  public.report_role(report_id, auth.uid()) = 'owner'
  AND user_id <> auth.uid()
);

-- 10. RLS on report_activity
DROP POLICY IF EXISTS "Collaborators can view activity" ON public.report_activity;
DROP POLICY IF EXISTS "Collaborators can insert activity" ON public.report_activity;

CREATE POLICY "Collaborators can view activity"
ON public.report_activity FOR SELECT
USING (public.is_report_collaborator(report_id, auth.uid()));

CREATE POLICY "Collaborators can insert activity"
ON public.report_activity FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.is_report_collaborator(report_id, auth.uid())
);
