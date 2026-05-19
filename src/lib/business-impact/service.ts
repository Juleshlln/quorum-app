import { buildCompetitiveIntelligence } from '@/lib/business-impact/competitive-intelligence';
import { classifyTrafficSource } from '@/lib/business-impact/traffic-classification';
import { recomputeAttributionForProject } from '@/lib/business-impact/sync';
import type { AnalyticsConnectionRow } from '@/lib/business-impact/types';
import { round } from '@/lib/business-impact/math';

function buildDateMap(startDate: string, endDate: string) {
  const map = new Map<string, {
    date: string;
    visibility: number | null;
    observedAiSessions: number;
    conversions: number;
    revenue: number;
  }>();

  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    map.set(date, {
      date,
      visibility: null,
      observedAiSessions: 0,
      conversions: 0,
      revenue: 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return map;
}

async function getVisibilitySeries(args: {
  supabase: any;
  projectId: string;
  startDate: string;
  endDate: string;
}) {
  const { data: metricsRows } = await args.supabase
    .from('monitoring_daily_metrics')
    .select('day, visibility_score')
    .eq('project_id', args.projectId)
    .gte('day', args.startDate)
    .lte('day', args.endDate)
    .order('day', { ascending: true });

  if ((metricsRows || []).length > 0) {
    return (metricsRows || []).map((row: any) => ({
      date: row.day,
      visibility: typeof row.visibility_score === 'number' ? row.visibility_score : null,
    }));
  }

  const { data: runs } = await args.supabase
    .from('prompt_runs')
    .select('scheduled_at, brand_mentioned')
    .eq('project_id', args.projectId)
    .eq('run_type', 'monitoring')
    .eq('status', 'success')
    .gte('scheduled_at', `${args.startDate}T00:00:00Z`)
    .lte('scheduled_at', `${args.endDate}T23:59:59.999Z`)
    .order('scheduled_at', { ascending: true });

  const grouped = new Map<string, { total: number; brand: number }>();
  for (const run of (runs || []) as Array<any>) {
    const date = String(run.scheduled_at).slice(0, 10);
    const current = grouped.get(date) || { total: 0, brand: 0 };
    current.total += 1;
    if (run.brand_mentioned) current.brand += 1;
    grouped.set(date, current);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, values]) => ({
      date,
      visibility: values.total > 0 ? round((values.brand / values.total) * 100, 1) : null,
    }));
}

async function ensureAttributionRows(args: {
  supabase: any;
  projectId: string;
  projectWebsite: string | null;
  startDate: string;
  endDate: string;
}) {
  const { count } = await args.supabase
    .from('ai_attribution_events')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', args.projectId)
    .gte('date', args.startDate)
    .lte('date', args.endDate);

  if ((count || 0) > 0) {
    return;
  }

  await recomputeAttributionForProject({
    supabase: args.supabase,
    projectId: args.projectId,
    projectWebsite: args.projectWebsite,
    startDate: args.startDate,
    endDate: args.endDate,
  });
}

