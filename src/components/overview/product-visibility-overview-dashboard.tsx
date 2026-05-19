'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useMemo, useState, useTransition } from 'react';
import {
  ArrowUpRight,
  Bot,
  Clock3,
  Eye,
  Layers3,
  Loader2,
  Package,
  Play,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { OverviewKpiDetailKey, OverviewProviderId, OverviewResponse } from '@/lib/overview/product-visibility-overview';
import {
  formatDateFrLong,
  formatDateTimeFr,
  formatInteger,
  formatNumberFr,
  formatOpportunityLevel,
  formatPercentFr,
  formatProviderLabel,
  formatRanking,
  formatScoreStatus,
} from '@/lib/product-visibility/format';
import { CompetitiveAIPositionChart } from '@/components/overview/competitive-ai-position-chart';
import { cn } from '@/lib/utils';

const RANGES: Array<{ value: OverviewResponse['period']['range']; label: string }> = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
];

const PROVIDERS: Array<{ value: OverviewProviderId; label: string }> = [
  { value: 'all', label: 'Tous les moteurs' },
  { value: 'openai', label: 'ChatGPT' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'perplexity', label: 'Perplexity' },
  { value: 'llama', label: 'Llama' },
  { value: 'grok', label: 'Grok' },
  { value: 'deepseek', label: 'DeepSeek' },
];

type BadgeTone = 'good' | 'warn' | 'bad' | 'neutral';

function formatDelta(value: number | null | undefined, suffix = 'pts') {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (value === 0) return `0 ${suffix}`;
  return `${value > 0 ? '+' : ''}${formatNumberFr(value, Number.isInteger(value) ? 0 : 1)} ${suffix}`;
}

function scoreTone(score: number | null): BadgeTone {
  if (score === null) return 'neutral';
  if (score >= 60) return 'good';
  if (score >= 40) return 'warn';
  return 'bad';
}

function opportunityTone(level: string): BadgeTone {
  if (level === 'high') return 'bad';
  if (level === 'medium') return 'warn';
  return 'good';
}

function providerUiStatus(provider: OverviewResponse['providers'][number]) {
  if (provider.status === 'missing_api_key' || provider.status === 'disabled') {
    return { label: 'Non configuré', tone: 'neutral' as BadgeTone };
  }
  if (provider.status === 'error') return { label: 'Erreur', tone: 'bad' as BadgeTone };
  if (!provider.hasData) return { label: 'Non analysé', tone: 'warn' as BadgeTone };
  if (provider.visibilityScore !== null && provider.visibilityScore < 40) return { label: 'Faible', tone: 'bad' as BadgeTone };
  return { label: 'Connecté', tone: 'good' as BadgeTone };
}

function clampPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function plural(count: number, singular: string, pluralValue: string) {
  return `${count} ${count > 1 ? pluralValue : singular}`;
}

function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-full border px-2.5 text-[11px] font-semibold transition-colors',
        tone === 'good' && 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
        tone === 'warn' && 'border-amber-400/30 bg-amber-400/10 text-amber-200',
        tone === 'bad' && 'border-rose-400/30 bg-rose-400/10 text-rose-200',
        tone === 'neutral' && 'border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] quorum-text-muted',
      )}
    >
      {children}
    </span>
  );
}

function DeltaBadge({ value, invert = false, suffix = 'pts' }: { value?: number | null; invert?: boolean; suffix?: string }) {
  const label = formatDelta(value, suffix);
  if (!label) return <span className="text-xs quorum-text-subtle">—</span>;
  const positive = invert ? Number(value) < 0 : Number(value) > 0;
  const negative = invert ? Number(value) > 0 : Number(value) < 0;
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold',
        positive && 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
        negative && 'border-rose-400/25 bg-rose-400/10 text-rose-200',
        !positive && !negative && 'border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] quorum-text-muted',
      )}
    >
      {label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  return <StatusBadge tone={scoreTone(score)}>{formatScoreStatus(score)}</StatusBadge>;
}

