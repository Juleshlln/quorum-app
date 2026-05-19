/**
 * seed-monitoring.mjs
 *
 * Seeds a demo project with monitoring data for QA.
 * Citations go through ingestCitation() — the same validation as the real
 * pipeline — so generic-domain probable citations are rejected identically.
 */
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE URL or service role key.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}`, serviceKey);

const windowDays = 30;
const end = new Date();
const endDate = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
const startDate = new Date(endDate);
startDate.setUTCDate(startDate.getUTCDate() - (windowDays - 1));
const windowStart = startDate.toISOString().slice(0, 10);
const windowEnd = endDate.toISOString().slice(0, 10);

const models = ['gpt-4o'];
const modelsHash = crypto.createHash('sha256').update(JSON.stringify(models)).digest('hex');

/* ── Mirror of PROBABLE_GENERIC_DOMAINS from src/lib/sources/ingest.ts ── */
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

function normalizeDomain(raw) {
  if (!raw) return null;
  return raw.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '') || null;
}

function normalizeDomainType(type) {
  const map = { institutional: 'Institutional', editorial: 'Editorial', corporate: 'Corporate', ugc: 'UGC', other: 'Other' };
  return map[type] || 'Other';
}

function normalizeUrlType(url) {
  try { if (new URL(url).pathname === '/' || new URL(url).pathname === '') return 'Homepage'; } catch {}
  if (url.includes('/blog') || url.includes('/news')) return 'Article';
  if (url.includes('/category')) return 'CategoryPage';
  return 'Other';
}

/**
 * Single citation ingestion — mirrors src/lib/sources/ingest.ts logic.
 * Rejects generic-domain probable citations the same way.
 */
async function ingestCitation({
  projectId, runId, promptId, promptRunId, responseId,
  domain, url, domainType, method, confidence,
  citedAt, aiModel, brandMentioned, competitorMentioned, positionInAnswer,
}) {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain || !url) return { ingested: false, reason: 'missing domain or url' };

  // ── Guard: reject generic domains for probable citations ──
  if (method === 'probable' && PROBABLE_GENERIC_DOMAINS.has(normalizedDomain)) {
    console.warn(`  ⛔ Rejected probable citation for generic domain: ${normalizedDomain}`);
    return { ingested: false, reason: `generic domain rejected: ${normalizedDomain}` };
  }

  // ── Resolve domain category ──
  const { data: existingDomain } = await supabase
    .from('sources_domains')
    .select('id, is_owned, category, competitor_id')
    .eq('project_id', projectId)
    .or(`domain_normalized.eq."${normalizedDomain}",domain.eq."${normalizedDomain}"`)
    .maybeSingle();

  let domainId = existingDomain?.id;
  const resolvedDomainType = normalizeDomainType(domainType);

  // Resolve category from project data
  const { data: proj } = await supabase.from('projects').select('website').eq('id', projectId).single();
  const ownedDomain = normalizeDomain(proj?.website ? new URL(proj.website).hostname : null);
  const { data: comps } = await supabase.from('competitors').select('id, website').eq('project_id', projectId);
  const compDomains = (comps || []).map(c => {
    try { return { id: c.id, domain: normalizeDomain(new URL(c.website).hostname) }; } catch { return null; }
  }).filter(Boolean);

  let category = 'third_party';
  let competitorId = null;
  if (ownedDomain && (normalizedDomain === ownedDomain || normalizedDomain.endsWith(`.${ownedDomain}`))) {
    category = 'owned';
  } else {
    const comp = compDomains.find(c => normalizedDomain === c.domain || normalizedDomain.endsWith(`.${c.domain}`));
    if (comp) { category = 'competitor'; competitorId = comp.id; }
  }

  if (!domainId) {
    const { data: inserted } = await supabase
      .from('sources_domains')
      .insert({ project_id: projectId, domain: normalizedDomain, domain_normalized: normalizedDomain, domain_type: resolvedDomainType, is_owned: category === 'owned', category, competitor_id: competitorId })
      .select('id')
      .single();
    domainId = inserted?.id;
  }
  if (!domainId) return { ingested: false, reason: 'domain insert failed' };

  // ── Resolve URL ──
  const { data: existingUrl } = await supabase
    .from('sources_urls')
    .select('id')
    .eq('project_id', projectId)
    .or(`url_normalized.eq."${url}",url.eq."${url}"`)
    .maybeSingle();

  let urlId = existingUrl?.id;
  if (!urlId) {
    const { data: insertedUrl } = await supabase
      .from('sources_urls')
      .insert({ project_id: projectId, domain_id: domainId, url, url_normalized: url, url_type: normalizeUrlType(url) })
      .select('id')
      .single();
    urlId = insertedUrl?.id;
  }
  if (!urlId) return { ingested: false, reason: 'url insert failed' };

  // ── Insert citation ──
  const { error } = await supabase.from('citations').upsert({
    project_id: projectId,
    run_id: runId,
    prompt_id: promptId,
    prompt_run_id: promptRunId,
    response_id: responseId || null,
    ai_model: aiModel,
    domain_id: domainId,
    url_id: urlId,
    method,
    confidence,
    is_fallback: false,
    cited_at: citedAt,
    brand_mentioned: brandMentioned,
    competitor_mentioned: competitorMentioned,
    position_in_answer: positionInAnswer,
  }, { onConflict: 'project_id,prompt_run_id,url_id,method' });

  if (error) {
    console.warn(`  ⚠ Citation upsert error: ${error.message}`);
    return { ingested: false, reason: error.message };
  }
  return { ingested: true };
}

function buildSourcesSummary(citations) {
  const total = citations.length;
  const uniqueDomains = new Set(citations.map((c) => c.domain?.domain).filter(Boolean)).size;
  const uniqueUrls = new Set(citations.map((c) => c.url?.url).filter(Boolean)).size;
  const observed = citations.filter((c) => (c.method || 'observed') === 'observed').length;
  const probable = citations.filter((c) => (c.method || 'observed') === 'probable').length;
  const owned = citations.filter((c) => c.domain?.category === 'owned' || c.domain?.is_owned).length;
  const competitor = citations.filter((c) => c.domain?.category === 'competitor').length;
  const thirdParty = citations.filter((c) => c.domain?.category === 'third_party' || !c.domain?.category).length;

  const byDate = new Map();
  citations.forEach((c) => {
    const date = c.cited_at.slice(0, 10);
    byDate.set(date, (byDate.get(date) || 0) + 1);
  });
  const series = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, total_citations: count }));

  return {
    total_citations: total,
    unique_domains: uniqueDomains,
    unique_urls: uniqueUrls,
    observed_citations: observed,
    probable_citations: probable,
    owned_citations: owned,
    competitor_citations: competitor,
    third_party_citations: thirdParty,
    owned_share: total > 0 ? Math.round((owned / total) * 100) : 0,
    competitor_share: total > 0 ? Math.round((competitor / total) * 100) : 0,
    third_party_share: total > 0 ? Math.round((thirdParty / total) * 100) : 0,
    series,
  };
}

async function main() {
  const userId = process.env.SEED_USER_ID;
  let seedUserId = userId;
  if (!seedUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    seedUserId = profile?.id || null;
  }
  if (!seedUserId) {
    console.error('No profiles found. Set SEED_USER_ID to an existing profile id.');
    process.exit(1);
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      user_id: seedUserId,
      name: 'Seed Brand',
      website: 'https://seedbrand.com',
      description: 'Projet seed pour QA monitoring',
      industry: 'SaaS',
      keywords: ['monitoring', 'sources'],
    })
    .select('*')
    .single();
  if (projectError || !project) {
    console.error('Project insert failed', projectError?.message);
    process.exit(1);
  }

  const competitors = [
    { name: 'Competitor One', website: 'https://competitor-one.com' },
    { name: 'Competitor Two', website: 'https://competitor-two.com' },
  ];
  await supabase.from('competitors').insert(competitors.map((c) => ({
    project_id: project.id,
    name: c.name,
    website: c.website,
  })));

  const { data: topics } = await supabase
    .from('monitoring_topics')
    .insert([
      { project_id: project.id, title: 'Produit', is_active: true },
      { project_id: project.id, title: 'Marché', is_active: true },
    ])
    .select('id, title');

  const topicId = topics?.[0]?.id || null;
  const prompts = [
    { prompt_text: 'Quels sont les meilleurs outils de monitoring pour PME ?', topic_id: topicId },
    { prompt_text: 'Quel est le meilleur outil pour suivre sa visibilité IA ?', topic_id: topicId },
  ];

  const { data: promptRows } = await supabase
    .from('monitoring_prompts')
    .insert(prompts.map((p) => ({
      project_id: project.id,
      prompt_text: p.prompt_text,
      topic_id: p.topic_id,
      is_active: true,
    })))
    .select('id, prompt_text, topic_id');

  const { data: runRow } = await supabase
    .from('monitoring_runs')
    .insert({
      project_id: project.id,
      status: 'running',
      window_start: windowStart,
      window_end: windowEnd,
      window_days: windowDays,
      models,
      models_hash: modelsHash,
      run_date: windowEnd,
      started_at: new Date().toISOString(),
      items_total: 0,
      items_processed: 0,
      items_success: 0,
      items_failed: 0,
    })
    .select('*')
    .single();

  if (!runRow) {
    throw new Error('Failed to create monitoring run seed row');
  }

  for (const prompt of promptRows || []) {
    const { data: run } = await supabase
      .from('prompt_runs')
      .upsert({
        run_id: runRow.id,
        run_window_start: windowStart,
        run_window_end: windowEnd,
        run_date: windowEnd,
        prompt_id: prompt.id,
        project_id: project.id,
        ai_model: models[0],
        run_type: 'monitoring',
        scheduled_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
        status: 'success',
        brand_mentioned: true,
      }, {
        onConflict: 'run_id,prompt_id,ai_model',
      })
      .select('id')
      .single();

    if (!run) {
      throw new Error('Failed to create prompt_run seed row');
    }

    const { data: respRow } = await supabase
      .from('monitoring_responses')
      .insert({
        project_id: project.id,
        prompt_run_id: run.id,
        raw_text: `Réponse seed pour prompt ${prompt.id}.`,
        model_used: models[0],
        prompt_final: prompt.prompt_text,
        language: 'fr',
      })
      .select('id')
      .single();

    const seedCitations = [
      { domain: 'seedbrand.com', category: 'owned', method: 'observed' },
      { domain: 'competitor-one.com', category: 'competitor', method: 'observed' },
      { domain: 'news-site.com', category: 'third_party', method: 'observed' },
    ];

    for (const entry of seedCitations) {
      const url = `https://${entry.domain}/article-${prompt.id.slice(0, 6)}`;
      const result = await ingestCitation({
        projectId: project.id,
        runId: runRow.id,
        promptId: prompt.id,
        promptRunId: run.id,
        responseId: respRow?.id || null,
        domain: entry.domain,
        url,
        domainType: 'editorial',
        method: entry.method,
        confidence: 0.9,
        citedAt: new Date().toISOString(),
        aiModel: models[0],
        brandMentioned: true,
        competitorMentioned: entry.category === 'competitor',
        positionInAnswer: 1,
      });
      console.log(`  Citation ${entry.domain} (${entry.method}): ${result.ingested ? '✓' : '✗ ' + result.reason}`);
    }
  }

  const { data: citations } = await supabase
    .from('citations')
    .select('cited_at, method, domain:sources_domains(domain, category, is_owned), url:sources_urls(url)')
    .eq('project_id', project.id);
  const metrics = buildSourcesSummary(citations || []);

  await supabase.from('project_metrics_windowed').upsert({
    project_id: project.id,
    run_id: runRow.id,
    window_days: windowDays,
    window_start: windowStart,
    window_end: windowEnd,
    metrics,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'project_id,window_days,window_start,window_end',
  });

  const itemsTotal = (promptRows?.length || 0) * models.length;
  await supabase
    .from('monitoring_runs')
    .update({
      status: 'success',
      items_total: itemsTotal,
      items_processed: itemsTotal,
      items_success: itemsTotal,
      items_failed: 0,
      finished_at: new Date().toISOString(),
    })
    .eq('id', runRow.id);

  console.log('Seed completed:', { project_id: project.id, run_id: runRow.id });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