function buildTopPages(events: Array<any>) {
  type PageAccumulator = {
    pageUrl: string;
    domain: string | null;
    citationCount: number;
    visibilityScore: number[];
    observedAiSessions: number;
    assistedSessionsEstimate: number;
    conversionsObserved: number;
    revenueObserved: number;
    confidenceCounts: Record<string, number>;
  };

  const pageMap = new Map<string, {
    pageUrl: string;
    domain: string | null;
    citationCount: number;
    visibilityScore: number[];
    observedAiSessions: number;
    assistedSessionsEstimate: number;
    conversionsObserved: number;
    revenueObserved: number;
    confidenceCounts: Record<string, number>;
  }>();

  for (const event of events) {
    const current: PageAccumulator = pageMap.get(event.cited_url) || {
      pageUrl: event.cited_url,
      domain: event.cited_domain || null,
      citationCount: 0,
      visibilityScore: [] as number[],
      observedAiSessions: 0,
      assistedSessionsEstimate: 0,
      conversionsObserved: 0,
      revenueObserved: 0,
      confidenceCounts: {} as Record<string, number>,
    };

    current.citationCount += Number(event.citation_count || 0);
    current.observedAiSessions += Number(event.observed_ai_sessions || 0);
    current.assistedSessionsEstimate += Number(event.assisted_sessions_estimate || 0);
    current.conversionsObserved += Number(event.conversions_observed || 0);
    current.revenueObserved += Number(event.revenue_observed || 0);
    current.confidenceCounts[event.attribution_confidence] = (current.confidenceCounts[event.attribution_confidence] || 0) + 1;
    if (typeof event.visibility_score === 'number') {
      current.visibilityScore.push(event.visibility_score);
    }

    pageMap.set(event.cited_url, current);
  }

  return Array.from(pageMap.values())
    .map((page) => {
      const dominantConfidence = Object.entries(page.confidenceCounts)
        .sort((left, right) => right[1] - left[1])[0]?.[0] || 'medium';

      return {
        pageUrl: page.pageUrl,
        domain: page.domain,
        citationCount: page.citationCount,
        visibilityScore: page.visibilityScore.length > 0
          ? round(page.visibilityScore.reduce((sum, value) => sum + value, 0) / page.visibilityScore.length, 1)
          : 0,
        observedAiSessions: page.observedAiSessions,
        assistedSessionsEstimate: round(page.assistedSessionsEstimate),
        conversionsObserved: round(page.conversionsObserved),
        revenueObserved: round(page.revenueObserved),
        confidence: dominantConfidence,
      };
    })
    .sort((left, right) => right.observedAiSessions - left.observedAiSessions);
}

function buildTopAiSources(trafficRows: Array<any>) {
  const sources = new Map<string, { sessions: number; pages: Set<string> }>();

  for (const row of trafficRows) {
    const classification = classifyTrafficSource({
      source: row.source,
      medium: row.medium,
    });
    if (classification.classification !== 'ai_observed') continue;

    const current = sources.get(classification.matchedSource || 'ai') || {
      sessions: 0,
      pages: new Set<string>(),
    };

    current.sessions += Number(row.sessions || 0);
    current.pages.add(row.page_url);
    sources.set(classification.matchedSource || 'ai', current);
  }

  return Array.from(sources.entries())
    .map(([source, values]) => ({
      source,
      sessions: values.sessions,
      pageCount: values.pages.size,
    }))
    .sort((left, right) => right.sessions - left.sessions);
}

function buildBrandSearchSeries(rows: Array<any>) {
  const byDate = new Map<string, { clicks: number; impressions: number; ctrSum: number; positionSum: number; queryCount: number }>();

  for (const row of rows) {
    const current = byDate.get(row.date) || { clicks: 0, impressions: 0, ctrSum: 0, positionSum: 0, queryCount: 0 };
    current.clicks += Number(row.clicks || 0);
    current.impressions += Number(row.impressions || 0);
    current.ctrSum += Number(row.ctr || 0);
    current.positionSum += Number(row.position || 0);
    current.queryCount += 1;
    byDate.set(row.date, current);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({
      date,
      clicks: values.clicks,
      impressions: values.impressions,
      avgCtr: values.queryCount > 0 ? round(values.ctrSum / values.queryCount, 2) : 0,
      avgPosition: values.queryCount > 0 ? round(values.positionSum / values.queryCount, 1) : 0,
    }));
}

