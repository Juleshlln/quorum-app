-- Migration: 023_advisor_recommendations
-- Description: Stores Quorum Advisor AI-generated recommendations per project

CREATE TABLE IF NOT EXISTS public.advisor_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  input_snapshot JSONB NOT NULL DEFAULT '{}',
  output JSONB NOT NULL DEFAULT '{}',
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost NUMERIC(10, 6)
);

CREATE INDEX IF NOT EXISTS idx_advisor_recs_project_date
  ON public.advisor_recommendations(project_id, generated_at DESC);

ALTER TABLE public.advisor_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own advisor recommendations" ON public.advisor_recommendations;
DROP POLICY IF EXISTS "Users can insert own advisor recommendations" ON public.advisor_recommendations;

CREATE POLICY "Users can view own advisor recommendations" ON public.advisor_recommendations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = advisor_recommendations.project_id
        AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own advisor recommendations" ON public.advisor_recommendations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = advisor_recommendations.project_id
        AND projects.user_id = auth.uid()
    )
  );
