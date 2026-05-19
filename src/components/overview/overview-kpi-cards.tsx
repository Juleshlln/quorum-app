'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowUp, ArrowDown, Equal } from 'lucide-react';

type CoverageMeta = {
  runsPerPrompt: number;
  promptCount: number;
  modelsUsed: string[];
  lastRunAt?: string | null;
};

type OverviewKpisProps = {
  visibilityRate: number | null;
  visibilityPrev?: number | null;
  sentimentScore: number | null;
  sentimentPrev?: number | null;
  sentimentLabel?: 'positive' | 'neutral' | 'negative' | null;
  sentimentMentions?: number;
  avgPosition: number | null;
  avgPositionPrev?: number | null;
  coverage: CoverageMeta;
};

type KpiMethodKey = 'visibility' | 'sentiment' | 'rank' | 'coverage';

/* ── Color helpers ────────────────────────────── */

function visibilityColor(value: number): string {
  if (value >= 75) return '#34d399';   // green
  if (value >= 60) return '#fbbf24';   // yellow
  if (value >= 40) return '#fb923c';   // orange
  return '#f87171';                     // red
}

/* ── Trend logic ──────────────────────────────── */

type Trend = 'up' | 'stable' | 'down' | null;

function computeTrend(current: number | null, prev: number | null): Trend {
  if (current === null || prev === null) return null;
  if (current > prev) return 'up';
  if (current < prev) return 'down';
  return 'stable';
}

/** For rank: lower is better, so inverted logic */
function computeRankTrend(current: number | null, prev: number | null): Trend {
  if (current === null || prev === null) return null;
  if (current < prev) return 'up';    // improved (e.g. 3→2)
  if (current > prev) return 'down';  // degraded (e.g. 2→3)
  return 'stable';
}

function TrendBadge({ trend }: { trend: Trend }) {
  if (!trend) return null;

  if (trend === 'up') {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ color: '#34d399', background: 'rgba(52,211,153,0.12)' }}>
        <ArrowUp className="h-3 w-3" />
      </span>
    );
  }
  if (trend === 'down') {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ color: '#f87171', background: 'rgba(248,113,113,0.12)' }}>
        <ArrowDown className="h-3 w-3" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ color: 'var(--quorum-subtle)', background: 'var(--quorum-surface)' }}>
      <Equal className="h-3 w-3" />
    </span>
  );
}

function MethodPanel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border quorum-border-default quorum-surface px-4 py-3 text-xs leading-relaxed quorum-text-muted">
      {children}
    </div>
  );
}

function KpiCard({
  methodKey,
  activeMethod,
  onToggle,
  strong = false,
  children,
  method,
}: {
  methodKey: KpiMethodKey;
  activeMethod: KpiMethodKey | null;
  onToggle: (methodKey: KpiMethodKey) => void;
  strong?: boolean;
  children: ReactNode;
  method: ReactNode;
}) {
  const isOpen = activeMethod === methodKey;

  return (
    <button
      type="button"
      className={`${strong ? 'quorum-panel-strong' : 'quorum-panel'} block w-full p-5 text-left transition-colors hover:quorum-surface focus:outline-none focus:ring-2 focus:ring-[var(--quorum-ring)]`}
      onClick={() => onToggle(methodKey)}
      aria-expanded={isOpen}
    >
      {children}
      {isOpen ? <MethodPanel>{method}</MethodPanel> : null}
    </button>
  );
}

/* ── Component ────────────────────────────────── */