function ProgressBar({ value }: { value: number | null }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--quorum-surface-strong)]">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-700 ease-out',
          value === null ? 'bg-[var(--quorum-border-strong)]' : value >= 60 ? 'bg-emerald-300' : value >= 40 ? 'bg-amber-300' : 'bg-rose-300',
        )}
        style={{ width: `${clampPercent(value)}%` }}
      />
    </div>
  );
}

export function ProductVisibilityOverviewBusinessDashboard({ data }: { data: OverviewResponse }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [activeKpiDetail, setActiveKpiDetail] = useState<OverviewKpiDetailKey | null>(null);

  const selectedProviderRow = data.selectedProvider === 'all'
    ? null
    : data.providers.find((provider) => provider.id === data.selectedProvider);
  const selectedProviderMissing = selectedProviderRow?.status === 'missing_api_key' || selectedProviderRow?.status === 'disabled';
  const noEngineConfigured = data.providers.every((provider) => provider.status === 'missing_api_key' || provider.status === 'disabled');
  const latestProviderRunAt = data.providers
    .map((provider) => provider.lastRunAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] || null;

  const weakestProvider = useMemo(
    () => data.providers
      .filter((provider) => provider.visibilityScore !== null)
      .sort((left, right) => (left.visibilityScore || 0) - (right.visibilityScore || 0))[0] || null,
    [data.providers],
  );
  const leadProviderCount = data.providers.filter(
    (provider) => provider.hasData && (provider.ownedMentions || 0) > (provider.competitorMentions || 0),
  ).length;
  const selectedKpiDetail = activeKpiDetail ? data.kpiDetails[activeKpiDetail] : null;

  const updateFilters = (next: { range?: string; provider?: string }) => {
    const params = new URLSearchParams();
    params.set('range', next.range || data.period.range);
    params.set('provider', next.provider || data.selectedProvider);
    router.push(`/overview?${params.toString()}`);
  };

  const runAnalysis = () => {
    if (!data.state.hasTrackedOffers || !data.state.hasQueries) {
      router.push(data.state.nextAction?.href || '/offers');
      return;
    }

    setRunMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch('/api/overview/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ max_offers: 5, max_prompts: 3 }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || 'Analyse impossible.');
        setRunMessage('Analyse lancée.');
        router.refresh();
      } catch (error) {
        setRunMessage(error instanceof Error ? error.message : 'Analyse impossible.');
      }
    });
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        data={data}
        isPending={isPending}
        onRangeChange={(range) => updateFilters({ range })}
        onProviderChange={(provider) => updateFilters({ provider })}
        onRunAnalysis={runAnalysis}
      />

      {selectedProviderMissing || noEngineConfigured ? (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          {noEngineConfigured ? 'Aucun moteur configuré. Ajoutez une clé API pour lancer une analyse.' : 'Moteur non configuré.'}
        </div>
      ) : null}
      {runMessage ? (
        <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3 text-sm quorum-text-muted">
          {runMessage}
        </div>
      ) : null}

      {!data.state.hasResults ? <EmptyDashboardState data={data} onRunAnalysis={runAnalysis} /> : null}

      <HeroVisibilityScore data={data} leadProviderCount={leadProviderCount} weakestProvider={weakestProvider} />
      <CompetitiveAIPositionChart data={data.competitivePosition} />
      <DecisionRail weakestProvider={weakestProvider} topCompetitor={data.topCompetitors[0] || null} topPriority={data.priorityOffers[0] || null} />

      <VisibilityScoreSplit data={data} />
      <KpiStrip data={data} onOpenDetail={setActiveKpiDetail} />
      {selectedKpiDetail ? <KpiDetailPanel detail={selectedKpiDetail} onClose={() => setActiveKpiDetail(null)} /> : null}

      <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <AiEngineComparison data={data} latestProviderRunAt={latestProviderRunAt} />
        <PriorityActions data={data} onRunAnalysis={runAnalysis} isPending={isPending} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <OfferOutcomeGrid data={data} />
        <VisibleCompetitorsPreview data={data} />
      </section>

      <LastAnalyzedResponse data={data} />
    </div>
  );
}

