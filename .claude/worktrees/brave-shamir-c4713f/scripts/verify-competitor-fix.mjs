/**
 * verify-competitor-fix.mjs
 *
 * Verifies that the competitor classification fix works correctly
 * by checking DB state and testing the classification logic.
 *
 * Usage:
 *   node --env-file=.env.local scripts/verify-competitor-fix.mjs
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

const PROJECT_ID = '747816f2-bd89-4c98-94b6-af070834c6c3';

async function main() {
  let allPassed = true;

  // Test 1: Competitors exist in DB
  console.log('\n=== Test 1: Competitors in DB ===');
  const { data: competitors } = await supabase
    .from('competitors')
    .select('name, domain, website')
    .eq('project_id', PROJECT_ID);

  const expectedNames = ['Lyreco', 'Raja', 'Bruneau', 'Rexel', 'Sonepar', 'Staples', 'Amazon Business', 'RS Components'];
  const foundNames = (competitors || []).map(c => c.name);
  for (const name of expectedNames) {
    const found = foundNames.includes(name);
    console.log(`  ${found ? '✓' : '✗'} ${name} ${found ? 'found' : 'MISSING'}`);
    if (!found) allPassed = false;
  }

  // Test 2: sources_domains correctly classified
  console.log('\n=== Test 2: Domain classification ===');
  const { data: domains } = await supabase
    .from('sources_domains')
    .select('domain, category, competitor_id, is_owned')
    .eq('project_id', PROJECT_ID);

  const competitorDomains = (domains || []).filter(d => d.category === 'competitor');
  const ownedDomains = (domains || []).filter(d => d.category === 'owned');
  console.log(`  Competitor domains: ${competitorDomains.length}`);
  competitorDomains.forEach(d => console.log(`    ✓ ${d.domain} (competitor_id: ${d.competitor_id})`));
  console.log(`  Owned domains: ${ownedDomains.length}`);
  ownedDomains.forEach(d => console.log(`    ✓ ${d.domain}`));

  if (competitorDomains.length === 0) {
    console.log('  ✗ No competitor domains found!');
    allPassed = false;
  }

  // Test 3: citations.competitor_mentioned is true for competitor domains
  console.log('\n=== Test 3: Citation competitor_mentioned flags ===');
  const { data: citations } = await supabase
    .from('citations')
    .select('id, competitor_mentioned, brand_mentioned, domain:sources_domains(domain, category)')
    .eq('project_id', PROJECT_ID);

  const competitorCitations = (citations || []).filter(c => c.competitor_mentioned === true);
  const competitorDomainCitations = (citations || []).filter(c => c.domain?.category === 'competitor');

  console.log(`  Total citations: ${(citations || []).length}`);
  console.log(`  competitor_mentioned=true: ${competitorCitations.length}`);
  console.log(`  domain.category=competitor: ${competitorDomainCitations.length}`);

  // Check consistency: every citation with a competitor domain should have competitor_mentioned=true
  let inconsistent = 0;
  for (const c of competitorDomainCitations) {
    if (c.competitor_mentioned !== true) {
      console.log(`  ✗ Citation ${c.id} has competitor domain "${c.domain?.domain}" but competitor_mentioned=${c.competitor_mentioned}`);
      inconsistent++;
      allPassed = false;
    }
  }
  if (inconsistent === 0 && competitorDomainCitations.length > 0) {
    console.log('  ✓ All competitor domain citations have competitor_mentioned=true');
  }

  // Test 4: Check specific known domains
  console.log('\n=== Test 4: Known competitor domains ===');
  const knownCompetitorDomains = ['rexel.fr', 'sonepar.com', 'rs-online.com', 'rexel.com'];
  for (const d of knownCompetitorDomains) {
    const found = (domains || []).find(row =>
      row.domain === d || row.domain === `www.${d}` || row.domain?.endsWith(`.${d}`)
    );
    if (found) {
      const correct = found.category === 'competitor';
      console.log(`  ${correct ? '✓' : '✗'} ${found.domain}: category=${found.category}`);
      if (!correct) allPassed = false;
    } else {
      console.log(`  - ${d}: not in sources_domains (no citations yet)`);
    }
  }

  // Summary
  console.log(`\n=== Result: ${allPassed ? 'ALL CHECKS PASSED ✓' : 'SOME CHECKS FAILED ✗'} ===\n`);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
