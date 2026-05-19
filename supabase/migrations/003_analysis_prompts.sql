-- Quorum MVP Database Schema
-- Migration: 003_analysis_prompts
-- Description: Store prompts used per analysis (selected + custom)

CREATE TABLE IF NOT EXISTS public.analysis_prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_id UUID NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
    prompt_text TEXT NOT NULL,
    category TEXT NOT NULL, -- visibility | position | sentiment
    type TEXT NOT NULL, -- suggested | custom
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_analysis_prompts_analysis_id ON public.analysis_prompts(analysis_id);
ALTER TABLE public.analysis_prompts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view analysis prompts of own projects" ON public.analysis_prompts;
DROP POLICY IF EXISTS "Users can insert analysis prompts to own projects" ON public.analysis_prompts;
CREATE POLICY "Users can view analysis prompts of own projects" ON public.analysis_prompts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.analyses
            JOIN public.projects ON projects.id = analyses.project_id
            WHERE analyses.id = analysis_prompts.analysis_id
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert analysis prompts to own projects" ON public.analysis_prompts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.analyses
            JOIN public.projects ON projects.id = analyses.project_id
            WHERE analyses.id = analysis_prompts.analysis_id
            AND projects.user_id = auth.uid()
        )
    );
