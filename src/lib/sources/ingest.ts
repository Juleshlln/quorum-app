import { getDomainFromUrl, normalizeDomain, normalizeUrl } from '@/lib/sources/normalize';

type CitationInput = {
  url: string;
  domain: string;
  domain_type: string;
  method?: string;
  confidence?: number;
  rationale?: string;
  is_fallback?: boolean;
};

function normalizeDomainType(type: string) {
  const map: Record<string, string> = {
    institutional: 'Institutional',
    editorial: 'Editorial',
    corporate: 'Corporate',
    ugc: 'UGC',
    other: 'Other',
  };
  return map[type] || 'Other';
}

function normalizeUrlType(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname === '/' || parsed.pathname === '') return 'Homepage';
  } catch {
    // ignore parsing errors
  }
  if (url.includes('/blog') || url.includes('/news')) return 'Article';
  if (url.includes('/category')) return 'CategoryPage';
  if (url.includes('/profile') || url.includes('/about')) return 'Profile';
  if (url.includes('/forum') || url.includes('/discussion')) return 'Discussion';
  if (url.includes('/how-to') || url.includes('/guide')) return 'HowToGuide';
  return 'Other';
}

const DOMAIN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const domainCache = new Map<string, { owned: string | null; competitors: Array<{ id: string; domain: string }>; cachedAt: number }>();
const PROBABLE_GENERIC_DOMAINS = new Set([
  'wikipedia.org',
  'reddit.com',
  'youtube.com',
  'medium.com',
  'g2.com',
  'capterra.com',
  'trustpilot.com',
  'linkedin.com',
]);

async function resolveDomainCategory({
  supabase,
  projectId,
  domain,
}: {
  supabase: any;
  projectId: string;
  domain: string;
}): Promise<{ category: string; competitor_id: string | null }> {
  const registry = await supabase
    .from('domains_registry')
    .select('category, competitor_id')
    .eq('project_id', projectId)
    .eq('domain', domain)
    .maybeSingle();
  if (registry?.data?.category) {
    return { category: registry.data.category, competitor_id: registry.data.competitor_id || null };
  }

  let cached = domainCache.get(projectId);
  if (!cached || Date.now() - cached.cachedAt > DOMAIN_CACHE_TTL_MS) {
    const { data: project } = await supabase
      .from('projects')
      .select('website')
      .eq('id', projectId)
      .single();
    const { data: competitors } = await supabase
      .from('competitors')
      .select('id, website')
      .eq('project_id', projectId);
    cached = {
      owned: getDomainFromUrl(project?.website || null),
      competitors: (competitors || [])
        .map((c: any) => ({ id: c.id, domain: getDomainFromUrl(c.website || null) }))
        .filter((c: any) => c.domain),
      cachedAt: Date.now(),
    };
    domainCache.set(projectId, cached);
  }

  if (cached.owned && (domain === cached.owned || domain.endsWith(`.${cached.owned}`))) {
    return { category: 'owned', competitor_id: null };
  }
  const competitor = cached.competitors.find((c) => domain === c.domain || domain.endsWith(`.${c.domain}`));
  if (competitor) {
    return { category: 'competitor', competitor_id: competitor.id };
  }
  return { category: 'third_party', competitor_id: null };
}