export async function getBusinessImpactOverview(args: {
  supabase: any;
  projectId: string;
  projectWebsite: string | null;
  startDate: string;
  endDate: string;
}) {
  await ensureAttributionRows(args);

  const [connectionsResponse, eventsResponse, trafficResponse, brandSearchResponse, visibilitySeries] = await Promise.all([
    args.supabase
      .from('analytics_connections')
      .select('id, provider, property_id, site_url, status, last_synced_at, last_error, metadata')
      .eq('project_id', args.projectId)
      .order('provider', { ascending: true }),
    args.supabase
      .from('ai_attribution_events')
      .select('*')
      .eq('project_id', args.projectId)
      .gte('date', args.startDate)
      .lte('date', args.endDate)
      .order('date', { ascending: true }),
    args.supabase
      .from('traffic_daily_page_metrics')
      .select('date, page_url, source, medium, sessions, conversions, revenue')
      .eq('project_id', args.projectId)
      .gte('date', args.startDate)
      .lte('date', args.endDate),
    args.supabase
      .from('brand_search_daily')
      .select('date, query, clicks, impressions, ctr, position')
      .eq('project_id', args.projectId)
      .gte('date', args.startDate)
      .lte('date', args.endDate)
      .order('date', { ascending: true }),
    getVisibilitySeries(args),
  ]);

  if (eventsResponse.error) throw new Error(eventsResponse.error.message);
  if (trafficResponse.error) throw new Error(trafficResponse.error.message);
  // brandSearchResponse errors are non-fatal — GSC may not be connected
  const brandSearchRows = (brandSearchResponse.error ? [] : brandSearchResponse.data || []) as Array<any>;

  const events = (eventsResponse.data || []) as Array<any>;
  const trafficRows = (trafficResponse.data || []) as Array<any>;
  const dateMap = buildDateMap(args.startDate, args.endDate);

  for (const point of visibilitySeries) {
    const current = dateMap.get(point.date);
    if (current) current.visibility = point.visibility;
  }

  for (const event of events) {
    const current = dateMap.get(event.date);
    if (!current) continue;
    current.observedAiSessions += Number(event.observed_ai_sessions || 0);
    current.conversions += Number(event.conversions_observed || 0);
    current.revenue += Number(event.revenue_observed || 0);
  }

  const topPages = buildTopPages(events);
  const topAiSources = buildTopAiSources(trafficRows);
  const brandSearchSeries = buildBrandSearchSeries(brandSearchRows);
  const totalTrafficSessions = trafficRows.reduce((sum, row) => sum + Number(row.sessions || 0), 0);
  const observedAiSessions = events.reduce((sum, row) => sum + Number(row.observed_ai_sessions || 0), 0);
  const conversionsObserved = round(events.reduce((sum, row) => sum + Number(row.conversions_observed || 0), 0));
  const revenueObserved = round(events.reduce((sum, row) => sum + Number(row.revenue_observed || 0), 0));
  const assistedSessions = round(events.reduce((sum, row) => sum + Number(row.assisted_sessions_estimate || 0), 0));
  const confidenceBadges = ['high', 'medium', 'low'].map((level) => ({
    level,
    count: events.filter((event) => event.attribution_confidence === level).length,
  }));

  return {
    connections: (connectionsResponse.data || []) as AnalyticsConnectionRow[],
    kpis: {
      observedAiSessions,
      conversionsObserved,
      revenueObserved,
      assistedImpactScore: totalTrafficSessions > 0
        ? Math.min(100, round((assistedSessions / totalTrafficSessions) * 100, 1))
        : 0,
      assistedSessionsEstimate: assistedSessions,
    },
    series: Array.from(dateMap.values()),
    topPages: topPages.slice(0, 12),
    topAiSources: topAiSources.slice(0, 8),
    confidenceBadges,
    brandSearchSeries,
  };
}

export async function getBusinessImpactPages(args: {
  supabase: any;
  projectId: string;
  projectWebsite: string | null;
  startDate: string;
  endDate: string;
}) {
  await ensureAttributionRows(args);

  const { data, error } = await args.supabase
    .from('ai_attribution_events')
    .select('*')
    .eq('project_id', args.projectId)
    .gte('date', args.startDate)
    .lte('date', args.endDate);

  if (error) throw new Error(error.message);

  return buildTopPages((data || []) as Array<any>);
}

