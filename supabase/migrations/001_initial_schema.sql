-- Quorum MVP Database Schema
-- Migration: 001_initial_schema
-- Description: Core tables for AI Visibility Analytics SaaS

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- ============================================
-- CUSTOM TYPES
-- ============================================
CREATE TYPE run_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE recommendation_priority AS ENUM ('high', 'medium', 'low');
CREATE TYPE recommendation_category AS ENUM ('content', 'technical', 'pr', 'social', 'other');
-- ============================================
-- PROFILES (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    company_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
-- ============================================
-- PROJECTS / BRANDS
-- ============================================
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Brand info
    name TEXT NOT NULL,
    website TEXT,
    description TEXT,
    location TEXT,
    
    -- Context
    industry TEXT,
    target_countries TEXT[] DEFAULT '{}',
    target_languages TEXT[] DEFAULT '{fr}',
    
    -- Keywords & topics
    keywords TEXT[] DEFAULT '{}',
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
-- ============================================
-- COMPETITORS
-- ============================================
CREATE TABLE public.competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    website TEXT,
    description TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_competitors_project_id ON public.competitors(project_id);
-- ============================================
-- PROMPT TEMPLATES
-- ============================================
CREATE TABLE public.prompt_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    
    -- Template content
    name TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    
    -- Variables available: {brand}, {industry}, {competitors}, {location}
    -- Example: "Quels sont les meilleurs {industry} en France? Que penses-tu de {brand}?"
    
    -- Config
    is_active BOOLEAN DEFAULT true,
    category TEXT, -- 'visibility', 'accuracy', 'sentiment', 'comparison'
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_prompt_templates_project_id ON public.prompt_templates(project_id);
-- ============================================
-- RUNS
-- ============================================
CREATE TABLE public.runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    
    -- Status
    status run_status DEFAULT 'pending' NOT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Aggregated scores (0-100)
    score_visibility INTEGER, -- Brand mentioned?
    score_accuracy INTEGER,   -- Correct info?
    score_sentiment INTEGER,  -- Positive/negative?
    score_ranking INTEGER,    -- Position vs competitors
    score_overall INTEGER,    -- Weighted average
    
    -- Stats
    total_prompts INTEGER DEFAULT 0,
    completed_prompts INTEGER DEFAULT 0,
    
    -- Error handling
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_runs_project_id ON public.runs(project_id);
CREATE INDEX idx_runs_status ON public.runs(status);
CREATE INDEX idx_runs_created_at ON public.runs(created_at DESC);
-- ============================================
-- RUN ITEMS (individual prompt results)
-- ============================================
CREATE TABLE public.run_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
    prompt_template_id UUID REFERENCES public.prompt_templates(id) ON DELETE SET NULL,
    
    -- Input
    prompt_text TEXT NOT NULL, -- Resolved prompt (variables replaced)
    
    -- Output
    ai_model TEXT NOT NULL, -- 'gpt-4', 'claude-3', etc.
    ai_response TEXT,
    
    -- Analysis results
    brand_mentioned BOOLEAN,
    brand_position INTEGER, -- Position in list if applicable (1 = first)
    competitors_mentioned TEXT[] DEFAULT '{}',
    website_cited BOOLEAN,
    
    -- Scores (0-100)
    score_visibility INTEGER,
    score_accuracy INTEGER,
    score_sentiment INTEGER,
    
    -- Metadata
    tokens_used INTEGER,
    latency_ms INTEGER,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_run_items_run_id ON public.run_items(run_id);
-- ============================================
-- RECOMMENDATIONS
-- ============================================
CREATE TABLE public.recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    
    -- Content
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Classification
    priority recommendation_priority DEFAULT 'medium' NOT NULL,
    category recommendation_category DEFAULT 'content' NOT NULL,
    
    -- Actionable details
    action_type TEXT, -- 'create_page', 'add_faq', 'update_schema', 'write_pr', etc.
    action_details JSONB DEFAULT '{}',
    
    -- Status tracking
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX idx_recommendations_run_id ON public.recommendations(run_id);
CREATE INDEX idx_recommendations_project_id ON public.recommendations(project_id);
CREATE INDEX idx_recommendations_priority ON public.recommendations(priority);
-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
-- Profiles: users can only see/edit their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
-- Projects: users can only access their own projects
CREATE POLICY "Users can view own projects" ON public.projects
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects
    FOR DELETE USING (auth.uid() = user_id);
-- Competitors: access through project ownership
CREATE POLICY "Users can view competitors of own projects" ON public.competitors
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = competitors.project_id 
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert competitors to own projects" ON public.competitors
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = competitors.project_id 
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can update competitors of own projects" ON public.competitors
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = competitors.project_id 
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can delete competitors of own projects" ON public.competitors
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = competitors.project_id 
            AND projects.user_id = auth.uid()
        )
    );
-- Prompt templates: access through project ownership
CREATE POLICY "Users can view templates of own projects" ON public.prompt_templates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = prompt_templates.project_id 
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert templates to own projects" ON public.prompt_templates
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = prompt_templates.project_id 
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can update templates of own projects" ON public.prompt_templates
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = prompt_templates.project_id 
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can delete templates of own projects" ON public.prompt_templates
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = prompt_templates.project_id 
            AND projects.user_id = auth.uid()
        )
    );
-- Runs: access through project ownership
CREATE POLICY "Users can view runs of own projects" ON public.runs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = runs.project_id 
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert runs to own projects" ON public.runs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = runs.project_id 
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can update runs of own projects" ON public.runs
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = runs.project_id 
            AND projects.user_id = auth.uid()
        )
    );
-- Run items: access through run -> project ownership
CREATE POLICY "Users can view run items of own projects" ON public.run_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.runs
            JOIN public.projects ON projects.id = runs.project_id
            WHERE runs.id = run_items.run_id 
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert run items to own projects" ON public.run_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.runs
            JOIN public.projects ON projects.id = runs.project_id
            WHERE runs.id = run_items.run_id 
            AND projects.user_id = auth.uid()
        )
    );
-- Recommendations: access through project ownership
CREATE POLICY "Users can view recommendations of own projects" ON public.recommendations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = recommendations.project_id 
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can insert recommendations to own projects" ON public.recommendations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = recommendations.project_id 
            AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "Users can update recommendations of own projects" ON public.recommendations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = recommendations.project_id 
            AND projects.user_id = auth.uid()
        )
    );
-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_prompt_templates_updated_at
    BEFORE UPDATE ON public.prompt_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
-- ============================================
-- DEFAULT PROMPT TEMPLATES (inserted per project)
-- ============================================
-- These will be created via application code when a project is created

COMMENT ON TABLE public.projects IS 'Brand/company projects for AI visibility analysis';
COMMENT ON TABLE public.competitors IS 'Competitor brands to compare against';
COMMENT ON TABLE public.prompt_templates IS 'Prompt templates with variables: {brand}, {industry}, {competitors}, {location}';
COMMENT ON TABLE public.runs IS 'Analysis run sessions';
COMMENT ON TABLE public.run_items IS 'Individual prompt execution results';
COMMENT ON TABLE public.recommendations IS 'Actionable recommendations from analysis';
