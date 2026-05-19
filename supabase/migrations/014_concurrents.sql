-- Migration: 014_concurrents
-- Description: concurrents table for AI competitor detection

DO $$ BEGIN
  CREATE TYPE public.concurrent_detection_type AS ENUM ('auto', 'manuel');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
CREATE TABLE IF NOT EXISTS public.concurrents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  domaine TEXT,
  alias TEXT[] DEFAULT '{}'::TEXT[],
  type_detection public.concurrent_detection_type NOT NULL DEFAULT 'manuel',
  score_proximite INTEGER NOT NULL DEFAULT 50,
  justification JSONB,
  verrouille BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT concurrents_score_range CHECK (score_proximite >= 0 AND score_proximite <= 100)
);
CREATE INDEX IF NOT EXISTS idx_concurrents_project_id
  ON public.concurrents(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_concurrents_unique_domain
  ON public.concurrents(project_id, domaine)
  WHERE domaine IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_concurrents_unique_name
  ON public.concurrents(project_id, lower(nom));
ALTER TABLE public.concurrents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view concurrents of own projects" ON public.concurrents;
DROP POLICY IF EXISTS "Users can insert concurrents to own projects" ON public.concurrents;
DROP POLICY IF EXISTS "Users can update concurrents of own projects" ON public.concurrents;
DROP POLICY IF EXISTS "Users can delete concurrents of own projects" ON public.concurrents;
CREATE POLICY "Users can view concurrents of own projects" ON public.concurrents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = concurrents.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can insert concurrents to own projects" ON public.concurrents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = concurrents.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can update concurrents of own projects" ON public.concurrents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = concurrents.project_id
      AND projects.user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete concurrents of own projects" ON public.concurrents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = concurrents.project_id
      AND projects.user_id = auth.uid()
    )
  );
COMMENT ON TABLE public.concurrents IS 'Concurrents détectés ou ajoutés manuellement par projet';
