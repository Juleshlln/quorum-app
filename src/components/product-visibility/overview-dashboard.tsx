'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { Package, Eye, Trophy, Link2, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  formatDateFr,
  formatDelta,
  formatInteger,
  formatIntegerDelta,
  formatLastRun,
  formatOpportunityLevel,
  formatPercent,
  formatRanking,
  formatScore,
} from '@/lib/product-visibility/format';
import type { ProductVisibilityOverviewStandard } from '@/lib/product-visibility/service';
import { ProductVisibilityQuickActions } from '@/components/product-visibility/quick-actions';

type OverviewData = ProductVisibilityOverviewStandard;

const PIE_COLORS = ['#34d399', '#fb923c'];

type DeltaTone = 'positive' | 'negative' | 'neutral' | 'muted';

function deltaTone(value: number | null | undefined, invert = false): DeltaTone {
  if (value === null || value === undefined) return 'muted';
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return 'neutral';
  const positive = invert ? n < 0 : n > 0;
  return positive ? 'positive' : 'negative';
}

function deltaClass(tone: DeltaTone): string {
  switch (tone) {
    case 'positive':
      return 'text-emerald-300';
    case 'negative':
      return 'text-rose-300';
    case 'neutral':
      return 'quorum-text-muted';
    default:
      return 'quorum-text-muted';
  }
}

function KpiCard({
  label,
  value,
  hint,
  delta,
  deltaTone: tone = 'muted',
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  delta?: string;
  deltaTone?: DeltaTone;
  icon: typeof Package;
}) {
  return (
    <div className="quorum-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="quorum-kicker">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border quorum-border-default quorum-surface">
          <Icon className="h-4 w-4 quorum-text-primary" />
        </div>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] quorum-text-primary">{value}</p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta ? (
          <span className={`font-medium ${deltaClass(tone)}`}>{delta}</span>
        ) : null}
        <span className="quorum-text-muted">{hint}</span>
      </div>
    </div>
  );
}

function EmptyHint({ stage }: { stage: OverviewData['meta']['onboarding_stage'] }) {
  if (stage === 'products_without_prompts') {
    return (
      <OnboardingPanel
        title="Vos produits sont ajoutés. Générez maintenant les requêtes IA à tester."
        description="Les questions d’achat permettent de mesurer si les IA recommandent vos produits ou ceux de vos concurrents."
        actions={<ProductVisibilityQuickActions showRun={false} />}
      />
    );
  }

  if (stage === 'ready_without_analysis') {
    return (
      <OnboardingPanel
        title="Vos produits et requêtes sont prêts. Lancez votre première analyse."
        description="L’analyse interroge les IA, stocke les réponses et détecte les produits mentionnés."
        actions={<ProductVisibilityQuickActions showGeneratePrompts={false} />}
      />
    );
  }

  if (stage === 'analysis_without_results') {
    return (
      <OnboardingPanel
        title="Analyse terminée, mais aucun produit n’a été détecté dans les réponses IA."
        description="Consultez les résultats collectés puis enrichissez vos produits, ajoutez des concurrents ou reformulez vos requêtes."
        actions={(
          <div className="flex flex-wrap gap-3">
            <Link href="/product-visibility/results" className="quorum-btn-primary text-sm">Voir les résultats</Link>
            <Link href="/product-visibility/products" className="quorum-btn-secondary text-sm">Enrichir les produits</Link>
            <Link href="/product-visibility/prompts" className="quorum-btn-secondary text-sm">Reformuler les requêtes</Link>
          </div>
        )}
      />
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-5 py-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StepCard
          step="1"
          title="Ajouter vos produits"
          text="Ajoutez les produits que vous voulez suivre dans les réponses IA."
          primaryHref="/product-visibility/products"
          primaryLabel="Ajouter un produit"
          secondaryLabel="Importer un CSV"
          secondaryHref="/product-visibility/sources"
        />
        <StepCard
          step="2"
          title="Créer des requêtes IA"
          text="Générez les questions d’achat que vos clients pourraient poser à ChatGPT, Gemini ou Perplexity."
          primaryHref="/product-visibility/prompts"
          primaryLabel="Générer des requêtes"
        />
        <StepCard
          step="3"
          title="Lancer une analyse"
          text="Lancez une première analyse pour mesurer quels produits sont recommandés par les IA."
          primaryHref="/product-visibility/prompts"
          primaryLabel="Lancer l’analyse"
          secondaryHref="/product-visibility/results"
          secondaryLabel="Voir les résultats"
        />
      </div>
      <p className="mt-5 text-sm quorum-text-muted">Les scores apparaîtront après la première analyse.</p>
    </div>
  );
}

function OnboardingPanel({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions: ReactNode;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-5 py-6">
      <p className="text-sm font-medium quorum-text-primary">{title}</p>
      <p className="mt-2 max-w-2xl text-sm quorum-text-muted">{description}</p>
      <div className="mt-4">{actions}</div>
    </div>
  );
}

function StepCard({
  step,
  title,
  text,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  step: string;
  title: string;
  text: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] p-4">
      <span className="quorum-soft-badge">Étape {step}</span>
      <h3 className="mt-3 text-sm font-semibold quorum-text-primary">{title}</h3>
      <p className="mt-2 min-h-[48px] text-xs leading-relaxed quorum-text-muted">{text}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={primaryHref} className="quorum-btn-primary text-xs">{primaryLabel}</Link>
        {secondaryHref && secondaryLabel ? (
          <Link href={secondaryHref} className="quorum-btn-secondary text-xs">{secondaryLabel}</Link>
        ) : null}
      </div>
    </div>
  );
}

