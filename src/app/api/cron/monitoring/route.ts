import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { queryOpenAI } from '@/lib/ai/providers';
import { computeModules, type ModuleKey, type RawItem } from '@/lib/analysis/modules';
import { ingestCitations } from '@/lib/sources/ingest';
import { getRunsForPlan } from '@/lib/plans';

const ALL_MODULES: ModuleKey[] = ['visibility', 'position', 'sentiment', 'global'];

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
  const headerSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const secret = headerSecret || bearerToken;

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, description, location, industry, keywords');

  const runsPerPrompt = getRunsForPlan();

  for (const project of projects || []) {
    const { data: topicsData } = await supabase
      .from('monitoring_topics')
      .select('id, is_active')
      .eq('project_id', project.id);

    const activeTopicIds = new Set((topicsData || []).filter((t) => t.is_active).map((t) => t.id));

    const { data: promptsData } = await supabase
      .from('monitoring_prompts')
      .select('id, prompt_text, is_active, topic_id')
      .eq('project_id', project.id)
      .eq('is_active', true);

    const filteredPrompts = (promptsData || []).filter((p) => !p.topic_id || activeTopicIds.size === 0 || activeTopicIds.has(p.topic_id));

    if (!filteredPrompts || filteredPrompts.length === 0) {
      continue;
    }

    const { data: competitorsData } = await supabase
      .from('competitors')
      .select('name')
      .eq('project_id', project.id);

    const competitors = (competitorsData || []).map((c: { name: string }) => c.name);
    const contextParts: string[] = [];
    if (project.description) contextParts.push(project.description);
    if (project.location) contextParts.push(`Localisation: ${project.location}`);
    if (project.industry) contextParts.push(`Secteur: ${project.industry}`);
    if (Array.isArray(project.keywords) && project.keywords.length > 0) {
      contextParts.push(`Mots-clés: ${project.keywords.join(', ')}`);
    }
    const context = contextParts.length > 0 ? `Contexte de la marque: ${contextParts.join('. ')}.` : '';

    const { data: analysisData, error: analysisError } = await supabase
      .from('analyses')
      .insert({
        project_id: project.id,
        status: 'running',
        objectives: ALL_MODULES,
        analysis_mode: 'trend',
        run_count: runsPerPrompt,
        runs_per_prompt: runsPerPrompt,
        kind: 'scheduled',
      })
      .select()
      .single();

    if (analysisError || !analysisData) continue;
    const analysisId = analysisData.id as string;

    const results: Array<any> = [];
    const runRows = filteredPrompts.flatMap((p) =>
      Array.from({ length: runsPerPrompt }).map((_, idx) => ({
        analysis_id: analysisId,
        prompt_text: p.prompt_text,
        run_index: idx + 1,
        topic_id: p.topic_id,
        run_type: 'monitoring',
        run_origin: 'scheduler',
      }))
    );

    const { data: insertedRuns } = await supabase
      .from('analysis_runs')
      .insert(runRows)
      .select();

    for (const run of insertedRuns || []) {
      const result = await queryOpenAI(run.prompt_text, project.name, competitors, context);
      results.push({ ...result, topic_id: run.topic_id });

      await supabase
        .from('analysis_runs')
        .update({
          model: result.model,
          response_text: result.response,
          brand_mentioned: result.mentioned,
          sentiment_label: result.sentiment,
          position_rank: result.position,
        })
        .eq('id', run.id);

      await supabase
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

      const citations = extractCitations(result.response);
      if (citations.length > 0) {
        await supabase.from('response_citations').insert(
          citations.map((c) => ({
            analysis_run_id: run.id,
            url: c.url,
            domain: c.domain,
            domain_type: classifyDomain(c.domain),
          }))
        );
        await ingestCitations({
          supabase,
          projectId: project.id,
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

    await supabase.from('analysis_items').insert(analysisItems);

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
    await supabase
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

    const metrics = computeTrendMetrics(
      results.map((r) => ({
        prompt: r.prompt,
        mentioned: r.mentioned,
        sentiment: r.sentiment,
        position: r.position,
      }))
    );
    await supabase.from('analysis_metrics').insert(metrics.map((m) => ({ analysis_id: analysisId, ...m })));

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
      await supabase
        .from('topic_daily_metrics')
        .delete()
        .eq('project_id', project.id)
        .eq('date', today)
        .in('topic_id', topicIds);

      await supabase
        .from('topic_daily_metrics')
        .insert(topicMetrics.map((m) => ({ project_id: project.id, ...m })));
    }

    await supabase
      .from('analyses')
      .update({
        status: 'completed',
        total_prompts: filteredPrompts.length,
        completed_prompts: filteredPrompts.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', analysisId);
  }

  return NextResponse.json({ success: true });
}
