-- Migration: 019_monitoring_daily_metrics
-- Pré-computed daily KPI table for the Overview dashboard.
-- One row per (project, day). Upserted by the orchestrator after each run.

CREATE TABLE IF NOT EXISTS public.monitoring_daily_metrics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  day             DATE NOT NULL,
  responses_count INTEGER NOT NULL DEFAULT 0,
  mentions_count  INTEGER NOT NULL DEFAULT 0,
  visibility_score FLOAT,
  avg_position    FLOAT,
  sentiment_score FLOAT,
  positive_count  INTEGER NOT NULL DEFAULT 0,
  neutral_count   INTEGER NOT NULL DEFAULT 0,
  negative_count  INTEGER NOT NULL DEFAULT 0,
  prompts_covered INTEGER NOT NULL DEFAULT 0,
  total_prompts_active INTEGER NOT NULL DEFAULT 0,
  models_used     TEXT[] NOT NULL DEFAULT '{}'::text[],
  competitor_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoring_daily_metrics_unique
  ON public.monitoring_daily_metrics(project_id, day);

CREATE INDEX IF NOT EXISTS idx_monitoring_daily_metrics_project
  ON public.monitoring_daily_metrics(project_id);

-- RLS
ALTER TABLE public.monitoring_daily_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own project daily metrics" ON public.monitoring_daily_metrics;
CREATE POLICY "Users can view own project daily metrics" ON public.monitoring_daily_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_daily_metrics.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Service role can do everything (no policy needed — bypasses RLS).
