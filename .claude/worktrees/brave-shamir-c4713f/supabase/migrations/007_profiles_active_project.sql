-- Migration: 007_profiles_active_project
-- Description: Store active project for single-brand MVP

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_active_project_id ON public.profiles(active_project_id);
