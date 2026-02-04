type CitationInput = {
  url: string;
  domain: string;
  domain_type: string;
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
  if (url.includes('/blog') || url.includes('/news')) return 'Article';
  if (url.includes('/category')) return 'CategoryPage';
  if (url.includes('/profile') || url.includes('/about')) return 'Profile';
  if (url.includes('/forum') || url.includes('/discussion')) return 'Discussion';
  if (url.includes('/how-to') || url.includes('/guide')) return 'HowToGuide';
  return 'Other';
}

export async function ingestCitations({
  supabase,
  projectId,
  promptRunId,
  citations,
  citedAt,
  aiModel,
  topicId,
  brandMentioned,
  competitorMentioned,
  positionInAnswer,
}: {
  supabase: any;
  projectId: string;
  promptRunId: string;
  citations: CitationInput[];
  citedAt: string;
  aiModel: string | null;
  topicId: string | null;
  brandMentioned: boolean;
  competitorMentioned: boolean | null;
  positionInAnswer: number | null;
}) {
  for (const citation of citations) {
    const domainType = normalizeDomainType(citation.domain_type);
    const { data: domainRow } = await supabase
      .from('sources_domains')
      .select('id, is_owned')
      .eq('project_id', projectId)
      .eq('domain', citation.domain)
      .maybeSingle();

    let domainId = domainRow?.id;
    if (!domainId) {
      const { data: inserted } = await supabase
        .from('sources_domains')
        .insert({
          project_id: projectId,
          domain: citation.domain,
          domain_type: domainType,
          is_owned: false,
        })
        .select('id')
        .single();
      domainId = inserted?.id;
    }

    if (!domainId) continue;

    const { data: urlRow } = await supabase
      .from('sources_urls')
      .select('id')
      .eq('project_id', projectId)
      .eq('url', citation.url)
      .maybeSingle();

    let urlId = urlRow?.id;
    if (!urlId) {
      const { data: insertedUrl } = await supabase
        .from('sources_urls')
        .insert({
          project_id: projectId,
          domain_id: domainId,
          url: citation.url,
          url_type: normalizeUrlType(citation.url),
        })
        .select('id')
        .single();
      urlId = insertedUrl?.id;
    }

    await supabase.from('citations').insert({
      project_id: projectId,
      prompt_run_id: promptRunId,
      topic_id: topicId,
      ai_model: aiModel,
      domain_id: domainId,
      url_id: urlId || null,
      cited_at: citedAt,
      brand_mentioned: brandMentioned,
      competitor_mentioned: competitorMentioned,
      position_in_answer: positionInAnswer,
    });
  }
}