export async function ingestCitations({
  supabase,
  runId,
  logRunId,
  projectId,
  promptId,
  promptRunId,
  responseId,
  citations,
  citedAt,
  aiModel,
  topicId,
  brandMentioned,
  competitorMentioned,
  positionInAnswer,
}: {
  supabase: any;
  runId?: string | null;
  logRunId?: string | null;
  projectId: string;
  promptId?: string | null;
  promptRunId: string;
  responseId?: string | null;
  citations: CitationInput[];
  citedAt: string;
  aiModel: string | null;
  topicId: string | null;
  brandMentioned: boolean;
  competitorMentioned: boolean | null;
  positionInAnswer: number | null;
}) {
  // Backfill linkage when callers do not pass run_id / prompt_id.
  // This keeps citations traceable by deriving metadata from prompt_runs.
  let resolvedRunId = runId || null;
  let resolvedPromptId = promptId || null;
  if (!resolvedRunId || !resolvedPromptId) {
    const { data: promptRun } = await supabase
      .from('prompt_runs')
      .select('run_id, prompt_id')
      .eq('id', promptRunId)
      .maybeSingle();
    if (promptRun) {
      if (!resolvedRunId && promptRun.run_id) resolvedRunId = promptRun.run_id;
      if (!resolvedPromptId && promptRun.prompt_id) resolvedPromptId = promptRun.prompt_id;
    }
  }

  for (const citation of citations) {
    const method = citation.method || 'observed';
    const rawUrl = typeof citation.url === 'string' ? citation.url : '';
    const normalizedDomainCandidate = normalizeDomain(citation.domain || '');

    if (!rawUrl) {
      try {
        await supabase.from('run_logs').insert({
          run_id: logRunId || null,
          monitoring_run_id: runId || null,
          project_id: projectId,
          level: 'warn',
          step: 'skip_citation',
          message: 'Skipping citation with missing URL',
          meta_json: {
            prompt_run_id: promptRunId,
            method,
            domain: citation.domain || null,
          },
        });
      } catch {
        // ignore
      }
      continue;
    }

    if (method === 'probable' && normalizedDomainCandidate && PROBABLE_GENERIC_DOMAINS.has(normalizedDomainCandidate)) {
      try {
        await supabase.from('run_logs').insert({
          run_id: logRunId || null,
          monitoring_run_id: runId || null,
          project_id: projectId,
          level: 'warn',
          step: 'skip_citation',
          message: 'Skipping probable citation from blocked generic domain',
          meta_json: {
            prompt_run_id: promptRunId,
            method,
            domain: normalizedDomainCandidate,
            url: rawUrl,
          },
        });
      } catch {
        // ignore
      }
      continue;
    }

    const normalizedUrl = normalizeUrl(rawUrl);
    if (!normalizedUrl) continue;
    const resolvedDomain = normalizeDomain(citation.domain) || getDomainFromUrl(normalizedUrl);
    if (!resolvedDomain) continue;
    const domainType = normalizeDomainType(citation.domain_type);
    const categoryInfo = await resolveDomainCategory({ supabase, projectId, domain: resolvedDomain });
    const escapedDomain = resolvedDomain.replace(/[,()]/g, '');
    const { data: domainRow } = await supabase
      .from('sources_domains')
      .select('id, is_owned, category, competitor_id')
      .eq('project_id', projectId)
      .or(`domain_normalized.eq."${escapedDomain}",domain.eq."${escapedDomain}"`)
      .maybeSingle();

    let domainId = domainRow?.id;
    if (!domainId) {
      const { data: inserted, error: domainInsertErr } = await supabase
        .from('sources_domains')
        .insert({
          project_id: projectId,
          domain: resolvedDomain,
          domain_normalized: resolvedDomain,
          domain_type: domainType,
          is_owned: categoryInfo.category === 'owned',
          category: categoryInfo.category,
          competitor_id: categoryInfo.competitor_id,
        })
        .select('id')
        .single();
      domainId = inserted?.id;
      if (domainInsertErr && !domainId) {
        try {
          await supabase.from('run_logs').insert({
            run_id: logRunId || null,
            monitoring_run_id: runId || null,
            project_id: projectId,
            level: 'error',
            step: 'insert_domain',
            message: domainInsertErr.message,
            meta_json: { domain: resolvedDomain, domain_type: domainType },
          });
        } catch {
          console.warn('[ingest] Failed to log domain insert error:', domainInsertErr.message);
        }
      }
    } else if (!domainRow?.category || domainRow?.competitor_id === undefined) {
      await supabase
        .from('sources_domains')
        .update({
          category: categoryInfo.category,
          competitor_id: categoryInfo.competitor_id,
          is_owned: categoryInfo.category === 'owned',
        })
        .eq('id', domainId);
    }

    if (!domainId) continue;

    const escapedUrl = normalizedUrl.replace(/[,()]/g, '');
    const { data: urlRow } = await supabase
      .from('sources_urls')
      .select('id')
      .eq('project_id', projectId)
      .or(`url_normalized.eq."${escapedUrl}",url.eq."${escapedUrl}"`)
      .maybeSingle();

    let urlId = urlRow?.id;
    if (!urlId) {
      const { data: insertedUrl, error: urlInsertErr } = await supabase
        .from('sources_urls')
        .insert({
          project_id: projectId,
          domain_id: domainId,
          url: normalizedUrl,
          url_normalized: normalizedUrl,
          url_type: normalizeUrlType(normalizedUrl),
        })
        .select('id')
        .single();
      urlId = insertedUrl?.id;
      if (urlInsertErr && !urlId) {
        try {
          await supabase.from('run_logs').insert({
            run_id: logRunId || null,
            monitoring_run_id: runId || null,
            project_id: projectId,
            level: 'error',
            step: 'insert_url',
            message: urlInsertErr.message,
            meta_json: { url: normalizedUrl, domain_id: domainId },
          });
        } catch {
          console.warn('[ingest] Failed to log url insert error:', urlInsertErr.message);
        }
      }
    }

    // Skip citation if url_id is null — NULL breaks unique constraint dedup
    // and would cause infinite duplicate rows on each run.
    if (!urlId) {
      try {
        await supabase.from('run_logs').insert({
          run_id: logRunId || null,
          monitoring_run_id: runId || null,
          project_id: projectId,
          level: 'warn',
          step: 'skip_citation',
          message: 'Skipping citation: url_id is null (url insert failed)',
          meta_json: {
            prompt_run_id: promptRunId,
            method: citation.method || 'observed',
            url: rawUrl,
            domain: resolvedDomain,
          },
        });
      } catch {
        // best-effort
      }
      continue;
    }

    const citationPayload = {
      project_id: projectId,
      run_id: resolvedRunId,
      prompt_id: resolvedPromptId,
      prompt_run_id: promptRunId,
      response_id: responseId || null,
      topic_id: topicId,
      ai_model: aiModel,
      domain_id: domainId,
      url_id: urlId,
      method: citation.method || 'observed',
      confidence: citation.confidence ?? 0.9,
      rationale: citation.rationale || null,
      is_fallback: citation.is_fallback ?? false,
      cited_at: citedAt,
      brand_mentioned: brandMentioned,
      competitor_mentioned: competitorMentioned,
      position_in_answer: positionInAnswer,
    };

    const { error } = await supabase.from('citations').upsert(citationPayload, {
      onConflict: 'project_id,prompt_run_id,url_id,method',
    });

    // Fallback: if upsert fails (e.g. conflicting partial index), try plain insert
    if (error) {
      const { error: insertErr } = await supabase.from('citations').insert(citationPayload);
      if (insertErr) {
        try {
          await supabase.from('run_logs').insert({
            run_id: logRunId || null,
            monitoring_run_id: runId || null,
            project_id: projectId,
            level: 'error',
            step: 'insert_citation',
            message: insertErr.message,
            meta_json: {
              prompt_run_id: promptRunId,
              url_id: urlId,
              method: citation.method || 'observed',
              upsert_error: error.message,
            },
          });
        } catch {
          console.warn('[ingest] Failed to log citation insert error:', insertErr.message);
        }
      }
    }
  }
}
