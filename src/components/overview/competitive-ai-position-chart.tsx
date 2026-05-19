'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Check, Eraser, Layers3, Settings2 } from 'lucide-react';
import type { CompetitiveAIPositionData } from '@/lib/overview/product-visibility-overview';
import { formatNumberFr, formatPercentFr, formatProviderLabel, formatRanking } from '@/lib/product-visibility/format';
import { useTheme } from '@/components/theme/theme-provider';
import { cn } from '@/lib/utils';

type ActorType = CompetitiveAIPositionData['products'][number]['competitors'][number]['type'];
type ModelId = CompetitiveAIPositionData['availableModels'][number]['id'];
type ProductRow = CompetitiveAIPositionData['products'][number];
type ActorRow = ProductRow['competitors'][number];
type ModelMetric = ActorRow['models'][number];
type TrendRange = '7d' | '30d';

type ChartRow = {
  name: string;
  type: ActorType;
  averagePosition: number | null;
  appearanceRate: number;
  visibilityPercent: number;
  stats: Record<string, ModelMetric | undefined>;
  [key: string]: string | number | null | ActorType | Record<string, ModelMetric | undefined>;
};

type TrendPoint = {
  date: string;
  label: string;
  [actorName: string]: string | number | null;
};

const MODEL_COLORS_DARK: Record<string, string> = {
  openai: '#34d399',
  claude: '#a78bfa',
  gemini: '#38bdf8',
  perplexity: '#fbbf24',
  grok: '#f472b6',
  deepseek: '#fb7185',
  llama: '#c4b5fd',
};

const MODEL_COLORS_LIGHT: Record<string, string> = {
  openai: '#059669',
  claude: '#7c3aed',
  gemini: '#0284c7',
  perplexity: '#d97706',
  grok: '#db2777',
  deepseek: '#e11d48',
  llama: '#6d28d9',
};

const ACTOR_COLORS_DARK = ['#34d399', '#e5e7eb', '#a78bfa', '#38bdf8', '#fbbf24', '#f472b6', '#94a3b8'];
const ACTOR_COLORS_LIGHT = ['#059669', '#374151', '#7c3aed', '#0284c7', '#d97706', '#db2777', '#64748b'];

function average(values: number[]) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function modelKey(model: string) {
  return `model_${model}`;
}

function actorLabel(type: ActorType) {
  if (type === 'owned') return 'Votre marque';
  if (type === 'competitor') return 'Concurrent';
  return 'Tiers';
}

function actorTone(type: ActorType) {
  if (type === 'owned') return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200';
  if (type === 'competitor') return 'border-amber-400/25 bg-amber-400/10 text-amber-200';
  return 'border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] quorum-text-muted';
}

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function dateCutoff(latestDate: string, range: TrendRange) {
  const cursor = new Date(`${latestDate}T00:00:00.000Z`);
  cursor.setUTCDate(cursor.getUTCDate() - (range === '7d' ? 6 : 29));
  return cursor.toISOString().slice(0, 10);
}

function buildChartRows(product: ProductRow | null, selectedModels: ModelId[]) {
  if (!product || selectedModels.length === 0) return [];

  return product.competitors
    .map((actor) => {
      const stats: Record<string, ModelMetric | undefined> = {};
      const row: ChartRow = {
        name: actor.name,
        type: actor.type,
        averagePosition: null,
        appearanceRate: 0,
        visibilityPercent: 0,
        stats,
      };
      const visiblePositions: number[] = [];
      let appearanceSum = 0;
      let appearanceModels = 0;

      for (const selectedModel of selectedModels) {
        const metric = actor.models.find((item) => item.model === selectedModel);
        stats[selectedModel] = metric;
        row[modelKey(selectedModel)] = metric?.averagePosition ?? null;
        if (metric) {
          appearanceSum += metric.appearanceRate;
          appearanceModels += 1;
        }
        if (metric?.averagePosition !== null && metric?.averagePosition !== undefined) {
          visiblePositions.push(metric.averagePosition);
        }
      }

      row.averagePosition = average(visiblePositions);
      row.appearanceRate = appearanceModels > 0 ? appearanceSum / appearanceModels : 0;
      row.visibilityPercent = Math.round(row.appearanceRate * 100);
      return row;
    })
    .filter((row) => row.type === 'owned' || row.averagePosition !== null || row.appearanceRate > 0)
    .sort((left, right) => {
      if (left.averagePosition === null && right.averagePosition !== null) return 1;
      if (left.averagePosition !== null && right.averagePosition === null) return -1;
      if (left.averagePosition !== null && right.averagePosition !== null && left.averagePosition !== right.averagePosition) {
        return left.averagePosition - right.averagePosition;
      }
      if (left.appearanceRate !== right.appearanceRate) return right.appearanceRate - left.appearanceRate;
      if (left.type === 'owned') return -1;
      if (right.type === 'owned') return 1;
      return left.name.localeCompare(right.name, 'fr');
    });
}

