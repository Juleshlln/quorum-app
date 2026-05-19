import type { AnalyticsConnector } from '@/lib/integrations/analytics/types';

export const matomoConnector: AnalyticsConnector = {
  provider: 'matomo',
  async validateConnection() {
    return {
      ok: false,
      message: 'Matomo connector is scaffolded but not implemented yet.',
    };
  },
  async fetchDailyPageMetrics() {
    throw new Error('TODO: implement Matomo daily page metrics ingestion');
  },
};
