-- Migration: 025_product_visibility_monitoring
-- Description: Product visibility data model for B2B ecommerce monitoring

-- Product categories (shopping universes)
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  business_intent TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_unique_name
  ON public.product_categories(project_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_product_categories_project
  ON public.product_categories(project_id, status, priority);

-- Products / items monitored for visibility
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  brand_name TEXT,
  product_url TEXT,
  sku TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  is_owned_product BOOLEAN NOT NULL DEFAULT false,
  competitor_brand TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_unique_name_sku
  ON public.products(project_id, lower(product_name), COALESCE(lower(sku), ''));
CREATE INDEX IF NOT EXISTS idx_products_project_category
  ON public.products(project_id, category_id);
CREATE INDEX IF NOT EXISTS idx_products_project_owned
  ON public.products(project_id, is_owned_product, status);

-- Product attributes dictionary (optional per category)
CREATE TABLE IF NOT EXISTS public.product_attributes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_attributes_unique
  ON public.product_attributes(project_id, category_id, lower(name));
CREATE INDEX IF NOT EXISTS idx_product_attributes_project
  ON public.product_attributes(project_id, category_id);

-- Structured extraction results per run/prompt/product
CREATE TABLE IF NOT EXISTS public.product_visibility_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.monitoring_runs(id) ON DELETE SET NULL,
  prompt_id UUID REFERENCES public.monitoring_prompts(id) ON DELETE SET NULL,
  prompt_run_id UUID REFERENCES public.prompt_runs(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ai_model TEXT,
  buying_intent TEXT,
  visibility_score NUMERIC,
  rank_position INTEGER,
  mention_count INTEGER NOT NULL DEFAULT 1,
  sentiment_score NUMERIC,
  accuracy_score NUMERIC,
  attributes_detected JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources_detected JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_answer TEXT,
  analysis_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_owned_product BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_visibility_results_unique
  ON public.product_visibility_results(project_id, prompt_run_id, product_id, COALESCE(ai_model, ''));
CREATE INDEX IF NOT EXISTS idx_product_visibility_results_project
  ON public.product_visibility_results(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_visibility_results_run
  ON public.product_visibility_results(project_id, run_id);
CREATE INDEX IF NOT EXISTS idx_product_visibility_results_category
  ON public.product_visibility_results(project_id, category_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_visibility_results_product
  ON public.product_visibility_results(project_id, product_id, created_at DESC);

-- Actionable recommendations generated from product visibility gaps
CREATE TABLE IF NOT EXISTS public.product_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  run_id UUID REFERENCES public.monitoring_runs(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  expected_impact TEXT,
  effort TEXT,
  source_reason TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_recommendations_project
  ON public.product_recommendations(project_id, status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_recommendations_category
  ON public.product_recommendations(project_id, category_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_recommendations_product
  ON public.product_recommendations(project_id, product_id, created_at DESC);

-- Prompt metadata for ecommerce monitoring
ALTER TABLE public.monitoring_prompts
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS buying_intent TEXT,
  ADD COLUMN IF NOT EXISTS topic_label TEXT,
  ADD COLUMN IF NOT EXISTS monitoring_frequency TEXT NOT NULL DEFAULT 'daily';

CREATE INDEX IF NOT EXISTS idx_monitoring_prompts_category_id
  ON public.monitoring_prompts(category_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_prompts_buying_intent
  ON public.monitoring_prompts(project_id, buying_intent);

-- Prompt -> Product many-to-many relation (a prompt can target multiple products)
CREATE TABLE IF NOT EXISTS public.monitoring_prompt_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES public.monitoring_prompts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoring_prompt_products_unique
  ON public.monitoring_prompt_products(prompt_id, product_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_prompt_products_project
  ON public.monitoring_prompt_products(project_id, prompt_id, product_id);

-- RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_visibility_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_prompt_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view product categories of own projects" ON public.product_categories;
DROP POLICY IF EXISTS "Users can insert product categories to own projects" ON public.product_categories;
DROP POLICY IF EXISTS "Users can update product categories of own projects" ON public.product_categories;
DROP POLICY IF EXISTS "Users can delete product categories of own projects" ON public.product_categories;

CREATE POLICY "Users can view product categories of own projects" ON public.product_categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_categories.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert product categories to own projects" ON public.product_categories
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_categories.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update product categories of own projects" ON public.product_categories
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_categories.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete product categories of own projects" ON public.product_categories
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_categories.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view products of own projects" ON public.products;
DROP POLICY IF EXISTS "Users can insert products to own projects" ON public.products;
DROP POLICY IF EXISTS "Users can update products of own projects" ON public.products;
DROP POLICY IF EXISTS "Users can delete products of own projects" ON public.products;

CREATE POLICY "Users can view products of own projects" ON public.products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = products.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert products to own projects" ON public.products
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = products.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update products of own projects" ON public.products
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = products.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete products of own projects" ON public.products
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = products.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view product attributes of own projects" ON public.product_attributes;
DROP POLICY IF EXISTS "Users can insert product attributes to own projects" ON public.product_attributes;
DROP POLICY IF EXISTS "Users can update product attributes of own projects" ON public.product_attributes;
DROP POLICY IF EXISTS "Users can delete product attributes of own projects" ON public.product_attributes;

CREATE POLICY "Users can view product attributes of own projects" ON public.product_attributes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_attributes.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert product attributes to own projects" ON public.product_attributes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_attributes.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update product attributes of own projects" ON public.product_attributes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_attributes.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete product attributes of own projects" ON public.product_attributes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_attributes.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view product visibility results of own projects" ON public.product_visibility_results;
DROP POLICY IF EXISTS "Users can insert product visibility results to own projects" ON public.product_visibility_results;
DROP POLICY IF EXISTS "Users can update product visibility results of own projects" ON public.product_visibility_results;
DROP POLICY IF EXISTS "Users can delete product visibility results of own projects" ON public.product_visibility_results;

CREATE POLICY "Users can view product visibility results of own projects" ON public.product_visibility_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_visibility_results.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert product visibility results to own projects" ON public.product_visibility_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_visibility_results.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update product visibility results of own projects" ON public.product_visibility_results
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_visibility_results.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete product visibility results of own projects" ON public.product_visibility_results
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_visibility_results.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view product recommendations of own projects" ON public.product_recommendations;
DROP POLICY IF EXISTS "Users can insert product recommendations to own projects" ON public.product_recommendations;
DROP POLICY IF EXISTS "Users can update product recommendations of own projects" ON public.product_recommendations;
DROP POLICY IF EXISTS "Users can delete product recommendations of own projects" ON public.product_recommendations;

CREATE POLICY "Users can view product recommendations of own projects" ON public.product_recommendations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_recommendations.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert product recommendations to own projects" ON public.product_recommendations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_recommendations.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update product recommendations of own projects" ON public.product_recommendations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_recommendations.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete product recommendations of own projects" ON public.product_recommendations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = product_recommendations.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view monitoring prompt products of own projects" ON public.monitoring_prompt_products;
DROP POLICY IF EXISTS "Users can insert monitoring prompt products to own projects" ON public.monitoring_prompt_products;
DROP POLICY IF EXISTS "Users can update monitoring prompt products of own projects" ON public.monitoring_prompt_products;
DROP POLICY IF EXISTS "Users can delete monitoring prompt products of own projects" ON public.monitoring_prompt_products;

CREATE POLICY "Users can view monitoring prompt products of own projects" ON public.monitoring_prompt_products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_prompt_products.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert monitoring prompt products to own projects" ON public.monitoring_prompt_products
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_prompt_products.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update monitoring prompt products of own projects" ON public.monitoring_prompt_products
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_prompt_products.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete monitoring prompt products of own projects" ON public.monitoring_prompt_products
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = monitoring_prompt_products.project_id
      AND projects.user_id = auth.uid()
    )
  );
