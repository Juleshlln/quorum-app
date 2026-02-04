import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { queryOpenAI } from '@/lib/ai/providers';
import { computeModules, type ModuleKey, type RawItem } from '@/lib/analysis/modules';
import { ingestCitations } from '@/lib/sources/ingest';
import { getRunsForPlan } from '@/lib/plans';

const ALL_MODULES: ModuleKey[] = ['visibility', 'position', 'sentiment', 'global'];
const MIN_TRIGGER_MINUTES = 10;

function extractCitations(text: string | null): Array<{ url: string; domain: string }> {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s)]+/g;
  const urls = text.match(urlRegex) || [];
  return urls.map((url) => {
    const domain = url.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
    return { url, domain };
  });
}

function classifyDomain(domain: string): string {
  if (domain.includes('reddit.com') || domain.includes('youtube.com') || domain.includes('tiktok.com')) {
    return 'ugc';
  }
  if (domain.endsWith('.gouv.fr') || domain.endsWith('.gov') || domain.endsWith('.edu')) {
    return 'institutional';
  }
  if (domain.includes('wikipedia.org') || domain.includes('medium.com')) {
    return 'editorial';
  }
  return 'other';
}

function computeTrendMetrics(results: Array<{ prompt: string; mentioned: boolean; sentiment: string | null; position: number | null }>) {
  const aggregates = new Map<string, { total: number; mentioned: number; positive: number; neutral: number; negative: number; positions: number[] }>();

  for (const result of results) {
    const entry = aggregates.get(result.prompt) || {
      total: 0,
      mentioned: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      positions: [],
    };
    entry.total += 1;
    if (result.mentioned) {
      entry.mentioned += 1;
      if (result.sentiment === 'positive') entry.positive += 1;
      else if (result.sentiment === 'negative') entry.negative += 1;
      else entry.neutral += 1;
      if (typeof result.position === 'number') entry.positions.push(result.position);
    }
    aggregates.set(result.prompt, entry);
  }

  return Array.from(aggregates.entries()).map(([prompt_text, entry]) => {
    const mentionRate = entry.total > 0 ? Math.round((entry.mentioned / entry.total) * 100) : 0;
    const hasMentions = entry.mentioned > 0;
    const positive = hasMentions ? Math.round((entry.positive / entry.mentioned) * 100) : null;
    const neutral = hasMentions ? Math.round((entry.neutral / entry.mentioned) * 100) : null;
    const negative = hasMentions ? Math.round((entry.negative / entry.mentioned) * 100) : null;
    const avgPosition = entry.positions.length > 0
      ? Math.round(entry.positions.reduce((a, b) => a + b, 0) / entry.positions.length)
      : null;
    const minPosition = entry.positions.length > 0 ? Math.min(...entry.positions) : null;
    const maxPosition = entry.positions.length > 0 ? Math.max(...entry.positions) : null;
    const stability = entry.positions.length > 1 ? Math.round(maxPosition! - minPosition!) : null;

    return {
      prompt_text,
      samples: entry.total,
      mention_rate: mentionRate,
      sentiment_positive: positive,
      sentiment_neutral: neutral,
      sentiment_negative: negative,
      avg_position: avgPosition,
      min_position: minPosition,
      max_position: maxPosition,
      stability,
    };
  });
}