export function OverviewKpiCards({
  visibilityRate,
  visibilityPrev,
  sentimentScore,
  sentimentPrev,
  sentimentLabel,
  sentimentMentions = 0,
  avgPosition,
  avgPositionPrev,
  coverage,
}: OverviewKpisProps) {
  const [activeMethod, setActiveMethod] = useState<KpiMethodKey | null>(null);
  const visTrend = computeTrend(visibilityRate, visibilityPrev ?? null);
  const sentTrend = computeTrend(sentimentScore, sentimentPrev ?? null);
  const rankTrend = computeRankTrend(avgPosition, avgPositionPrev ?? null);
  const toggleMethod = (methodKey: KpiMethodKey) => {
    setActiveMethod((current) => (current === methodKey ? null : methodKey));
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {/* Visibilité moyenne */}
      <KpiCard
        methodKey="visibility"
        activeMethod={activeMethod}
        onToggle={toggleMethod}
        method="Calculée sur les 7 derniers jours : nombre de réponses où la marque est mentionnée divisé par le nombre total de réponses collectées. Le résultat est arrondi en pourcentage. La tendance compare les 7 derniers jours aux 7 jours précédents."
      >
        <p className="quorum-kicker">Visibilité moyenne</p>
        <div className="mt-3 flex items-center gap-3">
          <p
            className="text-3xl font-bold tracking-[-0.04em]"
            style={{
              color: visibilityRate !== null ? visibilityColor(visibilityRate) : 'var(--quorum-text)',
            }}
          >
            {visibilityRate !== null ? `${visibilityRate}%` : '—'}
          </p>
          <TrendBadge trend={visTrend} />
        </div>
        <p className="mt-3 text-sm leading-relaxed quorum-text-muted">
          Moyenne pondérée sur les 7 derniers jours
        </p>
      </KpiCard>

      {/* Sentiment détecté */}
      <KpiCard
        methodKey="sentiment"
        activeMethod={activeMethod}
        onToggle={toggleMethod}
        method="Calculé uniquement sur les réponses où la marque est citée. Le système analyse la phrase de mention et son contexte proche, compte les signaux favorables et défavorables, pondère par confiance, puis normalise la tonalité entre 0 % et 100 %. 50 % correspond à une tonalité neutre."
      >
        <p className="quorum-kicker">Sentiment détecté</p>
        <div className="mt-3 flex items-center gap-3">
          <p className="text-3xl font-bold tracking-[-0.04em] quorum-text-primary">
            {sentimentScore !== null ? `${sentimentScore}%` : '—'}
          </p>
          <TrendBadge trend={sentTrend} />
        </div>
        <p className="mt-3 text-sm leading-relaxed quorum-text-muted">
          {sentimentLabel === 'positive'
            ? 'Tonalité favorable'
            : sentimentLabel === 'negative'
              ? 'Tonalité défavorable'
              : sentimentScore !== null
                ? `Tonalité neutre · ${sentimentMentions} mention${sentimentMentions > 1 ? 's' : ''} analysée${sentimentMentions > 1 ? 's' : ''}`
                : 'Données insuffisantes'}
        </p>
      </KpiCard>

      {/* Rang compétitif */}
      <KpiCard
        methodKey="rank"
        activeMethod={activeMethod}
        onToggle={toggleMethod}
        method="Calculé sur les 7 derniers jours. La marque et ses concurrents sont triés par nombre de mentions dans les réponses IA. Le rang #1 correspond à la marque la plus citée. La tendance compare ce rang aux 7 jours précédents."
      >
        <p className="quorum-kicker">Rang compétitif</p>
        <div className="mt-3 flex items-center gap-3">
          <p className="text-3xl font-bold tracking-[-0.04em] quorum-text-primary">
            {avgPosition !== null ? `#${avgPosition}` : '—'}
          </p>
          <TrendBadge trend={rankTrend} />
        </div>
        <p className="mt-3 text-sm leading-relaxed quorum-text-muted">
          Basé sur le nombre de mentions vs concurrents
        </p>
      </KpiCard>

      {/* Couverture */}
      <KpiCard
        methodKey="coverage"
        activeMethod={activeMethod}
        onToggle={toggleMethod}
        strong
        method="Synthèse opérationnelle des analyses disponibles. Le nombre d'analyses correspond aux analyses terminées sur les 30 derniers jours. Les requêtes actives viennent des requêtes de monitoring activées. Les modèles listés sont ceux détectés dans les dernières métriques disponibles, et la dernière analyse reprend l'analyse terminée la plus récente."
      >
        <p className="quorum-kicker">Couverture</p>
        <div className="mt-3 space-y-1 text-sm quorum-text-primary">
          <div>{coverage.runsPerPrompt} analyse{coverage.runsPerPrompt !== 1 ? 's' : ''}</div>
          <div>{coverage.promptCount} requête{coverage.promptCount !== 1 ? 's' : ''} active{coverage.promptCount !== 1 ? 's' : ''}</div>
          <div className="text-xs quorum-text-muted">
            Modèles : {coverage.modelsUsed.length > 0 ? coverage.modelsUsed.join(', ') : '—'}
          </div>
          {coverage.lastRunAt && (
            <div className="text-xs quorum-text-muted">
              Dernière analyse : {new Date(coverage.lastRunAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </KpiCard>
    </div>
  );
}
