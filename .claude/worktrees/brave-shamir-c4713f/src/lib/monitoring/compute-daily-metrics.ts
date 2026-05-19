/**
 * compute-daily-metrics.ts
 *
 * Called by the orchestrator after each successful run.
 * Reads prompt_runs for the run's day, aggregates KPI, and upserts
 * a single row into monitoring_daily_metrics.
 *
 * Zero joins — flat queries only.
 */

type CompetitorDayEntry = {
  name: string;
  mentions: number;
  visibility: number;
};

export async function computeAndUpsertDailyMetrics({
  supabase,
  projectId,
  day,
}: {
  supabase: any;
  projectId: string;
  day: string; // YYYY-MM-DD
}) {
  const dayStart = `${day}T00:00:00Z`;
  const dayEnd = `${day}T23:59:59.999Z`;

  // ── 1. All prompt_runs for this project + day (flat, no joins) ──
  const { data: runs } = await supabase
    .from('prompt_runs')
    .select('id, prompt_id, ai_model, brand_mentioned, position_rank, sentiment_label, competitors_mentioned')
    .eq('project_id', projectId)
    .eq('run_type', 'monitoring')
    .eq('status', 'success')
    .gte('scheduled_at', dayStart)
    .lte('scheduled_at', dayEnd);

  const rows = (runs || []) as Array<{
    id: string;
    prompt_id: string;
    ai_model: string | null;
    brand_mentioned: boolean | null;
    position_rank: number | null;
    sentiment_label: string | null;
    competitors_mentioned: string[] | null;
  }>;

  const responsesCount = rows.length;

  // No prompt_runs for this day → nothing to store
  if (responsesCount === 0) {
    return { responsesCount: 0, mentionsCount: 0, visibilityScore: null, avgPosition: null, sentimentScore: null };
  }

  const mentioned = rows.filter((r) => r.brand_mentioned === true);
  const mentionsCount = mentioned.length;

  const visibilityScore = Math.round((mentionsCount / responsesCount) * 100);

  // Position
  const positions = mentioned
    .map((r) => r.position_rank)
    .filter((p): p is number => typeof p === 'number');
  const avgPosition = positions.length > 0
    ? Number((positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1))
    : null;

  // Sentiment
  const positiveCount = mentioned.filter((r) => r.sentiment_label === 'positive').length;
  const neutralCount = mentioned.filter((r) => r.sentiment_label === 'neutral').length;
  const negativeCount = mentioned.filter((r) => r.sentiment_label === 'negative').length;
  const sentimentScore = mentionsCount > 0
    ? Number(((positiveCount - negativeCount) / mentionsCount).toFixed(2))
    : null;

  // Coverage
  const promptIds = new Set(rows.map((r) => r.prompt_id));
  const promptsCovered = promptIds.size;

  const { count: totalPromptsActive } = await supabase
    .from('monitoring_prompts')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('is_active', true);

  // Models
  const modelsUsed = [...new Set(rows.map((r) => r.ai_model).filter(Boolean) as string[])];

  // ── 2. Competitor data ──
  const { data: competitorsData } = await supabase
    .from('competitors')
    .select('name')
    .eq('project_id', projectId);

  const competitorNames = (competitorsData || []).map((c: { name: string }) => c.name);

  const competitorData: CompetitorDayEntry[] = competitorNames.map((name: string) => {
    const compMentions = rows.filter((r) =>
      r.competitors_mentioned?.some((c) => c.toLowerCase() === name.toLowerCase())
    ).length;
    return {
      name,
      mentions: compMentions,
      visibility: responsesCount > 0
        ? Math.round((compMentions / responsesCount) * 100)
        : 0,
    };
  });

  // ── 3. Upsert ──
  const { error } = await supabase
    .from('monitoring_daily_metrics')
    .upsert(
      {
        project_id: projectId,
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
      },
      { onConflict: 'project_id,day' }
    );

  if (error) {
    console.warn('[computeAndUpsertDailyMetrics] upsert error:', error.message);
  }

  return {
    responsesCount,
    mentionsCount,
    visibilityScore,
    avgPosition,
    sentimentScore,
  };
}
