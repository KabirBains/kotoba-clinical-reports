
ALTER TABLE public.reports
ADD COLUMN quality_scorecard jsonb DEFAULT NULL,
ADD COLUMN issue_statuses jsonb DEFAULT '{}'::jsonb,
ADD COLUMN dismissed_issue_keys jsonb DEFAULT '[]'::jsonb;
