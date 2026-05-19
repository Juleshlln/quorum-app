import { Activity, ArrowUpRight, BadgeDollarSign, Link2, Radar, ShieldCheck } from 'lucide-react';
import { BusinessImpactTrendChart } from '@/components/business-impact/business-impact-trend-chart';
import { BrandSearchTrends } from '@/components/business-impact/brand-search-trends';

type ConnectionRow = {
  id: string;
  provider: string;
  property_id: string | null;
  site_url: string | null;
  status: string;
  last_synced_at: string | null;
  last_error?: string | null;
  metadata?: unknown;
};

type BusinessImpactDashboardProps = {
  windowLabel: string;
  connections: ConnectionRow[];
  kpis: {
    observedAiSessions: number;
    conversionsObserved: number;
    revenueObserved: number;
    assistedImpactScore: number;
    assistedSessionsEstimate: number;
  };
  series: Array<{
    date: string;
    visibility: number | null;
    observedAiSessions: number;
    conversions: number;
    revenue: number;
  }>;
  topPages: Array<{
    pageUrl: string;
    domain: string | null;
    citationCount: number;
    visibilityScore: number;
    observedAiSessions: number;
    assistedSessionsEstimate: number;
    conversionsObserved: number;
    revenueObserved: number;
    confidence: string;
  }>;
  topAiSources: Array<{
    source: string;
    sessions: number;
    pageCount: number;
  }>;
  confidenceBadges: Array<{
    level: string;
    count: number;
  }>;
  brandSearchSeries: Array<{
    date: string;
    clicks: number;
    impressions: number;
    avgCtr: number;
    avgPosition: number;
  }>;
};

function formatInteger(value: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function confidenceClasses(level: string) {
  if (level === 'high') {
    return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
  }
  if (level === 'low') {
    return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
  }
  return 'border-sky-400/30 bg-sky-400/10 text-sky-200';
}

function providerLabel(provider: string) {
  if (provider === 'ga4') return 'GA4';
  if (provider === 'gsc') return 'Google Search Console';
  if (provider === 'matomo') return 'Matomo';
  return provider;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="quorum-panel p-5">
      <div className="flex items-center justify-between">
        <p className="quorum-kicker">{label}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)]">
          <Icon className="h-4 w-4 quorum-text-primary" />
        </div>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-[-0.04em] quorum-text-primary">{value}</p>
      <p className="mt-2 text-sm quorum-text-muted">{detail}</p>
    </div>
  );
}

