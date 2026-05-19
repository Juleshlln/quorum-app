-- Migration: 027_product_catalog_sources
-- Description: Sources de catalogue produits (sitemap, CSV, Shopify, WooCommerce) + historique d'import.

-- 1) Table des sources de catalogue
CREATE TABLE IF NOT EXISTS public.product_catalog_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('sitemap', 'csv', 'shopify', 'woocommerce')),
  name TEXT NOT NULL,
  -- Configuration spécifique au connecteur (URL, identifiants, options).
  -- Les credentials ne doivent JAMAIS être renvoyés au client (cf. lib/product-catalog).
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'error')),
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  last_item_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_catalog_sources_project
  ON public.product_catalog_sources(project_id, kind, status);

-- 2) Historique des imports
CREATE TABLE IF NOT EXISTS public.product_catalog_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES public.product_catalog_sources(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_catalog_imports_project
  ON public.product_catalog_imports(project_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_catalog_imports_source
  ON public.product_catalog_imports(source_id, started_at DESC);

-- 3) Colonnes additionnelles sur products (pour upsert depuis une source)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS external_ref TEXT,
  ADD COLUMN IF NOT EXISTS catalog_source_id UUID REFERENCES public.product_catalog_sources(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS price_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS price_currency TEXT,
  ADD COLUMN IF NOT EXISTS availability TEXT;

-- Index unique pour l'upsert par source (n'impacte pas les produits manuels qui ont catalog_source_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_external_ref_per_source
  ON public.products(catalog_source_id, external_ref)
  WHERE catalog_source_id IS NOT NULL AND external_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_catalog_source
  ON public.products(catalog_source_id);

-- 4) RLS
ALTER TABLE public.product_catalog_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_catalog_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view catalog sources of own projects" ON public.product_catalog_sources;
DROP POLICY IF EXISTS "Users can insert catalog sources to own projects" ON public.product_catalog_sources;
DROP POLICY IF EXISTS "Users can update catalog sources of own projects" ON public.product_catalog_sources;
DROP POLICY IF EXISTS "Users can delete catalog sources of own projects" ON public.product_catalog_sources;

CREATE POLICY "Users can view catalog sources of own projects" ON public.product_catalog_sources
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_catalog_sources.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert catalog sources to own projects" ON public.product_catalog_sources
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_catalog_sources.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update catalog sources of own projects" ON public.product_catalog_sources
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_catalog_sources.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete catalog sources of own projects" ON public.product_catalog_sources
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_catalog_sources.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view catalog imports of own projects" ON public.product_catalog_imports;
DROP POLICY IF EXISTS "Users can insert catalog imports to own projects" ON public.product_catalog_imports;
DROP POLICY IF EXISTS "Users can update catalog imports of own projects" ON public.product_catalog_imports;
DROP POLICY IF EXISTS "Users can delete catalog imports of own projects" ON public.product_catalog_imports;

CREATE POLICY "Users can view catalog imports of own projects" ON public.product_catalog_imports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_catalog_imports.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert catalog imports to own projects" ON public.product_catalog_imports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_catalog_imports.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update catalog imports of own projects" ON public.product_catalog_imports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_catalog_imports.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete catalog imports of own projects" ON public.product_catalog_imports
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_catalog_imports.project_id
      AND projects.user_id = auth.uid()
    )
  );
