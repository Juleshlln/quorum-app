import { ATTRIBUTION_ENGINE_VERSION, ATTRIBUTION_SOURCE_DETECTION_VERSION, buildAttributionEvents, groupCitationsForAttribution } from '@/lib/business-impact/attribution';
import type { AnalyticsConnectionRow, AnalyticsProvider, BrandSearchMetric, DailyPageMetric, ProjectTrafficInput } from '@/lib/business-impact/types';
import { getAnalyticsConnector } from '@/lib/integrations/analytics/registry';
import { decryptCredentials, encryptCredentials } from '@/lib/integrations/analytics/crypto';
import { parseAnalyticsCredentials } from '@/lib/integrations/analytics/google-auth';
import type { SupportedAnalyticsCredentials } from '@/lib/integrations/analytics/types';

const UPSERT_BATCH_SIZE = 500;

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildBrandTerms(input: ProjectTrafficInput) {
  const terms = new Set<string>();
  const sanitizedProjectName = input.projectName.trim().toLowerCase();
  if (sanitizedProjectName) terms.add(sanitizedProjectName);

  for (const keyword of input.projectKeywords) {
    const sanitized = keyword.trim().toLowerCase();
    if (sanitized.length >= 3) terms.add(sanitized);
  }

  if (input.projectWebsite) {
    try {
      const url = new URL(
        input.projectWebsite.startsWith('http')
          ? input.projectWebsite
          : `https://${input.projectWebsite}`,
      );
      const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
      if (hostname) terms.add(hostname);
      const root = hostname.split('.')[0];
      if (root && root.length >= 3) terms.add(root);
    } catch {
      // Ignore website parsing issues; brand name remains the primary signal.
    }
  }

  return Array.from(terms);
}

function serializeCredentials(credentials: SupportedAnalyticsCredentials) {
  return encryptCredentials(JSON.stringify(credentials));
}