const RANGE_LABELS: Record<OverviewData['period']['range'], string> = {
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
  '90d': '90 derniers jours',
};

export function ProductVisibilityOverviewDashboard({ data }: { data: OverviewData }) {
  const pieData = [
    { name: 'Vos produits', value: data.charts.owned_vs_competitors.owned },
    { name: 'Concurrents', value: data.charts.owned_vs_competitors.competitors },
  ];

  const rangeLabel = RANGE_LABELS[data.period.range] ?? '30 derniers jours';

  return (
    <div className="space-y-6">
      <section className="quorum-panel-strong p-6 md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="quorum-kicker">Visibilité produit</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] quorum-text-primary md:text-4xl">
              Vue d’ensemble
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed quorum-text-muted">
              Mesurez la part de visibilité de vos produits face à vos concurrents dans les
              recommandations IA, sur l’ensemble des intentions d’achat B2B.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="quorum-soft-badge">Période : {rangeLabel}</span>
            <span className="quorum-soft-badge">
              Dernière analyse : {formatLastRun(data.kpis.last_run)}
            </span>
          </div>
        </div>

        {!data.meta.has_data ? <EmptyHint stage={data.meta.onboarding_stage} /> : null}

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Score de visibilité produit"
            value={formatPercent(data.kpis.product_visibility_score)}
            hint={data.kpis.product_visibility_score === null ? 'Les scores apparaîtront après la première analyse' : 'Part de vos produits dans l’ensemble des mentions IA'}
            delta={formatDelta(data.deltas.product_visibility_score)}
            deltaTone={deltaTone(data.deltas.product_visibility_score)}
            icon={Eye}
          />
          <KpiCard
            label="Mentions de vos produits"
            value={formatInteger(data.kpis.owned_product_mentions)}
            hint="Vos produits cités par les IA sur la période"
            delta={formatIntegerDelta(data.deltas.owned_product_mentions)}
            deltaTone={deltaTone(data.deltas.owned_product_mentions)}
            icon={Package}
          />
          <KpiCard
            label="Mentions concurrentes"
            value={formatInteger(data.kpis.competitor_product_mentions)}
            hint="Produits concurrents recommandés sur la période"
            delta={formatIntegerDelta(data.deltas.competitor_product_mentions)}
            deltaTone={deltaTone(data.deltas.competitor_product_mentions, true)}
            icon={Trophy}
          />
          <KpiCard
            label="Position moyenne"
            value={formatRanking(data.kpis.average_product_ranking)}
            hint="Rang moyen de vos produits quand ils sont cités"
            delta={formatDelta(data.deltas.average_product_ranking, 2)}
            deltaTone={deltaTone(data.deltas.average_product_ranking, true)}
            icon={TrendingUp}
          />
          <KpiCard
            label="Couverture des sources IA"
            value={formatPercent(data.kpis.ai_citation_coverage)}
            hint={data.kpis.ai_citation_coverage === null ? 'Données insuffisantes' : 'Réponses contenant des sources explicites'}
            delta={formatDelta(data.deltas.ai_citation_coverage)}
            deltaTone={deltaTone(data.deltas.ai_citation_coverage)}
            icon={Link2}
          />
          <KpiCard
            label="Produits à forte opportunité"
            value={formatInteger(data.kpis.high_opportunity_products)}
            hint="Vos produits avec un fort potentiel d’amélioration"
            icon={Sparkles}
          />
        </div>

        {data.reliability?.confidence_level === 'low' ? (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
            <div className="text-amber-100">
              <p className="font-medium">Échantillon faible — {data.reliability.sample_size} mention{data.reliability.sample_size > 1 ? 's' : ''} sur la période.</p>
              <p className="mt-0.5 text-amber-100/80">Les KPI ci-dessus sont calculés mais peu fiables tant que vous n’avez pas au moins {data.reliability.min_sample} réponses IA exploitables. Lancez plus d’analyses ou élargissez la fenêtre temporelle.</p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="quorum-panel p-5">
        <p className="quorum-kicker">Où agir en priorité</p>
        <h2 className="mt-2 text-lg font-semibold quorum-text-primary">Catégories à travailler</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] quorum-text-muted">
              <tr>
                <th className="pb-3 pr-4 font-medium">Catégorie</th>
                <th className="pb-3 pr-4 font-medium">Vos produits</th>
                <th className="pb-3 pr-4 font-medium">Concurrents</th>
                <th className="pb-3 pr-4 font-medium">Écart</th>
                <th className="pb-3 pr-4 font-medium">Opportunité</th>
                <th className="pb-3 pr-4 font-medium">Action recommandée</th>
              </tr>
            </thead>
            <tbody>
              {data.tables.category_performance.length > 0 ? (
                data.tables.category_performance
                  .slice()
                  .sort((left, right) => right.opportunity_score - left.opportunity_score)
                  .slice(0, 6)
                  .map((row) => {
                    const gap = row.owned_visibility - row.competitor_visibility;
                    return (
                      <tr key={row.category_id} className="border-t border-[color:var(--quorum-border)]">
                        <td className="py-3 pr-4 font-medium quorum-text-primary">{row.category}</td>
                        <td className="py-3 pr-4 quorum-text-primary">{formatPercent(row.owned_visibility)}</td>
                        <td className="py-3 pr-4 quorum-text-primary">{formatPercent(row.competitor_visibility)}</td>
                        <td className={gap < 0 ? 'py-3 pr-4 text-rose-300' : 'py-3 pr-4 text-emerald-300'}>
                          {gap > 0 ? '+' : ''}{gap.toFixed(0).replace('.', ',')} pts
                        </td>
                        <td className="py-3 pr-4 quorum-text-primary">{formatOpportunityLevel(row.opportunity_score)}</td>
                        <td className="py-3 pr-4 quorum-text-muted">
                          {gap < -20
                            ? 'Renforcer la page catégorie et les attributs produit'
                            : 'Maintenir le suivi et enrichir les preuves produit'}
                        </td>
                      </tr>
                    );
                  })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center quorum-text-muted">
                    Ajoutez des produits puis lancez une analyse pour identifier les priorités.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="quorum-panel p-5">
          <p className="quorum-kicker">Évolution dans le temps</p>
          <h2 className="mt-2 text-lg font-semibold quorum-text-primary">
            Score de visibilité produit
          </h2>
          <div className="mt-4 h-[280px]">
            {data.charts.visibility_trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data.charts.visibility_trend.map((row) => ({
                    ...row,
                    day_label: formatDateFr(row.day),
                  }))}
                >
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" strokeDasharray="4 4" />
                  <XAxis dataKey="day_label" stroke="rgba(148, 163, 184, 0.8)" fontSize={11} />
                  <YAxis stroke="rgba(148, 163, 184, 0.8)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--quorum-panel-strong)',
                      border: '1px solid var(--quorum-border)',
                      borderRadius: '14px',
                      color: 'var(--quorum-text)',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="visibility_score"
                    name="Score de visibilité (%)"
                    stroke="#34d399"
                    strokeWidth={2.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="owned_mentions"
                    name="Vos mentions"
                    stroke="#60a5fa"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="competitor_mentions"
                    name="Mentions concurrentes"
                    stroke="#fb923c"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="Pas encore d’historique sur la période sélectionnée." />
            )}
          </div>
        </div>

        <div className="grid gap-6">
          <div className="quorum-panel p-5">
            <p className="quorum-kicker">Vos produits vs concurrents</p>
            <h2 className="mt-2 text-lg font-semibold quorum-text-primary">
              Répartition des mentions IA
            </h2>
            <div className="mt-4 h-[220px]">
              {pieData.some((entry) => entry.value > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={78} innerRadius={45}>
                      {pieData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--quorum-panel-strong)',
                        border: '1px solid var(--quorum-border)',
                        borderRadius: '14px',
                        color: 'var(--quorum-text)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="Aucune mention détectée sur la période." />
              )}
            </div>
          </div>

          <div className="quorum-panel p-5">
            <p className="quorum-kicker">Catégories sans visibilité</p>
            <div className="mt-3 space-y-2">
              {data.charts.absent_categories.length > 0 ? (
                data.charts.absent_categories.map((row) => (
                  <div
                    key={row.category_id}
                    className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium quorum-text-primary">{row.category}</p>
                      <span className="text-xs quorum-text-muted">
                        Opportunité {formatPercent(row.opportunity_score, 0)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs quorum-text-muted">
                      {formatInteger(row.competitor_mentions)} mentions concurrentes ·{' '}
                      {formatInteger(row.products_tracked)} produits suivis
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-4 py-6 text-center text-sm quorum-text-muted">
                  Aucune catégorie sans visibilité détectée.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="quorum-panel p-5">
          <p className="quorum-kicker">Top catégories</p>
          <h2 className="mt-2 text-lg font-semibold quorum-text-primary">
            Catégories où vos produits performent le mieux
          </h2>
          <div className="mt-4 h-[260px]">
            {data.charts.top_categories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.charts.top_categories.slice(0, 8)}
                  layout="vertical"
                  margin={{ left: 20 }}
                >
                  <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" strokeDasharray="4 4" />
                  <XAxis type="number" stroke="rgba(148, 163, 184, 0.8)" fontSize={11} />
                  <YAxis
                    type="category"
                    dataKey="category"
                    width={170}
                    stroke="rgba(148, 163, 184, 0.8)"
                    fontSize={11}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--quorum-panel-strong)',
                      border: '1px solid var(--quorum-border)',
                      borderRadius: '14px',
                      color: 'var(--quorum-text)',
                    }}
                  />
                  <Bar dataKey="owned_visibility" fill="#34d399" name="Visibilité de vos produits (%)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart message="Aucune catégorie suivie pour le moment." />
            )}
          </div>
        </div>

        <div className="quorum-panel p-5">
          <p className="quorum-kicker">Top produits</p>
          <h2 className="mt-2 text-lg font-semibold quorum-text-primary">
            Produits les plus visibles dans les IA
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.16em] quorum-text-muted">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Produit</th>
                  <th className="pb-3 pr-4 font-medium">Marque</th>
                  <th className="pb-3 pr-4 font-medium">Mentions</th>
                  <th className="pb-3 pr-4 font-medium">Visibilité</th>
                </tr>
              </thead>
              <tbody>
                {data.charts.top_products.length > 0 ? (
                  data.charts.top_products.map((row) => (
                    <tr key={row.product_id} className="border-t border-[color:var(--quorum-border)]">
                      <td className="py-3 pr-4 quorum-text-primary">{row.product}</td>
                      <td className="py-3 pr-4 quorum-text-muted">{row.brand || '—'}</td>
                      <td className="py-3 pr-4 quorum-text-primary">{formatInteger(row.mentions)}</td>
                      <td className="py-3 pr-4 quorum-text-primary">
                        {formatPercent(row.visibility_score)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center quorum-text-muted">
                      Aucun produit cité sur la période.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="quorum-panel p-5">
        <p className="quorum-kicker">Performance par catégorie</p>
        <h2 className="mt-2 text-lg font-semibold quorum-text-primary">
          Vos produits vs concurrents par catégorie
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] quorum-text-muted">
              <tr>
                <th className="pb-3 pr-4 font-medium">Catégorie</th>
                <th className="pb-3 pr-4 font-medium">Vos produits</th>
                <th className="pb-3 pr-4 font-medium">Concurrents</th>
                <th className="pb-3 pr-4 font-medium">Concurrent leader</th>
                <th className="pb-3 pr-4 font-medium">Position moyenne</th>
                <th className="pb-3 pr-4 font-medium">Opportunité</th>
                <th className="pb-3 pr-4 font-medium">Tendance</th>
                <th className="pb-3 pr-4 font-medium">Dernière analyse</th>
              </tr>
            </thead>
            <tbody>
              {data.tables.category_performance.length > 0 ? (
                data.tables.category_performance.map((row) => {
                  const trend = Number(row.trend_delta);
                  const trendDisplay = !Number.isFinite(trend) || trend === 0
                    ? '0'
                    : `${trend > 0 ? '+' : ''}${trend.toFixed(1).replace('.', ',')}`;
                  return (
                    <tr key={row.category_id} className="border-t border-[color:var(--quorum-border)]">
                      <td className="py-3 pr-4 font-medium quorum-text-primary">{row.category}</td>
                      <td className="py-3 pr-4 quorum-text-primary">
                        {formatPercent(row.owned_visibility)}
                      </td>
                      <td className="py-3 pr-4 quorum-text-primary">
                        {formatPercent(row.competitor_visibility)}
                      </td>
                      <td className="py-3 pr-4 quorum-text-muted">{row.top_competitor || '—'}</td>
                      <td className="py-3 pr-4 quorum-text-primary">
                        {formatRanking(row.avg_ranking)}
                      </td>
                      <td className="py-3 pr-4 quorum-text-primary">
                        {formatScore(row.opportunity_score, 0)}
                      </td>
                      <td
                        className={`py-3 pr-4 ${
                          trend > 0 ? 'text-emerald-300' : trend < 0 ? 'text-rose-300' : 'quorum-text-muted'
                        }`}
                      >
                        {trendDisplay}
                      </td>
                      <td className="py-3 pr-4 quorum-text-muted">{formatDateFr(row.last_run)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center quorum-text-muted">
                    Aucune donnée par catégorie disponible.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-4 py-6 text-center text-xs quorum-text-muted">
      {message}
    </div>
  );
}
