-- Quorum MVP Database Schema
-- Migration: 002_analyses_modules
-- Description: Modular analyses (data collection + module results)

-- ============================================
-- ANALYSES (modular runs)
-- ============================================
CREATE TABLE IF NOT EXISTS public.analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    status run_status DEFAULT 'pending' NOT NULL,
    objectives TEXT[] DEFAULT '{}'::text[] NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_prompts INTEGER DEFAULT 0,
    completed_prompts INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analyses_project_id ON public.analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON public.analyses(status);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON public.analyses(created_at DESC);
-- ============================================
-- ANALYSIS ITEMS (raw AI responses)
-- ============================================
CREATE TABLE IF NOT EXISTS public.analysis_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    prompt_text TEXT NOT NULL,
    ai_model TEXT NOT NULL,
    ai_response TEXT,
    provider TEXT NOT NULL DEFAULT 'openai',
    brand_mentioned BOOLEAN,
    brand_position INTEGER,
    competitors_mentioned TEXT[] DEFAULT '{}'::text[],
    website_cited BOOLEAN,
    sentiment_label TEXT,
    response_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analysis_items_analysis_id ON public.analysis_items(analysis_id);
-- ============================================
-- MODULE RESULTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.analysis_module_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    module_key TEXT NOT NULL,
    score INTEGER,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (analysis_id, module_key)
);
CREATE INDEX IF NOT EXISTS idx_analysis_module_results_analysis_id
  ON public.analysis_module_results(analysis_id);
-- ============================================
-- RLS
-- ============================================
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_module_results ENABLE ROW LEVEL SECURITY;
-- Analyses: access through project ownership
CREATE POLICY "Users can view analyses of own projects" ON public.analyses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = analyses.project_id
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert analyses to own projects" ON public.analyses
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = analyses.project_id
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can update analyses of own projects" ON public.analyses
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = analyses.project_id
            AND projects.user_id = auth.uid()
        )
    );
-- Analysis items: access through analysis -> project ownership
CREATE POLICY "Users can view analysis items of own projects" ON public.analysis_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.analyses
            JOIN public.projects ON projects.id = analyses.project_id
            WHERE analyses.id = analysis_items.analysis_id
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert analysis items to own projects" ON public.analysis_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.analyses
            JOIN public.projects ON projects.id = analyses.project_id
            WHERE analyses.id = analysis_items.analysis_id
            AND projects.user_id = auth.uid()
        )
    );
-- Module results: access through analysis -> project ownership
CREATE POLICY "Users can view module results of own projects" ON public.analysis_module_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.analyses
            JOIN public.projects ON projects.id = analyses.project_id
            WHERE analyses.id = analysis_module_results.analysis_id
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert module results to own projects" ON public.analysis_module_results
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.analyses
            JOIN public.projects ON projects.id = analyses.project_id
            WHERE analyses.id = analysis_module_results.analysis_id
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can update module results of own projects" ON public.analysis_module_results
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.analyses
            JOIN public.projects ON projects.id = analyses.project_id
            WHERE analyses.id = analysis_module_results.analysis_id
            AND projects.user_id = auth.uid()
        )
    );
