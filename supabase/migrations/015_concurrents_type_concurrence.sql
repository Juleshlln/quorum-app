-- Migration: 015_concurrents_type_concurrence
-- Description: add type_concurrence to concurrents

ALTER TABLE public.concurrents
  ADD COLUMN IF NOT EXISTS type_concurrence TEXT;
