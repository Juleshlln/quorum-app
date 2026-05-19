import { ga4Connector } from '@/lib/integrations/analytics/ga4';
import { gscConnector } from '@/lib/integrations/analytics/gsc';
import { matomoConnector } from '@/lib/integrations/analytics/matomo';
import type { AnalyticsProvider } from '@/lib/business-impact/types';
import type { AnalyticsConnector } from '@/lib/integrations/analytics/types';

const CONNECTORS: Record<AnalyticsProvider, AnalyticsConnector> = {
  ga4: ga4Connector,
  gsc: gscConnector,
  matomo: matomoConnector,
};

export function getAnalyticsConnector(provider: AnalyticsProvider) {
  return CONNECTORS[provider];
}

export function listAnalyticsConnectors() {
  return Object.values(CONNECTORS);
}
