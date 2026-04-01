import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { OverviewKpiCards } from '@/components/overview/overview-kpi-cards';
import { CompetitiveSnapshot } from '@/components/overview/competitive-snapshot';
import { InsightsWhyModule } from '@/components/overview/insights-why-module';
import { UserSimulationSnippets } from '@/components/overview/user-simulation-snippets';
import { TopicPerformance } from '@/components/overview/topic-performance';
import { ExportButtons } from '@/components/overview/export-buttons';

/* ────────────────────────────────────────────────────────────────── */
/*  Types                                                            */
/* ────────────────────────────────────────────────────────────────── */

type DailyMetric = {
  day: string;
  responses_count: number;
  mentions_count: number;
  visibility_score: number | null;
  avg_position: number | null;
  sentiment_score: number | null;
  positive_count: number;
  neutral_count: number;
  negative_count: number;
  prompts_covered: number;
  total_prompts_active: number;
  models_used: string[];
  competitor_data: Array<{ name: string; mentions: number; visibility: number }>;
};

/* ────────────────────────────────────────────────────────────────── */
/*  Helpers                                                          */
/* ────────────────────────────────────────────────────────────────── */

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function normalizeVisibilityScore(raw: unknown): number {
  const numeric = Number(raw ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric >= 0 && numeric <= 1) return Math.round(numeric * 100);
  return numeric;
}

/* ────────────────────────────────────────────────────────────────── */
/*  Page                                                             */
/* ────────────────────────────────────────────────────────────────── */

