-- Migration: 010_topics_prompts_schema
-- Description: Add topic description + prompt metadata + prompt_runs table

-- Extend monitoring_topics to behave as Topics
ALTER TABLE public.monitoring_topics
  ADD COLUMN IF NOT EXISTS description TEXT;
-- Extend monitoring_prompts to behave as Prompts/Questions
ALTER TABLE public.monitoring_prompts
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT,
  ADD COLUMN IF NOT EXISTS intent TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_monitoring_prompts_topic_id ON public.monitoring_prompts(topic_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_prompts_intent ON public.monitoring_prompts(intent);
-- Prompt runs (future ready)
CREATE TABLE IF NOT EXISTS public.prompt_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES public.monitoring_prompts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  visibility_score INTEGER,
  sentiment_label TEXT,
  position_rank INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_prompt_runs_prompt_id ON public.prompt_runs(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_runs_project_id ON public.prompt_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_prompt_runs_run_date ON public.prompt_runs(run_date);
-- RLS for prompt_runs
ALTER TABLE public.prompt_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view prompt runs of own projects" ON public.prompt_runs;
DROP POLICY IF EXISTS "Users can insert prompt runs to own projects" ON public.prompt_runs;
CREATE POLICY "Users can view prompt runs of own projects" ON public.prompt_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = prompt_runs.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert prompt runs to own projects" ON public.prompt_runs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = prompt_runs.project_id
      AND projects.user_id = auth.uid()
    )
  );