function DashboardHeader({
  data,
  isPending,
  onRangeChange,
  onProviderChange,
  onRunAnalysis,
}: {
  data: OverviewResponse;
  isPending: boolean;
  onRangeChange: (range: string) => void;
  onProviderChange: (provider: string) => void;
  onRunAnalysis: () => void;
}) {
  return (
    <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] quorum-text-primary md:text-4xl">Vue d’ensemble</h1>
        <p className="mt-2 text-sm quorum-text-muted">Cockpit Product & Service Visibility</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select value={data.period.range} onChange={(event) => onRangeChange(event.target.value)} className="quorum-input min-w-[132px] text-sm" aria-label="Période">
          {RANGES.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
        </select>
        <select value={data.selectedProvider} onChange={(event) => onProviderChange(event.target.value)} className="quorum-input min-w-[184px] text-sm" aria-label="Moteur IA">
          {PROVIDERS.map((provider) => <option key={provider.value} value={provider.value}>{provider.label}</option>)}
        </select>
        <button type="button" className="quorum-btn-primary min-w-[168px] text-sm" onClick={onRunAnalysis} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Lancer l’analyse
        </button>
      </div>
    </section>
  );
}

function HeroVisibilityScore({
  data,
  leadProviderCount,
  weakestProvider,
}: {
  data: OverviewResponse;
  leadProviderCount: number;
  weakestProvider: OverviewResponse['providers'][number] | null;
}) {
  const score = data.kpis.globalVisibilityScore;
  const synthesis = score === null
    ? 'Données insuffisantes.'
    : leadProviderCount > 0
      ? `Vos offres devancent les concurrents sur ${plural(leadProviderCount, 'moteur', 'moteurs')}.`
      : weakestProvider
        ? `Point faible : ${weakestProvider.label}.`
        : 'Visibilité à renforcer.';

  return (
    <section className="quorum-panel-strong overflow-hidden p-6 md:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="quorum-kicker">AI Visibility Score</p>
          <div className="mt-5 flex flex-wrap items-end gap-4">
            <p
              className="font-semibold leading-none tracking-[-0.08em] quorum-text-primary"
              style={{ fontSize: 'clamp(4.5rem, 6.2vw, 6.75rem)' }}
            >
              {score === null ? '—' : formatPercentFr(score, 0)}
            </p>
            <div className="mb-2 flex flex-col gap-2">
              {data.deltas.globalVisibilityScore !== null ? (
                <DeltaBadge value={data.deltas.globalVisibilityScore} />
              ) : null}
            </div>
          </div>
          <p className="mt-5 max-w-xl text-sm font-medium quorum-text-primary">{synthesis}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:w-[430px] lg:grid-cols-1 xl:grid-cols-3">
          <SignalTile icon={Bot} label="Moteur" value={formatProviderLabel(data.selectedProvider)} />
          <SignalTile icon={Clock3} label="Période" value={`${formatDateFrLong(data.period.currentStart)} - ${formatDateFrLong(data.period.currentEnd)}`} />
          <SignalTile icon={Layers3} label="Offres" value={`${formatInteger(data.kpis.trackedOffers)} suivies`} />
        </div>
      </div>
      <div className="mt-7">
        <div className="mb-3 flex justify-end">
          <ScoreBadge score={score} />
        </div>
        <ProgressBar value={score} />
      </div>
    </section>
  );
}

