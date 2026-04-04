
CREATE TABLE public.collateral_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  template_id TEXT NOT NULL,
  interviewee_name TEXT DEFAULT '',
  interviewee_role TEXT DEFAULT '',
  interview_date DATE,
  interview_method TEXT DEFAULT '',
  responses JSONB DEFAULT '{}',
  custom_questions JSONB DEFAULT '{}',
  general_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_collateral_interviews_report ON public.collateral_interviews(report_id);

ALTER TABLE public.collateral_interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own collateral interviews"
ON public.collateral_interviews FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own collateral interviews"
ON public.collateral_interviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collateral interviews"
ON public.collateral_interviews FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own collateral interviews"
ON public.collateral_interviews FOR DELETE
USING (auth.uid() = user_id);