export async function getAttributionEvents(args: {
  supabase: any;
  projectId: string;
  projectWebsite: string | null;
  startDate: string;
  endDate: string;
}) {
  await ensureAttributionRows(args);

  const { data, error } = await args.supabase
    .from('ai_attribution_events')
    .select('*')
    .eq('project_id', args.projectId)
    .gte('date', args.startDate)
    .lte('date', args.endDate)
    .order('date', { ascending: false })
    .order('observed_ai_sessions', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

async function buildCompetitiveDataset(args: {
  supabase: any;
  projectId: string;
  startDate: string;
  endDate: string;
}) {
  const [runsResponse, citationsResponse, competitorsResponse] = await Promise.all([
    args.supabase
      .from('prompt_runs')
      .select('id, prompt_id, scheduled_at, brand_mentioned, competitors_mentioned')
      .eq('project_id', args.projectId)
      .eq('run_type', 'monitoring')
      .eq('status', 'success')
      .gte('scheduled_at', `${args.startDate}T00:00:00Z`)
      .lte('scheduled_at', `${args.endDate}T23:59:59.999Z`),
    args.supabase
      .from('citations')
      .select('prompt_run_id, cited_at, domain:sources_domains(domain, category, is_owned, competitor_id), url:sources_urls(url)')
      .eq('project_id', args.projectId)
      .eq('is_fallback', false)
      .gte('cited_at', `${args.startDate}T00:00:00Z`)
      .lte('cited_at', `${args.endDate}T23:59:59.999Z`),
    args.supabase
      .from('competitors')
      .select('id, name')
      .eq('project_id', args.projectId)
      .order('name', { ascending: true }),
  ]);

  if (runsResponse.error) throw new Error(runsResponse.error.message);
  if (citationsResponse.error) throw new Error(citationsResponse.error.message);
  if (competitorsResponse.error) throw new Error(competitorsResponse.error.message);

  const runs = (runsResponse.data || []) as Array<any>;
  const promptIds = Array.from(new Set(runs.map((run) => run.prompt_id).filter(Boolean)));

  // Fetch prompts; topics need prompt results first so they stay sequential
  const { data: promptsData } = promptIds.length > 0
    ? await args.supabase
      .from('monitoring_prompts')
      .select('id, prompt_text, topic_id')
      .in('id', promptIds)
    : { data: [] };

  const typedPrompts = (promptsData || []) as Array<{ id: string; prompt_text: string; topic_id: string | null }>;
  const promptsById = new Map<string, { id: string; prompt_text: string; topic_id: string | null }>(
    typedPrompts.map((prompt) => [prompt.id, prompt]),
  );
  const topicIds = Array.from(new Set(typedPrompts.map((prompt) => prompt.topic_id).filter(Boolean))) as string[];
  const { data: topicsData } = topicIds.length > 0
    ? await args.supabase
      .from('monitoring_topics')
      .select('id, name')
      .in('id', topicIds)
    : { data: [] };

  const typedTopics = (topicsData || []) as Array<{ id: string; name: string }>;
  const topicsById = new Map<string, { id: string; name: string }>(
    typedTopics.map((topic) => [topic.id, topic]),
  );

  return {
    runs: runs.map((run) => {
      const prompt = promptsById.get(run.prompt_id);
      const topic = prompt?.topic_id ? topicsById.get(prompt.topic_id) : null;

      return {
        id: run.id,
        date: String(run.scheduled_at).slice(0, 10),
        promptId: run.prompt_id,
        promptText: prompt?.prompt_text || 'Prompt deleted',
        topicId: prompt?.topic_id || null,
        topicName: topic?.name || null,
        brandMentioned: Boolean(run.brand_mentioned),
        competitorsMentioned: Array.isArray(run.competitors_mentioned)
          ? run.competitors_mentioned
          : [],
      };
    }),
    citations: ((citationsResponse.data || []) as Array<any>).map((citation) => ({
      promptRunId: citation.prompt_run_id,
      date: String(citation.cited_at).slice(0, 10),
      domain: citation.domain?.domain || null,
      category: citation.domain?.category || null,
      isOwned: Boolean(citation.domain?.is_owned),
      competitorId: citation.domain?.competitor_id || null,
      url: citation.url?.url || null,
    })),
    competitors: (competitorsResponse.data || []) as Array<{ id: string; name: string }>,
  };
}

export async function getCompetitiveIntelligenceOverview(args: {
  supabase: any;
  projectId: string;
  brandName: string;
  startDate: string;
  endDate: string;
}) {
  const dataset = await buildCompetitiveDataset(args);
  return buildCompetitiveIntelligence({
    brandName: args.brandName,
    runs: dataset.runs,
    citations: dataset.citations,
    competitors: dataset.competitors,
  });
}
