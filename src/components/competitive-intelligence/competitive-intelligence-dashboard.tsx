import { Layers3, Radar, Sparkles, SplitSquareVertical } from 'lucide-react';
import { CompetitiveComparisonChart } from '@/components/competitive-intelligence/competitive-comparison-chart';
import { PromptHeatmap } from '@/components/competitive-intelligence/prompt-heatmap';

type CompetitiveIntelligenceDashboardProps = {
  windowLabel: string;
  brandName: string;
  overview: {
    shareOfAnswer: Array<{
      brand: string;
      share: number;
      mentions: number;
    }>;
    shareOfClickableSurface: {
      brand: number;
      competitors: number;
      thirdParty: number;
    };
    sourceOwnershipGap: Array<{
      domain: string;
      brandCitations: number;
      competitorCitations: number;
      gap: number;
      priority: 'high' | 'medium' | 'low';
    }>;
    competitorSourceOverlap: Array<{
      competitor: string;
      overlap: number;
      sharedDomains: number;
      competitorOnlyDomains: number;
      brandOnlyDomains: number;
    }>;
    promptLevelCompetitiveMap: Array<{
      promptId: string;
      promptText: string;
      topicId: string | null;
      topicName: string | null;
      totalRuns: number;
      brandShare: number;
      competitorPresence: number;
      topCompetitor: string | null;
      topCompetitorShare: number;
      ownedClickableShare: number;
      sourceOverlap: number;
      priority: 'high' | 'medium' | 'low';
    }>;
    visibilityVolatilityIndex: number;
    opportunityGapSummary: Array<{
      id: string;
      title: string;
      summary: string;
      priority: 'high' | 'medium' | 'low';
      metric: string;
      value: number;
    }>;
  };
};

function priorityClass(priority: 'high' | 'medium' | 'low') {
  if (priority === 'high') return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
  if (priority === 'medium') return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
  return 'border-zinc-400/20 bg-zinc-400/10 text-zinc-300';
}

function ShareCard({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: typeof Layers3;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="quorum-panel p-5">
      <div className="flex items-center justify-between">
        <p className="quorum-kicker">{title}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)]">
          <Icon className="h-4 w-4 quorum-text-primary" />
        </div>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-[-0.04em] quorum-text-primary">{value}</p>
      <p className="mt-2 text-sm quorum-text-muted">{detail}</p>
    </div>
  );
}

export function CompetitiveIntelligenceDashboard({
  windowLabel,
  brandName,
  overview,
}: CompetitiveIntelligenceDashboardProps) {
  const brandShare = overview.shareOfAnswer.find((entry) => entry.brand === brandName)?.share || 0;

  return (
    <div className="space-y-6">
      <section className="quorum-panel-strong overflow-hidden p-6 md:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="quorum-kicker">Competitive Intelligence</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] quorum-text-primary md:text-4xl">
              Transformer les réponses IA en carte d’opportunités concurrentielles.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed quorum-text-muted">
              Les métriques ci-dessous décrivent la présence dans les réponses, la surface cliquable et les gaps de sources sans masquer leur nature probabiliste.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="quorum-soft-badge">{windowLabel}</span>
            <span className="quorum-soft-badge">Actionable competitive map</span>
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ShareCard
            icon={Layers3}
            title="Share of answer"
            value={`${brandShare}%`}
            detail="Part des réponses monitorées où la marque apparaît."
          />
          <ShareCard
            icon={SplitSquareVertical}
            title="Clickable surface"
            value={`${overview.shareOfClickableSurface.brand}%`}
            detail="Part de la surface cliquable captée par vos URLs possédées."
          />
          <ShareCard
            icon={Radar}
            title="Source overlap"
            value={`${overview.competitorSourceOverlap[0]?.overlap || 0}%`}
            detail="Chevauchement moyen des sources non-owned avec le concurrent le plus proche."
          />
          <ShareCard
            icon={Sparkles}
            title="Volatility index"
            value={`${overview.visibilityVolatilityIndex}`}
            detail="Amplitude moyenne des variations jour par jour du share of answer."
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <CompetitiveComparisonChart data={overview.shareOfAnswer.slice(0, 8)} />

        <div className="quorum-panel p-6">
          <div className="mb-5">
            <p className="quorum-kicker">Share of Clickable Surface</p>
            <h2 className="mt-2 text-lg font-semibold quorum-text-primary">Répartition des citations cliquables</h2>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Brand-owned', value: overview.shareOfClickableSurface.brand, color: '#34d399' },
              { label: 'Competitor-owned', value: overview.shareOfClickableSurface.competitors, color: '#fb923c' },
              { label: 'Third-party', value: overview.shareOfClickableSurface.thirdParty, color: '#94a3b8' },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="quorum-text-primary">{item.label}</span>
                  <span className="quorum-text-primary">{item.value}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/5">
                  <div
                    className="h-2.5 rounded-full"
                    style={{ width: `${item.value}%`, background: item.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PromptHeatmap rows={overview.promptLevelCompetitiveMap.slice(0, 10)} />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <div className="quorum-panel p-6">
          <div className="mb-5">
            <p className="quorum-kicker">Source Overlap</p>
            <h2 className="mt-2 text-lg font-semibold quorum-text-primary">Overlap et ownership gaps</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.18em] quorum-text-muted">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Competitor</th>
                  <th className="pb-3 pr-4 font-medium">Overlap</th>
                  <th className="pb-3 pr-4 font-medium">Shared</th>
                  <th className="pb-3 pr-4 font-medium">Competitor-only</th>
                </tr>
              </thead>
              <tbody>
                {overview.competitorSourceOverlap.length > 0 ? overview.competitorSourceOverlap.map((row) => (
                  <tr key={row.competitor} className="border-t border-[color:var(--quorum-border)]">
                    <td className="py-4 pr-4 font-medium quorum-text-primary">{row.competitor}</td>
                    <td className="py-4 pr-4 quorum-text-primary">{row.overlap}%</td>
                    <td className="py-4 pr-4 quorum-text-primary">{row.sharedDomains}</td>
                    <td className="py-4 pr-4 quorum-text-primary">{row.competitorOnlyDomains}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center quorum-text-muted">
                      Aucun overlap compétitif calculé pour cette période.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-3">
            {overview.sourceOwnershipGap.slice(0, 6).map((gap) => (
              <div
                key={gap.domain}
                className="rounded-[22px] border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium quorum-text-primary">{gap.domain}</p>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${priorityClass(gap.priority)}`}>
                    {gap.priority}
                  </span>
                </div>
                <p className="mt-2 text-xs quorum-text-muted">
                  Gap {gap.gap} • brand {gap.brandCitations} vs competitors {gap.competitorCitations}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="quorum-panel p-6">
          <div className="mb-5">
            <p className="quorum-kicker">Opportunity Gaps</p>
            <h2 className="mt-2 text-lg font-semibold quorum-text-primary">Priorités actionnables</h2>
          </div>
          <div className="space-y-3">
            {overview.opportunityGapSummary.length > 0 ? overview.opportunityGapSummary.map((card) => (
              <div
                key={card.id}
                className="rounded-[22px] border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium quorum-text-primary">{card.title}</p>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${priorityClass(card.priority)}`}>
                    {card.priority}
                  </span>
                </div>
                <p className="mt-2 text-sm quorum-text-muted">{card.summary}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] quorum-text-muted">
                  {card.metric} • {card.value}
                </p>
              </div>
            )) : (
              <div className="rounded-[22px] border border-dashed border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-5 text-sm quorum-text-muted">
                Aucune opportunité prioritaire détectée pour la période sélectionnée.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