function buildInsight(rows: ChartRow[], selectedModels: ModelId[]) {
  if (selectedModels.length === 0) return 'Sélectionnez au moins un modèle IA pour afficher la comparaison.';
  const owned = rows.find((row) => row.type === 'owned') || null;
  const visibleRows = rows.filter((row) => row.averagePosition !== null);
  const leader = visibleRows[0] || null;

  if (!leader) return 'Aucun acteur visible sur les modèles sélectionnés pour cette offre.';
  if (!owned || owned.averagePosition === null) {
    return `${leader.name} domine actuellement avec une position moyenne de ${formatRanking(leader.averagePosition)}. Votre marque n'est pas visible sur cette sélection.`;
  }
  if (leader.type === 'owned') {
    return `Votre marque mène la catégorie avec une position moyenne de ${formatRanking(owned.averagePosition)} et un taux d'apparition de ${formatPercentFr(owned.appearanceRate, 0)}.`;
  }

  return `Votre marque apparaît en moyenne en ${formatRanking(owned.averagePosition)}. ${leader.name} domine actuellement avec une position moyenne de ${formatRanking(leader.averagePosition)}.`;
}

function buildTrendData(rows: ChartRow[], selectedModels: ModelId[], range: TrendRange) {
  const dateSet = new Set<string>();

  for (const row of rows) {
    for (const model of selectedModels) {
      const metric = row.stats[model];
      for (const point of metric?.trend || []) {
        dateSet.add(point.date);
      }
    }
  }

  const allDates = Array.from(dateSet).sort((left, right) => left.localeCompare(right));
  const latestDate = allDates[allDates.length - 1] || null;
  const cutoff = latestDate ? dateCutoff(latestDate, range) : null;
  const dates = cutoff ? allDates.filter((date) => date >= cutoff) : [];
  return dates.map((date) => {
    const point: TrendPoint = {
      date,
      label: formatShortDate(date),
    };

    for (const row of rows) {
      let visibleRuns = 0;
      let totalRuns = 0;

      for (const model of selectedModels) {
        const trendPoint = row.stats[model]?.trend.find((item) => item.date === date);
        if (!trendPoint || trendPoint.totalRuns === 0 || trendPoint.visibilityRate === null) continue;
        totalRuns += trendPoint.totalRuns;
        visibleRuns += trendPoint.visibilityRate * trendPoint.totalRuns;
      }

      point[row.name] = totalRuns > 0 ? Math.round((visibleRuns / totalRuns) * 100) : null;
    }

    return point;
  });
}

function CompetitiveTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    color?: string;
    name?: string | number;
    payload?: ChartRow;
    value?: number | string | null;
  }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div className="min-w-[220px] rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-panel-strong)] p-3 shadow-2xl backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold quorum-text-primary">{label}</p>
        <span className={cn('rounded-full border px-2 py-1 text-[10px] font-semibold', actorTone(row.type))}>
          {actorLabel(row.type)}
        </span>
      </div>
      <div className="mb-3 rounded-xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] quorum-text-muted">Visibilité</p>
        <p className="mt-1 text-sm font-semibold quorum-text-primary">{formatPercentFr(row.appearanceRate, 0)}</p>
      </div>
      <div className="space-y-2">
        {Object.entries(row.stats).map(([model, metric]) => {
          return (
            <div key={model} className="grid grid-cols-[1fr_auto] items-center gap-2 text-xs">
              <span className="quorum-text-muted">{formatProviderLabel(model)}</span>
              <span className="font-semibold quorum-text-primary">{formatRanking(metric?.averagePosition)}</span>
              <span className="quorum-text-subtle">Apparition</span>
              <span className="quorum-text-muted">{formatPercentFr(metric?.appearanceRate ?? 0, 0)}</span>
              <span className="quorum-text-subtle">Mentions</span>
              <span className="quorum-text-muted">{metric?.mentionsCount ?? 0}/{metric?.totalRuns ?? 0}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const EMPTY_COMPETITIVE_POSITION: CompetitiveAIPositionData = {
  availableModels: [],
  products: [],
};

export function CompetitiveAIPositionChart({ data }: { data?: CompetitiveAIPositionData | null }) {
  const safeData = data || EMPTY_COMPETITIVE_POSITION;
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const products = safeData.products;
  const firstProductWithData = products.find((product) => product.totalRuns > 0) || products[0] || null;
  const [selectedProductId, setSelectedProductId] = useState(firstProductWithData?.productOrServiceId || '');
  const selectedProduct = products.find((product) => product.productOrServiceId === selectedProductId) || firstProductWithData;
  const defaultModelIds = (selectedProduct?.availableModels.length ? selectedProduct.availableModels : safeData.availableModels).map((model) => model.id);
  const [selectedModels, setSelectedModels] = useState<ModelId[]>(defaultModelIds);
  const [trendRange, setTrendRange] = useState<TrendRange>('30d');

  useEffect(() => {
    if (!selectedProductId && firstProductWithData) {
      setSelectedProductId(firstProductWithData.productOrServiceId);
    }
  }, [firstProductWithData, selectedProductId]);

  useEffect(() => {
    if (selectedModels.length === 0) return;
    const knownModels = new Set(safeData.availableModels.map((model) => model.id));
    const validSelection = selectedModels.filter((model) => knownModels.has(model));
    if (validSelection.length !== selectedModels.length) {
      setSelectedModels(validSelection);
    }
  }, [safeData.availableModels, selectedModels]);

  const chartRows = useMemo(
    () => buildChartRows(selectedProduct || null, selectedModels),
    [selectedProduct, selectedModels],
  );
  const trendData = useMemo(
    () => buildTrendData(chartRows, selectedModels, trendRange),
    [chartRows, selectedModels, trendRange],
  );
  const insight = useMemo(() => buildInsight(chartRows, selectedModels), [chartRows, selectedModels]);
  const selectedProductModelIds = new Set(selectedProduct?.availableModels.map((model) => model.id) || []);
  const unavailableSelectedModels = selectedModels.filter((model) => !selectedProductModelIds.has(model));
  const colors = isDark ? MODEL_COLORS_DARK : MODEL_COLORS_LIGHT;

  const toggleModel = (modelId: ModelId) => {
    setSelectedModels((current) => (
      current.includes(modelId)
        ? current.filter((item) => item !== modelId)
        : [...current, modelId]
    ));
  };

  const selectProduct = (productId: string) => {
    setSelectedProductId(productId);
    const nextProduct = products.find((product) => product.productOrServiceId === productId);
    if (!nextProduct) return;
    const nextModels = nextProduct.availableModels.map((model) => model.id);
    setSelectedModels((current) => {
      const overlap = current.filter((model) => nextModels.includes(model));
      return overlap.length > 0 ? overlap : nextModels;
    });
  };

  return (
    <section className="quorum-panel-strong overflow-hidden p-5 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-2xl">
          <p className="quorum-kicker">Position concurrentielle IA</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] quorum-text-primary md:text-2xl">
            Vos offres face aux concurrents
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed quorum-text-muted">
            Comparez la position moyenne et le taux d'apparition selon les modèles IA disponibles.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_minmax(280px,1.4fr)] xl:w-[620px]">
          <label className="min-w-0">
            <span className="mb-2 block text-xs font-semibold quorum-text-muted">Produit ou service</span>
            <select
              value={selectedProduct?.productOrServiceId || ''}
              onChange={(event) => selectProduct(event.target.value)}
              className="quorum-select text-sm"
              aria-label="Produit ou service à analyser"
              disabled={products.length === 0}
            >
              {products.map((product) => (
                <option key={product.productOrServiceId} value={product.productOrServiceId}>
                  {product.productOrServiceName}
                </option>
              ))}
            </select>
          </label>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold quorum-text-muted">Modèles IA</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedModels(safeData.availableModels.map((model) => model.id))}
                  className="rounded-lg border border-[color:var(--quorum-border)] p-1.5 quorum-text-muted transition hover:border-[color:var(--quorum-border-strong)] hover:quorum-text-primary"
                  aria-label="Tout sélectionner"
                  title="Tout sélectionner"
                  disabled={safeData.availableModels.length === 0}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedModels([])}
                  className="rounded-lg border border-[color:var(--quorum-border)] p-1.5 quorum-text-muted transition hover:border-[color:var(--quorum-border-strong)] hover:quorum-text-primary"
                  aria-label="Désélectionner"
                  title="Désélectionner"
                  disabled={safeData.availableModels.length === 0}
                >
                  <Eraser className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex min-h-[46px] flex-wrap gap-2 rounded-xl border border-[color:var(--quorum-border)] bg-[var(--quorum-input-bg)] p-2">
              {safeData.availableModels.length > 0 ? safeData.availableModels.map((model) => {
                const active = selectedModels.includes(model.id);
                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => toggleModel(model.id)}
                    className={cn(
                      'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
                      active
                        ? 'border-[color:var(--quorum-border-strong)] bg-[var(--quorum-surface-strong)] quorum-text-primary'
                        : 'border-transparent quorum-text-muted hover:bg-[var(--quorum-surface)] hover:quorum-text-primary',
                    )}
                  >
                    {model.label}
                  </button>
                );
              }) : (
                <span className="flex items-center px-2 text-xs quorum-text-subtle">Aucun modèle analysé</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="mt-6 flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-6 text-center">
          <Layers3 className="mb-4 h-8 w-8 quorum-text-subtle" />
          <p className="text-sm font-semibold quorum-text-primary">Aucune donnée produit/service disponible pour le moment.</p>
          <p className="mt-2 max-w-md text-sm quorum-text-muted">Lancez une première analyse pour visualiser votre position concurrentielle.</p>
          <Link href="/offers" className="quorum-btn-primary mt-5 text-sm">
            <Settings2 className="h-4 w-4" />
            Commencer le paramétrage
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      ) : selectedModels.length === 0 ? (
        <div className="mt-6 flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-6 text-center text-sm quorum-text-muted">
          Sélectionnez au moins un modèle IA pour afficher la comparaison.
        </div>
      ) : !selectedProduct || selectedProduct.totalRuns === 0 ? (
        <div className="mt-6 flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-6 text-center text-sm quorum-text-muted">
          Aucune donnée disponible pour ce produit/service. Essayez de sélectionner un autre élément ou lancez une nouvelle analyse.
        </div>
      ) : chartRows.length === 0 ? (
        <div className="mt-6 flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-6 text-center text-sm quorum-text-muted">
          Aucune donnée disponible pour ce produit/service. Essayez de sélectionner un autre élément ou lancez une nouvelle analyse.
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <MetricTile label="Offre analysée" value={selectedProduct.productOrServiceName} />
            <MetricTile label="Réponses IA" value={formatNumberFr(selectedProduct.totalRuns, 0)} />
            <MetricTile label="Lecture" value="Visibilité = taux d'apparition" />
          </div>

          {unavailableSelectedModels.length > 0 ? (
            <p className="mt-4 rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3 text-xs quorum-text-muted">
              Certaines données IA ne sont pas encore disponibles pour ce produit.
            </p>
          ) : null}

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.7fr)]">
            <div className="min-w-0 rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold quorum-text-primary">Évolution de visibilité</p>
                  <p className="mt-1 text-xs quorum-text-muted">Taux d'apparition quotidien sur les modèles sélectionnés.</p>
                </div>
                <div className="flex rounded-xl border border-[color:var(--quorum-border)] bg-[var(--quorum-panel)] p-1">
                  {(['7d', '30d'] as const).map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setTrendRange(range)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                        trendRange === range
                          ? 'bg-[var(--quorum-surface-strong)] quorum-text-primary'
                          : 'quorum-text-muted hover:quorum-text-primary',
                      )}
                    >
                      {range === '7d' ? '7j' : '30j'}
                    </button>
                  ))}
                </div>
              </div>
              <VisibilityTrendDots
                rows={chartRows}
                data={trendData}
                selectedModels={selectedModels}
                isDark={isDark}
              />
            </div>

            <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] p-4">
              <div className="mb-4">
                <p className="text-sm font-semibold quorum-text-primary">Classement concurrentiel</p>
                <p className="mt-1 text-xs quorum-text-muted">Position moyenne sur les modèles sélectionnés.</p>
              </div>
              <div className="space-y-3">
                {chartRows.map((row, index) => (
                  <div key={row.name} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-panel)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className={cn(
                          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border text-xs font-bold',
                          row.type === 'owned'
                            ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                            : 'border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] quorum-text-muted',
                        )}>
                          #{index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold quorum-text-primary">{row.name}</p>
                          <p className="mt-1 text-xs quorum-text-muted">{actorLabel(row.type)} · {formatPercentFr(row.appearanceRate, 0)} visible</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold quorum-text-primary">{formatRanking(row.averagePosition)}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] quorum-text-subtle">Position</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedModels.map((model) => {
                        const metric = row.stats[model];
                        return (
                          <span
                            key={model}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-2 py-1 text-[11px] quorum-text-muted"
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors[model] || '#94a3b8' }} />
                            {formatProviderLabel(model)} {formatRanking(metric?.averagePosition)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.42fr)]">
            <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
              <p className="text-sm font-semibold quorum-text-primary">{insight}</p>
            </div>
            <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] quorum-text-muted">Acteurs visibles</p>
              <p className="mt-1 text-lg font-semibold quorum-text-primary">{formatNumberFr(chartRows.filter((row) => row.averagePosition !== null).length, 0)}</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] quorum-text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold quorum-text-primary">{value}</p>
    </div>
  );
}

