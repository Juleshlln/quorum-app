import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { OverviewKpiCards } from '@/components/overview/overview-kpi-cards';
import { CompetitiveSnapshot } from '@/components/overview/competitive-snapshot';
import { InsightsWhyModule } from '@/components/overview/insights-why-module';
import { UserSimulationSnippets } from '@/components/overview/user-simulation-snippets';
import Link from 'next/link';

type AnalysisItemRow = {
  created_at: string;
  prompt_text: string;
  ai_response: string | null;
  ai_model: string | null;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  sentiment_label: string | null;
  competitors_mentioned: string[];
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
  const start30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: trendItemsData } = await supabase
    .from('analysis_items')
    .select('created_at, prompt_text, ai_response, ai_model, brand_mentioned, brand_position, sentiment_label, competitors_mentioned, analysis:analyses!inner(project_id, analysis_mode)')
    .eq('analysis.project_id', activeProject.id)
    .eq('analysis.kind', 'scheduled')
    .eq('analysis.analysis_mode', 'trend')
    .gte('created_at', start30)
    .order('created_at', { ascending: true });

  const trendItems = (trendItemsData || []) as AnalysisItemRow[];

  const { data: competitorsData } = await supabase
    .from('competitors')
    .select('name')
    .eq('project_id', activeProject.id);

  const competitorNames = (competitorsData || []).map((c: { name: string }) => c.name);

  const { data: latestTrendAnalysis } = await supabase
    .from('analyses')
    .select('created_at, run_count, total_prompts')
    .eq('project_id', activeProject.id)
    .eq('kind', 'scheduled')
    .eq('analysis_mode', 'trend')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: simulationItemsData } = await supabase
    .from('analysis_items')
    .select('prompt_text, ai_response, ai_model, created_at, analysis:analyses!inner(project_id, analysis_mode)')
    .eq('analysis.project_id', activeProject.id)
    .eq('analysis.kind', 'sandbox')
    .eq('analysis.analysis_mode', 'simulation')
    .order('created_at', { ascending: false })
    .limit(3);

  const simulationItems = (simulationItemsData || []) as AnalysisItemRow[];
  const hasMonitoringData = trendItems.length > 0;

  const trendMap = new Map<string, { mentions: number; total: number }>();
  trendItems.forEach((item) => {
    const key = item.created_at.slice(0, 10);
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

  const items7d = trendItems.filter((i) => i.created_at >= start7);
  const mention7 = items7d.filter((i) => i.brand_mentioned).length;
  const visibility7 = items7d.length > 0 ? Math.round((mention7 / items7d.length) * 100) : null;

  const mentionedItems = trendItems.filter((i) => i.brand_mentioned);
  const positiveCount = mentionedItems.filter((i) => i.sentiment_label === 'positive').length;
  const sentimentPositive = mentionedItems.length > 0
    ? Math.round((positiveCount / mentionedItems.length) * 100)
    : null;

  const positions = mentionedItems.map((i) => i.brand_position).filter((p): p is number => typeof p === 'number');
  const avgPosition = positions.length > 0
    ? Number((positions.reduce((a, b) => a + b, 0) / positions.length).toFixed(1))
    : null;

  const totalRuns = trendItems.length;
  const mainMentions = mentionedItems.length;
  const mainVisibility = totalRuns > 0 ? Math.round((mainMentions / totalRuns) * 100) : null;

  const competitorStats = competitorNames.map((name) => {
    const mentions = trendItems.filter((i) =>
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

  const modelSet = new Set(trendItems.map((i) => i.ai_model).filter(Boolean) as string[]);
  const domains = trendItems.flatMap((i) => extractDomains(i.ai_response));
  const domainCounts = domains.reduce((acc, domain) => {
    acc[domain] = (acc[domain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([domain]) => domain);

  const promptCounts = trendItems.reduce((acc, item) => {
    if (item.brand_mentioned) {
      acc[item.prompt_text] = (acc[item.prompt_text] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  const topPrompts = Object.entries(promptCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([prompt]) => prompt);

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
          runsPerPrompt: latestTrendAnalysis?.run_count || 5,
          promptCount: latestTrendAnalysis?.total_prompts || 0,
          modelsUsed: Array.from(modelSet),
          lastRunAt: latestTrendAnalysis?.created_at || null,
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

      <div className="grid gap-6 md:grid-cols-2">
        <InsightsWhyModule
          topDomains={topDomains}
          topPrompts={topPrompts}
          actions={actions}
        />
        <UserSimulationSnippets
          snippets={simulationItems.map((s) => ({
            prompt: s.prompt_text,
            response: s.ai_response || '',
            model: s.ai_model,
            createdAt: s.created_at,
          }))}
        />
      </div>
    </div>
  );
}
