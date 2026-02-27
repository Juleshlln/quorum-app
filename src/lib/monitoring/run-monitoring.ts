import { queryOpenAI } from '@/lib/ai/providers';
import { ingestCitations } from '@/lib/sources/ingest';
import { getDomainFromUrl, normalizeUrl } from '@/lib/sources/normalize';
import { logRun } from '@/lib/monitoring/run-logs';

/**
 * After ingesting citations for a prompt_run, enrich `competitors_mentioned`
 * on the prompt_run by querying which cited domains belong to competitors.
 * This supplements the text-based detection with domain-based detection.
 */
async function enrichCompetitorsMentioned({
  supabase,
  promptRunId,
  textBasedCompetitors,
}: {
  supabase: any;
  promptRunId: string;
  textBasedCompetitors: string[];
}) {
  const { data: citedCompetitors } = await supabase
    .from('citations')
    .select('domain:sources_domains!inner(competitor_id, competitor:competitors!inner(name))')
    .eq('prompt_run_id', promptRunId)
    .eq('competitor_mentioned', true);

  const domainBasedNames = new Set<string>();
  for (const row of citedCompetitors || []) {
    const name = (row as any)?.domain?.competitor?.name;
    if (name) domainBasedNames.add(name);
  }

  // Merge text-based + domain-based, deduplicated (case-insensitive)
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const name of [...textBasedCompetitors, ...domainBasedNames]) {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(name);
    }
  }

  if (merged.length > textBasedCompetitors.length) {
    await supabase
      .from('prompt_runs')
      .update({ competitors_mentioned: merged })
      .eq('id', promptRunId);
  }

  return merged;
}

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
  const explicitUrlsInstruction = 'Dans ta réponse, cite systématiquement les URLs exactes des sources que tu mentionnes, sous la forme https://...';
  if (!REQUIRE_SOURCES || !CITATION_MODELS.includes(model)) {
    return `${prompt}\n\n${explicitUrlsInstruction}`;
  }
  return `${prompt}\n\nRéponds normalement puis ajoute une section \"Sources (URLs)\" avec 2 à 3 URLs exactes.\n${explicitUrlsInstruction}`;
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
  logRunId,
  projectId,
  brandName,
  competitors,
  context,
  scheduledAt = new Date().toISOString(),
  runWindowStart,
  runWindowEnd,
  runType = 'monitoring',
  models = DEFAULT_MODELS,
}: {
  supabase: any;
  runId?: string | null;
  logRunId?: string | null;
  projectId: string;
  brandName: string;
  competitors: string[];
  context: string;
  scheduledAt?: string;
  runWindowStart?: string | null;
  runWindowEnd?: string | null;
  runType?: 'monitoring' | 'sandbox';
  models?: string[];
}) {
  if (runType === 'monitoring' && !runId) {
    await logRun({
      supabase,
      runId: logRunId,
      monitoringRunId: runId,
      projectId,
      level: 'error',
      step: 'validate_run',
      message: 'Missing runId for monitoring prompt_runs',
      meta: { runType },
    });
    throw new Error('Missing runId for monitoring prompt_runs');
  }

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
      runId: logRunId,
      monitoringRunId: runId,
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
      runId: logRunId,
      monitoringRunId: runId,
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
      const promptRunMonitoringId = runType === 'monitoring' ? runId : (runId || null);
      await logRun({
        supabase,
        runId: logRunId,
        monitoringRunId: runId,
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
      } catch (aiErr: any) {
        result = null;
        await logRun({
          supabase,
          runId: logRunId,
          monitoringRunId: runId,
          projectId,
          level: 'error',
          step: 'query_ai',
          message: aiErr?.message || String(aiErr),
          meta: { prompt_id: prompt.id, model },
        });
      }

      // queryOpenAI never throws — it returns { error } on failure.
      // Treat error responses as a failed result.
      const aiSuccess = result && !result.error && result.response !== '';

      const promptRunPayload = {
        run_id: promptRunMonitoringId,
        run_window_start: runWindowStart || null,
        run_window_end: runWindowEnd || null,
        run_date: scheduledAt.slice(0, 10),
        prompt_id: prompt.id,
        prompt_version_id: version.id,
        project_id: projectId,
        ai_model: model,
        run_type: runType,
        scheduled_at: scheduledAt,
        executed_at: new Date().toISOString(),
        status: aiSuccess ? 'success' : 'failed',
        brand_mentioned: aiSuccess ? (result!.mentioned ?? null) : null,
        position_rank: aiSuccess ? (result!.position ?? null) : null,
        sentiment_label: aiSuccess ? (result!.sentiment ?? null) : null,
        competitors_mentioned: aiSuccess ? (result!.competitors_mentioned ?? []) : [],
      };

      // Try upsert first; fall back to select-existing + update if the
      // ON CONFLICT cannot resolve (partial unique index issue).
      let runRow: { id: string } | null = null;
      let runError: any = null;

      const upsertResult = await supabase
        .from('prompt_runs')
        .upsert(promptRunPayload, {
          onConflict: 'run_id,prompt_id,ai_model',
        })
        .select('id')
        .single();
      runRow = upsertResult.data;
      runError = upsertResult.error;

      // Fallback: if upsert failed, try finding existing row and updating it,
      // or insert fresh if no existing row found.
      if (runError || !runRow) {
        const { data: existingRow } = await supabase
          .from('prompt_runs')
          .select('id')
          .eq('run_id', promptRunMonitoringId)
          .eq('prompt_id', prompt.id)
          .eq('ai_model', model)
          .maybeSingle();

        if (existingRow) {
          const { executed_at, status, brand_mentioned, position_rank, sentiment_label, competitors_mentioned } = promptRunPayload;
          await supabase
            .from('prompt_runs')
            .update({ executed_at, status, brand_mentioned, position_rank, sentiment_label, competitors_mentioned })
            .eq('id', existingRow.id);
          runRow = existingRow;
          runError = null;
        } else {
          const insertResult = await supabase
            .from('prompt_runs')
            .insert(promptRunPayload)
            .select('id')
            .single();
          runRow = insertResult.data;
          runError = insertResult.error;
        }
      }

      if (runError || !runRow) {
        await logRun({
          supabase,
          runId: logRunId,
          monitoringRunId: runId,
          projectId,
          level: 'error',
          step: 'create_run',
          message: runError?.message || 'Failed to create prompt run',
          meta: { prompt_id: prompt.id, model, upsert_error: upsertResult.error?.message },
        });
        continue;
      }

      runs += 1;
      if (aiSuccess) {
        answers += 1;
      }

      if (aiSuccess) {
        // Delete any stale ai_answers from a previous run for this prompt_run,
        // then insert the fresh response. This avoids duplicates on re-runs.
        await supabase
          .from('ai_answers')
          .delete()
          .eq('prompt_run_id', runRow.id);

        const { error: answerErr } = await supabase.from('ai_answers').insert({
          prompt_run_id: runRow.id,
          raw_answer_text: result!.response,
        });
        if (answerErr) {
          await logRun({
            supabase,
            runId: logRunId,
            monitoringRunId: runId,
            projectId,
            level: 'error',
            step: 'insert_answer',
            message: answerErr.message,
            meta: { prompt_run_id: runRow.id },
          });
        }
      }

      if (aiSuccess) {
        const { data: responseRow, error: responseErr } = await supabase
          .from('monitoring_responses')
          .insert({
            project_id: projectId,
            prompt_run_id: runRow.id,
            raw_text: result!.response,
            raw_json: null,
            model_used: result!.model,
            prompt_final: finalPrompt,
            params: result!.params,
            language: 'fr',
            latency_ms: result!.response_time_ms,
          })
          .select('id')
          .single();
        if (responseErr) {
          await logRun({
            supabase,
            runId: logRunId,
            monitoringRunId: runId,
            projectId,
            level: 'error',
            step: 'insert_response',
            message: responseErr.message,
            meta: { prompt_run_id: runRow.id },
          });
        }

        const responseId = responseRow?.id ?? null;
        let citations = extractCitations(result!.response);
        if (citations.length > 0) {
          observed += citations.length;
          await logRun({
            supabase,
            runId: logRunId,
            monitoringRunId: runId,
            projectId,
            step: 'extract_sources',
            message: 'Observed citations extracted',
            meta: { count: citations.length },
          });
          await ingestCitations({
            supabase,
            runId,
            logRunId,
            projectId,
            promptId: prompt.id,
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
            aiModel: result!.model,
            topicId: prompt.topic_id ?? null,
            brandMentioned: result!.mentioned,
            competitorMentioned: result!.competitors_mentioned?.length ? true : false,
            positionInAnswer: result!.position,
          });

          // Enrich prompt_run.competitors_mentioned with domain-based matches
          await enrichCompetitorsMentioned({
            supabase,
            promptRunId: runRow.id,
            textBasedCompetitors: result!.competitors_mentioned ?? [],
          });
        } else {
          if (REQUIRE_SOURCES && CITATION_MODELS.includes(model)) {
            await logRun({
              supabase,
              runId: logRunId,
              monitoringRunId: runId,
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
            } catch (followupErr: any) {
              await logRun({
                supabase,
                runId: logRunId,
                monitoringRunId: runId,
                projectId,
                level: 'warn',
                step: 'followup_sources',
                message: followupErr?.message || String(followupErr),
                meta: { prompt_id: prompt.id, model },
              });
            }
          }

          if (citations.length > 0) {
            probable += citations.length;
            await ingestCitations({
              supabase,
              runId,
              logRunId,
              projectId,
              promptId: prompt.id,
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
              aiModel: result!.model,
              topicId: prompt.topic_id ?? null,
              brandMentioned: result!.mentioned,
              competitorMentioned: result!.competitors_mentioned?.length ? true : false,
              positionInAnswer: result!.position,
            });

            // Enrich prompt_run.competitors_mentioned with domain-based matches
            await enrichCompetitorsMentioned({
              supabase,
              promptRunId: runRow.id,
              textBasedCompetitors: result!.competitors_mentioned ?? [],
            });
            continue;
          }

          await logRun({
            supabase,
            runId: logRunId,
            monitoringRunId: runId,
            projectId,
            level: 'warn',
            step: 'extract_sources',
            message: 'No citations detected after follow-up; skipping citations insertion',
            meta: { prompt_id: prompt.id, model },
          });
        }
      }
    }
  }

  await logRun({
    supabase,
    runId: logRunId,
    monitoringRunId: runId,
    projectId,
    step: 'compute_metrics',
    message: 'Monitoring run completed',
    meta: { runs, answers, observed, probable },
  });

  return { runs, answers };
}
