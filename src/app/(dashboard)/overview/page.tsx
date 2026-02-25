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

type TopicAgg = {
  topic_id: string;
  runs: number;
  mentions: number;
  positive: number;
  neutral: number;
  negative: number;
  positionSum: number;
  positionCount: number;
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

function extractDomains(text: string | null) {
  if (!text) return [];
  const urls = text.match(/https?:\/\/[^\s)]+/g) || [];
  return urls
    .map((u) => u.replace(/^https?:\/\//, '').split('/')[0].toLowerCase())
    .filter(Boolean);
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
      <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-10 text-center text-zinc-400">
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
  /*  F. Topics performance (flat query, no joins)                 */
  /* ══════════════════════════════════════════════════════════════ */

  const { data: topicsData } = await supabase
    .from('monitoring_topics')
    .select('id, name')
    .eq('project_id', projectId);
  const topicNameMap = new Map<string, string>(
    (topicsData || []).map((t: { id: string; name: string | null }) => [t.id, t.name || 'Topic'])
  );

  // Flat prompt_runs with topic — single simple query
  const topicQuery = async (startDate: string) => {
    const { data } = await supabase
      .from('prompt_runs')
      .select('prompt_id, brand_mentioned, position_rank, sentiment_label')
      .eq('project_id', projectId)
      .eq('run_type', 'monitoring')
      .eq('status', 'success')
      .gte('scheduled_at', `${startDate}T00:00:00Z`);

    const rows = (data || []) as Array<{
      prompt_id: string;
      brand_mentioned: boolean | null;
      position_rank: number | null;
      sentiment_label: string | null;
    }>;

    // Get prompt→topic mapping
    const { data: promptRows } = await supabase
      .from('monitoring_prompts')
      .select('id, topic_id')
      .eq('project_id', projectId);
    const promptTopicMap = new Map<string, string>(
      (promptRows || [])
        .filter((p: { id: string; topic_id: string | null }) => p.topic_id)
        .map((p: { id: string; topic_id: string }) => [p.id, p.topic_id])
    );

    const aggs = new Map<string, TopicAgg>();
    for (const r of rows) {
      const topicId = promptTopicMap.get(r.prompt_id);
      if (!topicId) continue;
      const a = aggs.get(topicId) || {
        topic_id: topicId,
        runs: 0, mentions: 0, positive: 0, neutral: 0, negative: 0,
        positionSum: 0, positionCount: 0,
      };
      a.runs += 1;
      if (r.brand_mentioned) {
        a.mentions += 1;
        if (r.sentiment_label === 'positive') a.positive += 1;
        else if (r.sentiment_label === 'negative') a.negative += 1;
        else a.neutral += 1;
        if (typeof r.position_rank === 'number') {
          a.positionSum += r.position_rank;
          a.positionCount += 1;
        }
      }
      aggs.set(topicId, a);
    }

    return Array.from(aggs.values()).map((a) => ({
      topicId: a.topic_id,
      name: topicNameMap.get(a.topic_id) || 'Topic',
      visibilityRate: a.runs > 0 ? Math.round((a.mentions / a.runs) * 100) : null,
      sentimentPositive: a.mentions > 0 ? Math.round((a.positive / a.mentions) * 100) : null,
      avgPosition: a.positionCount > 0 ? Number((a.positionSum / a.positionCount).toFixed(1)) : null,
      mentions: a.mentions,
      runs: a.runs,
    })).sort((a, b) => (b.visibilityRate || 0) - (a.visibilityRate || 0));
  };

  const topicMetrics7 = await topicQuery(start7);
  const topicMetrics30 = await topicQuery(start30);

  /* ══════════════════════════════════════════════════════════════ */
  /*  G. Insights (domains from monitoring_responses raw_text)     */
  /* ══════════════════════════════════════════════════════════════ */

  const { data: recentResponses } = await supabase
    .from('monitoring_responses')
    .select('raw_text')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(50);

  const domains = (recentResponses || []).flatMap((r: { raw_text: string | null }) =>
    extractDomains(r.raw_text)
  );
  const domainCounts: Record<string, number> = {};
  for (const d of domains) {
    domainCounts[d] = (domainCounts[d] || 0) + 1;
  }
  const topDomains = Object.entries(domainCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([d]) => d);

  // Top prompts (from prompt_runs + monitoring_prompts)
  const { data: mentionedPR } = await supabase
    .from('prompt_runs')
    .select('prompt_id')
    .eq('project_id', projectId)
    .eq('run_type', 'monitoring')
    .eq('brand_mentioned', true)
    .gte('scheduled_at', `${start30}T00:00:00Z`);

  const promptIdCounts: Record<string, number> = {};
  for (const r of (mentionedPR || []) as Array<{ prompt_id: string }>) {
    promptIdCounts[r.prompt_id] = (promptIdCounts[r.prompt_id] || 0) + 1;
  }
  const topPromptIds = Object.entries(promptIdCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([id]) => id);

  const { data: promptTexts } = topPromptIds.length > 0
    ? await supabase
        .from('monitoring_prompts')
        .select('id, prompt_text')
        .in('id', topPromptIds)
    : { data: [] };
  const promptTextMap = new Map<string, string>(
    ((promptTexts || []) as Array<{ id: string; prompt_text: string }>).map((p) => [p.id, p.prompt_text])
  );
  const topPrompts: string[] = topPromptIds.map((id) => promptTextMap.get(id) || 'Prompt');

  const actions = [
    topDomains[0]
      ? { title: 'Renforcer la présence', detail: `Améliorer votre visibilité sur ${topDomains[0]}.` }
      : { title: 'Renforcer la présence', detail: 'Travaillez la visibilité sur des sources reconnues.' },
    topPrompts[0]
      ? { title: 'Optimiser un prompt clé', detail: `Renforcer le contenu lié à "${topPrompts[0]}".` }
      : { title: 'Optimiser un prompt clé', detail: 'Créer des contenus qui répondent aux requêtes principales.' },
  ];

  /* ══════════════════════════════════════════════════════════════ */
  /*  H. Sandbox snippets (keep existing logic, flat query)        */
  /* ══════════════════════════════════════════════════════════════ */

  const { data: sandboxRunsData } = await supabase
    .from('prompt_runs')
    .select('id, scheduled_at, ai_model')
    .eq('project_id', projectId)
    .eq('run_type', 'sandbox')
    .order('scheduled_at', { ascending: false })
    .limit(3);

  const sandboxIds = (sandboxRunsData || []).map((r: { id: string }) => r.id);
  const { data: sandboxAnswers } = sandboxIds.length > 0
    ? await supabase
        .from('ai_answers')
        .select('prompt_run_id, raw_answer_text')
        .in('prompt_run_id', sandboxIds)
    : { data: [] };
  const answerMap = new Map(
    (sandboxAnswers || []).map((a: { prompt_run_id: string; raw_answer_text: string | null }) => [a.prompt_run_id, a.raw_answer_text])
  );

  const { data: sandboxVersions } = sandboxIds.length > 0
    ? await supabase
        .from('prompt_runs')
        .select('id, prompt_version_id')
        .in('id', sandboxIds)
    : { data: [] };
  const versionIds = (sandboxVersions || [])
    .map((r: { prompt_version_id: string | null }) => r.prompt_version_id)
    .filter(Boolean) as string[];
  const { data: versionTexts } = versionIds.length > 0
    ? await supabase
        .from('prompt_versions')
        .select('id, prompt_text')
        .in('id', versionIds)
    : { data: [] };
  const versionTextMap = new Map(
    (versionTexts || []).map((v: { id: string; prompt_text: string }) => [v.id, v.prompt_text])
  );
  const versionIdMap = new Map(
    (sandboxVersions || []).map((r: { id: string; prompt_version_id: string | null }) => [r.id, r.prompt_version_id])
  );

  const sandboxSnippets = (sandboxRunsData || []).map((r: { id: string; scheduled_at: string; ai_model: string | null }) => ({
    prompt: versionTextMap.get(versionIdMap.get(r.id) || '') || 'Prompt',
    response: answerMap.get(r.id) || '',
    model: r.ai_model,
    createdAt: r.scheduled_at,
  }));

  /* ══════════════════════════════════════════════════════════════ */
  /*  Render                                                       */
  /* ══════════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Overview</h1>
          <p className="text-zinc-400 mt-1">Marque active: {activeProject.name}</p>
        </div>
        <ExportButtons />
      </div>

      <OverviewKpiCards
        visibilityRate={visibility7}
        sentimentPositive={sentimentPositive}
        avgPosition={avgPosition}
        coverage={{
          runsPerPrompt: completedRunsCount || 0,
          promptCount: totalPromptsActive,
          modelsUsed,
          lastRunAt,
        }}
      />

      {!hasMonitoringData && (
        <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-8 text-center text-zinc-400">
          Aucune analyse quotidienne détectée.
          <div className="mt-4 flex items-center justify-center gap-3">
            <ExportButtons />
          </div>
        </div>
      )}

      <CompetitiveSnapshot trendData={trendData} trendBrands={trendBrands} leaderboard={leaderboard} />

      <TopicPerformance data7={topicMetrics7} data30={topicMetrics30} />

      <div className="grid gap-6 md:grid-cols-2">
        <InsightsWhyModule
          topDomains={topDomains}
          topPrompts={topPrompts}
          actions={actions}
        />
        <UserSimulationSnippets snippets={sandboxSnippets} />
      </div>
    </div>
  );
}