export function BusinessImpactDashboard(props: BusinessImpactDashboardProps) {
  const hasConnections = props.connections.length > 0;
  const hasData = props.series.some((point) => point.observedAiSessions > 0 || point.conversions > 0 || point.visibility !== null);

  return (
    <div className="space-y-6">
      <section className="quorum-panel-strong overflow-hidden p-6 md:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="quorum-kicker">Business Impact</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] quorum-text-primary md:text-4xl">
              Relier la visibilité IA au trafic observé et au signal business.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed quorum-text-muted">
              Cette vue sépare explicitement le trafic IA observé, l’impact assisté inféré et la confiance du signal d’attribution.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="quorum-soft-badge">{props.windowLabel}</span>
            <span className="quorum-soft-badge">Observed + Assisted</span>
          </div>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Activity}
            label="AI observed sessions"
            value={formatInteger(props.kpis.observedAiSessions)}
            detail="Sessions traçables via sources IA détectées dans l’analytics."
          />
          <MetricCard
            icon={ShieldCheck}
            label="Conversions observed"
            value={formatDecimal(props.kpis.conversionsObserved)}
            detail="Conversions proratisées uniquement sur le trafic IA observé."
          />
          <MetricCard
            icon={BadgeDollarSign}
            label="Revenue observed"
            value={formatCurrency(props.kpis.revenueObserved)}
            detail="Revenu observé rattaché au trafic IA détecté, sans promesse d’attribution parfaite."
          />
          <MetricCard
            icon={Radar}
            label="Assisted impact score"
            value={`${formatDecimal(props.kpis.assistedImpactScore)} / 100`}
            detail={`${formatDecimal(props.kpis.assistedSessionsEstimate)} sessions assistées estimées après citations.`}
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.85fr)]">
        <BusinessImpactTrendChart data={props.series} />

        <div className="space-y-6">
          <div className="quorum-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="quorum-kicker">Connections</p>
                <h2 className="mt-2 text-lg font-semibold quorum-text-primary">Connecteurs analytics</h2>
              </div>
              <Link2 className="h-4 w-4 quorum-text-muted" />
            </div>
            <div className="mt-5 space-y-3">
              {hasConnections ? props.connections.map((connection) => (
                <div
                  key={connection.id}
                  className="rounded-[22px] border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium quorum-text-primary">{providerLabel(connection.provider)}</p>
                      <p className="mt-1 text-xs quorum-text-muted">
                        {connection.site_url || connection.property_id || 'Configuration enregistrée'}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${
                      connection.status === 'active'
                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                        : connection.status === 'error'
                          ? 'border-rose-400/30 bg-rose-400/10 text-rose-200'
                          : 'border-zinc-400/20 bg-zinc-400/10 text-zinc-300'
                    }`}>
                      {connection.status}
                    </span>
                  </div>
                  {connection.last_synced_at ? (
                    <p className="mt-3 text-xs quorum-text-muted">
                      Dernière sync: {new Date(connection.last_synced_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  ) : null}
                  {connection.last_error ? (
                    <p className="mt-2 text-xs text-rose-200">{connection.last_error}</p>
                  ) : null}
                </div>
              )) : (
                <div className="rounded-[22px] border border-dashed border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-5 text-sm quorum-text-muted">
                  Aucun connecteur connecté. Les API `POST /api/integrations/ga4/connect` et `POST /api/integrations/gsc/connect` sont prêtes pour brancher le trafic réel.
                </div>
              )}
            </div>
          </div>

          <div className="quorum-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="quorum-kicker">Confidence</p>
                <h2 className="mt-2 text-lg font-semibold quorum-text-primary">Badges de confiance</h2>
              </div>
              <ArrowUpRight className="h-4 w-4 quorum-text-muted" />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {props.confidenceBadges.map((badge) => (
                <span
                  key={badge.level}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] ${confidenceClasses(badge.level)}`}
                >
                  {badge.level}
                  <span className="text-[11px] opacity-80">{formatInteger(badge.count)}</span>
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed quorum-text-muted">
              <span className="font-semibold text-emerald-300">high</span> combine citation + trafic IA observé + baseline historique. <span className="font-semibold text-sky-300">medium</span> garde au moins un signal direct ou un lift post-citation exploitable. <span className="font-semibold text-amber-300">low</span> reste indicatif.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="quorum-panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="quorum-kicker">Top Pages</p>
              <h2 className="mt-2 text-lg font-semibold quorum-text-primary">Pages les plus impactées</h2>
            </div>
            <span className="text-xs quorum-text-muted">Citations + sessions + revenu observé</span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.18em] quorum-text-muted">
                <tr>
                  <th className="pb-3 pr-4 font-medium">Page</th>
                  <th className="pb-3 pr-4 font-medium">AI sessions</th>
                  <th className="pb-3 pr-4 font-medium">Conversions</th>
                  <th className="pb-3 pr-4 font-medium">Revenue</th>
                  <th className="pb-3 pr-4 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {props.topPages.length > 0 ? props.topPages.map((page) => (
                  <tr key={page.pageUrl} className="border-t border-[color:var(--quorum-border)]">
                    <td className="py-4 pr-4 align-top">
                      <div className="max-w-[28rem]">
                        <p className="truncate font-medium quorum-text-primary">{page.pageUrl}</p>
                        <p className="mt-1 text-xs quorum-text-muted">
                          {page.citationCount} citations • visibilité {formatDecimal(page.visibilityScore)}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 pr-4 quorum-text-primary">{formatInteger(page.observedAiSessions)}</td>
                    <td className="py-4 pr-4 quorum-text-primary">{formatDecimal(page.conversionsObserved)}</td>
                    <td className="py-4 pr-4 quorum-text-primary">{formatCurrency(page.revenueObserved)}</td>
                    <td className="py-4 pr-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${confidenceClasses(page.confidence)}`}>
                        {page.confidence}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center quorum-text-muted">
                      {hasData ? 'Les événements d’attribution existent mais aucune page n’est encore classée sur cette période.' : 'Connectez l’analytics puis lancez un recalcul pour remplir cette table.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="quorum-panel p-6">
          <div>
            <p className="quorum-kicker">Top AI Sources</p>
            <h2 className="mt-2 text-lg font-semibold quorum-text-primary">Origines IA détectées</h2>
          </div>
          <div className="mt-5 space-y-3">
            {props.topAiSources.length > 0 ? props.topAiSources.map((source) => (
              <div
                key={source.source}
                className="rounded-[22px] border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium quorum-text-primary">{source.source}</p>
                  <p className="text-sm quorum-text-primary">{formatInteger(source.sessions)} sessions</p>
                </div>
                <p className="mt-2 text-xs quorum-text-muted">{formatInteger(source.pageCount)} pages d’atterrissage observées</p>
              </div>
            )) : (
              <div className="rounded-[22px] border border-dashed border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-5 text-sm quorum-text-muted">
                Aucun référent IA observé pour l’instant. Le trafic inconnu ou direct n’est pas requalifié artificiellement.
              </div>
            )}
          </div>
        </div>
      </section>

      <BrandSearchTrends data={props.brandSearchSeries} />
    </div>
  );
}
