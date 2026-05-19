-- Migration: 022_report_exports
-- Description: Daily exports registry + private reports bucket

CREATE TABLE IF NOT EXISTS public.report_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.monitoring_runs(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('daily_audit_pdf', 'csv_export')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'generating', 'done', 'failed')),
  file_path TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_exports_project_run_date
  ON public.report_exports(project_id, run_date);

CREATE INDEX IF NOT EXISTS idx_report_exports_run_id
  ON public.report_exports(run_id);

ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own project exports" ON public.report_exports;
DROP POLICY IF EXISTS "Users can create own project exports" ON public.report_exports;
DROP POLICY IF EXISTS "Users can update own project exports" ON public.report_exports;

CREATE POLICY "Users can view own project exports" ON public.report_exports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = report_exports.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own project exports" ON public.report_exports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = report_exports.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own project exports" ON public.report_exports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = report_exports.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Private storage bucket for generated reports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false,
  52428800,
  ARRAY['application/pdf', 'text/csv', 'text/plain']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