export default async function OverviewPage() {
  // 1. Auth
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) redirect('/login');

  const activeProject = await getActiveProjectForUser(user.id);
  if (!activeProject) {
    return (
      <div className="rounded-3xl border quorum-border-default quorum-surface-strong p-10 text-center text-zinc-400">
        Aucun projet actif. Créez votre marque pour commencer.
      </div>
    );
  }

  // 2. Admin client for all data (bypass RLS — safe after auth check)
  const supabase = createAdminClient();
  const projectId = activeProject.id;

  const now = new Date();
  const start30 = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const start7 = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);

  // Shared competitors list (used by fallback + leaderboard + trend legend)
  const { data: competitorsData } = await supabase
    .from('competitors')
    .select('name')
    .eq('project_id', projectId);
  const competitorNames = (competitorsData || []).map((c: { name: string }) => c.name);

  /* ══════════════════════════════════════════════════════════════ */
  /*  A. Try monitoring_daily_metrics first (industrialised path)  */
  /* ══════════════════════════════════════════════════════════════ */

  let dailyRows: DailyMetric[] = [];
  try {
    const { data } = await supabase
      .from('monitoring_daily_metrics')
      .select('*')
      .eq('project_id', projectId)
      .gte('day', start30)
      .order('day', { ascending: true });
    dailyRows = (data || []) as DailyMetric[];
  } catch {
    // Table may not exist yet — fall through to fallback
  }

  /* ══════════════════════════════════════════════════════════════ */
  /*  B. Fallback: build metrics from flat prompt_runs queries     */
  /* ══════════════════════════════════════════════════════════════ */

  const buildDailyRowsFromPromptRuns = async () => {
    const dayStart = `${start30}T00:00:00Z`;
    const { data: prData } = await supabase
      .from('prompt_runs')
      .select('scheduled_at, ai_model, prompt_id, brand_mentioned, position_rank, sentiment_label, competitors_mentioned')
      .eq('project_id', projectId)
      .eq('run_type', 'monitoring')
      .eq('status', 'success')
      .gte('scheduled_at', dayStart)
      .order('scheduled_at', { ascending: true });

    const flatRuns = (prData || []) as Array<{
      scheduled_at: string;
      ai_model: string | null;
      prompt_id: string;
      brand_mentioned: boolean | null;
      position_rank: number | null;
      sentiment_label: string | null;
      competitors_mentioned: string[] | null;
    }>;

    // Get prompt count
    const { count: promptCount } = await supabase
      .from('monitoring_prompts')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('is_active', true);

    // Group by day
    const byDay = new Map<string, typeof flatRuns>();
    for (const r of flatRuns) {
      const day = r.scheduled_at.slice(0, 10);
      const list = byDay.get(day) || [];
      list.push(r);
      byDay.set(day, list);
    }

    const builtRows: DailyMetric[] = [];
    for (const [day, rows] of byDay.entries()) {
      const mentioned = rows.filter((r) => r.brand_mentioned === true);
      const positions = mentioned
        .map((r) => r.position_rank)
        .filter((p): p is number => typeof p === 'number');
      const pos = mentioned.filter((r) => r.sentiment_label === 'positive').length;
      const neu = mentioned.filter((r) => r.sentiment_label === 'neutral').length;
      const neg = mentioned.filter((r) => r.sentiment_label === 'negative').length;

      const compEntries = competitorNames.map((name: string) => {
        const m = rows.filter((r) =>
          r.competitors_mentioned?.some((c) => c.toLowerCase() === name.toLowerCase())
        ).length;
        return { name, mentions: m, visibility: rows.length > 0 ? Math.round((m / rows.length) * 100) : 0 };
      });

      builtRows.push({
        day,
        responses_count: rows.length,
        mentions_count: mentioned.length,
        visibility_score: rows.length > 0 ? Math.round((mentioned.length / rows.length) * 100) : null,
        avg_position: positions.length > 0 ? Number((positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1)) : null,
        sentiment_score: mentioned.length > 0 ? Number(((pos - neg) / mentioned.length).toFixed(2)) : null,
        positive_count: pos,
        neutral_count: neu,
        negative_count: neg,
        prompts_covered: new Set(rows.map((r) => r.prompt_id)).size,
        total_prompts_active: promptCount || 0,
        models_used: [...new Set(rows.map((r) => r.ai_model).filter(Boolean) as string[])],
        competitor_data: compEntries,
      });
    }
    builtRows.sort((a, b) => a.day.localeCompare(b.day));
    return builtRows;
  };

  // If monitoring_daily_metrics exists but is sparse (e.g., only today),
  // rebuild from prompt_runs to restore full historical trend.
  const fallbackRows = await buildDailyRowsFromPromptRuns();
  if (dailyRows.length === 0 || fallbackRows.length > dailyRows.length) {
    dailyRows = fallbackRows;
  }

  /* ══════════════════════════════════════════════════════════════ */
  /*  C. Aggregate KPI from dailyRows                              */
  /* ══════════════════════════════════════════════════════════════ */

  const hasMonitoringData = dailyRows.length > 0;

  // --- 7-day slice ---
  const rows7 = dailyRows.filter((r) => r.day >= start7);
  const total7 = rows7.reduce((s, r) => s + r.responses_count, 0);
  const mentions7 = rows7.reduce((s, r) => s + r.mentions_count, 0);
  const visibility7 = total7 > 0 ? Math.round((mentions7 / total7) * 100) : null;

  // --- 30-day slice ---
  const total30 = dailyRows.reduce((s, r) => s + r.responses_count, 0);
  const mentions30 = dailyRows.reduce((s, r) => s + r.mentions_count, 0);

  // Sentiment (30d, weighted)
  const pos30 = dailyRows.reduce((s, r) => s + r.positive_count, 0);
  const neg30 = dailyRows.reduce((s, r) => s + r.negative_count, 0);
  const sentimentScore = mentions30 > 0
    ? Number(((pos30 - neg30) / mentions30).toFixed(2))
    : null;
  const sentimentPositive = mentions30 > 0
    ? Math.round((pos30 / mentions30) * 100)
    : null;

  // Position = net rank of own brand vs competitors based on mention counts (30d)
  // Build a leaderboard: own brand + each competitor sorted by total mentions desc
  const brandMentions30 = mentions30;
  const competitorMentions30 = competitorNames.map((name: string) => {
    let total = 0;
    for (const dr of dailyRows) {
      const entry = dr.competitor_data?.find(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );
      if (entry) total += entry.mentions;
    }
    return { name, mentions: total };
  });
  const mentionsLeaderboard = [
    { name: activeProject.name, mentions: brandMentions30 },
    ...competitorMentions30,
  ].sort((a, b) => b.mentions - a.mentions);
  const brandRankIndex = mentionsLeaderboard.findIndex(
    (e) => e.name === activeProject.name
  );
  const avgPosition = brandMentions30 > 0 ? brandRankIndex + 1 : null;

  // Coverage
  const latestDay = dailyRows.length > 0 ? dailyRows[dailyRows.length - 1] : null;
  const promptsCovered = latestDay?.prompts_covered ?? 0;
  const totalPromptsActive = latestDay?.total_prompts_active ?? 0;
  const modelsUsed = latestDay?.models_used ?? [];
  const coverageRate = totalPromptsActive > 0
    ? Math.round((promptsCovered / totalPromptsActive) * 100)
    : null;

  // Last run
  const { data: latestRun } = await supabase
    .from('monitoring_runs')
    .select('finished_at')
    .eq('project_id', projectId)
    .in('status', ['success', 'partial'])
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastRunAt = latestRun?.finished_at ?? null;

  // Completed runs count (30d)
  const { count: completedRunsCount } = await supabase
    .from('monitoring_runs')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .in('status', ['success', 'partial'])
    .gte('finished_at', `${start30}T00:00:00Z`);

  /* ══════════════════════════════════════════════════════════════ */
  /*  D. Trend data (for chart)                                    */
  /* ══════════════════════════════════════════════════════════════ */

  // Multi-brand trend: own brand + each competitor per day
  // Only include days that actually have responses (skip days with 0 responses)
  const trendData = dailyRows
    .filter((r) => r.responses_count > 0)
    .map((r) => {
      const visibility = normalizeVisibilityScore(r.visibility_score);
      const point: Record<string, string | number> = {
        date: formatShortDate(r.day),
        [activeProject.name]: visibility,
      };
      for (const c of r.competitor_data || []) {
        point[c.name] = c.visibility;
      }
      return point;
    });

  // Brand names for chart legend
  const trendBrands = [activeProject.name, ...competitorNames];

  /* ══════════════════════════════════════════════════════════════ */
  /*  E. Competitive leaderboard                                   */
  /* ══════════════════════════════════════════════════════════════ */

  // Aggregate competitor data across daily rows
  const mainVisibility = total30 > 0 ? Math.round((mentions30 / total30) * 100) : null;

  // Delta: current 7d vs previous 7d
  const start14 = new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
  const rowsPrev7 = dailyRows.filter((r) => r.day >= start14 && r.day < start7);
  const totalPrev7 = rowsPrev7.reduce((s, r) => s + r.responses_count, 0);
  const mentionsPrev7 = rowsPrev7.reduce((s, r) => s + r.mentions_count, 0);
  const visPrev7 = totalPrev7 > 0 ? Math.round((mentionsPrev7 / totalPrev7) * 100) : null;
  const mainDelta = visibility7 !== null && visPrev7 !== null ? visibility7 - visPrev7 : null;

  // --- Previous 7d sentiment (for KPI trend) ---
  const posPrev7 = rowsPrev7.reduce((s, r) => s + r.positive_count, 0);
  const negPrev7 = rowsPrev7.reduce((s, r) => s + r.negative_count, 0);
  const mentionsPrev7Total = rowsPrev7.reduce((s, r) => s + r.mentions_count, 0);
  const sentimentPrev7 = mentionsPrev7Total > 0 ? Math.round((posPrev7 / mentionsPrev7Total) * 100) : null;

  // --- Current 7d sentiment ---
  const pos7 = rows7.reduce((s, r) => s + r.positive_count, 0);
  const mentions7Total = rows7.reduce((s, r) => s + r.mentions_count, 0);
  const sentiment7 = mentions7Total > 0 ? Math.round((pos7 / mentions7Total) * 100) : null;

  // --- Previous 7d rank (for KPI trend) ---
  const brandMentions7 = mentions7;
  const brandMentionsPrev7 = mentionsPrev7;
  const competitorMentions7: Array<{ name: string; m7: number; mPrev7: number }> = competitorNames.map((name: string) => {
    let m7 = 0;
    let mPrev7 = 0;
    for (const dr of dailyRows) {
      const entry = dr.competitor_data?.find(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );
      if (entry) {
        if (dr.day >= start7) m7 += entry.mentions;
        if (dr.day >= start14 && dr.day < start7) mPrev7 += entry.mentions;
      }
    }
    return { name, m7, mPrev7 };
  });

  const leaderboard7 = [
    { name: activeProject.name, mentions: brandMentions7 },
    ...competitorMentions7.map((c) => ({ name: c.name, mentions: c.m7 })),
  ].sort((a, b) => b.mentions - a.mentions);
  const rank7 = brandMentions7 > 0
    ? leaderboard7.findIndex((e) => e.name === activeProject.name) + 1
    : null;

  const leaderboardPrev7 = [
    { name: activeProject.name, mentions: brandMentionsPrev7 },
    ...competitorMentions7.map((c) => ({ name: c.name, mentions: c.mPrev7 })),
  ].sort((a, b) => b.mentions - a.mentions);
  const rankPrev7 = brandMentionsPrev7 > 0
    ? leaderboardPrev7.findIndex((e) => e.name === activeProject.name) + 1
    : null;

  const competitorStats = competitorNames.map((name: string) => {
    let compMentions = 0;
    let compMentions7 = 0;
    let compMentionsPrev7 = 0;
    for (const dr of dailyRows) {
      const entry = dr.competitor_data?.find(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );
      if (entry) {
        compMentions += entry.mentions;
        if (dr.day >= start7) compMentions7 += entry.mentions;
        if (dr.day >= start14 && dr.day < start7) compMentionsPrev7 += entry.mentions;
      }
    }
    const vis7 = total7 > 0 ? Math.round((compMentions7 / total7) * 100) : null;
    const visPrev = totalPrev7 > 0 ? Math.round((compMentionsPrev7 / totalPrev7) * 100) : null;
    return {
      brand: name,
      visibilityRate: total30 > 0 ? Math.round((compMentions / total30) * 100) : null,
      delta: vis7 !== null && visPrev !== null ? vis7 - visPrev : null,
      avgSentiment: null as number | null,
      avgPosition: null as number | null, // filled below from mentionsLeaderboard
      mentions: compMentions,
      runs: total30,
    };
  });

  // Build leaderboard with net rank for every brand
  const leaderboardUnsorted = [
    {
      brand: activeProject.name,
      visibilityRate: mainVisibility,
      delta: mainDelta,
      avgSentiment: sentimentPositive,
      avgPosition,
      mentions: mentions30,
      runs: total30,
    },
    ...competitorStats,
  ];
  // Assign rank to each competitor from mentionsLeaderboard
  for (const row of leaderboardUnsorted) {
    const idx = mentionsLeaderboard.findIndex(
      (e) => e.name.toLowerCase() === row.brand.toLowerCase()
    );
    if (idx >= 0 && row.mentions > 0) {
      row.avgPosition = idx + 1;
    }
  }
  const leaderboard = leaderboardUnsorted.sort((a, b) => (b.visibilityRate || 0) - (a.visibilityRate || 0));

  /* ══════════════════════════════════════════════════════════════ */
  /*  F. Per-prompt performance + Themes detection                 */
  /* ══════════════════════════════════════════════════════════════ */

  // Fetch all active prompts
  const { data: allPromptsData } = await supabase
    .from('monitoring_prompts')
    .select('id, prompt_text, topic_id, is_active')
    .eq('project_id', projectId)
    .eq('is_active', true);
  const allPrompts = (allPromptsData || []) as Array<{
    id: string; prompt_text: string; topic_id: string | null; is_active: boolean;
  }>;

  // Fetch prompt_runs for 30d (we'll slice for 7d too)
  const { data: allPromptRuns30 } = await supabase
    .from('prompt_runs')
    .select('prompt_id, brand_mentioned, scheduled_at, competitors_mentioned')
    .eq('project_id', projectId)
    .eq('run_type', 'monitoring')
    .eq('status', 'success')
    .gte('scheduled_at', `${start30}T00:00:00Z`)
    .order('scheduled_at', { ascending: false });

  const promptRuns30 = (allPromptRuns30 || []) as Array<{
    prompt_id: string;
    brand_mentioned: boolean | null;
    scheduled_at: string;
    competitors_mentioned: string[] | null;
  }>;

  // Per-prompt aggregation
  const promptPerformance = allPrompts.map((p) => {
    const runs = promptRuns30.filter((r) => r.prompt_id === p.id);
    const brandWins = runs.filter((r) => r.brand_mentioned === true).length;
    const visibility = runs.length > 0 ? Math.round((brandWins / runs.length) * 100) : 0;

    // Trend: last 3 runs vs previous 3 runs
    const sorted = [...runs].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
    const last3 = sorted.slice(0, 3);
    const prev3 = sorted.slice(3, 6);
    const last3Rate = last3.length > 0 ? last3.filter((r) => r.brand_mentioned === true).length / last3.length : 0;
    const prev3Rate = prev3.length > 0 ? prev3.filter((r) => r.brand_mentioned === true).length / prev3.length : 0;
    const diff = last3Rate - prev3Rate;
    const trend: 'up' | 'stable' | 'down' = diff > 0.15 ? 'up' : diff < -0.15 ? 'down' : 'stable';

    // Collect competitors from all runs of this prompt
    const competitorsSet = new Set<string>();
    for (const r of runs) {
      for (const c of r.competitors_mentioned || []) competitorsSet.add(c);
    }

    return {
      promptId: p.id,
      promptText: p.prompt_text,
      runs: runs.length,
      brandWins,
      visibility,
      trend,
      competitors: [...competitorsSet],
    };
  }).sort((a, b) => b.visibility - a.visibility);

  // Theme detection from prompt texts
  const themeRules: Array<{ name: string; icon: string; keywords: string[] }> = [
    { name: 'Prix / Compétitivité', icon: '💰', keywords: ['prix', 'moins cher', 'économique', 'cout', 'budget', 'tarif', 'pas cher'] },
    { name: 'Distribution BtoB', icon: '🏢', keywords: ['btob', 'b2b', 'distributeur', 'professionnel', 'entreprise', 'fourniture'] },
    { name: 'E-commerce', icon: '🛒', keywords: ['ecommerce', 'e-commerce', 'commande en ligne', 'livraison', 'achat en ligne', 'site web'] },
    { name: 'Alternatif Amazon', icon: '📦', keywords: ['alternative', 'amazon', 'marketplace'] },
    { name: 'Leaders / Marché', icon: '🏆', keywords: ['leader', 'meilleur', 'top', 'classement', 'recommande', 'principal'] },
  ];

  const detectedThemes = themeRules.map((theme) => {
    const matchingPrompts = promptPerformance.filter((p) =>
      theme.keywords.some((kw) => p.promptText.toLowerCase().includes(kw))
    );
    if (matchingPrompts.length === 0) return null;
    const avgVis = matchingPrompts.length > 0
      ? Math.round(matchingPrompts.reduce((s, p) => s + p.visibility, 0) / matchingPrompts.length)
      : 0;
    return {
      name: theme.name,
      icon: theme.icon,
      promptCount: matchingPrompts.length,
      avgVisibility: avgVis,
    };
  }).filter(Boolean) as Array<{ name: string; icon: string; promptCount: number; avgVisibility: number }>;

  // Legacy topic metrics (keep for backward compat)
  const { data: topicsData } = await supabase
    .from('monitoring_topics')
    .select('id, name')
    .eq('project_id', projectId);
  const topicNameMap = new Map<string, string>(
    (topicsData || []).map((t: { id: string; name: string | null }) => [t.id, t.name || 'Topic'])
  );

  /* ══════════════════════════════════════════════════════════════ */
  /*  G. Insights — real citations + dynamic recommendations       */
  /* ══════════════════════════════════════════════════════════════ */

  // Top owned domains from citations (brand_mentioned=true)
  const { data: ownedCitationData } = await supabase
    .from('citations')
    .select('domain_id, brand_mentioned, domain:sources_domains(domain, category)')
    .eq('project_id', projectId)
    .eq('brand_mentioned', true)
    .eq('is_fallback', false)
    .gte('created_at', `${start30}T00:00:00Z`);

  const ownedDomainCounts: Record<string, { count: number; category: string }> = {};
  for (const c of (ownedCitationData || []) as Array<{ domain: { domain: string; category: string } | null }>) {
    const d = c.domain?.domain;
    if (!d) continue;
    if (!ownedDomainCounts[d]) ownedDomainCounts[d] = { count: 0, category: c.domain?.category || 'third_party' };
    ownedDomainCounts[d].count++;
  }
  const insightTopDomains = Object.entries(ownedDomainCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 3)
    .map(([domain, info]) => ({ domain, count: info.count, category: info.category }));

  // Top prompts by best visibility (reuse promptPerformance)
  const insightTopPrompts = promptPerformance
    .filter((p) => p.visibility > 0)
    .slice(0, 3)
    .map((p) => ({
      text: p.promptText,
      visibility: p.visibility,
      runs: p.runs,
    }));

  // Owned media percentage
  const totalCitationCount = Object.values(ownedDomainCounts).reduce((s, d) => s + d.count, 0);
  const ownedCitationCount = Object.values(ownedDomainCounts).filter((d) => d.category === 'owned').reduce((s, d) => s + d.count, 0);
  // Need ALL citation domain data for accurate owned %
  const { data: allCitDomains } = await supabase
    .from('citations')
    .select('domain:sources_domains(domain, category)')
    .eq('project_id', projectId)
    .eq('is_fallback', false)
    .gte('created_at', `${start30}T00:00:00Z`);
  let allCitTotal = 0;
  let allCitOwned = 0;
  for (const c of (allCitDomains || []) as Array<{ domain: { domain: string; category: string } | null }>) {
    allCitTotal++;
    if (c.domain?.category === 'owned') allCitOwned++;
  }
  const ownedPercent = allCitTotal > 0 ? Math.round((allCitOwned / allCitTotal) * 100) : 0;

  // Dynamic recommendations
  const insightActions: Array<{ title: string; detail: string; type: 'warning' | 'info' | 'success' }> = [];

  // Rule 1: prompt with 0% visibility
  const worstPrompt = promptPerformance.find((p) => p.visibility === 0 && p.runs > 0);
  if (worstPrompt) {
    const truncated = worstPrompt.promptText.length > 50
      ? worstPrompt.promptText.slice(0, 50) + '...'
      : worstPrompt.promptText;
    insightActions.push({
      title: 'Optimiser un prompt clé',
      detail: `Aucune visibilité sur "${truncated}". Créez du contenu ciblant cette requête.`,
      type: 'warning',
    });
  }

  // Rule 2: competitor leading on a prompt
  const competitorLeading = promptPerformance.find((p) => p.visibility === 0 && p.competitors.length > 0);
  if (competitorLeading) {
    const comp = competitorLeading.competitors[0];
    const truncated = competitorLeading.promptText.length > 40
      ? competitorLeading.promptText.slice(0, 40) + '...'
      : competitorLeading.promptText;
    insightActions.push({
      title: `Contrer ${comp}`,
      detail: `Il vous devance sur "${truncated}". Renforcez votre contenu sur ce sujet.`,
      type: 'warning',
    });
  }

  // Rule 3: owned media < 30%
  if (ownedPercent < 30 && allCitTotal > 0) {
    insightActions.push({
      title: 'Renforcer la présence owned',
      detail: `Seulement ${ownedPercent}% de citations owned. Publiez du contenu sur ${(activeProject as any).website || 'votre site'}.`,
      type: 'warning',
    });
  }

  // Rule 4: fallback positive
  if (insightActions.length === 0) {
    const vis = mainVisibility ?? 0;
    if (vis >= 50) {
      insightActions.push({
        title: 'Maintenir la dynamique',
        detail: 'Visibilité solide. Continuez à enrichir vos contenus sur les prompts actifs.',
        type: 'success',
      });
    } else {
      insightActions.push({
        title: 'Créer du contenu IA-optimisé',
        detail: 'Publiez des pages qui répondent directement aux questions posées aux IA sur votre marché.',
        type: 'info',
      });
    }
  }

  /* ══════════════════════════════════════════════════════════════ */
  /*  H. Simulation — real monitoring AI response with highlights  */
  /* ══════════════════════════════════════════════════════════════ */

  // Find latest monitoring prompt_run where brand_mentioned=true + has answer
  const { data: simRunData } = await supabase
    .from('prompt_runs')
    .select('id, prompt_id, scheduled_at, ai_model, brand_mentioned, competitors_mentioned')
    .eq('project_id', projectId)
    .eq('run_type', 'monitoring')
    .eq('status', 'success')
    .eq('brand_mentioned', true)
    .order('scheduled_at', { ascending: false })
    .limit(10);

  let simulationData: {
    promptText: string;
    answerText: string;
    brandMentioned: boolean;
    competitors: string[];
    model: string;
    date: string;
  } | null = null;

  if (simRunData && simRunData.length > 0) {
    // Get ai_answers for these runs and find one with actual text
    const simRunIds = simRunData.map((r: any) => r.id);
    const { data: simAnswers } = await supabase
      .from('ai_answers')
      .select('prompt_run_id, raw_answer_text')
      .in('prompt_run_id', simRunIds);

    const simAnswerMap = new Map<string, string>(
      (simAnswers || []).map((a: any) => [a.prompt_run_id, a.raw_answer_text ?? ''])
    );

    // Find first run that has a non-empty answer
    for (const run of simRunData as any[]) {
      const answerText = simAnswerMap.get(run.id) || '';
      if (answerText.length > 50) {
        // Get prompt text
        const prompt = allPrompts.find((p) => p.id === run.prompt_id);
        simulationData = {
          promptText: prompt?.prompt_text || 'Prompt',
          answerText,
          brandMentioned: run.brand_mentioned === true,
          competitors: run.competitors_mentioned || [],
          model: run.ai_model || 'gpt-4o',
          date: run.scheduled_at,
        };
        break;
      }
    }
  }

  // Fallback: try any run (not just brand_mentioned=true) if no result
  if (!simulationData) {
    const { data: simFallback } = await supabase
      .from('prompt_runs')
      .select('id, prompt_id, scheduled_at, ai_model, brand_mentioned, competitors_mentioned')
      .eq('project_id', projectId)
      .eq('run_type', 'monitoring')
      .eq('status', 'success')
      .order('scheduled_at', { ascending: false })
      .limit(5);

    if (simFallback && simFallback.length > 0) {
      const fbIds = simFallback.map((r: any) => r.id);
      const { data: fbAnswers } = await supabase
        .from('ai_answers')
        .select('prompt_run_id, raw_answer_text')
        .in('prompt_run_id', fbIds);
      const fbMap = new Map<string, string>((fbAnswers || []).map((a: any) => [a.prompt_run_id, a.raw_answer_text ?? '']));
      for (const run of simFallback as any[]) {
        const txt = fbMap.get(run.id) || '';
        if (txt.length > 50) {
          const prompt = allPrompts.find((p) => p.id === run.prompt_id);
          simulationData = {
            promptText: prompt?.prompt_text || 'Prompt',
            answerText: txt,
            brandMentioned: run.brand_mentioned === true,
            competitors: run.competitors_mentioned || [],
            model: run.ai_model || 'gpt-4o',
            date: run.scheduled_at,
          };
          break;
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════ */
  /*  Render                                                       */
  /* ══════════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-8">
      <div className="quorum-panel-strong flex flex-col gap-5 p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="quorum-kicker">Overview</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.05em] quorum-text-primary">Pilotage de la visibilité IA</h1>
          <p className="mt-2 text-sm quorum-text-muted">Marque active: {activeProject.name}</p>
        </div>
        <ExportButtons />
      </div>

      <OverviewKpiCards
        visibilityRate={visibility7}
        visibilityPrev={visPrev7}
        sentimentPositive={sentiment7}
        sentimentPrev={sentimentPrev7}
        avgPosition={rank7}
        avgPositionPrev={rankPrev7}
        coverage={{
          runsPerPrompt: completedRunsCount || 0,
          promptCount: totalPromptsActive,
          modelsUsed,
          lastRunAt,
        }}
      />

      {!hasMonitoringData && (
        <div className="quorum-panel p-8 text-center quorum-text-muted">
          Aucune analyse quotidienne détectée.
          <div className="mt-4 flex items-center justify-center gap-3">
            <ExportButtons />
          </div>
        </div>
      )}

      <CompetitiveSnapshot trendData={trendData} trendBrands={trendBrands} leaderboard={leaderboard} avg7={visibility7} brandName={activeProject.name} />

      <TopicPerformance
        promptPerformance={promptPerformance}
        detectedThemes={detectedThemes}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <InsightsWhyModule
          topDomains={insightTopDomains}
          topPrompts={insightTopPrompts}
          actions={insightActions}
          ownedPercent={ownedPercent}
        />
        <UserSimulationSnippets
          simulation={simulationData}
          brandName={activeProject.name}
        />
      </div>
    </div>
  );
}