export async function upsertAnalyticsConnection(args: {
  supabase: any;
  projectId: string;
  provider: AnalyticsProvider;
  propertyId?: string | null;
  siteUrl?: string | null;
  credentials: SupportedAnalyticsCredentials;
  metadata?: Record<string, unknown>;
}) {
  const connector = getAnalyticsConnector(args.provider);
  const validation = await connector.validateConnection({
    propertyId: args.propertyId || null,
    siteUrl: args.siteUrl || null,
    credentials: args.credentials,
  });

  const { data, error } = await args.supabase
    .from('analytics_connections')
    .upsert(
      {
        project_id: args.projectId,
        provider: args.provider,
        property_id: args.propertyId || null,
        site_url: args.siteUrl || null,
        credentials_encrypted: serializeCredentials(args.credentials),
        status: validation.ok ? 'active' : 'error',
        metadata: {
          ...(args.metadata || {}),
          accountLabel: validation.accountLabel || null,
        },
        last_error: validation.ok ? null : validation.message || 'Connection validation failed',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id,provider' },
    )
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as AnalyticsConnectionRow;
}

function getConnectionCredentials(connection: AnalyticsConnectionRow) {
  if (!connection.credentials_encrypted) {
    throw new Error(`Missing credentials for ${connection.provider}`);
  }
  return parseAnalyticsCredentials(decryptCredentials(connection.credentials_encrypted));
}

async function markConnectionSync(args: {
  supabase: any;
  connectionId: string;
  status: 'active' | 'error';
  errorMessage?: string | null;
}) {
  await args.supabase
    .from('analytics_connections')
    .update({
      status: args.status,
      last_error: args.errorMessage || null,
      last_synced_at: args.status === 'active' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', args.connectionId);
}

async function upsertTrafficMetrics(args: {
  supabase: any;
  connection: AnalyticsConnectionRow;
  projectId: string;
  metrics: DailyPageMetric[];
}) {
  const rows = args.metrics.map((metric) => ({
    project_id: args.projectId,
    connection_id: args.connection.id,
    provider: args.connection.provider,
    date: metric.date,
    page_url: metric.pageUrl,
    source: metric.source,
    medium: metric.medium,
    sessions: metric.sessions,
    users: metric.users,
    engaged_sessions: metric.engagedSessions,
    conversions: metric.conversions,
    revenue: metric.revenue,
    updated_at: new Date().toISOString(),
  }));

  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await args.supabase.from('traffic_daily_page_metrics').upsert(batch, {
      onConflict: 'project_id,provider,date,page_url,source,medium',
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}

async function upsertBrandSearchMetrics(args: {
  supabase: any;
  connection: AnalyticsConnectionRow;
  projectId: string;
  metrics: BrandSearchMetric[];
}) {
  const rows = args.metrics.map((metric) => ({
    project_id: args.projectId,
    connection_id: args.connection.id,
    provider: args.connection.provider,
    date: metric.date,
    query: metric.query,
    clicks: metric.clicks,
    impressions: metric.impressions,
    ctr: metric.ctr,
    position: metric.position,
    updated_at: new Date().toISOString(),
  }));

  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await args.supabase.from('brand_search_daily').upsert(batch, {
      onConflict: 'project_id,provider,date,query',
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function syncAnalyticsDataForProject(args: {
  supabase: any;
  project: ProjectTrafficInput;
  startDate: string;
  endDate: string;
  providers?: AnalyticsProvider[];
}) {
  const { data, error } = await args.supabase
    .from('analytics_connections')
    .select('*')
    .eq('project_id', args.project.projectId)
    .in('status', ['active', 'error', 'paused']);

  if (error) {
    throw new Error(error.message);
  }

  const connections = ((data || []) as AnalyticsConnectionRow[])
    .filter((connection) => (args.providers || []).length === 0 || args.providers?.includes(connection.provider as AnalyticsProvider));

  const brandTerms = buildBrandTerms(args.project);
  const summary = {
    trafficRows: 0,
    brandRows: 0,
    syncedProviders: [] as AnalyticsProvider[],
  };

  for (const connection of connections) {
    try {
      const credentials = getConnectionCredentials(connection);
      const connector = getAnalyticsConnector(connection.provider as AnalyticsProvider);

      if (connection.provider === 'ga4' && connector.fetchDailyPageMetrics) {
        const metrics = await connector.fetchDailyPageMetrics({
          propertyId: connection.property_id || '',
          siteUrl: connection.site_url || args.project.projectWebsite,
          startDate: args.startDate,
          endDate: args.endDate,
          credentials,
        });
        await upsertTrafficMetrics({
          supabase: args.supabase,
          connection,
          projectId: args.project.projectId,
          metrics,
        });
        summary.trafficRows += metrics.length;
        summary.syncedProviders.push('ga4');
      }

      if (connection.provider === 'gsc' && connector.fetchBrandSearchMetrics && connection.site_url) {
        const metrics = await connector.fetchBrandSearchMetrics({
          siteUrl: connection.site_url,
          startDate: args.startDate,
          endDate: args.endDate,
          brandTerms,
          credentials,
        });
        await upsertBrandSearchMetrics({
          supabase: args.supabase,
          connection,
          projectId: args.project.projectId,
          metrics,
        });
        summary.brandRows += metrics.length;
        summary.syncedProviders.push('gsc');
      }

      await markConnectionSync({
        supabase: args.supabase,
        connectionId: connection.id,
        status: 'active',
      });
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : 'Analytics sync failed';
      console.error(`[business-impact] sync failed for ${connection.provider}`, message);
      await markConnectionSync({
        supabase: args.supabase,
        connectionId: connection.id,
        status: 'error',
        errorMessage: message,
      });
    }
  }

  return summary;
}

export async function recomputeAttributionForProject(args: {
  supabase: any;
  projectId: string;
  projectWebsite: string | null;
  startDate: string;
  endDate: string;
}) {
  const [citationResponse, trafficResponse] = await Promise.all([
    args.supabase
      .from('citations')
      .select(`
        cited_at,
        ai_model,
        topic_id,
        url:sources_urls(url),
        domain:sources_domains(domain),
        run:prompt_runs!citations_prompt_run_id_fkey(prompt_id, visibility_score)
      `)
      .eq('project_id', args.projectId)
      .eq('is_fallback', false)
      .gte('cited_at', `${args.startDate}T00:00:00Z`)
      .lte('cited_at', `${args.endDate}T23:59:59.999Z`),
    args.supabase
      .from('traffic_daily_page_metrics')
      .select('date, page_url, source, medium, sessions, users, engaged_sessions, conversions, revenue')
      .eq('project_id', args.projectId)
      .gte('date', args.startDate)
      .lte('date', args.endDate),
  ]);

  if (citationResponse.error) {
    throw new Error(citationResponse.error.message);
  }
  if (trafficResponse.error) {
    throw new Error(trafficResponse.error.message);
  }

  const groupedCitations = groupCitationsForAttribution(
    ((citationResponse.data || []) as Array<any>)
      .filter((row) => row.url?.url)
      .map((row) => ({
        date: String(row.cited_at).slice(0, 10),
        model: row.ai_model || null,
        promptId: row.run?.prompt_id || null,
        topicId: row.topic_id || null,
        citedUrl: row.url?.url,
        citedDomain: row.domain?.domain || null,
        visibilityScore: typeof row.run?.visibility_score === 'number' ? row.run.visibility_score : null,
      })),
  );

  const attributionRows = buildAttributionEvents({
    citations: groupedCitations,
    trafficMetrics: ((trafficResponse.data || []) as Array<any>).map((row) => ({
      date: row.date,
      pageUrl: row.page_url,
      source: row.source,
      medium: row.medium,
      sessions: Number(row.sessions || 0),
      users: Number(row.users || 0),
      engagedSessions: Number(row.engaged_sessions || 0),
      conversions: Number(row.conversions || 0),
      revenue: Number(row.revenue || 0),
    })),
    siteUrl: args.projectWebsite,
  });

  const payload = attributionRows.map((row) => ({
    project_id: args.projectId,
    date: row.date,
    model: row.model,
    prompt_id: row.promptId,
    topic_id: row.topicId,
    cited_url: row.citedUrl,
    cited_domain: row.citedDomain,
    citation_count: row.citationCount,
    visibility_score: row.visibilityScore,
    observed_ai_sessions: row.observedAiSessions,
    assisted_sessions_estimate: row.assistedSessionsEstimate,
    conversions_observed: row.conversionsObserved,
    revenue_observed: row.revenueObserved,
    attribution_confidence: row.attributionConfidence,
    attribution_version: ATTRIBUTION_ENGINE_VERSION,
    source_detection_version: ATTRIBUTION_SOURCE_DETECTION_VERSION,
    updated_at: new Date().toISOString(),
  }));

  for (const batch of chunk(payload, UPSERT_BATCH_SIZE)) {
    const { error } = await args.supabase.from('ai_attribution_events').upsert(batch, {
      onConflict: 'project_id,date,model,prompt_id,topic_id,cited_url',
    });
    if (error) {
      throw new Error(error.message);
    }
  }

  return {
    rows: payload.length,
  };
}

export async function syncBusinessImpactForProject(args: {
  supabase: any;
  project: ProjectTrafficInput;
  startDate: string;
  endDate: string;
  providers?: AnalyticsProvider[];
}) {
  const ingestion = await syncAnalyticsDataForProject({
    supabase: args.supabase,
    project: args.project,
    startDate: args.startDate,
    endDate: args.endDate,
    providers: args.providers,
  });

  const attribution = await recomputeAttributionForProject({
    supabase: args.supabase,
    projectId: args.project.projectId,
    projectWebsite: args.project.projectWebsite,
    startDate: args.startDate,
    endDate: args.endDate,
  });

  return {
    ingestion,
    attribution,
  };
}
