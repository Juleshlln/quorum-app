import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { queryOpenAI, type AIQueryResult } from '@/lib/ai/providers';
import { computeModules, type ModuleKey, type RawItem } from '@/lib/analysis/modules';
import { ingestCitations } from '@/lib/sources/ingest';

const ALL_MODULES: ModuleKey[] = ['visibility', 'position', 'sentiment', 'global'];

function normalizeObjectives(input: unknown): ModuleKey[] {
  if (!Array.isArray(input) || input.length === 0) return [];
  const raw = input.map((v) => String(v).toLowerCase());
  if (raw.includes('all') || raw.includes('complete')) return ALL_MODULES;
  const allowed = new Set(ALL_MODULES);
  const filtered = raw.filter((v) => allowed.has(v as ModuleKey)) as ModuleKey[];
  return filtered.length > 0 ? Array.from(new Set(filtered)) : [];
}

type PromptSelection = {
  text: string;
  category: ModuleKey;
  type: 'suggested' | 'custom';
  template_id?: string | null;
  objective_tag?: string | null;
};

type AnalysisMode = 'trend' | 'simulation';

function normalizePromptSelections(input: unknown): PromptSelection[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((p) => ({
      text: String(p?.text || '').trim(),
      category: String(p?.category || '').toLowerCase() as ModuleKey,
      type: (p?.type === 'custom' ? 'custom' : 'suggested') as PromptSelection['type'],
      template_id: p?.template_id ? String(p.template_id) : null,
      objective_tag: p?.objective_tag ? String(p.objective_tag) : null,
    }))
    .filter((p) => p.text.length > 0 && ['visibility', 'position', 'sentiment'].includes(p.category));
}

function normalizeAnalysisMode(input: unknown): AnalysisMode {
  return String(input || '').toLowerCase() === 'simulation' ? 'simulation' : 'trend';
}

