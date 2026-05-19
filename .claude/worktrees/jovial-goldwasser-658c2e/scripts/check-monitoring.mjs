import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !serviceKey) {
  console.error('Missing SUPABASE URL or service role key.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl.startsWith('http') ? supabaseUrl : `https://${supabaseUrl}`, serviceKey);

const projectId = process.env.CHECK_PROJECT_ID;
const windowDays = Number(process.env.CHECK_WINDOW_DAYS || '30');
if (!projectId) {
  console.error('Set CHECK_PROJECT_ID to run sanity checks.');
  process.exit(1);
}

async function main() {
  const { data: metricsRow } = await supabase
    .from('project_metrics_windowed')
    .select('metrics, window_start, window_end')
    .eq('project_id', projectId)
    .eq('window_days', windowDays)
    .order('window_end', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!metricsRow?.metrics) {
    console.error('No metrics found for project/window');
    process.exit(1);
  }

  const { window_start: windowStart, window_end: windowEnd } = metricsRow;
  const metrics = metricsRow.metrics;
  const shareSum = (metrics.owned_share || 0) + (metrics.competitor_share || 0) + (metrics.third_party_share || 0);
  const shareOk = Math.abs(100 - shareSum) <= 2;

  const startTs = `${windowStart}T00:00:00Z`;
  const endTs = `${windowEnd}T23:59:59.999Z`;
  const { data: citations } = await supabase
    .from('citations')
    .select('id')
    .eq('project_id', projectId)
    .gte('cited_at', startTs)
    .lte('cited_at', endTs);

  const citationsTotal = (citations || []).length;
  const totalsOk = citationsTotal === metrics.total_citations;

  console.log(JSON.stringify({
    windowStart,
    windowEnd,
    shareSum,
    shareOk,
    citationsTotal,
    metricsTotal: metrics.total_citations,
    totalsOk,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