function VisibilityScoreSplit({ data }: { data: OverviewResponse }) {
  const items = [
    {
      title: 'Product Visibility',
      score: data.kpis.productVisibilityScore,
      delta: data.deltas.productVisibilityScore,
      tracked: data.kpis.trackedProducts,
      visible: data.kpis.visibleProducts,
      icon: Package,
      href: '/offers?type=product_category',
    },
    {
      title: 'Service Visibility',
      score: data.kpis.serviceVisibilityScore,
      delta: data.deltas.serviceVisibilityScore,
      tracked: data.kpis.trackedServices,
      visible: data.kpis.visibleServices,
      icon: Sparkles,
      href: '/offers?type=service',
    },
  ];

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.title}
            href={item.href}
            className="quorum-panel p-5 transition hover:border-[color:var(--quorum-border-strong)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="quorum-kicker">{item.title}</p>
                <div className="mt-4 flex items-end gap-3">
                  <p className="text-4xl font-semibold tracking-[-0.05em] quorum-text-primary">
                    {formatPercentFr(item.score, 0)}
                  </p>
                  <div className="mb-1">
                    <DeltaBadge value={item.delta} />
                  </div>
                </div>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)]">
                <Icon className="h-5 w-5 quorum-text-primary" />
              </div>
            </div>
            <div className="mt-5"><ProgressBar value={item.score} /></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <MiniInfo label="Offres suivies" value={formatInteger(item.tracked)} />
              <MiniInfo label="Offres visibles" value={formatInteger(item.visible)} />
            </div>
          </Link>
        );
      })}
    </section>
  );
}

function DecisionRail({
  weakestProvider,
  topCompetitor,
  topPriority,
}: {
  weakestProvider: OverviewResponse['providers'][number] | null;
  topCompetitor: OverviewResponse['topCompetitors'][number] | null;
  topPriority: OverviewResponse['priorityOffers'][number] | null;
}) {
  return (
    <aside className="quorum-panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold quorum-text-primary">Décisions</h2>
        <StatusBadge tone={topPriority ? opportunityTone(topPriority.opportunityLevel) : 'neutral'}>{topPriority ? 'À traiter' : 'Stable'}</StatusBadge>
      </div>
      <div className="space-y-3">
        <DecisionItem icon={TrendingDown} label="Moteur faible" value={weakestProvider?.label || '—'} meta={weakestProvider ? formatPercentFr(weakestProvider.visibilityScore, 0) : 'Non analysé'} />
        <DecisionItem icon={Users} label="Concurrent dominant" value={topCompetitor?.name || '—'} meta={topCompetitor ? `${formatInteger(topCompetitor.mentions)} mentions` : 'Aucun'} />
        <DecisionItem icon={Sparkles} label="Action prioritaire" value={topPriority?.name || '—'} meta={topPriority ? formatProviderLabel(topPriority.aiProvider) : 'Aucune'} />
      </div>
    </aside>
  );
}

function KpiStrip({ data, onOpenDetail }: { data: OverviewResponse; onOpenDetail: (detailKey: OverviewKpiDetailKey) => void }) {
  const kpis = [
    { detailKey: 'trackedOffers' as const, label: 'Offres suivies', value: formatInteger(data.kpis.trackedOffers), delta: null, icon: Layers3, note: 'Actives' },
    { detailKey: 'visibleOffers' as const, label: 'Offres visibles', value: formatInteger(data.kpis.visibleOffers), delta: data.deltas.visibleOffers, icon: Eye, note: 'Citées' },
    { detailKey: 'ownedMentions' as const, label: 'Mentions', value: formatInteger(data.kpis.ownedMentions), delta: data.deltas.ownedMentions, icon: Package, note: 'Vos offres' },
    { detailKey: 'competitorMentions' as const, label: 'Concurrents', value: formatInteger(data.kpis.competitorMentions), delta: data.deltas.competitorMentions, invertDelta: true, icon: Users, note: 'Mentions' },
    { detailKey: 'averagePosition' as const, label: 'Position', value: formatRanking(data.kpis.averagePosition), delta: data.deltas.averagePosition, invertDelta: true, icon: Target, note: 'Moyenne' },
    { detailKey: 'priorityOpportunities' as const, label: 'Opportunités', value: formatInteger(data.kpis.priorityOpportunities), delta: data.deltas.priorityOpportunities, icon: Sparkles, note: 'À traiter' },
  ];

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      {kpis.map((kpi) => <KpiCard key={kpi.detailKey} {...kpi} onOpen={() => onOpenDetail(kpi.detailKey)} />)}
    </section>
  );
}

