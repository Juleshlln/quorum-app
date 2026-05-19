-- Migration: 030_product_visibility_detected_entities
-- Description: Store detected product and brand names for product visibility auditability

ALTER TABLE public.product_visibility_results
  ADD COLUMN IF NOT EXISTS detected_product_name TEXT,
  ADD COLUMN IF NOT EXISTS detected_brand_name TEXT,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC;

CREATE INDEX IF NOT EXISTS idx_product_visibility_results_detected_brand
  ON public.product_visibility_results(project_id, lower(detected_brand_name))
  WHERE detected_brand_name IS NOT NULL;
