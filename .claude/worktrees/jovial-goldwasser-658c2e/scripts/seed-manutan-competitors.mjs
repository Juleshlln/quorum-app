/**
 * seed-manutan-competitors.mjs
 *
 * Seeds competitors for the Manutan project and backfills existing
 * sources_domains + citations to reflect competitor classification.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-manutan-competitors.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE URL or service role key.');
  process.exit(1);
}

const supabase = createClient(
  supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}`,
  serviceKey,
);

const MANUTAN_PROJECT_ID = '747816f2-bd89-4c98-94b6-af070834c6c3';

const COMPETITORS = [
  { name: 'Lyreco',  website: 'https://www.lyreco.com',  domain: 'lyreco.com'  },
  { name: 'Raja',    website: 'https://www.raja.fr',      domain: 'raja.fr'     },
  { name: 'Bruneau', website: 'https://www.bruneau.fr',   domain: 'bruneau.fr'  },
  { name: 'Rexel',   website: 'https://www.rexel.fr',     domain: 'rexel.fr'    },
  { name: 'Sonepar', website: 'https://www.sonepar.com',  domain: 'sonepar.com' },
  { name: 'Staples', website: 'https://www.staples.fr',   domain: 'staples.fr'  },
  { name: 'Amazon Business', website: 'https://www.amazon.fr', domain: 'amazon.fr' },
  { name: 'RS Components',   website: 'https://www.rs-online.com', domain: 'rs-online.com' },
];

function normalizeDomain(raw) {
  if (!raw) return null;
  return raw.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '') || null;
}

async function main() {
  // 1. Verify project exists
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, website')
    .eq('id', MANUTAN_PROJECT_ID)
    .single();

  if (!project) {
    console.error(`Project ${MANUTAN_PROJECT_ID} not found.`);
    process.exit(1);
  }
  console.log(`Project: ${project.name} (${project.id})`);

  // 2. Check existing competitors
  const { data: existing } = await supabase
    .from('competitors')
    .select('id, name, domain, website')
    .eq('project_id', MANUTAN_PROJECT_ID);
  console.log(`Existing competitors: ${(existing || []).length}`);

  // 3. Insert missing competitors
  const existingNames = new Set((existing || []).map(c => c.name.toLowerCase()));
  const toInsert = COMPETITORS.filter(c => !existingNames.has(c.name.toLowerCase()));

  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabase
      .from('competitors')
      .insert(toInsert.map(c => ({
        project_id: MANUTAN_PROJECT_ID,
        name: c.name,
        website: c.website,
        domain: c.domain,
        confidence: 0.9,
        method: 'manual_seed',
      })))
      .select('id, name, domain');

    if (error) {
      console.error('Failed to insert competitors:', error.message);
      process.exit(1);
    }
    console.log(`Inserted ${inserted.length} competitors:`, inserted.map(c => c.name));
  } else {
    console.log('All competitors already exist.');
  }

  // 4. Reload full competitor list
  const { data: allCompetitors } = await supabase
    .from('competitors')
    .select('id, name, domain, website')
    .eq('project_id', MANUTAN_PROJECT_ID);

  // Build domain → competitor_id map
  const domainToCompetitor = new Map();
  for (const c of allCompetitors || []) {
    const d1 = normalizeDomain(c.domain);
    const d2 = c.website ? normalizeDomain(new URL(c.website).hostname) : null;
    if (d1) domainToCompetitor.set(d1, c.id);
    if (d2 && d2 !== d1) domainToCompetitor.set(d2, c.id);
    // Also match without TLD for multi-TLD brands (e.g., rexel.fr = rexel.com)
    const nameToken = c.name.toLowerCase().replace(/\s+/g, '');
    domainToCompetitor.set(`__name__${nameToken}`, c.id);
  }

  // 5. Backfill sources_domains: update category and competitor_id
  const { data: domains } = await supabase
    .from('sources_domains')
    .select('id, domain, category, competitor_id')
    .eq('project_id', MANUTAN_PROJECT_ID);

  let updatedDomains = 0;
  for (const d of domains || []) {
    const normalizedDomain = normalizeDomain(d.domain);
    if (!normalizedDomain) continue;

    // Check exact domain match
    let competitorId = domainToCompetitor.get(normalizedDomain) || null;

    // Fallback: check by name token
    if (!competitorId) {
      for (const c of allCompetitors || []) {
        const token = c.name.toLowerCase().replace(/\s+/g, '');
        if (normalizedDomain.startsWith(token + '.') || normalizedDomain.includes('.' + token + '.')) {
          competitorId = c.id;
          break;
        }
      }
    }

    if (competitorId && d.category !== 'competitor') {
      const { error } = await supabase
        .from('sources_domains')
        .update({ category: 'competitor', competitor_id: competitorId, is_owned: false })
        .eq('id', d.id);
      if (!error) {
        updatedDomains++;
        console.log(`  Updated domain "${d.domain}" → competitor`);
      }
    }
  }
  console.log(`Updated ${updatedDomains} sources_domains rows.`);

  // 6. Backfill citations: update competitor_mentioned
  const { data: citations } = await supabase
    .from('citations')
    .select('id, domain_id, competitor_mentioned')
    .eq('project_id', MANUTAN_PROJECT_ID);

  // Build set of competitor domain IDs
  const { data: competitorDomains } = await supabase
    .from('sources_domains')
    .select('id')
    .eq('project_id', MANUTAN_PROJECT_ID)
    .eq('category', 'competitor');
  const competitorDomainIds = new Set((competitorDomains || []).map(d => d.id));

  let updatedCitations = 0;
  for (const c of citations || []) {
    const shouldBeTrue = competitorDomainIds.has(c.domain_id);
    if (shouldBeTrue && c.competitor_mentioned !== true) {
      const { error } = await supabase
        .from('citations')
        .update({ competitor_mentioned: true })
        .eq('id', c.id);
      if (!error) updatedCitations++;
    }
  }
  console.log(`Updated ${updatedCitations} citations with competitor_mentioned = true.`);

  // 7. Summary
  const { count: totalCitations } = await supabase
    .from('citations')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', MANUTAN_PROJECT_ID);
  const { count: competitorCitations } = await supabase
    .from('citations')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', MANUTAN_PROJECT_ID)
    .eq('competitor_mentioned', true);

  console.log(`\nSummary:`);
  console.log(`  Total citations: ${totalCitations}`);
  console.log(`  Competitor citations: ${competitorCitations}`);
  console.log(`  Competitor rate: ${totalCitations > 0 ? Math.round((competitorCitations / totalCitations) * 100) : 0}%`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