function VisibilityTrendDots({
  rows,
  data,
  selectedModels,
  isDark,
}: {
  rows: ChartRow[];
  data: TrendPoint[];
  selectedModels: ModelId[];
  isDark: boolean;
}) {
  const [hovered, setHovered] = useState<{
    actor: string;
    date: string;
    value: number;
    details: Array<{ model: ModelId; value: number | null; totalRuns: number }>;
  } | null>(null);
  const colors = isDark ? ACTOR_COLORS_DARK : ACTOR_COLORS_LIGHT;
  const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(17,17,19,0.08)';
  const tickColor = isDark ? 'rgba(247,244,238,0.48)' : 'rgba(17,17,19,0.56)';
  const chartWidth = 760;
  const chartHeight = 380;
  const plot = { left: 48, right: 18, top: 18, bottom: data.length > 12 ? 82 : 54 };
  const innerWidth = chartWidth - plot.left - plot.right;
  const innerHeight = chartHeight - plot.top - plot.bottom;
  const dateCount = Math.max(data.length - 1, 1);
  const denseDates = data.length > 12;

  const xForIndex = (index: number) => plot.left + (index / dateCount) * innerWidth;
  const yForValue = (value: number) => plot.top + (1 - Math.max(0, Math.min(100, value)) / 100) * innerHeight;
  const xTicks = data;

  const buildHoverDetails = (row: ChartRow, date: string) => selectedModels.map((model) => {
    const trendPoint = row.stats[model]?.trend.find((item) => item.date === date);
    return {
      model,
      value: trendPoint?.visibilityRate !== null && trendPoint?.visibilityRate !== undefined
        ? Math.round(trendPoint.visibilityRate * 100)
        : null,
      totalRuns: trendPoint?.totalRuns || 0,
    };
  });

  if (data.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-6 text-center text-sm quorum-text-muted">
        Aucune donnée quotidienne disponible sur cette période.
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="relative min-w-0 overflow-hidden rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-panel)]">
        {hovered ? (
          <div className="absolute right-4 top-4 z-10 min-w-[220px] rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-panel-strong)] px-3 py-2 text-xs shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold quorum-text-primary">{hovered.actor}</p>
                <p className="mt-1 quorum-text-muted">{formatShortDate(hovered.date)} · moyenne {hovered.value}%</p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 border-t border-[color:var(--quorum-border)] pt-2">
              {hovered.details.map((detail) => (
                <div key={detail.model} className="flex items-center justify-between gap-3">
                  <span className="quorum-text-muted">{formatProviderLabel(detail.model)}</span>
                  <span className="font-semibold quorum-text-primary">
                    {detail.value === null ? '—' : `${detail.value}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="block h-[360px] w-full md:h-[420px]"
          role="img"
          aria-label="Évolution quotidienne de visibilité"
        >
          {[0, 25, 50, 75, 100].map((value) => {
            const y = yForValue(value);
            return (
              <g key={value}>
                <line x1={plot.left} x2={chartWidth - plot.right} y1={y} y2={y} stroke={gridColor} strokeDasharray="4 4" />
                <text x={plot.left - 10} y={y + 4} textAnchor="end" fill={tickColor} fontSize="11">{value}%</text>
              </g>
            );
          })}

          {xTicks.map((point) => {
            const index = data.findIndex((item) => item.date === point.date);
            const x = xForIndex(index);
            return (
              <g key={point.date}>
                <line x1={x} x2={x} y1={plot.top} y2={chartHeight - plot.bottom} stroke={gridColor} strokeDasharray="4 4" />
                <text
                  x={x}
                  y={chartHeight - (denseDates ? 28 : 18)}
                  textAnchor={denseDates ? 'end' : 'middle'}
                  fill={tickColor}
                  fontSize={denseDates ? '9' : '11'}
                  transform={denseDates ? `rotate(-55 ${x} ${chartHeight - 28})` : undefined}
                >
                  {point.label}
                </text>
              </g>
            );
          })}

          <line x1={plot.left} x2={chartWidth - plot.right} y1={chartHeight - plot.bottom} y2={chartHeight - plot.bottom} stroke={gridColor} />
          <line x1={plot.left} x2={plot.left} y1={plot.top} y2={chartHeight - plot.bottom} stroke={gridColor} />

          {rows.map((row, rowIndex) => {
            const points = data
              .map((point, pointIndex) => {
                const value = point[row.name];
                if (typeof value !== 'number' || !Number.isFinite(value)) return null;
                return {
                  x: xForIndex(pointIndex),
                  y: yForValue(value),
                  value,
                  date: point.date,
                };
              })
              .filter((point): point is { x: number; y: number; value: number; date: string } => Boolean(point));
            const color = colors[rowIndex % colors.length];

            return (
              <g key={row.name}>
                {points.length > 1 ? (
                  <polyline
                    points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                    fill="none"
                    stroke={color}
                    strokeWidth={row.type === 'owned' ? 3 : 2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                {points.map((point) => (
                  <circle
                    key={`${row.name}-${point.date}`}
                    cx={point.x}
                    cy={point.y}
                    r={row.type === 'owned' ? 4.8 : 4}
                    fill={color}
                    stroke={isDark ? '#050505' : '#ffffff'}
                    strokeWidth="1.8"
                    className="cursor-pointer"
                    onMouseEnter={() => setHovered({
                      actor: row.name,
                      date: point.date,
                      value: point.value,
                      details: buildHoverDetails(row, point.date),
                    })}
                    onMouseLeave={() => setHovered(null)}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
        {rows.map((row, index) => (
          <div key={row.name} className="inline-flex items-center gap-2 text-xs quorum-text-muted">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors[index % colors.length] }} />
            <span>{row.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
