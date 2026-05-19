-- Migration: 005_analysis_modes
-- Description: Add analysis modes + multi-run storage

-- Extend analyses with mode and run_count
ALTER TABLE public.analyses
ADD COLUMN IF NOT EXISTS analysis_mode TEXT DEFAULT 'trend' NOT NULL,
ADD COLUMN IF NOT EXISTS run_count INTEGER DEFAULT 1 NOT NULL;

-- Individual runs per prompt
CREATE TABLE IF NOT EXISTS public.analysis_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    prompt_text TEXT NOT NULL,
    run_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_analysis_id ON public.analysis_runs(analysis_id);

-- Responses per run
CREATE TABLE IF NOT EXISTS public.analysis_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_run_id UUID NOT NULL REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
    ai_model TEXT NOT NULL,
    ai_response TEXT,
    provider TEXT NOT NULL DEFAULT 'openai',
    brand_mentioned BOOLEAN,
    brand_position INTEGER,
    competitors_mentioned TEXT[] DEFAULT '{}'::text[],
    website_cited BOOLEAN,
    sentiment_label TEXT,
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_responses_run_id ON public.analysis_responses(analysis_run_id);

-- Aggregated metrics per prompt
CREATE TABLE IF NOT EXISTS public.analysis_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    prompt_text TEXT NOT NULL,
    samples INTEGER NOT NULL DEFAULT 0,
    mention_rate INTEGER,
    sentiment_positive INTEGER,
    sentiment_neutral INTEGER,
    sentiment_negative INTEGER,
    avg_position INTEGER,
    min_position INTEGER,
    max_position INTEGER,
    stability INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_metrics_analysis_id ON public.analysis_metrics(analysis_id);

-- RLS
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view analysis runs of own projects" ON public.analysis_runs;
DROP POLICY IF EXISTS "Users can insert analysis runs to own projects" ON public.analysis_runs;
DROP POLICY IF EXISTS "Users can view analysis responses of own projects" ON public.analysis_responses;
DROP POLICY IF EXISTS "Users can insert analysis responses to own projects" ON public.analysis_responses;
DROP POLICY IF EXISTS "Users can view analysis metrics of own projects" ON public.analysis_metrics;
DROP POLICY IF EXISTS "Users can insert analysis metrics to own projects" ON public.analysis_metrics;

CREATE POLICY "Users can view analysis runs of own projects" ON public.analysis_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.analyses
      JOIN public.projects ON projects.id = analyses.project_id
      WHERE analyses.id = analysis_runs.analysis_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert analysis runs to own projects" ON public.analysis_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analyses
      JOIN public.projects ON projects.id = analyses.project_id
      WHERE analyses.id = analysis_runs.analysis_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view analysis responses of own projects" ON public.analysis_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.analysis_runs
      JOIN public.analyses ON analyses.id = analysis_runs.analysis_id
      JOIN public.projects ON projects.id = analyses.project_id
      WHERE analysis_runs.id = analysis_responses.analysis_run_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert analysis responses to own projects" ON public.analysis_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analysis_runs
      JOIN public.analyses ON analyses.id = analysis_runs.analysis_id
      JOIN public.projects ON projects.id = analyses.project_id
      WHERE analysis_runs.id = analysis_responses.analysis_run_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view analysis metrics of own projects" ON public.analysis_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.analyses
      JOIN public.projects ON projects.id = analyses.project_id
      WHERE analyses.id = analysis_metrics.analysis_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert analysis metrics to own projects" ON public.analysis_metrics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analyses
      JOIN public.projects ON projects.id = analyses.project_id
      WHERE analyses.id = analysis_metrics.analysis_id
      AND projects.user_id = auth.uid()
    )
  );