function KpiCard({
  label,
  value,
  note,
  delta,
  invertDelta,
  icon: Icon,
  onOpen,
}: {
  label: string;
  value: string;
  note: string;
  delta?: number | null;
  invertDelta?: boolean;
  icon: LucideIcon;
  onOpen: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className="quorum-panel group min-h-[132px] w-full p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--quorum-border-strong)] focus:outline-none focus:ring-2 focus:ring-emerald-300/35">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold quorum-text-muted">{label}</p>
        <Icon className="h-4 w-4 quorum-text-subtle transition group-hover:quorum-text-primary" />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] quorum-text-primary">{value}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs quorum-text-subtle">{note}</span>
        <DeltaBadge value={delta} invert={invertDelta} />
      </div>
    </button>
  );
}

function AiEngineComparison({ data, latestProviderRunAt }: { data: OverviewResponse; latestProviderRunAt: string | null }) {
  return (
    <section className="quorum-panel p-5">
      <PanelHeader title="Moteurs IA" action={<span className="text-xs quorum-text-subtle">{formatDateTimeFr(latestProviderRunAt)}</span>} />
      <div className="mt-4 overflow-hidden rounded-2xl border border-[color:var(--quorum-border)]">
        <div className="hidden grid-cols-[1.1fr_0.8fr_1fr_0.9fr] gap-4 border-b border-[color:var(--quorum-border)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] quorum-text-muted md:grid">
          <span>Moteur IA</span><span>Score</span><span>Statut</span><span>Dernière analyse</span>
        </div>
        <div className="divide-y divide-[color:var(--quorum-border)]">
          {data.providers.map((provider) => {
            const status = providerUiStatus(provider);
            const isWeak = provider.visibilityScore !== null && provider.visibilityScore < 40;
            return (
              <div key={provider.id} className="grid gap-3 px-4 py-3 transition hover:bg-[var(--quorum-surface)] md:grid-cols-[1.1fr_0.8fr_1fr_0.9fr] md:items-center md:gap-4">
                <div className="flex items-center justify-between gap-3 md:block">
                  <p className="font-medium quorum-text-primary">{provider.label}</p>
                  {isWeak ? <StatusBadge tone="bad">Faible</StatusBadge> : null}
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2 md:hidden">
                    <span className="text-xs quorum-text-muted">Score</span>
                    <span className="text-sm font-semibold quorum-text-primary">{formatPercentFr(provider.visibilityScore, 0)}</span>
                  </div>
                  <div className="hidden text-sm font-semibold quorum-text-primary md:block">{formatPercentFr(provider.visibilityScore, 0)}</div>
                  <div className="mt-2"><ProgressBar value={provider.visibilityScore} /></div>
                </div>
                <div><StatusBadge tone={status.tone}>{status.label}</StatusBadge></div>
                <p className="text-xs quorum-text-muted">{formatDateTimeFr(provider.lastRunAt)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PriorityActions({ data, isPending, onRunAnalysis }: { data: OverviewResponse; isPending: boolean; onRunAnalysis: () => void }) {
  const priorities = data.priorityOffers.slice(0, 3);
  return (
    <section className="quorum-panel p-5">
      <PanelHeader title="À traiter en priorité" />
      <div className="mt-4 space-y-3">
        {priorities.length > 0 ? priorities.map((offer) => (
          <article key={offer.id} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] p-4 transition hover:border-[color:var(--quorum-border-strong)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold quorum-text-primary">Faible visibilité</p>
                <p className="mt-1 truncate text-sm quorum-text-muted">{offer.name}</p>
              </div>
              <StatusBadge tone={opportunityTone(offer.opportunityLevel)}>{formatOpportunityLevel(offer.opportunityLevel)}</StatusBadge>
            </div>
            <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
              <MiniLine label="Moteur IA" value={formatProviderLabel(offer.aiProvider)} />
              <MiniLine label="Concurrents" value={`${formatInteger(offer.competitorMentions)} mentions`} />
              <MiniLine label="Score" value={formatPercentFr(offer.visibilityScore, 0)} />
            </div>
            <p className="mt-4 line-clamp-2 text-sm quorum-text-primary">{offer.recommendedAction}</p>
            <Link href={`/offers/${offer.id}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold quorum-text-primary hover:underline">
              Voir détail <ArrowUpRight className="h-4 w-4" />
            </Link>
          </article>
        )) : (
          <EmptySmall title={data.state.hasRuns ? 'Aucune priorité détectée.' : 'Aucune analyse lancée.'}>
            <button type="button" onClick={onRunAnalysis} disabled={isPending} className="quorum-btn-secondary mt-4 text-sm">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Lancer l’analyse
            </button>
          </EmptySmall>
        )}
      </div>
    </section>
  );
}

function OfferOutcomeGrid({ data }: { data: OverviewResponse }) {
  const visibleOffers = data.topVisibleOffers.slice(0, 4);
  const invisibleOffers = data.invisibleOffers.slice(0, 4);

  return (
    <section className="quorum-panel p-5">
      <PanelHeader title="Offres visibles / invisibles" action={<Link href="/offers" className="text-sm font-semibold quorum-text-primary hover:underline">Voir toutes</Link>} />
      <div className="mt-4 grid gap-4 2xl:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold quorum-text-primary">Top visibles</p>
            <StatusBadge tone="good">{formatInteger(visibleOffers.length)}</StatusBadge>
          </div>
          <div className="space-y-3">
            {visibleOffers.length > 0 ? visibleOffers.map((offer) => (
              <Link key={offer.id} href={`/offers/${offer.id}`} className="block rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-panel)] p-3 transition hover:border-[color:var(--quorum-border-strong)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold quorum-text-primary">{offer.name}</p>
                    <p className="mt-1 text-xs quorum-text-subtle">{offer.type} · {formatProviderLabel(offer.aiProvider)}</p>
                  </div>
                  <p className="text-sm font-semibold quorum-text-primary">{formatPercentFr(offer.visibilityScore, 0)}</p>
                </div>
                <div className="mt-3"><ProgressBar value={offer.visibilityScore} /></div>
                <p className="mt-2 text-xs quorum-text-muted">
                  {formatInteger(offer.ownedMentions)} mentions · {formatInteger(offer.competitorMentions)} concurrentes
                </p>
              </Link>
            )) : (
              <EmptySmall title="Aucune offre visible sur la période." />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold quorum-text-primary">Invisibles à corriger</p>
            <StatusBadge tone={invisibleOffers.length > 0 ? 'bad' : 'neutral'}>{formatInteger(invisibleOffers.length)}</StatusBadge>
          </div>
          <div className="space-y-3">
            {invisibleOffers.length > 0 ? invisibleOffers.map((offer) => (
              <Link key={offer.id} href={`/offers/${offer.id}`} className="block rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-panel)] p-3 transition hover:border-[color:var(--quorum-border-strong)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold quorum-text-primary">{offer.name}</p>
                    <p className="mt-1 text-xs quorum-text-subtle">{offer.type} · {formatProviderLabel(offer.aiProvider)}</p>
                  </div>
                  <StatusBadge tone="bad">0 mention</StatusBadge>
                </div>
                <p className="mt-3 text-xs quorum-text-muted">
                  {offer.reason}
                </p>
                <p className="mt-2 text-xs quorum-text-primary">
                  Concurrent en tête : {offer.topCompetitor || 'non identifié'} · {formatInteger(offer.competitorMentions)} mentions
                </p>
              </Link>
            )) : (
              <EmptySmall title="Aucune offre invisible détectée." />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function VisibleCompetitorsPreview({ data }: { data: OverviewResponse }) {
  return (
    <section className="quorum-panel p-5">
      <PanelHeader title="Concurrents qui gagnent" action={<Link href="/concurrents" className="text-sm font-semibold quorum-text-primary hover:underline">Voir détail</Link>} />
      <div className="mt-4 space-y-3">
        {data.topCompetitors.slice(0, 5).map((competitor) => (
          <div key={competitor.name} className="grid gap-3 rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium quorum-text-primary">{competitor.name}</p>
              <p className="mt-1 truncate text-xs quorum-text-subtle">{competitor.categories.join(', ') || 'Catégorie non renseignée'}</p>
            </div>
            <p className="text-sm font-semibold quorum-text-primary">{formatInteger(competitor.mentions)} mentions</p>
            <div className="text-xs quorum-text-muted">
              <span>{formatProviderLabel(competitor.dominantProvider)}</span>
              <span className="mx-2 quorum-text-subtle">·</span>
              <span>Écart {formatNumberFr(competitor.gapVsOwned)}</span>
            </div>
          </div>
        ))}
        {data.topCompetitors.length === 0 ? <EmptySmall title="Aucun concurrent visible." /> : null}
      </div>
    </section>
  );
}

function LastAnalyzedResponse({ data }: { data: OverviewResponse }) {
  const response = data.sampleResponse;
  return (
    <section className="quorum-panel p-5">
      <PanelHeader title="Dernière réponse analysée" />
      {response ? (
        <div className="mt-4 rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] p-4">
          <div className="grid gap-3 text-xs sm:grid-cols-4">
            <MiniLine label="Moteur IA" value={formatProviderLabel(response.aiProvider)} />
            <MiniLine label="Date" value={formatDateTimeFr(response.date)} />
            <MiniLine label="Vos offres" value={response.detectedOwnedOffers.join(', ') || 'Aucune'} />
            <MiniLine label="Marques détectées" value={response.detectedBrands.slice(0, 4).join(', ') || 'Aucune'} />
          </div>
          <div className="mt-4 rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-panel)] px-4 py-3">
            <p className="line-clamp-2 text-sm font-medium quorum-text-primary">{response.question}</p>
            <p className="mt-3 line-clamp-4 text-sm leading-relaxed quorum-text-muted">{response.excerpt}</p>
          </div>
          {response.responseId ? (
            <Link href="/offers" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold quorum-text-primary hover:underline">
              Voir le détail <ArrowUpRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="mt-4"><EmptySmall title="Aucune réponse analysée." /></div>
      )}
    </section>
  );
}

function EmptyDashboardState({ data, onRunAnalysis }: { data: OverviewResponse; onRunAnalysis: () => void }) {
  let title = 'Données insuffisantes.';
  let action: ReactNode = null;

  if (!data.state.hasTrackedOffers) {
    title = 'Aucune offre suivie.';
    action = (
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href="/offers" className="quorum-btn-primary text-sm">Ajouter une offre</Link>
        <Link href="/product-visibility/sources" className="quorum-btn-secondary text-sm">Importer un catalogue</Link>
      </div>
    );
  } else if (!data.state.hasQueries) {
    title = 'Aucune question d’achat.';
    action = <Link href="/offers" className="quorum-btn-primary mt-5 text-sm">Générer les questions</Link>;
  } else if (!data.state.hasRuns) {
    title = 'Aucune analyse lancée.';
    action = <button type="button" onClick={onRunAnalysis} className="quorum-btn-primary mt-5 text-sm">Lancer l’analyse</button>;
  } else if (!data.state.hasResults) {
    title = 'Aucune offre détectée.';
    action = (
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href="/offers" className="quorum-btn-primary text-sm">Enrichir les offres</Link>
        <Link href="/concurrents" className="quorum-btn-secondary text-sm">Voir les concurrents</Link>
      </div>
    );
  }

  return (
    <section className="quorum-panel p-8 text-center">
      <p className="text-lg font-semibold quorum-text-primary">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm quorum-text-muted">{data.state.nextAction?.label || 'Lancez une analyse pour afficher les scores.'}</p>
      {action}
    </section>
  );
}

function KpiDetailPanel({ detail, onClose }: { detail: OverviewResponse['kpiDetails'][OverviewKpiDetailKey]; onClose: () => void }) {
  return (
    <section className="quorum-panel-strong p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="quorum-kicker">Détail</p>
          <h2 className="mt-2 text-xl font-semibold quorum-text-primary">{detail.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed quorum-text-muted">{detail.explanation}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={detail.href} className="quorum-btn-primary text-sm">
            {detail.ctaLabel} <ArrowUpRight className="h-4 w-4" />
          </Link>
          <button type="button" onClick={onClose} className="quorum-btn-secondary p-2.5" aria-label="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <MiniInfo label="Calcul" value={detail.formula} />
        <MiniInfo label="Source" value={detail.source} />
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[color:var(--quorum-border)]">
        {detail.rows.length > 0 ? (
          <div className="divide-y divide-[color:var(--quorum-border)]">
            {detail.rows.map((row, index) => {
              const content = (
                <div className="flex flex-col gap-2 px-4 py-3 transition hover:bg-[var(--quorum-surface)] sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium quorum-text-primary">{row.label}</p>
                    <p className="mt-1 line-clamp-2 text-xs quorum-text-muted">{row.description}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2 text-sm font-semibold quorum-text-primary">
                    {row.value}
                    {row.href ? <ArrowUpRight className="h-3.5 w-3.5 quorum-text-muted" /> : null}
                  </div>
                </div>
              );
              return row.href ? <Link key={`${row.label}-${index}`} href={row.href}>{content}</Link> : <div key={`${row.label}-${index}`}>{content}</div>;
            })}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm quorum-text-muted">{detail.emptyMessage}</div>
        )}
      </div>
    </section>
  );
}

function PanelHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-lg font-semibold tracking-[-0.02em] quorum-text-primary">{title}</h2>
      {action}
    </div>
  );
}

function SignalTile({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] p-4">
      <Icon className="h-4 w-4 quorum-text-subtle" />
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] quorum-text-muted">{label}</p>
      <p className="mt-1 line-clamp-2 text-sm font-semibold quorum-text-primary">{value}</p>
    </div>
  );
}

function DecisionItem({ icon: Icon, label, value, meta }: { icon: LucideIcon; label: string; value: string; meta: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] p-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[color:var(--quorum-border)] bg-[var(--quorum-panel)]">
        <Icon className="h-4 w-4 quorum-text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs quorum-text-muted">{label}</p>
        <p className="truncate text-sm font-semibold quorum-text-primary">{value}</p>
      </div>
      <span className="ml-auto flex-shrink-0 text-xs quorum-text-subtle">{meta}</span>
    </div>
  );
}

function MiniLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] quorum-text-muted">{label}</p>
      <p className="mt-1 line-clamp-2 font-medium quorum-text-primary">{value}</p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] quorum-text-muted">{label}</p>
      <p className="mt-2 text-sm quorum-text-primary">{value}</p>
    </div>
  );
}

function EmptySmall({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-4 py-6 text-center text-sm quorum-text-muted">
      <p>{title}</p>
      {children}
    </div>
  );
}
