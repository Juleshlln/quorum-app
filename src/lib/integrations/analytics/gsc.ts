import type { AnalyticsConnector } from '@/lib/integrations/analytics/types';
import { getGoogleAccessToken } from '@/lib/integrations/analytics/google-auth';

const GSC_SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly'];
const GSC_PAGE_SIZE = 25000;

function normalizeSiteUrl(siteUrl: string) {
  if (siteUrl.startsWith('sc-domain:')) {
    return siteUrl;
  }

  const candidate = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
  const parsed = new URL(candidate);
  if (!parsed.pathname || parsed.pathname === '') {
    parsed.pathname = '/';
  }
  return parsed.toString();
}

function matchesBrandTerm(query: string, brandTerms: string[]) {
  const normalized = query.trim().toLowerCase();
  return brandTerms.some((term) => normalized.includes(term));
}

async function fetchSearchAnalytics(args: {
  siteUrl: string;
  accessToken: string;
  body: Record<string, unknown>;
}) {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(args.siteUrl)}/searchAnalytics/query`,
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
    throw new Error(payload?.error?.message || 'Search Console request failed');
  }

  return payload as {
    rows?: Array<{
      keys?: string[];
      clicks?: number;
      impressions?: number;
      ctr?: number;
      position?: number;
    }>;
  };
}

export const gscConnector: AnalyticsConnector = {
  provider: 'gsc',
  async validateConnection({ siteUrl, credentials }) {
    if (!siteUrl) {
      throw new Error('GSC site_url is required');
    }

    const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
    const accessToken = await getGoogleAccessToken(credentials, GSC_SCOPES);
    await fetchSearchAnalytics({
      siteUrl: normalizedSiteUrl,
      accessToken,
      body: {
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        dimensions: ['date'],
        rowLimit: 1,
      },
    });

    return {
      ok: true,
      accountLabel: normalizedSiteUrl,
      message: 'Connection validated',
    };
  },
  async fetchBrandSearchMetrics({ siteUrl, startDate, endDate, brandTerms, credentials }) {
    const normalizedSiteUrl = normalizeSiteUrl(siteUrl);
    const accessToken = await getGoogleAccessToken(credentials, GSC_SCOPES);
    const normalizedTerms = Array.from(
      new Set(brandTerms.map((term) => term.trim().toLowerCase()).filter(Boolean)),
    );

    const rows: Array<{
      keys?: string[];
      clicks?: number;
      impressions?: number;
      ctr?: number;
      position?: number;
    }> = [];

    let startRow = 0;
    while (true) {
      const payload = await fetchSearchAnalytics({
        siteUrl: normalizedSiteUrl,
        accessToken,
        body: {
          startDate,
          endDate,
          dimensions: ['date', 'query'],
          searchType: 'web',
          rowLimit: GSC_PAGE_SIZE,
          startRow,
        },
      });

      const batch = payload.rows || [];
      rows.push(...batch);

      if (batch.length < GSC_PAGE_SIZE) {
        break;
      }

      startRow += GSC_PAGE_SIZE;
    }

    return rows
      .filter((row) => {
        const query = row.keys?.[1] || '';
        return query && matchesBrandTerm(query, normalizedTerms);
      })
      .map((row) => ({
        date: row.keys?.[0] || '',
        query: row.keys?.[1] || '',
        clicks: Number(row.clicks || 0),
        impressions: Number(row.impressions || 0),
        ctr: Number(row.ctr || 0),
        position: Number(row.position || 0),
      }));
  },
};
