import type { AnalyticsConnector } from '@/lib/integrations/analytics/types';
import { getGoogleAccessToken } from '@/lib/integrations/analytics/google-auth';

const GA4_SCOPES = ['https://www.googleapis.com/auth/analytics.readonly'];

function normalizePropertyId(propertyId: string) {
  return propertyId.replace(/^properties\//, '').trim();
}

function formatGa4Date(raw: string) {
  if (!/^\d{8}$/.test(raw)) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function toAbsolutePageUrl(siteUrl: string | null, pagePath: string) {
  if (/^https?:\/\//i.test(pagePath)) {
    return pagePath;
  }

  if (!siteUrl) {
    return pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  }

  try {
    const base = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
    return new URL(pagePath.startsWith('/') ? pagePath : `/${pagePath}`, base).toString();
  } catch {
    return pagePath.startsWith('/') ? pagePath : `/${pagePath}`;
  }
}

async function runGa4Report(args: {
  propertyId: string;
  accessToken: string;
  body: Record<string, unknown>;
}) {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${normalizePropertyId(args.propertyId)}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args.body),
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'GA4 report request failed');
  }

  return payload as {
    rows?: Array<{
      dimensionValues?: Array<{ value?: string }>;
      metricValues?: Array<{ value?: string }>;
    }>;
  };
}

export const ga4Connector: AnalyticsConnector = {
  provider: 'ga4',
  async validateConnection({ propertyId, credentials }) {
    if (!propertyId) {
      throw new Error('GA4 property_id is required');
    }

    const accessToken = await getGoogleAccessToken(credentials, GA4_SCOPES);
    await runGa4Report({
      propertyId,
      accessToken,
      body: {
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }],
        limit: '1',
      },
    });

    return {
      ok: true,
      accountLabel: `GA4 property ${normalizePropertyId(propertyId)}`,
      message: 'Connection validated',
    };
  },
  async fetchDailyPageMetrics({ propertyId, siteUrl, startDate, endDate, credentials }) {
    const accessToken = await getGoogleAccessToken(credentials, GA4_SCOPES);
    const payload = await runGa4Report({
      propertyId,
      accessToken,
      body: {
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'date' },
          { name: 'landingPagePlusQueryString' },
          { name: 'sessionSource' },
          { name: 'sessionMedium' },
        ],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
          { name: 'engagedSessions' },
          { name: 'conversions' },
          { name: 'totalRevenue' },
        ],
        keepEmptyRows: false,
        limit: '100000',
      },
    });

    return (payload.rows || []).map((row) => {
      const [dateValue, pagePathValue, sourceValue, mediumValue] = row.dimensionValues || [];
      const [sessionsValue, usersValue, engagedValue, conversionsValue, revenueValue] = row.metricValues || [];

      return {
        date: formatGa4Date(dateValue?.value || ''),
        pageUrl: toAbsolutePageUrl(siteUrl, pagePathValue?.value || '/'),
        source: sourceValue?.value || null,
        medium: mediumValue?.value || null,
        sessions: Number(sessionsValue?.value || 0),
        users: Number(usersValue?.value || 0),
        engagedSessions: Number(engagedValue?.value || 0),
        conversions: Number(conversionsValue?.value || 0),
        revenue: Number(revenueValue?.value || 0),
      };
    });
  },
};