function computeTopicDailyMetrics(results: Array<{ topic_id: string | null; mentioned: boolean; sentiment: string | null; position: number | null }>, date: string) {
  const aggregates = new Map<string, { runs: number; mentions: number; positive: number; neutral: number; negative: number; positionSum: number; positionMentions: number }>();

  for (const result of results) {
    if (!result.topic_id) continue;
    const entry = aggregates.get(result.topic_id) || {
      runs: 0,
      mentions: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      positionSum: 0,
      positionMentions: 0,
    };
    entry.runs += 1;
    if (result.mentioned) {
      entry.mentions += 1;
      if (result.sentiment === 'positive') entry.positive += 1;
      else if (result.sentiment === 'negative') entry.negative += 1;
      else entry.neutral += 1;
      if (typeof result.position === 'number') {
        entry.positionSum += result.position;
        entry.positionMentions += 1;
      }
    }
    aggregates.set(result.topic_id, entry);
  }

  return Array.from(aggregates.entries()).map(([topic_id, entry]) => ({
    topic_id,
    date,
    runs_count: entry.runs,
    mentions_count: entry.mentions,
    visibility_rate: entry.runs > 0 ? Math.round((entry.mentions / entry.runs) * 100) : null,
    positive_count: entry.positive,
    neutral_count: entry.neutral,
    negative_count: entry.negative,
    avg_position: entry.positionMentions > 0 ? Number((entry.positionSum / entry.positionMentions).toFixed(1)) : null,
  }));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === 'string' ? body.reason : null;

  const supabase = await createClient();
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activeProject = await getActiveProjectForUser(user.id);
  if (!activeProject) {
    return NextResponse.json({ error: 'No active project' }, { status: 400 });
  }

  if (body.projectId && body.projectId !== activeProject.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = hasServiceRole ? createAdminClient() : supabase;

  const { data: lastTrigger, error: lastTriggerError } = await db
    .from('monitoring_triggers')
    .select('triggered_at')
    .eq('project_id', activeProject.id)
    .order('triggered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastTriggerError) {
    return NextResponse.json({ error: 'Failed to read triggers', details: lastTriggerError.message }, { status: 500 });
  }

  if (lastTrigger) {
    const last = new Date(lastTrigger.triggered_at);
    const diffMs = Date.now() - last.getTime();
    if (diffMs < MIN_TRIGGER_MINUTES * 60 * 1000) {
      return NextResponse.json({ status: 'skipped', reason: 'rate_limited' });
    }
  }

  const { error: triggerError } = await db
    .from('monitoring_triggers')
    .insert({ project_id: activeProject.id, reason: reason || 'manual_change' });

  if (triggerError) {
    return NextResponse.json({ error: 'Failed to create trigger', details: triggerError.message }, { status: 500 });
  }

  const { data: topicsData, error: topicsError } = await db
    .from('monitoring_topics')
    .select('id, is_active')
    .eq('project_id', activeProject.id);

  if (topicsError) {
    return NextResponse.json({ error: 'Failed to read topics', details: topicsError.message }, { status: 500 });
  }

  const activeTopicIds = new Set((topicsData || []).filter((t) => t.is_active).map((t) => t.id));

  const { data: promptsData, error: promptsError } = await db
    .from('monitoring_prompts')
    .select('id, prompt_text, is_active, topic_id')
    .eq('project_id', activeProject.id)
    .eq('is_active', true);

  if (promptsError) {
    return NextResponse.json({ error: 'Failed to read prompts', details: promptsError.message }, { status: 500 });
  }

  const filteredPrompts = (promptsData || []).filter((p) => !p.topic_id || activeTopicIds.size === 0 || activeTopicIds.has(p.topic_id));

  if (filteredPrompts.length === 0) {
    return NextResponse.json({ status: 'skipped', reason: 'no_prompts' });
  }

  const { data: competitorsData, error: competitorsError } = await db
    .from('competitors')
    .select('name')
    .eq('project_id', activeProject.id);

  if (competitorsError) {
    return NextResponse.json({ error: 'Failed to read competitors', details: competitorsError.message }, { status: 500 });
  }

  const competitors = (competitorsData || []).map((c: { name: string }) => c.name);
  const contextParts: string[] = [];
  if (activeProject.description) contextParts.push(activeProject.description);
  if (activeProject.location) contextParts.push(`Localisation: ${activeProject.location}`);
  if (activeProject.industry) contextParts.push(`Secteur: ${activeProject.industry}`);
  if (Array.isArray(activeProject.keywords) && activeProject.keywords.length > 0) {
    contextParts.push(`Mots-clés: ${activeProject.keywords.join(', ')}`);
  }
  const context = contextParts.length > 0 ? `Contexte de la marque: ${contextParts.join('. ')}.` : '';

  const runsPerPrompt = getRunsForPlan();

  const { data: analysisData, error: analysisError } = await db
    .from('analyses')
    .insert({
      project_id: activeProject.id,
      status: 'running',
      objectives: ALL_MODULES,
      analysis_mode: 'trend',
      run_count: runsPerPrompt,
      runs_per_prompt: runsPerPrompt,
      kind: 'scheduled',
    })
    .select()
    .single();

  if (analysisError || !analysisData) {
    return NextResponse.json({ error: 'Failed to create analysis', details: analysisError?.message }, { status: 500 });
  }

  const analysisId = analysisData.id as string;
    const runRows = filteredPrompts.flatMap((p) =>
      Array.from({ length: runsPerPrompt }).map((_, idx) => ({
        analysis_id: analysisId,
        prompt_text: p.prompt_text,
        run_index: idx + 1,
        topic_id: p.topic_id,
        run_type: 'monitoring',
        run_origin: 'monitoring_now',
      }))
    );

  const { data: insertedRuns, error: runsError } = await db
    .from('analysis_runs')
    .insert(runRows)
    .select();

  if (runsError) {
    return NextResponse.json({ error: 'Failed to create runs', details: runsError.message }, { status: 500 });
  }

  const results: Array<any> = [];

  for (const run of insertedRuns || []) {
    const result = await queryOpenAI(run.prompt_text, activeProject.name, competitors, context);
    results.push({ ...result, topic_id: run.topic_id });

    const { error: runUpdateError } = await db
      .from('analysis_runs')
      .update({
        model: result.model,
        response_text: result.response,
        brand_mentioned: result.mentioned,
        sentiment_label: result.sentiment,
        position_rank: result.position,
      })
      .eq('id', run.id);

    if (runUpdateError) {
      return NextResponse.json({ error: 'Failed to update run', details: runUpdateError.message }, { status: 500 });
    }

    const { error: responseError } = await db
      .from('analysis_responses')
      .insert({
        analysis_run_id: run.id,
        ai_model: result.model,
        ai_response: result.response,
        provider: result.provider,
        brand_mentioned: result.mentioned,
        brand_position: result.position,
        competitors_mentioned: result.competitors_mentioned,
        website_cited: result.sources_cited.length > 0,
        sentiment_label: result.sentiment,
        response_time_ms: result.response_time_ms,
      });

    if (responseError) {
      return NextResponse.json({ error: 'Failed to store response', details: responseError.message }, { status: 500 });
    }

    const citations = extractCitations(result.response);
    if (citations.length > 0) {
      const { error: citationError } = await db.from('response_citations').insert(
        citations.map((c) => ({
          analysis_run_id: run.id,
          url: c.url,
          domain: c.domain,
          domain_type: classifyDomain(c.domain),
        }))
      );
      if (citationError) {
        return NextResponse.json({ error: 'Failed to store citations', details: citationError.message }, { status: 500 });
      }
      await ingestCitations({
        supabase: db,
        projectId: activeProject.id,
        promptRunId: run.id,
        citations: citations.map((c) => ({
          url: c.url,
          domain: c.domain,
          domain_type: classifyDomain(c.domain),
        })),
        citedAt: new Date().toISOString(),
        aiModel: result.model,
        topicId: run.topic_id ?? null,
        brandMentioned: result.mentioned,
        competitorMentioned: result.competitors_mentioned?.length ? true : false,
        positionInAnswer: result.position,
      });
    }
  }

  const analysisItems = results.map((r) => ({
    analysis_id: analysisId,
    prompt_text: r.prompt,
    ai_model: r.model,
    ai_response: r.response,
    provider: r.provider,
    brand_mentioned: r.mentioned,
    brand_position: r.position,
    competitors_mentioned: r.competitors_mentioned,
    website_cited: r.sources_cited.length > 0,
    sentiment_label: r.sentiment,
    response_time_ms: r.response_time_ms,
  }));

  const { error: itemsError } = await db.from('analysis_items').insert(analysisItems);
  if (itemsError) {
    return NextResponse.json({ error: 'Failed to store analysis items', details: itemsError.message }, { status: 500 });
  }

  const rawItems: RawItem[] = analysisItems.map((i) => ({
    prompt_text: i.prompt_text,
    ai_response: i.ai_response,
    brand_mentioned: i.brand_mentioned,
    brand_position: i.brand_position,
    competitors_mentioned: i.competitors_mentioned,
    website_cited: i.website_cited,
    sentiment_label: i.sentiment_label,
  }));

  const moduleResults = computeModules(rawItems, ALL_MODULES);
  const { error: moduleError } = await db
    .from('analysis_module_results')
    .upsert(
      moduleResults.map((m) => ({
        analysis_id: analysisId,
        module_key: m.module_key,
        score: m.score,
        details: m.details,
      })),
      { onConflict: 'analysis_id,module_key' }
    );
  if (moduleError) {
    return NextResponse.json({ error: 'Failed to store modules', details: moduleError.message }, { status: 500 });
  }

  const metrics = computeTrendMetrics(
    results.map((r) => ({
      prompt: r.prompt,
      mentioned: r.mentioned,
      sentiment: r.sentiment,
      position: r.position,
    }))
  );
  const { error: metricsError } = await db.from('analysis_metrics').insert(metrics.map((m) => ({ analysis_id: analysisId, ...m })));
  if (metricsError) {
    return NextResponse.json({ error: 'Failed to store metrics', details: metricsError.message }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const topicMetrics = computeTopicDailyMetrics(
    results.map((r) => ({
      topic_id: r.topic_id ?? null,
      mentioned: r.mentioned,
      sentiment: r.sentiment,
      position: r.position,
    })),
    today
  );

  if (topicMetrics.length > 0) {
    const topicIds = topicMetrics.map((m) => m.topic_id);
    const { error: deleteMetricError } = await db
      .from('topic_daily_metrics')
      .delete()
      .eq('project_id', activeProject.id)
      .eq('date', today)
      .in('topic_id', topicIds);

    if (deleteMetricError) {
      return NextResponse.json({ error: 'Failed to reset topic metrics', details: deleteMetricError.message }, { status: 500 });
    }

    const { error: insertMetricError } = await db
      .from('topic_daily_metrics')
      .insert(topicMetrics.map((m) => ({ project_id: activeProject.id, ...m })));
    if (insertMetricError) {
      return NextResponse.json({ error: 'Failed to store topic metrics', details: insertMetricError.message }, { status: 500 });
    }
  }

  const { error: finalizeError } = await db
    .from('analyses')
    .update({
      status: 'completed',
      total_prompts: filteredPrompts.length,
      completed_prompts: filteredPrompts.length,
      completed_at: new Date().toISOString(),
    })
    .eq('id', analysisId);

  if (finalizeError) {
    return NextResponse.json({ error: 'Failed to finalize analysis', details: finalizeError.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'started' });
}
