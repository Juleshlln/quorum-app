-- Migration: 016_monitoring_runs_pipeline
-- Description: Monitoring runs orchestration + windowed metrics

-- Orchestration runs (monitoring pipeline)
CREATE TABLE IF NOT EXISTS public.monitoring_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | running | success | partial | failed
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  window_days INTEGER NOT NULL,
  models JSONB NOT NULL DEFAULT '[]'::jsonb,
  models_hash TEXT NOT NULL,
  run_date DATE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  items_total INTEGER DEFAULT 0,
  items_processed INTEGER DEFAULT 0,
  items_success INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  error_stack TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoring_runs_unique_window
  ON public.monitoring_runs(project_id, window_start, window_end, models_hash);
CREATE INDEX IF NOT EXISTS idx_monitoring_runs_status
  ON public.monitoring_runs(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_runs_project_id
  ON public.monitoring_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_runs_run_date
  ON public.monitoring_runs(run_date);
-- Link prompt runs + citations to orchestration runs
ALTER TABLE public.prompt_runs
  ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES public.monitoring_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS run_window_start DATE,
  ADD COLUMN IF NOT EXISTS run_window_end DATE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_prompt_runs_run_prompt_model
  ON public.prompt_runs(run_id, prompt_id, ai_model)
  WHERE run_id IS NOT NULL;
ALTER TABLE public.citations
  ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES public.monitoring_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prompt_id UUID REFERENCES public.monitoring_prompts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_citations_run_id ON public.citations(run_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_citations_run_prompt_model_url_method
  ON public.citations(run_id, prompt_id, ai_model, url_id, method)
  WHERE run_id IS NOT NULL;
-- Extend run_logs to support monitoring_runs
ALTER TABLE public.run_logs
  ADD COLUMN IF NOT EXISTS monitoring_run_id UUID REFERENCES public.monitoring_runs(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_run_logs_monitoring_run_id ON public.run_logs(monitoring_run_id);
-- Windowed metrics storage
CREATE TABLE IF NOT EXISTS public.project_metrics_windowed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.monitoring_runs(id) ON DELETE SET NULL,
  window_days INTEGER NOT NULL,
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_metrics_windowed_unique
  ON public.project_metrics_windowed(project_id, window_days, window_start, window_end);
CREATE INDEX IF NOT EXISTS idx_project_metrics_windowed_project
  ON public.project_metrics_windowed(project_id, window_days, window_end);
-- RLS
ALTER TABLE public.monitoring_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_metrics_windowed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view monitoring runs of own projects" ON public.monitoring_runs;
DROP POLICY IF EXISTS "Users can insert monitoring runs to own projects" ON public.monitoring_runs;
DROP POLICY IF EXISTS "Users can update monitoring runs of own projects" ON public.monitoring_runs;
CREATE POLICY "Users can view monitoring runs of own projects" ON public.monitoring_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_runs.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert monitoring runs to own projects" ON public.monitoring_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_runs.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update monitoring runs of own projects" ON public.monitoring_runs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_runs.project_id
      AND projects.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Users can view project metrics of own projects" ON public.project_metrics_windowed;
DROP POLICY IF EXISTS "Users can insert project metrics of own projects" ON public.project_metrics_windowed;
DROP POLICY IF EXISTS "Users can update project metrics of own projects" ON public.project_metrics_windowed;
CREATE POLICY "Users can view project metrics of own projects" ON public.project_metrics_windowed
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_metrics_windowed.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert project metrics of own projects" ON public.project_metrics_windowed
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_metrics_windowed.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update project metrics of own projects" ON public.project_metrics_windowed
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_metrics_windowed.project_id
      AND projects.user_id = auth.uid()
    )
  );
