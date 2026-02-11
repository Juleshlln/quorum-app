import { queryOpenAI } from '@/lib/ai/providers';
import { ingestCitations } from '@/lib/sources/ingest';
import { getDomainFromUrl, normalizeUrl } from '@/lib/sources/normalize';
import { logRun } from '@/lib/monitoring/run-logs';

type MonitoringPrompt = {
  id: string;
  prompt_text: string;
  topic_id: string | null;
  project_id: string;
  is_active: boolean | null;
};

type PromptVersion = {
  id: string;
  version_number: number;
  prompt_text: string;
  is_active: boolean;
};

const DEFAULT_MODELS = ['gpt-4o'];
const CITATION_MODELS = (process.env.MONITORING_SOURCES_MODELS || 'gpt-4o')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const REQUIRE_SOURCES = process.env.MONITORING_REQUIRE_SOURCES === 'true';

const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'en', 'pour', 'avec', 'sur', 'dans', 'est',
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'for', 'with', 'on', 'in', 'is', 'are',
]);

function extractCitations(text: string | null): Array<{ url: string; domain: string }> {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s)]+/g;
  const urls = text.match(urlRegex) || [];
  const seen = new Set<string>();
  const results: Array<{ url: string; domain: string }> = [];
  urls.forEach((url) => {
    const clean = url.replace(/[)\].,;]+$/g, '');
    const normalized = normalizeUrl(clean);
    if (!normalized || seen.has(normalized)) return;
    const domain = getDomainFromUrl(normalized);
    if (!domain) return;
    seen.add(normalized);
    results.push({ url: normalized, domain });
  });
  return results;
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

function buildPromptWithSources(prompt: string, model: string) {
  if (!REQUIRE_SOURCES || !CITATION_MODELS.includes(model)) return prompt;
  return `${prompt}\n\nRéponds normalement puis ajoute une section \"Sources (URLs)\" avec 2 à 3 URLs exactes.`;
}

function buildFollowupSourcesPrompt(prompt: string) {
  return `Donne uniquement 2 à 3 URLs exactes et pertinentes (https://...), sans autre texte, pour répondre à la question suivante:\n\n${prompt}\n\nSi tu ne peux pas, réponds exactement: NONE`;
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ\s-]/gi, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

async function inferProbableSources({
  supabase,
  prompt,
  brandName,
  competitors,
}: {
  supabase: any;
  prompt: string;
  brandName: string;
  competitors: string[];
}) {
  const keywords = extractKeywords(prompt);
  const brandToken = brandName.toLowerCase();
  const competitorTokens = competitors.map((c) => c.toLowerCase());

  const { data: catalog } = await supabase
    .from('domains_catalog')
    .select('domain, domain_type')
    .limit(200);

  const fallbackDomains = [
    { domain: 'wikipedia.org', domain_type: 'editorial' },
    { domain: 'reddit.com', domain_type: 'ugc' },
    { domain: 'youtube.com', domain_type: 'ugc' },
    { domain: 'medium.com', domain_type: 'editorial' },
    { domain: 'g2.com', domain_type: 'editorial' },
    { domain: 'capterra.com', domain_type: 'editorial' },
    { domain: 'trustpilot.com', domain_type: 'editorial' },
    { domain: 'linkedin.com', domain_type: 'ugc' },
  ];

  const candidates = (catalog && catalog.length > 0 ? catalog : fallbackDomains).map((row: any) => ({
    domain: row.domain,
    domain_type: row.domain_type || 'other',
  }));

  const scored = candidates.map((c: { domain: string; domain_type: string }) => {
    const domainLower = c.domain.toLowerCase();
    let score = 0.2;
    if (domainLower.includes(brandToken)) score += 0.3;
    if (competitorTokens.some((t) => domainLower.includes(t))) score += 0.2;
    if (keywords.some((k) => domainLower.includes(k))) score += 0.1;
    return {
      url: `https://${c.domain}`,
      domain: c.domain,
      domain_type: c.domain_type,
      confidence: Math.min(0.75, score),
      rationale: 'Source probable inférée à partir du thème du prompt (heuristique).',
    };
  });

  return scored.sort((a: { confidence: number }, b: { confidence: number }) => b.confidence - a.confidence).slice(0, 8);
}

