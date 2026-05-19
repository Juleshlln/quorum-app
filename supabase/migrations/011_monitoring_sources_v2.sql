-- Migration: 011_monitoring_sources_v2
-- Description: Daily run logs, response storage, citations metadata (observed/probable)

-- Daily run batches (idempotence per day/project)
CREATE TABLE IF NOT EXISTS public.monitoring_daily_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  items_total INTEGER NOT NULL DEFAULT 0,
  items_success INTEGER NOT NULL DEFAULT 0,
  items_failed INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoring_daily_runs_unique
  ON public.monitoring_daily_runs(project_id, run_date);
CREATE INDEX IF NOT EXISTS idx_monitoring_daily_runs_project
  ON public.monitoring_daily_runs(project_id);
-- Per-step run logs for observability
CREATE TABLE IF NOT EXISTS public.run_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID REFERENCES public.monitoring_daily_runs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info',
  step TEXT NOT NULL,
  message TEXT NOT NULL,
  meta_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_run_logs_run_id ON public.run_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_run_logs_project_id ON public.run_logs(project_id);
-- Raw AI responses for traceability
CREATE TABLE IF NOT EXISTS public.monitoring_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  prompt_run_id UUID NOT NULL REFERENCES public.prompt_runs(id) ON DELETE CASCADE,
  raw_text TEXT,
  raw_json JSONB,
  model_used TEXT,
  prompt_final TEXT,
  params JSONB,
  language TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_monitoring_responses_run_id ON public.monitoring_responses(prompt_run_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_responses_project_id ON public.monitoring_responses(project_id);
-- Extend citations with method/confidence/rationale/response linkage
ALTER TABLE public.citations
  ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'observed',
  ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 0.9,
  ADD COLUMN IF NOT EXISTS rationale TEXT,
  ADD COLUMN IF NOT EXISTS response_id UUID REFERENCES public.monitoring_responses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_citations_method ON public.citations(method);
CREATE INDEX IF NOT EXISTS idx_citations_project_id ON public.citations(project_id);
CREATE INDEX IF NOT EXISTS idx_citations_prompt_run_id ON public.citations(prompt_run_id);
CREATE INDEX IF NOT EXISTS idx_citations_response_id ON public.citations(response_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_citations_unique_method
  ON public.citations(project_id, prompt_run_id, url_id, method);
-- RLS
ALTER TABLE public.monitoring_daily_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view daily runs of own projects" ON public.monitoring_daily_runs;
CREATE POLICY "Users can view daily runs of own projects" ON public.monitoring_daily_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_daily_runs.project_id
      AND projects.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can insert daily runs to own projects" ON public.monitoring_daily_runs;
CREATE POLICY "Users can insert daily runs to own projects" ON public.monitoring_daily_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_daily_runs.project_id
      AND projects.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can view run logs of own projects" ON public.run_logs;
CREATE POLICY "Users can view run logs of own projects" ON public.run_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = run_logs.project_id
      AND projects.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can insert run logs to own projects" ON public.run_logs;
CREATE POLICY "Users can insert run logs to own projects" ON public.run_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = run_logs.project_id
      AND projects.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can view monitoring responses of own projects" ON public.monitoring_responses;
CREATE POLICY "Users can view monitoring responses of own projects" ON public.monitoring_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_responses.project_id
      AND projects.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can insert monitoring responses to own projects" ON public.monitoring_responses;
CREATE POLICY "Users can insert monitoring responses to own projects" ON public.monitoring_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_responses.project_id
      AND projects.user_id = auth.uid()
    )
  );