function normalizeRunCount(input: unknown, mode: AnalysisMode): number {
  if (mode === 'simulation') return 1;
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return 5;
  const clamped = Math.min(10, Math.max(2, Math.round(parsed)));
  return clamped;
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const projectId = body?.projectId;
    const objectives = normalizeObjectives(body?.objectives);
    const selections = normalizePromptSelections(body?.prompts);
    const mainCategory = String(body?.objective || body?.category || '').toLowerCase();
    const analysisMode = normalizeAnalysisMode(body?.analysis_mode);
    const runCount = normalizeRunCount(body?.runs_per_prompt ?? body?.run_count, analysisMode);

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }
    if (!objectives.length) {
      return NextResponse.json({ error: 'Objective is required' }, { status: 400 });
    }
    if (selections.length === 0) {
      return NextResponse.json({ error: 'Au moins un prompt est requis' }, { status: 400 });
    }
    if (!['visibility', 'position', 'sentiment'].includes(mainCategory)) {
      return NextResponse.json({ error: 'Catégorie principale invalide' }, { status: 400 });
    }

    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !projectData) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const { data: analysisData, error: analysisError } = await supabase
      .from('analyses')
      .insert({
        project_id: projectId,
        status: 'running',
        objectives,
        analysis_mode: analysisMode,
        run_count: runCount,
        runs_per_prompt: runCount,
        kind: 'sandbox',
      })
      .select()
      .single();

    if (analysisError || !analysisData) {
      return NextResponse.json(
        { error: `Failed to create analysis: ${analysisError?.message || 'Unknown error'}` },
        { status: 500 }
      );
    }

    const analysisId = analysisData.id as string;

    const { data: competitorsData } = await supabase
      .from('competitors')
      .select('name')
      .eq('project_id', projectId);

    const competitors = (competitorsData as Array<{ name: string }> | null) || [];
    const competitorNames = competitors.map((c) => c.name);

    const keywords = Array.isArray(projectData.keywords) ? projectData.keywords.filter(Boolean) : [];
    const contextParts: string[] = [];
    if (projectData.description) contextParts.push(projectData.description);
    if (projectData.location) contextParts.push(`Localisation: ${projectData.location}`);
    if (projectData.industry) contextParts.push(`Secteur: ${projectData.industry}`);
    if (keywords.length > 0) contextParts.push(`Mots-clés: ${keywords.join(', ')}`);

    const context = contextParts.length > 0
      ? `Contexte de la marque: ${contextParts.join('. ')}.`
      : '';

    const prompts = selections.map((s) => s.text);

    const analysisPrompts = selections.map((s) => ({
      analysis_id: analysisId,
      prompt_text: s.text,
      category: s.category,
      type: s.type,
      objective_tag: s.objective_tag || s.category,
      template_id: s.template_id,
    }));

    const { error: promptsError } = await supabase
      .from('analysis_prompts')
      .insert(analysisPrompts);

    if (promptsError) {
      await supabase
        .from('analyses')
        .update({ status: 'failed', error_message: promptsError.message })
        .eq('id', analysisId);
      return NextResponse.json({ error: 'Erreur sauvegarde des prompts' }, { status: 500 });
    }

    const results: AIQueryResult[] = [];

    const runRows = prompts.flatMap((prompt) =>
      Array.from({ length: runCount }).map((_, idx) => ({
        analysis_id: analysisId,
        prompt_text: prompt,
        run_index: idx + 1,
        run_type: 'sandbox',
        run_origin: 'analysis_page',
      }))
    );

    const { data: insertedRuns, error: runsError } = await supabase
      .from('analysis_runs')
      .insert(runRows)
      .select();

    if (runsError || !insertedRuns) {
      await supabase
        .from('analyses')
        .update({ status: 'failed', error_message: runsError?.message || 'Erreur sauvegarde des runs' })
        .eq('id', analysisId);
      return NextResponse.json({ error: 'Erreur sauvegarde des runs' }, { status: 500 });
    }

    for (const run of insertedRuns as Array<{ id: string; prompt_text: string }>) {
      const result = await queryOpenAI(run.prompt_text, projectData.name, competitorNames, context);
      results.push(result);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const responseRow = {
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
      };

      const { error: responseError } = await supabase
        .from('analysis_responses')
        .insert(responseRow);

      if (responseError) {
        await supabase
          .from('analyses')
          .update({ status: 'failed', error_message: responseError.message })
          .eq('id', analysisId);
        return NextResponse.json({ error: 'Erreur sauvegarde des réponses' }, { status: 500 });
      }

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

      const citations = extractCitations(result.response);
      if (citations.length > 0) {
        const rows = citations.map((c) => ({
          analysis_run_id: run.id,
          url: c.url,
          domain: c.domain,
          domain_type: classifyDomain(c.domain),
        }));
        await supabase.from('response_citations').insert(rows);
        await ingestCitations({
          supabase,
          projectId: projectData.id,
          promptRunId: run.id,
          citations: citations.map((c) => ({
            url: c.url,
            domain: c.domain,
            domain_type: classifyDomain(c.domain),
          })),
          citedAt: new Date().toISOString(),
          aiModel: result.model,
          topicId: null,
          brandMentioned: result.mentioned,
          competitorMentioned: result.competitors_mentioned?.length ? true : false,
          positionInAnswer: result.position,
        });
      }
    }

    if (results.length === 0) {
      await supabase
        .from('analyses')
        .update({ status: 'failed', error_message: 'No results returned' })
        .eq('id', analysisId);
      return NextResponse.json({ error: 'Aucun résultat retourné' }, { status: 500 });
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

    const { error: itemsError } = await supabase
      .from('analysis_items')
      .insert(analysisItems);

    if (itemsError) {
      await supabase
        .from('analyses')
        .update({ status: 'failed', error_message: itemsError.message })
        .eq('id', analysisId);
      return NextResponse.json({ error: 'Erreur sauvegarde des résultats' }, { status: 500 });
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

    if (analysisMode === 'trend') {
      const moduleResults = computeModules(rawItems, objectives);
      const rows = moduleResults.map((m) => ({
        analysis_id: analysisId,
        module_key: m.module_key,
        score: m.score,
        details: m.details,
      }));

      const { error: modulesError } = await supabase
        .from('analysis_module_results')
        .upsert(rows, { onConflict: 'analysis_id,module_key' });

      if (modulesError) {
        await supabase
          .from('analyses')
          .update({ status: 'failed', error_message: modulesError.message })
          .eq('id', analysisId);
        return NextResponse.json({ error: 'Erreur sauvegarde des modules' }, { status: 500 });
      }

      const metrics = computeTrendMetrics(
        results.map((r) => ({
          prompt: r.prompt,
          mentioned: r.mentioned,
          sentiment: r.sentiment,
          position: r.position,
        }))
      );

      const metricsRows = metrics.map((m) => ({
        analysis_id: analysisId,
        ...m,
      }));

      const { error: metricsError } = await supabase
        .from('analysis_metrics')
        .insert(metricsRows);

      if (metricsError) {
        await supabase
          .from('analyses')
          .update({ status: 'failed', error_message: metricsError.message })
          .eq('id', analysisId);
        return NextResponse.json({ error: 'Erreur sauvegarde des métriques' }, { status: 500 });
      }
    }

    const { error: updateError } = await supabase
      .from('analyses')
      .update({
        status: 'completed',
        total_prompts: prompts.length,
        completed_prompts: results.length,
        completed_at: new Date().toISOString(),
      })
      .eq('id', analysisId);

    if (updateError) {
      return NextResponse.json({ error: 'Erreur finalisation analyse' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      analysisId,
      objectives,
      category: mainCategory,
      resultsCount: results.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