export async function runMonitoringForProject({
  supabase,
  runId,
  projectId,
  brandName,
  competitors,
  context,
  scheduledAt = new Date().toISOString(),
  runType = 'monitoring',
  models = DEFAULT_MODELS,
}: {
  supabase: any;
  runId?: string | null;
  projectId: string;
  brandName: string;
  competitors: string[];
  context: string;
  scheduledAt?: string;
  runType?: 'monitoring' | 'sandbox';
  models?: string[];
}) {
  const { data: topicsData } = await supabase
    .from('monitoring_topics')
    .select('id, is_active')
    .eq('project_id', projectId);

  const activeTopicIds = new Set(
    (topicsData || []).filter((t: any) => t.is_active !== false).map((t: any) => t.id)
  );

  const { data: promptsData, error: promptsError } = await supabase
    .from('monitoring_prompts')
    .select('id, prompt_text, topic_id, project_id, is_active')
    .eq('project_id', projectId);

  if (promptsError) {
    await logRun({
      supabase,
      runId,
      projectId,
      level: 'error',
      step: 'load_prompts',
      message: promptsError.message,
    });
    throw new Error(promptsError.message);
  }

  const prompts = (promptsData as MonitoringPrompt[] || []).filter((p) => {
    if (p.is_active === false) return false;
    if (p.topic_id && !activeTopicIds.has(p.topic_id)) return false;
    return true;
  });

  if (prompts.length === 0) {
    await logRun({
      supabase,
      runId,
      projectId,
      level: 'warn',
      step: 'load_prompts',
      message: 'No active monitoring prompts found.',
    });
    return { runs: 0, answers: 0 };
  }

  let runs = 0;
  let answers = 0;
  let observed = 0;
  let probable = 0;

  for (const prompt of prompts) {
    let version: PromptVersion | null = null;
    const { data: versionRows } = await supabase
      .from('prompt_versions')
      .select('id, version_number, prompt_text, is_active')
      .eq('prompt_id', prompt.id)
      .eq('is_active', true)
      .limit(1);

    if (versionRows && versionRows.length > 0) {
      version = versionRows[0] as PromptVersion;
    } else {
      const { data: insertedVersion } = await supabase
        .from('prompt_versions')
        .insert({
          prompt_id: prompt.id,
          version_number: 1,
          prompt_text: prompt.prompt_text,
          is_active: true,
        })
        .select('id, version_number, prompt_text, is_active')
        .single();
      if (insertedVersion) {
        version = insertedVersion as PromptVersion;
      }
    }

    if (!version) continue;

    for (const model of models) {
      await logRun({
        supabase,
        runId,
        projectId,
        step: 'execute_item',
        message: 'Running prompt',
        meta: { prompt_id: prompt.id, model },
      });
      let result: Awaited<ReturnType<typeof queryOpenAI>> | null = null;
      const finalPrompt = buildPromptWithSources(version.prompt_text, model);
      try {
        result = await queryOpenAI(finalPrompt, brandName, competitors, context, {
          model,
          temperature: 0,
          top_p: 1,
          max_tokens: 1200,
          require_sources: REQUIRE_SOURCES && CITATION_MODELS.includes(model),
        });
      } catch {
        result = null;
      }

      const { data: runRow, error: runError } = await supabase
        .from('prompt_runs')
        .insert({
          prompt_id: prompt.id,
          prompt_version_id: version.id,
          project_id: projectId,
          ai_model: model,
          run_type: runType,
          scheduled_at: scheduledAt,
          executed_at: new Date().toISOString(),
          status: result ? 'success' : 'failed',
          brand_mentioned: result?.mentioned ?? null,
          position_rank: result?.position ?? null,
          sentiment_label: result?.sentiment ?? null,
          competitors_mentioned: result?.competitors_mentioned ?? [],
        })
        .select('id')
        .single();

      if (runError || !runRow) {
        await logRun({
          supabase,
          runId,
          projectId,
          level: 'error',
          step: 'create_run',
          message: runError?.message || 'Failed to create prompt run',
          meta: { prompt_id: prompt.id, model },
        });
        continue;
      }

      runs += 1;
      if (result) {
        answers += 1;
      }

      if (result) {
        await supabase.from('ai_answers').insert({
          prompt_run_id: runRow.id,
          raw_answer_text: result.response,
        });
      }

      if (result) {
        const { data: responseRow } = await supabase
          .from('monitoring_responses')
          .insert({
            project_id: projectId,
            prompt_run_id: runRow.id,
            raw_text: result.response,
            raw_json: null,
            model_used: result.model,
            prompt_final: finalPrompt,
            params: result.params,
            language: 'fr',
            latency_ms: result.response_time_ms,
          })
          .select('id')
          .single();

        const responseId = responseRow?.id ?? null;
        let citations = extractCitations(result.response);
        if (citations.length > 0) {
          observed += citations.length;
          await logRun({
            supabase,
            runId,
            projectId,
            step: 'extract_sources',
            message: 'Observed citations extracted',
            meta: { count: citations.length },
          });
          await ingestCitations({
            supabase,
            runId,
            projectId,
            promptRunId: runRow.id,
            responseId,
            citations: citations.map((c) => ({
              url: c.url,
              domain: c.domain,
              domain_type: classifyDomain(c.domain),
              confidence: 0.9,
              rationale: 'URL explicitement citée dans la réponse.',
              method: 'observed',
            })),
            citedAt: scheduledAt,
            aiModel: result.model,
            topicId: prompt.topic_id ?? null,
            brandMentioned: result.mentioned,
            competitorMentioned: result.competitors_mentioned?.length ? true : false,
            positionInAnswer: result.position,
          });
        } else {
          if (REQUIRE_SOURCES && CITATION_MODELS.includes(model)) {
            await logRun({
              supabase,
              runId,
              projectId,
              step: 'extract_sources',
              message: 'No URLs in response, running follow-up for URLs only',
            });
            try {
              const followup = await queryOpenAI(
                buildFollowupSourcesPrompt(version.prompt_text),
                brandName,
                competitors,
                context,
                {
                  model,
                  temperature: 0,
                  top_p: 1,
                  max_tokens: 200,
                  require_sources: false,
                }
              );
              if (!/^\s*NONE\s*$/i.test((followup.response || '').trim())) {
                citations = extractCitations(followup.response);
              }
            } catch {
              // ignore follow-up errors
            }
          }

          if (citations.length > 0) {
            probable += citations.length;
            await ingestCitations({
              supabase,
              runId,
              projectId,
              promptRunId: runRow.id,
              responseId,
              citations: citations.map((c) => ({
                url: c.url,
                domain: c.domain,
                domain_type: classifyDomain(c.domain),
                confidence: 0.7,
                rationale: 'URLs obtenues via un prompt de suivi (sources probables).',
                method: 'probable',
              })),
              citedAt: scheduledAt,
              aiModel: result.model,
              topicId: prompt.topic_id ?? null,
              brandMentioned: result.mentioned,
              competitorMentioned: result.competitors_mentioned?.length ? true : false,
              positionInAnswer: result.position,
            });
            continue;
          }

          await logRun({
            supabase,
            runId,
            projectId,
            step: 'extract_sources',
            message: 'No citations in response, inferring probable sources',
          });
          const inferred = await inferProbableSources({
            supabase,
            prompt: version.prompt_text,
            brandName,
            competitors,
          });
          if (inferred.length > 0) {
            probable += inferred.length;
            await ingestCitations({
              supabase,
              runId,
              projectId,
              promptRunId: runRow.id,
              responseId,
              citations: inferred.map((p) => ({
                url: p.url,
                domain: p.domain,
                domain_type: p.domain_type,
                confidence: p.confidence,
                rationale: p.rationale,
                method: 'probable',
              })),
              citedAt: scheduledAt,
              aiModel: result.model,
              topicId: prompt.topic_id ?? null,
              brandMentioned: result.mentioned,
              competitorMentioned: result.competitors_mentioned?.length ? true : false,
              positionInAnswer: result.position,
            });
          }
        }
      }
    }
  }

  await logRun({
    supabase,
    runId,
    projectId,
    step: 'compute_metrics',
    message: 'Monitoring run completed',
    meta: { runs, answers, observed, probable },
  });

  return { runs, answers };
}
