import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { OverviewKpiCards } from '@/components/overview/overview-kpi-cards';
import { CompetitiveSnapshot } from '@/components/overview/competitive-snapshot';
import { InsightsWhyModule } from '@/components/overview/insights-why-module';
import { UserSimulationSnippets } from '@/components/overview/user-simulation-snippets';
import { TopicPerformance } from '@/components/overview/topic-performance';
import Link from 'next/link';

type MonitoringRunRow = {
  scheduled_at: string;
  ai_model: string | null;
  brand_mentioned: boolean | null;
  position_rank: number | null;
  sentiment_label: string | null;
  competitors_mentioned: string[] | null;
  prompt: { topic_id: string | null } | null;
  prompt_version: { prompt_text: string } | null;
  answers: Array<{ raw_answer_text: string | null }> | null;
};

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function extractDomains(text: string | null) {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s)]+/g;
  const urls = text.match(urlRegex) || [];
  return urls
    .map((url) => url.replace(/^https?:\/\//, '').split('/')[0].toLowerCase())
    .filter(Boolean);
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const activeProject = await getActiveProjectForUser(user.id);
  if (!activeProject) {
    return (
      <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-10 text-center text-zinc-400">
        Aucun projet actif. Créez votre marque pour commencer.
      </div>
    );
  }

  const now = new Date();
  const start30Date = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const start7Date = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const start30 = start30Date.toISOString();
  const start7 = start7Date.toISOString();

  const { data: monitoringRunsData } = await supabase
    .from('prompt_runs')
    .select('scheduled_at, ai_model, brand_mentioned, position_rank, sentiment_label, competitors_mentioned, prompt:monitoring_prompts(topic_id), prompt_version:prompt_versions(prompt_text), answers:ai_answers(raw_answer_text)')
    .eq('project_id', activeProject.id)
    .eq('run_type', 'monitoring')
    .gte('scheduled_at', start30)
    .order('scheduled_at', { ascending: true });

  const monitoringRuns = (monitoringRunsData || []) as MonitoringRunRow[];

  const { data: competitorsData } = await supabase
    .from('competitors')
    .select('name')
    .eq('project_id', activeProject.id);

  const competitorNames = (competitorsData || []).map((c: { name: string }) => c.name);

  const { data: sandboxRunsData } = await supabase
    .from('prompt_runs')
    .select('scheduled_at, ai_model, prompt_version:prompt_versions(prompt_text), answers:ai_answers(raw_answer_text)')
    .eq('project_id', activeProject.id)
    .eq('run_type', 'sandbox')
    .order('scheduled_at', { ascending: false })
    .limit(3);

  const sandboxRuns = (sandboxRunsData || []) as Array<{
    scheduled_at: string;
    ai_model: string | null;
    prompt_version: { prompt_text: string } | null;
    answers: Array<{ raw_answer_text: string | null }> | null;
  }>;

  const hasMonitoringData = monitoringRuns.length > 0;

  const { data: topicsData } = await supabase
    .from('monitoring_topics')
    .select('id, name')
    .eq('project_id', activeProject.id);

  const topicNameMap = new Map((topicsData || []).map((t: { id: string; name: string }) => [t.id, t.name]));

  const aggregateTopicMetrics = (rows: MonitoringRunRow[], startDateStr: string) => {
    const filtered = rows.filter((row) => row.scheduled_at >= startDateStr);
    const aggregates = new Map<string, {
      name: string;
      runs: number;
      mentions: number;
      positive: number;
      neutral: number;
      negative: number;
      positionSum: number;
      positionMentions: number;
    }>();

    for (const row of filtered) {
      const topicId = row.prompt?.topic_id;
      if (!topicId) continue;
      const existing = aggregates.get(topicId) || {
        name: topicNameMap.get(topicId) || 'Topic',
        runs: 0,
        mentions: 0,
        positive: 0,
        neutral: 0,
        negative: 0,
        positionSum: 0,
        positionMentions: 0,
      };
      existing.runs += 1;
      if (row.brand_mentioned) {
        existing.mentions += 1;
        if (row.sentiment_label === 'positive') existing.positive += 1;
        else if (row.sentiment_label === 'negative') existing.negative += 1;
        else existing.neutral += 1;
        if (typeof row.position_rank === 'number') {
          existing.positionSum += row.position_rank;
          existing.positionMentions += 1;
        }
      }
      aggregates.set(topicId, existing);
    }

    return Array.from(aggregates.entries()).map(([topicId, entry]) => ({
      topicId,
      name: entry.name,
      visibilityRate: entry.runs > 0 ? Math.round((entry.mentions / entry.runs) * 100) : null,
      sentimentPositive: entry.mentions > 0 ? Math.round((entry.positive / entry.mentions) * 100) : null,
      avgPosition: entry.positionMentions > 0 ? Number((entry.positionSum / entry.positionMentions).toFixed(1)) : null,
      mentions: entry.mentions,
      runs: entry.runs,
    })).sort((a, b) => (b.visibilityRate || 0) - (a.visibilityRate || 0));
  };

  const topicMetrics7 = aggregateTopicMetrics(monitoringRuns, start7);
  const topicMetrics30 = aggregateTopicMetrics(monitoringRuns, start30);

  const trendMap = new Map<string, { mentions: number; total: number }>();
  monitoringRuns.forEach((item) => {
    const key = item.scheduled_at.slice(0, 10);
    const entry = trendMap.get(key) || { mentions: 0, total: 0 };
    entry.total += 1;
    if (item.brand_mentioned) entry.mentions += 1;
    trendMap.set(key, entry);
  });

  const trendData = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entry]) => ({
      date: formatShortDate(date),
      visibilityRate: entry.total > 0 ? Math.round((entry.mentions / entry.total) * 100) : 0,
    }));

  const items7d = monitoringRuns.filter((i) => i.scheduled_at >= start7);
  const mention7 = items7d.filter((i) => i.brand_mentioned).length;
  const visibility7 = items7d.length > 0 ? Math.round((mention7 / items7d.length) * 100) : null;

  const mentionedItems = monitoringRuns.filter((i) => i.brand_mentioned);
  const positiveCount = mentionedItems.filter((i) => i.sentiment_label === 'positive').length;
  const sentimentPositive = mentionedItems.length > 0
    ? Math.round((positiveCount / mentionedItems.length) * 100)
    : null;

  const positions = mentionedItems.map((i) => i.position_rank).filter((p): p is number => typeof p === 'number');
  const avgPosition = positions.length > 0
    ? Number((positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1))
    : null;

  const totalRuns = monitoringRuns.length;
  const mainMentions = mentionedItems.length;
  const mainVisibility = totalRuns > 0 ? Math.round((mainMentions / totalRuns) * 100) : null;

  const competitorStats = competitorNames.map((name) => {
    const mentions = monitoringRuns.filter((i) =>
      i.competitors_mentioned?.some((c) => c.toLowerCase() === name.toLowerCase())
    ).length;
    return {
      brand: name,
      visibilityRate: totalRuns > 0 ? Math.round((mentions / totalRuns) * 100) : null,
      avgSentiment: null,
      avgPosition: null,
      mentions,
      runs: totalRuns,
    };
  });

  const leaderboard = [
    {
      brand: activeProject.name,
      visibilityRate: mainVisibility,
      avgSentiment: sentimentPositive,
      avgPosition,
      mentions: mainMentions,
      runs: totalRuns,
    },
    ...competitorStats,
  ].sort((a, b) => (b.visibilityRate || 0) - (a.visibilityRate || 0));

  const modelSet = new Set(monitoringRuns.map((i) => i.ai_model).filter(Boolean) as string[]);
  const domains = monitoringRuns.flatMap((i) => {
    const answerText = i.answers?.[0]?.raw_answer_text ?? null;
    return extractDomains(answerText);
  });
  const domainCounts = domains.reduce((acc, domain) => {
    acc[domain] = (acc[domain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([domain]) => domain);

  const promptCounts = monitoringRuns.reduce((acc, item) => {
    if (item.brand_mentioned) {
      const promptText = item.prompt_version?.prompt_text || 'Prompt';
      acc[promptText] = (acc[promptText] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  const topPrompts = Object.entries(promptCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([prompt]) => prompt);

  const { count: promptCount } = await supabase
    .from('monitoring_prompts')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', activeProject.id)
    .eq('is_active', true);

  const lastRunAt = monitoringRuns.length > 0
    ? monitoringRuns[monitoringRuns.length - 1].scheduled_at
    : null;

  const actions = [
    topDomains[0]
      ? { title: 'Renforcer la présence', detail: `Améliorer votre visibilité sur ${topDomains[0]}.` }
      : { title: 'Renforcer la présence', detail: 'Travaillez la visibilité sur des sources reconnues.' },
    topPrompts[0]
      ? { title: 'Optimiser un prompt clé', detail: `Renforcer le contenu lié à “${topPrompts[0]}”.` }
      : { title: 'Optimiser un prompt clé', detail: 'Créer des contenus qui répondent aux requêtes principales.' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Overview</h1>
          <p className="text-zinc-400 mt-1">Marque active: {activeProject.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/prompts"
            className="px-4 py-2 rounded-xl border border-white/10 text-sm text-zinc-300 hover:bg-white/5"
          >
            Configurer le monitoring
          </Link>
          <Link
            href="/analyses"
            className="px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:opacity-90"
          >
            Lancer une analyse manuelle
          </Link>
        </div>
      </div>

      <OverviewKpiCards
        visibilityRate={visibility7}
        sentimentPositive={sentimentPositive}
        avgPosition={avgPosition}
        coverage={{
          runsPerPrompt: modelSet.size,
          promptCount: promptCount || 0,
          modelsUsed: Array.from(modelSet),
          lastRunAt,
        }}
      />

      {!hasMonitoringData && (
        <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-8 text-center text-zinc-400">
          Aucune analyse quotidienne détectée.
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link href="/prompts" className="px-4 py-2 rounded-xl border border-white/10 text-sm text-zinc-300 hover:bg-white/5">
              Configurer les prompts
            </Link>
            <Link href="/analyses" className="px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:opacity-90">
              Lancer une analyse manuelle
            </Link>
          </div>
        </div>
      )}

      <CompetitiveSnapshot trendData={trendData} leaderboard={leaderboard} />

      <TopicPerformance data7={topicMetrics7} data30={topicMetrics30} />

      <div className="grid gap-6 md:grid-cols-2">
        <InsightsWhyModule
          topDomains={topDomains}
          topPrompts={topPrompts}
          actions={actions}
        />
        <UserSimulationSnippets
          snippets={sandboxRuns.map((s) => ({
            prompt: s.prompt_version?.prompt_text || 'Prompt',
            response: s.answers?.[0]?.raw_answer_text || '',
            model: s.ai_model,
            createdAt: s.scheduled_at,
          }))}
        />
      </div>
    </div>
  );
}
