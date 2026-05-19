-- Migration: 004_project_location
-- Description: Add optional location to projects for contextual prompts

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS location TEXT;
