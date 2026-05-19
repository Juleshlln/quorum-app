/**
 * backfill-competitors-mentioned.mjs
 *
 * Backfills prompt_runs.competitors_mentioned by looking at which
 * competitor domains were cited in each prompt_run's citations.
 * Then recomputes monitoring_daily_metrics.competitor_data.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-competitors-mentioned.mjs
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
  // 1. Get all competitors for this project
  const { data: competitors } = await supabase
    .from('competitors')
    .select('id, name')
    .eq('project_id', PROJECT_ID);
  const competitorIdToName = new Map(
    (competitors || []).map(c => [c.id, c.name])
  );
  console.log(`Competitors: ${(competitors || []).map(c => c.name).join(', ')}`);

  // 2. Get all prompt_runs for this project
  const { data: promptRuns } = await supabase
    .from('prompt_runs')
    .select('id, competitors_mentioned, scheduled_at')
    .eq('project_id', PROJECT_ID)
    .eq('run_type', 'monitoring')
    .eq('status', 'success');

  console.log(`Prompt runs to process: ${(promptRuns || []).length}`);

  // 3. For each prompt_run, find competitor names from citations
  let updated = 0;
  for (const pr of promptRuns || []) {
    // Get citations for this prompt_run that are on competitor domains
    const { data: citations } = await supabase
      .from('citations')
      .select('domain_id, competitor_mentioned')
      .eq('prompt_run_id', pr.id)
      .eq('competitor_mentioned', true);

    if (!citations || citations.length === 0) continue;

    // Get the domain → competitor_id mapping
    const domainIds = [...new Set(citations.map(c => c.domain_id))];
    const { data: domains } = await supabase
      .from('sources_domains')
      .select('id, competitor_id')
      .in('id', domainIds)
      .not('competitor_id', 'is', null);

    // Collect competitor names
    const competitorNames = new Set();
    for (const d of domains || []) {
      const name = competitorIdToName.get(d.competitor_id);
      if (name) competitorNames.add(name);
    }

    if (competitorNames.size === 0) continue;

    // Merge with existing text-based matches
    const existing = new Set(
      (pr.competitors_mentioned || []).map(n => n.toLowerCase())
    );
    const merged = [...(pr.competitors_mentioned || [])];
    for (const name of competitorNames) {
      if (!existing.has(name.toLowerCase())) {
        merged.push(name);
        existing.add(name.toLowerCase());
      }
    }

    // Update prompt_run
    const { error } = await supabase
      .from('prompt_runs')
      .update({ competitors_mentioned: merged })
      .eq('id', pr.id);

    if (!error) {
      updated++;
      console.log(`  Updated PR ${pr.id.slice(0, 8)}: [${merged.join(', ')}]`);
    } else {
      console.warn(`  Failed PR ${pr.id.slice(0, 8)}: ${error.message}`);
    }
  }

  console.log(`\nUpdated ${updated} prompt_runs with competitors_mentioned.`);

  // 4. Recompute monitoring_daily_metrics
  console.log('\n=== Recomputing monitoring_daily_metrics ===');

  const competitorNames = (competitors || []).map(c => c.name);

  // Get all prompt_runs grouped by day
  const { data: allRuns } = await supabase
    .from('prompt_runs')
    .select('id, prompt_id, ai_model, brand_mentioned, position_rank, sentiment_label, competitors_mentioned, scheduled_at')
    .eq('project_id', PROJECT_ID)
    .eq('run_type', 'monitoring')
    .eq('status', 'success')
    .order('scheduled_at', { ascending: true });

  const { count: totalPromptsActive } = await supabase
    .from('monitoring_prompts')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', PROJECT_ID)
    .eq('is_active', true);

  // Group by day
  const byDay = new Map();
  for (const r of allRuns || []) {
    const day = r.scheduled_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(r);
  }

  let metricsUpdated = 0;
  for (const [day, rows] of byDay.entries()) {
    const responsesCount = rows.length;
    const mentioned = rows.filter(r => r.brand_mentioned === true);
    const mentionsCount = mentioned.length;
    const visibilityScore = responsesCount > 0 ? Math.round((mentionsCount / responsesCount) * 100) : null;

    const positions = mentioned
      .map(r => r.position_rank)
      .filter(p => typeof p === 'number');
    const avgPosition = positions.length > 0
      ? Number((positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1))
      : null;

    const positiveCount = mentioned.filter(r => r.sentiment_label === 'positive').length;
    const neutralCount = mentioned.filter(r => r.sentiment_label === 'neutral').length;
    const negativeCount = mentioned.filter(r => r.sentiment_label === 'negative').length;
    const sentimentScore = mentionsCount > 0
      ? Number(((positiveCount - negativeCount) / mentionsCount).toFixed(2))
      : null;

    const promptsCovered = new Set(rows.map(r => r.prompt_id)).size;
    const modelsUsed = [...new Set(rows.map(r => r.ai_model).filter(Boolean))];

    const competitorData = competitorNames.map(name => {
      const compMentions = rows.filter(r =>
        r.competitors_mentioned?.some(c => c.toLowerCase() === name.toLowerCase())
      ).length;
      return {
        name,
        mentions: compMentions,
        visibility: responsesCount > 0 ? Math.round((compMentions / responsesCount) * 100) : 0,
      };
    });

    const { error } = await supabase
      .from('monitoring_daily_metrics')
      .upsert({
        project_id: PROJECT_ID,
        day,
        responses_count: responsesCount,
        mentions_count: mentionsCount,
        visibility_score: visibilityScore,
        avg_position: avgPosition,
        sentiment_score: sentimentScore,
        positive_count: positiveCount,
        neutral_count: neutralCount,
        negative_count: negativeCount,
        prompts_covered: promptsCovered,
        total_prompts_active: totalPromptsActive || 0,
        models_used: modelsUsed,
        competitor_data: competitorData,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'project_id,day' });

    if (!error) {
      metricsUpdated++;
      const compSummary = competitorData.filter(c => c.mentions > 0).map(c => `${c.name}:${c.mentions}`).join(', ');
      console.log(`  ${day}: ${responsesCount} runs, ${mentionsCount} brand mentions, competitors: ${compSummary || 'none'}`);
    } else {
      console.warn(`  ${day}: upsert failed: ${error.message}`);
    }
  }

  console.log(`\nUpdated ${metricsUpdated} monitoring_daily_metrics rows.`);

  // 5. Verify
  console.log('\n=== Verification ===');
  const { data: verifyRuns } = await supabase
    .from('prompt_runs')
    .select('id, competitors_mentioned')
    .eq('project_id', PROJECT_ID)
    .eq('run_type', 'monitoring')
    .eq('status', 'success')
    .not('competitors_mentioned', 'eq', '{}');

  const runsWithCompetitors = (verifyRuns || []).filter(
    r => r.competitors_mentioned && r.competitors_mentioned.length > 0
  );
  console.log(`prompt_runs with competitors_mentioned > 0: ${runsWithCompetitors.length}`);

  const { data: verifyMetrics } = await supabase
    .from('monitoring_daily_metrics')
    .select('day, competitor_data')
    .eq('project_id', PROJECT_ID)
    .order('day');

  for (const m of verifyMetrics || []) {
    const comps = (m.competitor_data || []).filter(c => c.mentions > 0);
    if (comps.length > 0) {
      console.log(`  ${m.day}: ${comps.map(c => `${c.name}=${c.visibility}%`).join(', ')}`);
    }
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
