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
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  website: string | null;
  description: string | null;
  industry: string | null;
  target_countries: string[];
  target_languages: string[];
  keywords: string[];
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
  industry?: string | null;
  target_countries?: string[];
  target_languages?: string[];
  keywords?: string[];
}

export interface ProjectUpdate {
  name?: string;
  website?: string | null;
  description?: string | null;
  industry?: string | null;
  target_countries?: string[];
  target_languages?: string[];
  keywords?: string[];
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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      projects: {
        Row: Project;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
      };
      competitors: {
        Row: Competitor;
        Insert: CompetitorInsert;
        Update: Partial<Omit<Competitor, 'id' | 'project_id' | 'created_at'>>;
      };
      prompt_templates: {
        Row: PromptTemplate;
        Insert: PromptTemplateInsert;
        Update: Partial<Omit<PromptTemplate, 'id' | 'project_id' | 'created_at' | 'updated_at'>>;
      };
      runs: {
        Row: Run;
        Insert: RunInsert;
        Update: Partial<Omit<Run, 'id' | 'project_id' | 'created_at'>>;
      };
      run_items: {
        Row: RunItem;
        Insert: RunItemInsert;
        Update: Partial<Omit<RunItem, 'id' | 'run_id' | 'created_at'>>;
      };
      recommendations: {
        Row: Recommendation;
        Insert: RecommendationInsert;
        Update: Partial<Omit<Recommendation, 'id' | 'run_id' | 'project_id' | 'created_at'>>;
      };
    };
    Enums: {
      run_status: RunStatus;
      recommendation_priority: RecommendationPriority;
      recommendation_category: RecommendationCategory;
    };
  };
}
