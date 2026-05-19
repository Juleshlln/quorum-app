import type { Tables } from '@/types/database';

export type TrafficClassification = 'ai_observed' | 'non_ai' | 'unknown';
export type AttributionConfidence = 'low' | 'medium' | 'high';
export type AnalyticsProvider = 'ga4' | 'gsc' | 'matomo';

export type AnalyticsConnectionRow = Tables<'analytics_connections'>;
export type TrafficDailyPageMetricRow = Tables<'traffic_daily_page_metrics'>;
export type AiAttributionEventRow = Tables<'ai_attribution_events'>;
export type BrandSearchDailyRow = Tables<'brand_search_daily'>;

export type DailyPageMetric = {
  date: string;
  pageUrl: string;
  source: string | null;
  medium: string | null;
  sessions: number;
  users: number;
  engagedSessions: number;
  conversions: number;
  revenue: number;
};

export type BrandSearchMetric = {
  date: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type ProjectTrafficInput = {
  projectId: string;
  projectName: string;
  projectWebsite: string | null;
  projectKeywords: string[];
};

export type AttributionInputCitation = {
  date: string;
  model: string | null;
  promptId: string | null;
  topicId: string | null;
  citedUrl: string;
  citedDomain: string | null;
  visibilityScore: number | null;
  citationCount: number;
};

export type AttributionComputationRow = {
  date: string;
  model: string | null;
  promptId: string | null;
  topicId: string | null;
  citedUrl: string;
  citedDomain: string | null;
  citationCount: number;
  visibilityScore: number;
  observedAiSessions: number;
  assistedSessionsEstimate: number;
  conversionsObserved: number;
  revenueObserved: number;
  attributionConfidence: AttributionConfidence;
};

export type CompetitiveBrandShare = {
  brand: string;
  share: number;
  mentions: number;
};

export type CompetitiveSourceGap = {
  domain: string;
  brandCitations: number;
  competitorCitations: number;
  gap: number;
  priority: 'high' | 'medium' | 'low';
};

export type CompetitiveSourceOverlap = {
  competitor: string;
  overlap: number;
  sharedDomains: number;
  competitorOnlyDomains: number;
  brandOnlyDomains: number;
};

export type PromptCompetitiveMapRow = {
  promptId: string;
  promptText: string;
  topicId: string | null;
  topicName: string | null;
  totalRuns: number;
  brandShare: number;
  competitorPresence: number;
  topCompetitor: string | null;
  topCompetitorShare: number;
  ownedClickableShare: number;
  sourceOverlap: number;
  priority: 'high' | 'medium' | 'low';
};

export type OpportunityGapCard = {
  id: string;
  title: string;
  summary: string;
  priority: 'high' | 'medium' | 'low';
  metric: string;
  value: number;
};

export type CompetitiveIntelligenceOverview = {
  shareOfAnswer: CompetitiveBrandShare[];
  shareOfClickableSurface: {
    brand: number;
    competitors: number;
    thirdParty: number;
  };
  sourceOwnershipGap: CompetitiveSourceGap[];
  competitorSourceOverlap: CompetitiveSourceOverlap[];
  promptLevelCompetitiveMap: PromptCompetitiveMapRow[];
  visibilityVolatilityIndex: number;
  opportunityGapSummary: OpportunityGapCard[];
};
