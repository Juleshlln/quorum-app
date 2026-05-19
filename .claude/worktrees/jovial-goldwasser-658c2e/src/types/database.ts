export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_answers: {
        Row: {
          created_at: string
          id: string
          prompt_run_id: string
          raw_answer_text: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          prompt_run_id: string
          raw_answer_text?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          prompt_run_id?: string
          raw_answer_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_answers_prompt_run_id_fkey"
            columns: ["prompt_run_id"]
            isOneToOne: false
            referencedRelation: "prompt_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      analyses: {
        Row: {
          analysis_mode: string
          completed_at: string | null
          completed_prompts: number | null
          created_at: string
          error_message: string | null
          id: string
          kind: string
          objectives: string[]
          project_id: string
          run_count: number
          runs_per_prompt: number
          started_at: string | null
          status: Database["public"]["Enums"]["run_status"]
          total_prompts: number | null
        }
        Insert: {
          analysis_mode?: string
          completed_at?: string | null
          completed_prompts?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          kind?: string
          objectives?: string[]
          project_id: string
          run_count?: number
          runs_per_prompt?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          total_prompts?: number | null
        }
        Update: {
          analysis_mode?: string
          completed_at?: string | null
          completed_prompts?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          kind?: string
          objectives?: string[]
          project_id?: string
          run_count?: number
          runs_per_prompt?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          total_prompts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analyses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_items: {
        Row: {
          ai_model: string
          ai_response: string | null
          analysis_id: string
          brand_mentioned: boolean | null
          brand_position: number | null
          competitors_mentioned: string[] | null
          created_at: string
          id: string
          prompt_text: string
          provider: string
          response_time_ms: number | null
          sentiment_label: string | null
          website_cited: boolean | null
        }
        Insert: {
          ai_model: string
          ai_response?: string | null
          analysis_id: string
          brand_mentioned?: boolean | null
          brand_position?: number | null
          competitors_mentioned?: string[] | null
          created_at?: string
          id?: string
          prompt_text: string
          provider?: string
          response_time_ms?: number | null
          sentiment_label?: string | null
          website_cited?: boolean | null
        }
        Update: {
          ai_model?: string
          ai_response?: string | null
          analysis_id?: string
          brand_mentioned?: boolean | null
          brand_position?: number | null
          competitors_mentioned?: string[] | null
          created_at?: string
          id?: string
          prompt_text?: string
          provider?: string
          response_time_ms?: number | null
          sentiment_label?: string | null
          website_cited?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_items_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_metrics: {
        Row: {
          analysis_id: string
          avg_position: number | null
          created_at: string
          id: string
          max_position: number | null
          mention_rate: number | null
          min_position: number | null
          prompt_text: string
          samples: number
          sentiment_negative: number | null
          sentiment_neutral: number | null
          sentiment_positive: number | null
          stability: number | null
        }
        Insert: {
          analysis_id: string
          avg_position?: number | null
          created_at?: string
          id?: string
          max_position?: number | null
          mention_rate?: number | null
          min_position?: number | null
          prompt_text: string
          samples?: number
          sentiment_negative?: number | null
          sentiment_neutral?: number | null
          sentiment_positive?: number | null
          stability?: number | null
        }
        Update: {
          analysis_id?: string
          avg_position?: number | null
          created_at?: string
          id?: string
          max_position?: number | null
          mention_rate?: number | null
          min_position?: number | null
          prompt_text?: string
          samples?: number
          sentiment_negative?: number | null
          sentiment_neutral?: number | null
          sentiment_positive?: number | null
          stability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_metrics_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_module_results: {
        Row: {
          analysis_id: string
          created_at: string
          details: Json | null
          id: string
          module_key: string
          score: number | null
        }
        Insert: {
          analysis_id: string
          created_at?: string
          details?: Json | null
          id?: string
          module_key: string
          score?: number | null
        }
        Update: {
          analysis_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          module_key?: string
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_module_results_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_prompts: {
        Row: {
          analysis_id: string
          category: string
          created_at: string
          id: string
          objective_tag: string | null
          prompt_text: string
          template_id: string | null
          type: string
        }
        Insert: {
          analysis_id: string
          category: string
          created_at?: string
          id?: string
          objective_tag?: string | null
          prompt_text: string
          template_id?: string | null
          type: string
        }
        Update: {
          analysis_id?: string
          category?: string
          created_at?: string
          id?: string
          objective_tag?: string | null
          prompt_text?: string
          template_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_prompts_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_responses: {
        Row: {
          ai_model: string
          ai_response: string | null
          analysis_run_id: string
          brand_mentioned: boolean | null
          brand_position: number | null
          competitors_mentioned: string[] | null
          created_at: string
          id: string
          provider: string
          response_time_ms: number | null
          sentiment_label: string | null
          website_cited: boolean | null
        }
        Insert: {
          ai_model: string
          ai_response?: string | null
          analysis_run_id: string
          brand_mentioned?: boolean | null
          brand_position?: number | null
          competitors_mentioned?: string[] | null
          created_at?: string
          id?: string
          provider?: string
          response_time_ms?: number | null
          sentiment_label?: string | null
          website_cited?: boolean | null
        }
        Update: {
          ai_model?: string
          ai_response?: string | null
          analysis_run_id?: string
          brand_mentioned?: boolean | null
          brand_position?: number | null
          competitors_mentioned?: string[] | null
          created_at?: string
          id?: string
          provider?: string
          response_time_ms?: number | null
          sentiment_label?: string | null
          website_cited?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_responses_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_runs: {
        Row: {
          analysis_id: string
          brand_mentioned: boolean | null
          created_at: string
          id: string
          model: string | null
          position_rank: number | null
          prompt_text: string
          response_text: string | null
          run_index: number
          run_origin: string | null
          run_type: string
          sentiment_label: string | null
          topic_id: string | null
        }
        Insert: {
          analysis_id: string
          brand_mentioned?: boolean | null
          created_at?: string
          id?: string
          model?: string | null
          position_rank?: number | null
          prompt_text: string
          response_text?: string | null
          run_index: number
          run_origin?: string | null
          run_type?: string
          sentiment_label?: string | null
          topic_id?: string | null
        }
        Update: {
          analysis_id?: string
          brand_mentioned?: boolean | null
          created_at?: string
          id?: string
          model?: string | null
          position_rank?: number | null
          prompt_text?: string
          response_text?: string | null
          run_index?: number
          run_origin?: string | null
          run_type?: string
          sentiment_label?: string | null
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_runs_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analysis_runs_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "monitoring_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      citations: {
        Row: {
          ai_model: string | null
          brand_mentioned: boolean
          cited_at: string
          competitor_mentioned: boolean | null
          confidence: number | null
          created_at: string
          domain_id: string
          id: string
          method: string | null
          position_in_answer: number | null
          project_id: string
          prompt_run_id: string
          rationale: string | null
          response_id: string | null
          topic_id: string | null
          url_id: string | null
        }
        Insert: {
          ai_model?: string | null
          brand_mentioned?: boolean
          cited_at?: string
          competitor_mentioned?: boolean | null
          confidence?: number | null
          created_at?: string
          domain_id: string
          id?: string
          method?: string | null
          position_in_answer?: number | null
          project_id: string
          prompt_run_id: string
          rationale?: string | null
          response_id?: string | null
          topic_id?: string | null
          url_id?: string | null
        }
        Update: {
          ai_model?: string | null
          brand_mentioned?: boolean
          cited_at?: string
          competitor_mentioned?: boolean | null
          confidence?: number | null
          created_at?: string
          domain_id?: string
          id?: string
          method?: string | null
          position_in_answer?: number | null
          project_id?: string
          prompt_run_id?: string
          rationale?: string | null
          response_id?: string | null
          topic_id?: string | null
          url_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "citations_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "sources_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citations_prompt_run_fk"
            columns: ["prompt_run_id"]
            isOneToOne: false
            referencedRelation: "prompt_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citations_prompt_run_id_fkey"
            columns: ["prompt_run_id"]
            isOneToOne: false
            referencedRelation: "prompt_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citations_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "monitoring_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citations_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "monitoring_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citations_url_id_fkey"
            columns: ["url_id"]
            isOneToOne: false
            referencedRelation: "sources_urls"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_suggestions: {
        Row: {
          confidence: number | null
          created_at: string
          description: string | null
          domain: string | null
          evidence: Json | null
          id: string
          method: string | null
          name: string
          project_id: string
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          description?: string | null
          domain?: string | null
          evidence?: Json | null
          id?: string
          method?: string | null
          name: string
          project_id: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          description?: string | null
          domain?: string | null
          evidence?: Json | null
          id?: string
          method?: string | null
          name?: string
          project_id?: string
          status?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_suggestions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          confidence: number | null
          created_at: string
          description: string | null
          domain: string | null
          evidence: Json | null
          id: string
          method: string | null
          name: string
          project_id: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          description?: string | null
          domain?: string | null
          evidence?: Json | null
          id?: string
          method?: string | null
          name: string
          project_id: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          description?: string | null
          domain?: string | null
          evidence?: Json | null
          id?: string
          method?: string | null
          name?: string
          project_id?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      concurrents: {
        Row: {
          alias: string[] | null
          created_at: string
          domaine: string | null
          id: string
          justification: Json | null
          nom: string
          project_id: string
          score_proximite: number
          type_concurrence: string | null
          type_detection: Database["public"]["Enums"]["concurrent_detection_type"]
          verrouille: boolean
        }
        Insert: {
          alias?: string[] | null
          created_at?: string
          domaine?: string | null
          id?: string
          justification?: Json | null
          nom: string
          project_id: string
          score_proximite?: number
          type_concurrence?: string | null
          type_detection?: Database["public"]["Enums"]["concurrent_detection_type"]
          verrouille?: boolean
        }
        Update: {
          alias?: string[] | null
          created_at?: string
          domaine?: string | null
          id?: string
          justification?: Json | null
          nom?: string
          project_id?: string
          score_proximite?: number
          type_concurrence?: string | null
          type_detection?: Database["public"]["Enums"]["concurrent_detection_type"]
          verrouille?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "concurrents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      domains_catalog: {
        Row: {
          domain: string
          domain_type: string | null
          updated_at: string
        }
        Insert: {
          domain: string
          domain_type?: string | null
          updated_at?: string
        }
        Update: {
          domain?: string
          domain_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      domains_registry: {
        Row: {
          category: string
          competitor_id: string | null
          created_at: string
          domain: string
          id: string
          project_id: string
          updated_at: string
        }
        Insert: {
          category?: string
          competitor_id?: string | null
          created_at?: string
          domain: string
          id?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          competitor_id?: string | null
          created_at?: string
          domain?: string
          id?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "domains_registry_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domains_registry_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_daily_runs: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          items_failed: number
          items_success: number
          items_total: number
          project_id: string
          run_date: string
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          items_failed?: number
          items_success?: number
          items_total?: number
          project_id: string
          run_date: string
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          items_failed?: number
          items_success?: number
          items_total?: number
          project_id?: string
          run_date?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_daily_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_prompts: {
        Row: {
          country: string | null
          created_at: string
          id: string
          intent: string | null
          is_active: boolean | null
          language: string | null
          project_id: string
          prompt_text: string
          source: string
          status: Database["public"]["Enums"]["prompt_status"] | null
          tags: string[] | null
          template_id: string | null
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          is_active?: boolean | null
          language?: string | null
          project_id: string
          prompt_text: string
          source: string
          status?: Database["public"]["Enums"]["prompt_status"] | null
          tags?: string[] | null
          template_id?: string | null
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          is_active?: boolean | null
          language?: string | null
          project_id?: string
          prompt_text?: string
          source?: string
          status?: Database["public"]["Enums"]["prompt_status"] | null
          tags?: string[] | null
          template_id?: string | null
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_prompts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_prompts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "prompt_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_prompts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "monitoring_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_responses: {
        Row: {
          created_at: string
          id: string
          language: string | null
          latency_ms: number | null
          model_used: string | null
          params: Json | null
          project_id: string
          prompt_final: string | null
          prompt_run_id: string
          raw_json: Json | null
          raw_text: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string | null
          latency_ms?: number | null
          model_used?: string | null
          params?: Json | null
          project_id: string
          prompt_final?: string | null
          prompt_run_id: string
          raw_json?: Json | null
          raw_text?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          language?: string | null
          latency_ms?: number | null
          model_used?: string | null
          params?: Json | null
          project_id?: string
          prompt_final?: string | null
          prompt_run_id?: string
          raw_json?: Json | null
          raw_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_responses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_responses_prompt_run_id_fkey"
            columns: ["prompt_run_id"]
            isOneToOne: false
            referencedRelation: "prompt_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_topics: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_topics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_triggers: {
        Row: {
          id: string
          project_id: string
          reason: string | null
          triggered_at: string
        }
        Insert: {
          id?: string
          project_id: string
          reason?: string | null
          triggered_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          reason?: string | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_triggers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_project_id: string | null
          company_name: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          active_project_id?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          active_project_id?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_project_id_fkey"
            columns: ["active_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          industry: string | null
          keywords: string[] | null
          location: string | null
          name: string
          target_countries: string[] | null
          target_languages: string[] | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          keywords?: string[] | null
          location?: string | null
          name: string
          target_countries?: string[] | null
          target_languages?: string[] | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          keywords?: string[] | null
          location?: string | null
          name?: string
          target_countries?: string[] | null
          target_languages?: string[] | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_runs: {
        Row: {
          ai_model: string | null
          brand_mentioned: boolean | null
          competitors_mentioned: string[] | null
          created_at: string
          executed_at: string | null
          id: string
          position_rank: number | null
          project_id: string
          prompt_id: string
          prompt_version_id: string | null
          run_date: string | null
          run_type: string
          scheduled_at: string
          sentiment_label: string | null
          status: string
          visibility_score: number | null
        }
        Insert: {
          ai_model?: string | null
          brand_mentioned?: boolean | null
          competitors_mentioned?: string[] | null
          created_at?: string
          executed_at?: string | null
          id?: string
          position_rank?: number | null
          project_id: string
          prompt_id: string
          prompt_version_id?: string | null
          run_date?: string | null
          run_type?: string
          scheduled_at?: string
          sentiment_label?: string | null
          status?: string
          visibility_score?: number | null
        }
        Update: {
          ai_model?: string | null
          brand_mentioned?: boolean | null
          competitors_mentioned?: string[] | null
          created_at?: string
          executed_at?: string | null
          id?: string
          position_rank?: number | null
          project_id?: string
          prompt_id?: string
          prompt_version_id?: string | null
          run_date?: string | null
          run_type?: string
          scheduled_at?: string
          sentiment_label?: string | null
          status?: string
          visibility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_runs_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "monitoring_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_templates: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_active: boolean | null
          is_default_monitoring: boolean | null
          name: string
          primary_objective: string | null
          project_id: string
          prompt_text: string
          secondary_objectives: string[] | null
          title: string | null
          topic_slug: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default_monitoring?: boolean | null
          name: string
          primary_objective?: string | null
          project_id: string
          prompt_text: string
          secondary_objectives?: string[] | null
          title?: string | null
          topic_slug?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_default_monitoring?: boolean | null
          name?: string
          primary_objective?: string | null
          project_id?: string
          prompt_text?: string
          secondary_objectives?: string[] | null
          title?: string | null
          topic_slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_versions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          prompt_id: string
          prompt_text: string
          version_number: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          prompt_id: string
          prompt_text: string
          version_number: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          prompt_id?: string
          prompt_text?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "monitoring_prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          action_details: Json | null
          action_type: string | null
          category: Database["public"]["Enums"]["recommendation_category"]
          completed_at: string | null
          created_at: string
          description: string
          id: string
          is_completed: boolean | null
          priority: Database["public"]["Enums"]["recommendation_priority"]
          project_id: string
          run_id: string
          title: string
        }
        Insert: {
          action_details?: Json | null
          action_type?: string | null
          category?: Database["public"]["Enums"]["recommendation_category"]
          completed_at?: string | null
          created_at?: string
          description: string
          id?: string
          is_completed?: boolean | null
          priority?: Database["public"]["Enums"]["recommendation_priority"]
          project_id: string
          run_id: string
          title: string
        }
        Update: {
          action_details?: Json | null
          action_type?: string | null
          category?: Database["public"]["Enums"]["recommendation_category"]
          completed_at?: string | null
          created_at?: string
          description?: string
          id?: string
          is_completed?: boolean | null
          priority?: Database["public"]["Enums"]["recommendation_priority"]
          project_id?: string
          run_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      response_citations: {
        Row: {
          analysis_run_id: string
          created_at: string
          domain: string
          domain_type: string | null
          id: string
          url: string
        }
        Insert: {
          analysis_run_id: string
          created_at?: string
          domain: string
          domain_type?: string | null
          id?: string
          url: string
        }
        Update: {
          analysis_run_id?: string
          created_at?: string
          domain?: string
          domain_type?: string | null
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "response_citations_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_items: {
        Row: {
          ai_model: string | null
          ai_response: string | null
          brand_mentioned: boolean | null
          brand_position: number | null
          competitors_mentioned: string[] | null
          created_at: string
          error_message: string | null
          id: string
          latency_ms: number | null
          model: string | null
          position: number | null
          prompt: string
          prompt_template_id: string | null
          prompt_text: string
          provider: string | null
          response: string | null
          response_time_ms: number | null
          run_id: string
          score_accuracy: number | null
          score_sentiment: number | null
          score_visibility: number | null
          sentiment: string | null
          sources_cited: string[] | null
          tokens_used: number | null
          website_cited: boolean | null
        }
        Insert: {
          ai_model?: string | null
          ai_response?: string | null
          brand_mentioned?: boolean | null
          brand_position?: number | null
          competitors_mentioned?: string[] | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          position?: number | null
          prompt: string
          prompt_template_id?: string | null
          prompt_text?: string
          provider?: string | null
          response?: string | null
          response_time_ms?: number | null
          run_id: string
          score_accuracy?: number | null
          score_sentiment?: number | null
          score_visibility?: number | null
          sentiment?: string | null
          sources_cited?: string[] | null
          tokens_used?: number | null
          website_cited?: boolean | null
        }
        Update: {
          ai_model?: string | null
          ai_response?: string | null
          brand_mentioned?: boolean | null
          brand_position?: number | null
          competitors_mentioned?: string[] | null
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          position?: number | null
          prompt?: string
          prompt_template_id?: string | null
          prompt_text?: string
          provider?: string | null
          response?: string | null
          response_time_ms?: number | null
          run_id?: string
          score_accuracy?: number | null
          score_sentiment?: number | null
          score_visibility?: number | null
          sentiment?: string | null
          sources_cited?: string[] | null
          tokens_used?: number | null
          website_cited?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "run_items_prompt_template_id_fkey"
            columns: ["prompt_template_id"]
            isOneToOne: false
            referencedRelation: "prompt_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      run_logs: {
        Row: {
          created_at: string
          id: string
          level: string
          message: string
          meta_json: Json | null
          project_id: string
          run_id: string | null
          step: string
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string
          message: string
          meta_json?: Json | null
          project_id: string
          run_id?: string | null
          step: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          message?: string
          meta_json?: Json | null
          project_id?: string
          run_id?: string | null
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "monitoring_daily_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          completed_at: string | null
          completed_prompts: number | null
          created_at: string
          error_message: string | null
          id: string
          project_id: string
          score_accuracy: number | null
          score_overall: number | null
          score_ranking: number | null
          score_sentiment: number | null
          score_visibility: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["run_status"]
          total_prompts: number | null
        }
        Insert: {
          completed_at?: string | null
          completed_prompts?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          project_id: string
          score_accuracy?: number | null
          score_overall?: number | null
          score_ranking?: number | null
          score_sentiment?: number | null
          score_visibility?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          total_prompts?: number | null
        }
        Update: {
          completed_at?: string | null
          completed_prompts?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          project_id?: string
          score_accuracy?: number | null
          score_overall?: number | null
          score_ranking?: number | null
          score_sentiment?: number | null
          score_visibility?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          total_prompts?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sources_domains: {
        Row: {
          category: string | null
          competitor_id: string | null
          created_at: string
          domain: string
          domain_type: string
          id: string
          is_owned: boolean
          project_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          competitor_id?: string | null
          created_at?: string
          domain: string
          domain_type?: string
          id?: string
          is_owned?: boolean
          project_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          competitor_id?: string | null
          created_at?: string
          domain?: string
          domain_type?: string
          id?: string
          is_owned?: boolean
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_domains_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_domains_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      sources_urls: {
        Row: {
          created_at: string
          domain_id: string
          id: string
          project_id: string
          updated_at: string
          url: string
          url_type: string
        }
        Insert: {
          created_at?: string
          domain_id: string
          id?: string
          project_id: string
          updated_at?: string
          url: string
          url_type?: string
        }
        Update: {
          created_at?: string
          domain_id?: string
          id?: string
          project_id?: string
          updated_at?: string
          url?: string
          url_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_urls_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "sources_domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_urls_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_daily_metrics: {
        Row: {
          avg_position: number | null
          created_at: string
          date: string
          id: string
          mentions_count: number
          negative_count: number
          neutral_count: number
          positive_count: number
          project_id: string
          runs_count: number
          topic_id: string
          visibility_rate: number | null
        }
        Insert: {
          avg_position?: number | null
          created_at?: string
          date: string
          id?: string
          mentions_count?: number
          negative_count?: number
          neutral_count?: number
          positive_count?: number
          project_id: string
          runs_count?: number
          topic_id: string
          visibility_rate?: number | null
        }
        Update: {
          avg_position?: number | null
          created_at?: string
          date?: string
          id?: string
          mentions_count?: number
          negative_count?: number
          neutral_count?: number
          positive_count?: number
          project_id?: string
          runs_count?: number
          topic_id?: string
          visibility_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "topic_daily_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_daily_metrics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "monitoring_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          sector_tag: string | null
          slug: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          sector_tag?: string | null
          slug: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          sector_tag?: string | null
          slug?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      concurrent_detection_type: "auto" | "manuel"
      prompt_status: "active" | "paused" | "archived"
      recommendation_category:
        | "content"
        | "technical"
        | "pr"
        | "social"
        | "other"
      recommendation_priority: "high" | "medium" | "low"
      run_status: "pending" | "running" | "completed" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      concurrent_detection_type: ["auto", "manuel"],
      prompt_status: ["active", "paused", "archived"],
      recommendation_category: [
        "content",
        "technical",
        "pr",
        "social",
        "other",
      ],
      recommendation_priority: ["high", "medium", "low"],
      run_status: ["pending", "running", "completed", "failed"],
    },
  },
} as const
