// ===========================================
// Quorum MVP - Database Types
// Auto-generated from Supabase schema
// ===========================================

// Enums
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type RecommendationPriority = 'high' | 'medium' | 'low';
export type RecommendationCategory = 'content' | 'technical' | 'pr' | 'social' | 'other';

// ===========================================
// Core Types
// ===========================================

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  active_project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  brand_name: string | null;
  website: string | null;
  description: string | null;
  location: string | null;
  industry: string | null;
  target_countries: string[];
  target_languages: string[];
  keywords: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface Competitor {
  id: string;
  project_id: string;
  name: string;
  website: string | null;
  description: string | null;
  created_at: string;
}

export interface PromptTemplate {
  id: string;
  project_id: string;
  name: string;
  prompt_text: string;
  is_active: boolean;
  category: string | null;
  title?: string | null;
  primary_objective?: string | null;
  secondary_objectives?: string[];
  topic_slug?: string | null;
  is_default_monitoring?: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface Run {
  id: string;
  project_id: string;
  status: RunStatus;
  started_at: string | null;
  completed_at: string | null;
  score_visibility: number | null;
  score_accuracy: number | null;
  score_sentiment: number | null;
  score_ranking: number | null;
  score_overall: number | null;
  total_prompts: number;
  completed_prompts: number;
  error_message: string | null;
  created_at: string;
}

export interface Analysis {
  id: string;
  project_id: string;
  status: RunStatus;
  objectives: string[];
  analysis_mode: string;
  run_count: number;
  kind: string;
  runs_per_prompt: number;
  started_at: string | null;
  completed_at: string | null;
  total_prompts: number;
  completed_prompts: number;
  error_message: string | null;
  created_at: string;
}

export interface AnalysisItem {
  id: string;
  analysis_id: string;
  prompt_text: string;
  ai_model: string;
  ai_response: string | null;
  provider: string;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  competitors_mentioned: string[];
  website_cited: boolean | null;
  sentiment_label: string | null;
  response_time_ms: number | null;
  created_at: string;
}

export interface AnalysisModuleResult {
  id: string;
  analysis_id: string;
  module_key: string;
  score: number | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AnalysisRun {
  id: string;
  analysis_id: string;
  prompt_text: string;
  run_index: number;
  model?: string | null;
  response_text?: string | null;
  brand_mentioned?: boolean | null;
  sentiment_label?: string | null;
  position_rank?: number | null;
  created_at: string;
}

export interface AnalysisResponse {
  id: string;
  analysis_run_id: string;
  ai_model: string;
  ai_response: string | null;
  provider: string;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  competitors_mentioned: string[];
  website_cited: boolean | null;
  sentiment_label: string | null;
  response_time_ms: number | null;
  created_at: string;
}

export interface AnalysisMetric {
  id: string;
  analysis_id: string;
  prompt_text: string;
  samples: number;
  mention_rate: number | null;
  sentiment_positive: number | null;
  sentiment_neutral: number | null;
  sentiment_negative: number | null;
  avg_position: number | null;
  min_position: number | null;
  max_position: number | null;
  stability: number | null;
  created_at: string;
}
export interface AnalysisPrompt {
  id: string;
  analysis_id: string;
  prompt_text: string;
  category: string;
  type: string;
  objective_tag?: string | null;
  template_id?: string | null;
  created_at: string;
}

export interface MonitoringTopic {
  id: string;
  project_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonitoringPrompt {
  id: string;
  project_id: string;
  prompt_text: string;
  source: string;
  template_id: string | null;
  topic_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResponseCitation {
  id: string;
  analysis_run_id: string;
  url: string;
  domain: string;
  domain_type: string;
  created_at: string;
}

export interface DomainCatalog {
  domain: string;
  domain_type: string;
  updated_at: string;
}

export interface RunItem {
  id: string;
  run_id: string;
  prompt_template_id: string | null;
  prompt_text: string;
  ai_model: string;
  ai_response: string | null;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  competitors_mentioned: string[];
  website_cited: boolean | null;
  score_visibility: number | null;
  score_accuracy: number | null;
  score_sentiment: number | null;
  tokens_used: number | null;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface Recommendation {
  id: string;
  run_id: string;
  project_id: string;
  title: string;
  description: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  action_type: string | null;
  action_details: Record<string, unknown>;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

// ===========================================
// Insert Types (for creating new records)
// ===========================================

export interface ProjectInsert {
  user_id: string;
  name: string;
  website?: string | null;
  description?: string | null;
  location?: string | null;
  industry?: string | null;
  target_countries?: string[];
  target_languages?: string[];
  keywords?: string[] | null;
}

export interface ProjectUpdate {
  name?: string;
  website?: string | null;
  description?: string | null;
  location?: string | null;
  industry?: string | null;
  target_countries?: string[];
  target_languages?: string[];
  keywords?: string[] | null;
}

export interface CompetitorInsert {
  project_id: string;
  name: string;
  website?: string | null;
  description?: string | null;
}

export interface PromptTemplateInsert {
  project_id: string;
  name: string;
  prompt_text: string;
  is_active?: boolean;
  category?: string | null;
  title?: string | null;
  primary_objective?: string | null;
  secondary_objectives?: string[];
  topic_slug?: string | null;
  is_default_monitoring?: boolean | null;
}

export interface RunInsert {
  project_id: string;
  status?: RunStatus;
  total_prompts?: number;
}

export interface RunItemInsert {
  run_id: string;
  prompt_template_id?: string | null;
  prompt_text: string;
  ai_model: string;
  ai_response?: string | null;
  brand_mentioned?: boolean | null;
  brand_position?: number | null;
  competitors_mentioned?: string[];
  website_cited?: boolean | null;
  score_visibility?: number | null;
  score_accuracy?: number | null;
  score_sentiment?: number | null;
  tokens_used?: number | null;
  latency_ms?: number | null;
  error_message?: string | null;
}

export interface AnalysisInsert {
  project_id: string;
  status?: RunStatus;
  objectives?: string[];
  analysis_mode?: string;
  run_count?: number;
  kind?: string;
  runs_per_prompt?: number;
  total_prompts?: number;
  completed_prompts?: number;
  error_message?: string | null;
}

export interface AnalysisItemInsert {
  analysis_id: string;
  prompt_text: string;
  ai_model: string;
  ai_response?: string | null;
  provider?: string;
  brand_mentioned?: boolean | null;
  brand_position?: number | null;
  competitors_mentioned?: string[];
  website_cited?: boolean | null;
  sentiment_label?: string | null;
  response_time_ms?: number | null;
}

export interface AnalysisModuleResultInsert {
  analysis_id: string;
  module_key: string;
  score?: number | null;
  details?: Record<string, unknown>;
}

export interface AnalysisRunInsert {
  analysis_id: string;
  prompt_text: string;
  run_index: number;
  model?: string | null;
  response_text?: string | null;
  brand_mentioned?: boolean | null;
  sentiment_label?: string | null;
  position_rank?: number | null;
}

export interface AnalysisResponseInsert {
  analysis_run_id: string;
  ai_model: string;
  ai_response?: string | null;
  provider?: string;
  brand_mentioned?: boolean | null;
  brand_position?: number | null;
  competitors_mentioned?: string[];
  website_cited?: boolean | null;
  sentiment_label?: string | null;
  response_time_ms?: number | null;
}

export interface AnalysisMetricInsert {
  analysis_id: string;
  prompt_text: string;
  samples: number;
  mention_rate?: number | null;
  sentiment_positive?: number | null;
  sentiment_neutral?: number | null;
  sentiment_negative?: number | null;
  avg_position?: number | null;
  min_position?: number | null;
  max_position?: number | null;
  stability?: number | null;
}
export interface AnalysisPromptInsert {
  analysis_id: string;
  prompt_text: string;
  category: string;
  type: string;
  objective_tag?: string | null;
  template_id?: string | null;
}

export interface MonitoringTopicInsert {
  project_id: string;
  name: string;
  is_active?: boolean;
}

export interface MonitoringPromptInsert {
  project_id: string;
  prompt_text: string;
  source: string;
  template_id?: string | null;
  topic_id?: string | null;
  is_active?: boolean;
}

export interface ResponseCitationInsert {
  analysis_run_id: string;
  url: string;
  domain: string;
  domain_type?: string;
}

export interface DomainCatalogInsert {
  domain: string;
  domain_type?: string;
}

export interface RecommendationInsert {
  run_id: string;
  project_id: string;
  title: string;
  description: string;
  priority?: RecommendationPriority;
  category?: RecommendationCategory;
  action_type?: string | null;
  action_details?: Record<string, unknown>;
}

// ===========================================
// Extended Types (with relations)
// ===========================================

export interface ProjectWithCompetitors extends Project {
  competitors: Competitor[];
}

export interface ProjectWithDetails extends Project {
  competitors: Competitor[];
  prompt_templates: PromptTemplate[];
  runs: Run[];
}

export interface RunWithItems extends Run {
  run_items: RunItem[];
  recommendations: Recommendation[];
  project?: Project;
}

export interface RunSummary {
  id: string;
  project_id: string;
  project_name: string;
  status: RunStatus;
  score_overall: number | null;
  total_prompts: number;
  completed_prompts: number;
  created_at: string;
  completed_at: string | null;
}

// ===========================================
// API Response Types
// ===========================================

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ===========================================
// Scoring Types
// ===========================================

export interface ScoreBreakdown {
  visibility: number;
  accuracy: number;
  sentiment: number;
  ranking: number;
  overall: number;
}

export interface AnalysisResult {
  brand_mentioned: boolean;
  brand_position: number | null;
  competitors_mentioned: string[];
  website_cited: boolean;
  scores: {
    visibility: number;
    accuracy: number;
    sentiment: number;
  };
  raw_response: string;
}

// ===========================================
// Supabase Database Type
// ===========================================

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      projects: {
        Row: Project;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
        Relationships: [];
      };
      competitors: {
        Row: Competitor;
        Insert: CompetitorInsert;
        Update: Partial<Omit<Competitor, 'id' | 'project_id' | 'created_at'>>;
        Relationships: [];
      };
      prompt_templates: {
        Row: PromptTemplate;
        Insert: PromptTemplateInsert;
        Update: Partial<Omit<PromptTemplate, 'id' | 'project_id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      runs: {
        Row: Run;
        Insert: RunInsert;
        Update: Partial<Omit<Run, 'id' | 'project_id' | 'created_at'>>;
        Relationships: [];
      };
      analyses: {
        Row: Analysis;
        Insert: AnalysisInsert;
        Update: Partial<Omit<Analysis, 'id' | 'project_id' | 'created_at'>>;
        Relationships: [];
      };
      run_items: {
        Row: RunItem;
        Insert: RunItemInsert;
        Update: Partial<Omit<RunItem, 'id' | 'run_id' | 'created_at'>>;
        Relationships: [];
      };
      analysis_items: {
        Row: AnalysisItem;
        Insert: AnalysisItemInsert;
        Update: Partial<Omit<AnalysisItem, 'id' | 'analysis_id' | 'created_at'>>;
        Relationships: [];
      };
      analysis_module_results: {
        Row: AnalysisModuleResult;
        Insert: AnalysisModuleResultInsert;
        Update: Partial<Omit<AnalysisModuleResult, 'id' | 'analysis_id' | 'created_at'>>;
        Relationships: [];
      };
      analysis_runs: {
        Row: AnalysisRun;
        Insert: AnalysisRunInsert;
        Update: Partial<Omit<AnalysisRun, 'id' | 'analysis_id' | 'created_at'>>;
        Relationships: [];
      };
      analysis_responses: {
        Row: AnalysisResponse;
        Insert: AnalysisResponseInsert;
        Update: Partial<Omit<AnalysisResponse, 'id' | 'analysis_run_id' | 'created_at'>>;
        Relationships: [];
      };
      analysis_metrics: {
        Row: AnalysisMetric;
        Insert: AnalysisMetricInsert;
        Update: Partial<Omit<AnalysisMetric, 'id' | 'analysis_id' | 'created_at'>>;
        Relationships: [];
      };
      analysis_prompts: {
        Row: AnalysisPrompt;
        Insert: AnalysisPromptInsert;
        Update: Partial<Omit<AnalysisPrompt, 'id' | 'analysis_id' | 'created_at'>>;
        Relationships: [];
      };
      monitoring_topics: {
        Row: MonitoringTopic;
        Insert: MonitoringTopicInsert;
        Update: Partial<Omit<MonitoringTopic, 'id' | 'project_id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      monitoring_prompts: {
        Row: MonitoringPrompt;
        Insert: MonitoringPromptInsert;
        Update: Partial<Omit<MonitoringPrompt, 'id' | 'project_id' | 'created_at' | 'updated_at'>>;
        Relationships: [];
      };
      response_citations: {
        Row: ResponseCitation;
        Insert: ResponseCitationInsert;
        Update: Partial<Omit<ResponseCitation, 'id' | 'analysis_run_id' | 'created_at'>>;
        Relationships: [];
      };
      domains_catalog: {
        Row: DomainCatalog;
        Insert: DomainCatalogInsert;
        Update: Partial<Omit<DomainCatalog, 'domain' | 'updated_at'>>;
        Relationships: [];
      };
      recommendations: {
        Row: Recommendation;
        Insert: RecommendationInsert;
        Update: Partial<Omit<Recommendation, 'id' | 'run_id' | 'project_id' | 'created_at'>>;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {
      run_status: RunStatus;
      recommendation_priority: RecommendationPriority;
      recommendation_category: RecommendationCategory;
    };
    CompositeTypes: {};
  };
};
