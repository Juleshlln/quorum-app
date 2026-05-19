import type { AnalyticsProvider, BrandSearchMetric, DailyPageMetric } from '@/lib/business-impact/types';

export type ServiceAccountCredentials = {
  type?: 'service_account';
  client_email: string;
  private_key: string;
  token_uri?: string;
  project_id?: string;
};

export type AccessTokenCredentials = {
  type: 'access_token';
  access_token: string;
};

export type SupportedAnalyticsCredentials = ServiceAccountCredentials | AccessTokenCredentials;

export type ConnectionValidationResult = {
  ok: boolean;
  accountLabel?: string | null;
  message?: string;
};

export type DailyPageMetricsArgs = {
  propertyId: string;
  siteUrl: string | null;
  startDate: string;
  endDate: string;
  credentials: SupportedAnalyticsCredentials;
};

export type BrandSearchArgs = {
  siteUrl: string;
  startDate: string;
  endDate: string;
  brandTerms: string[];
  credentials: SupportedAnalyticsCredentials;
};

export interface AnalyticsConnector {
  provider: AnalyticsProvider;
  validateConnection(args: {
    propertyId?: string | null;
    siteUrl?: string | null;
    credentials: SupportedAnalyticsCredentials;
  }): Promise<ConnectionValidationResult>;
  fetchDailyPageMetrics?(args: DailyPageMetricsArgs): Promise<DailyPageMetric[]>;
  fetchBrandSearchMetrics?(args: BrandSearchArgs): Promise<BrandSearchMetric[]>;
}
