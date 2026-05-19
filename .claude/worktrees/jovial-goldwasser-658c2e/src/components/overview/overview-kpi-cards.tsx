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
  sentimentPositive: number | null;
  sentimentPrev?: number | null;
  avgPosition: number | null;
  avgPositionPrev?: number | null;
  coverage: CoverageMeta;
};

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

/* ── Component ────────────────────────────────── */

export function OverviewKpiCards({
  visibilityRate,
  visibilityPrev,
  sentimentPositive,
  sentimentPrev,
  avgPosition,
  avgPositionPrev,
  coverage,
}: OverviewKpisProps) {
  const visTrend = computeTrend(visibilityRate, visibilityPrev ?? null);
  const sentTrend = computeTrend(sentimentPositive, sentimentPrev ?? null);
  const rankTrend = computeRankTrend(avgPosition, avgPositionPrev ?? null);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {/* Visibilité moyenne */}
      <div className="quorum-panel p-5">
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
      </div>

      {/* Sentiment détecté */}
      <div className="quorum-panel p-5">
        <p className="quorum-kicker">Sentiment détecté</p>
        <div className="mt-3 flex items-center gap-3">
          <p className="text-3xl font-bold tracking-[-0.04em] quorum-text-primary">
            {sentimentPositive !== null ? `${sentimentPositive}% positif` : '—'}
          </p>
          <TrendBadge trend={sentTrend} />
        </div>
        <p className="mt-3 text-sm leading-relaxed quorum-text-muted">
          Calculé uniquement quand la marque est citée
        </p>
      </div>

      {/* Rang compétitif */}
      <div className="quorum-panel p-5">
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
      </div>

      {/* Couverture */}
      <div className="quorum-panel-strong p-5">
        <p className="quorum-kicker">Couverture</p>
        <div className="mt-3 space-y-1 text-sm quorum-text-primary">
          <div>{coverage.runsPerPrompt} run{coverage.runsPerPrompt !== 1 ? 's' : ''}</div>
          <div>{coverage.promptCount} prompt{coverage.promptCount !== 1 ? 's' : ''} actif{coverage.promptCount !== 1 ? 's' : ''}</div>
          <div className="text-xs quorum-text-muted">
            Modèles: {coverage.modelsUsed.length > 0 ? coverage.modelsUsed.join(', ') : '—'}
          </div>
          {coverage.lastRunAt && (
            <div className="text-xs quorum-text-muted">
              Dernière analyse: {new Date(coverage.lastRunAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
