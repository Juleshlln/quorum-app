import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { queryOpenAI } from '@/lib/ai/providers';
import { computeModules, type ModuleKey, type RawItem } from '@/lib/analysis/modules';
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
    const { data: promptsData } = await supabase
      .from('monitoring_prompts')
      .select('id, prompt_text, is_active')
      .eq('project_id', project.id)
      .eq('is_active', true);

    if (!promptsData || promptsData.length === 0) {
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
    const runRows = promptsData.flatMap((p) =>
      Array.from({ length: runsPerPrompt }).map((_, idx) => ({
        analysis_id: analysisId,
        prompt_text: p.prompt_text,
        run_index: idx + 1,
      }))
    );

    const { data: insertedRuns } = await supabase
      .from('analysis_runs')
      .insert(runRows)
      .select();

    for (const run of insertedRuns || []) {
      const result = await queryOpenAI(run.prompt_text, project.name, competitors, context);
      results.push(result);

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

    await supabase
      .from('analyses')
      .update({
        status: 'completed',
        total_prompts: promptsData.length,
        completed_prompts: promptsData.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', analysisId);
  }

  return NextResponse.json({ success: true });
}
