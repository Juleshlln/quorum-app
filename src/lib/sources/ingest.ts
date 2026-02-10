import { getDomainFromUrl, normalizeDomain, normalizeUrl } from '@/lib/sources/normalize';

type CitationInput = {
  url: string;
  domain: string;
  domain_type: string;
  method?: string;
  confidence?: number;
  rationale?: string;
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

const domainCache = new Map<string, { owned: string | null; competitors: Array<{ id: string; domain: string }> }>();

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
  if (!cached) {
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
  projectId,
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
  projectId: string;
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
  for (const citation of citations) {
    const normalizedUrl = normalizeUrl(citation.url);
    if (!normalizedUrl) continue;
    const resolvedDomain = normalizeDomain(citation.domain) || getDomainFromUrl(normalizedUrl);
    if (!resolvedDomain) continue;
    const domainType = normalizeDomainType(citation.domain_type);
    const categoryInfo = await resolveDomainCategory({ supabase, projectId, domain: resolvedDomain });
    const { data: domainRow } = await supabase
      .from('sources_domains')
      .select('id, is_owned, category, competitor_id')
      .eq('project_id', projectId)
      .or(`domain_normalized.eq.${resolvedDomain},domain.eq.${resolvedDomain}`)
      .maybeSingle();

    let domainId = domainRow?.id;
    if (!domainId) {
      const { data: inserted } = await supabase
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

    const { data: urlRow } = await supabase
      .from('sources_urls')
      .select('id')
      .eq('project_id', projectId)
      .or(`url_normalized.eq.${normalizedUrl},url.eq.${normalizedUrl}`)
      .maybeSingle();

    let urlId = urlRow?.id;
    if (!urlId) {
      const { data: insertedUrl } = await supabase
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
    }

    const { error } = await supabase.from('citations').upsert({
      project_id: projectId,
      prompt_run_id: promptRunId,
      response_id: responseId || null,
      topic_id: topicId,
      ai_model: aiModel,
      domain_id: domainId,
      url_id: urlId || null,
      method: citation.method || 'observed',
      confidence: citation.confidence ?? 0.9,
      rationale: citation.rationale || null,
      cited_at: citedAt,
      brand_mentioned: brandMentioned,
      competitor_mentioned: competitorMentioned,
      position_in_answer: positionInAnswer,
    }, {
      onConflict: 'project_id,prompt_run_id,url_id,method',
    });
    if (error) {
      try {
        await supabase.from('run_logs').insert({
          run_id: runId || null,
          project_id: projectId,
          level: 'error',
          step: 'insert_citation',
          message: error.message,
          meta_json: {
            prompt_run_id: promptRunId,
            url_id: urlId || null,
            method: citation.method || 'observed',
          },
        });
      } catch {
        // ignore
      }
    }
  }
}
