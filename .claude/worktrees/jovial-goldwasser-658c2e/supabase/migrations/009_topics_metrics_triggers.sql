-- Migration: 009_topics_metrics_triggers
-- Description: Topics templates, metrics per topic, monitoring triggers, and topic_id on runs

-- Topic templates
CREATE TABLE IF NOT EXISTS public.topic_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sector_tag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Topic metrics per day
CREATE TABLE IF NOT EXISTS public.topic_daily_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES public.monitoring_topics(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  runs_count INTEGER NOT NULL DEFAULT 0,
  mentions_count INTEGER NOT NULL DEFAULT 0,
  visibility_rate FLOAT,
  positive_count INTEGER NOT NULL DEFAULT 0,
  neutral_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  avg_position FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_daily_metrics_unique ON public.topic_daily_metrics(project_id, topic_id, date);

-- Monitoring triggers (anti-loop)
CREATE TABLE IF NOT EXISTS public.monitoring_triggers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_monitoring_triggers_project_id ON public.monitoring_triggers(project_id);

-- Link runs to topics
ALTER TABLE public.analysis_runs
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES public.monitoring_topics(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.topic_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view topic templates" ON public.topic_templates;
CREATE POLICY "Users can view topic templates" ON public.topic_templates
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view topic metrics of own projects" ON public.topic_daily_metrics;
DROP POLICY IF EXISTS "Users can insert topic metrics to own projects" ON public.topic_daily_metrics;

CREATE POLICY "Users can view topic metrics of own projects" ON public.topic_daily_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = topic_daily_metrics.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert topic metrics to own projects" ON public.topic_daily_metrics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = topic_daily_metrics.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view monitoring triggers of own projects" ON public.monitoring_triggers;
DROP POLICY IF EXISTS "Users can insert monitoring triggers to own projects" ON public.monitoring_triggers;

CREATE POLICY "Users can view monitoring triggers of own projects" ON public.monitoring_triggers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_triggers.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert monitoring triggers to own projects" ON public.monitoring_triggers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_triggers.project_id
      AND projects.user_id = auth.uid()
    )
  );
