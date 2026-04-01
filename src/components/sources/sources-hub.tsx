'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Download,
  Globe,
  Link2,
  Users,
  Shield,
  BarChart3,
  Sparkles,
  Search,
  ChevronDown,
  ExternalLink,
  Eye,
} from 'lucide-react';

import { ScoreHero } from './score-hero';
import { MetricCard } from './metric-card';
import { ShareBar } from './share-bar';
import { StatusBar } from './status-bar';

/* ─── Types ─────────────────────────────────────────────────────── */

type TopicOption = { id: string; name: string };

type SourcesPayload = {
  kpis: {
    total_citations: number;
    unique_domains: number;
    unique_urls: number;
    owned_share: number;
    competitor_share: number;
    third_party_share: number;
    avg_quality_score: number;
    observed_citations: number;
    probable_citations: number;
  };
  series: Array<{ date: string; total_citations: number }>;
  breakdown: Array<{ type: string; count: number; share: number }>;
  table: SourceTableRow[];
};

type SummaryPayload = {
  metrics: {
    total_citations: number;
    unique_domains: number;
    unique_urls: number;
    owned_share: number;
    competitor_share: number;
    third_party_share: number;
    avg_quality_score: number;
    observed_citations: number;
    probable_citations: number;
    series: Array<{ date: string; total_citations: number }>;
  };
  latestRun: {
    id: string;
    status: string;
    run_date: string;
    started_at: string | null;
    finished_at: string | null;
    error_message?: string | null;
  } | null;
  window: {
    windowStart: string;
    windowEnd: string;
    windowDays: number;
  };
};

type SourceTableRow = {
  key: string;
  type: string;
  is_owned: boolean;
  used_total: number;
  used_share: number;
  observed_share: number;
  probable_share: number;
  avg_citations_per_run: number;
  last_seen: string;
  brand_mentioned_rate: number;
  quality_score: number;
  opportunity: boolean;
};

type EvidenceItem = {
  id?: string;
  cited_at: string;
  method: string | null;
  confidence: number | null;
  rationale: string | null;
  ai_model: string | null;
  prompt_text: string | null;
  response_snippet: string | null;
  response_id: string | null;
  source_urls?: string[];
};

type EvidenceData = {
  key: string;
  scope: 'domain' | 'url';
  items: EvidenceItem[];
};

type RunInfo = {
  latestRun: {
    id: string;
    status: string;
    run_date: string;
    started_at: string | null;
    finished_at: string | null;
    error_message?: string | null;
  } | null;
};

type CronStatus = {
  next_run_at_utc: string;
  did_run_today: boolean;
  last_daily_run_finished_at: string | null;
  last_daily_run_status: string | null;
};

/* ─── Helpers ───────────────────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = {
  Institutional: 'Institutionnel',
  Editorial: 'Éditorial',
  Corporate: 'Corporate',
  UGC: 'UGC',
  Other: 'Autre',
  Homepage: 'Accueil',
  Article: 'Article',
  CategoryPage: 'Catégorie',
  Profile: 'Profil',
  Discussion: 'Discussion',
  HowToGuide: 'Guide',
  Listicle: 'Liste',
};

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function formatChartDate(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function HeaderWithInfo({
  label,
  tooltip,
  sortable,
  active,
  direction,
  onClick,
  onShowInfo,
  onHideInfo,
}: {
  label: string;
  tooltip: string;
  sortable?: boolean;
  active?: boolean;
  direction?: 'asc' | 'desc';
  onClick?: () => void;
  onShowInfo?: (tooltip: string, target: HTMLElement) => void;
  onHideInfo?: () => void;
}) {
  const content = (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}{sortable && active ? ` ${direction === 'desc' ? '↓' : '↑'}` : ''}</span>
      <span className="inline-flex items-center">
        <button
          type="button"
          aria-label={tooltip}
          className="cursor-help text-[11px] quorum-text-subtle hover:quorum-text-primary"
          onMouseEnter={(event) => onShowInfo?.(tooltip, event.currentTarget)}
          onMouseLeave={() => onHideInfo?.()}
          onFocus={(event) => onShowInfo?.(tooltip, event.currentTarget)}
          onBlur={() => onHideInfo?.()}
          onClick={(event) => event.stopPropagation()}
        >
          ⓘ
        </button>
      </span>
    </span>
  );

  if (!sortable) return content;

  return (
    <span
      role="button"
      tabIndex={0}
      className="inline-flex items-center cursor-pointer transition-colors hover:quorum-text-primary"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
    >
      {content}
    </span>
  );
}

function cleanEvidenceSnippet(value: string | null) {
  if (!value) return value;
  return value
    .split('\n')
    .filter((line) => !/^\s*-\s*https?:\/\//i.test(line) && !/^\s*https?:\/\//i.test(line))
    .join('\n')
    .trim();
}

function toConfidencePercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

/* ─── Skeleton loader ───────────────────────────────────────────── */

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-[28px] border quorum-border-default quorum-surface ${className ?? ''}`} />
  );
}

function SourcesSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBlock className="h-48" />
      <div className="grid gap-4 md:grid-cols-4">
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
        <SkeletonBlock className="h-28" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <SkeletonBlock className="h-56" />
        <SkeletonBlock className="h-56" />
      </div>
    </div>
  );
}

/* ─── Custom chart tooltip ──────────────────────────────────────── */

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-2xl border quorum-border-default quorum-surface-strong px-3 py-2 shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <p className="mb-0.5 text-xs quorum-text-muted">{label}</p>
      <p className="text-sm font-semibold quorum-text-primary">{payload[0].value} citations</p>
    </div>
  );
}

/* ─── Filter chip ───────────────────────────────────────────────── */

function FilterChip({
  children,
  active,
  onClick,
}: {
  children?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
        active
          ? 'border quorum-border-strong quorum-surface-strong quorum-text-primary'
          : 'border border-transparent quorum-text-muted hover:quorum-surface hover:quorum-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

/* ─── Select wrapper ────────────────────────────────────────────── */

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        className="appearance-none rounded-full border quorum-border-default quorum-surface-strong pl-3 pr-7 py-1.5 text-xs quorum-text-primary outline-none transition-colors hover:quorum-border-strong focus:quorum-border-strong"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 quorum-text-subtle" />
    </div>
  );
}

/* ─── Opportunity badge ─────────────────────────────────────────── */

function OpportunityBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border quorum-border-default quorum-surface px-2 py-0.5 text-[10px] font-medium quorum-text-muted">
      <Sparkles className="h-2.5 w-2.5" />
      Opportunité
    </span>
  );
}

/* ─── Main Component ────────────────────────────────────────────── */

export function SourcesHub({ topics, projectId }: { topics: TopicOption[]; projectId: string }) {
  /* State – filters */
  const [tab, setTab] = useState<'domains' | 'urls'>('domains');
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [owned, setOwned] = useState<'all' | 'owned' | 'earned'>('all');
  const [topicId, setTopicId] = useState<string | 'all'>('all');
  const [model, setModel] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [gapOnly, setGapOnly] = useState(false);

  /* State – data */
  const [payload, setPayload] = useState<SourcesPayload | null>(null);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* State – runs */
  const [runInfo, setRunInfo] = useState<RunInfo>({ latestRun: null });
  const [cronStatus, setCronStatus] = useState<CronStatus | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [manualRunning, setManualRunning] = useState(false);

  /* State – modals */
  const [evidence, setEvidence] = useState<EvidenceData | null>(null);

  /* State – table sort */
  const [sortKey, setSortKey] = useState<'used_total' | 'used_share' | 'quality_score' | 'last_seen' | 'brand_mentioned_rate'>('used_share');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [headerTooltip, setHeaderTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  /* ─── Query string ────────────────────────────────────────── */

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('tab', tab);
    params.set('range', String(range));
    if (owned !== 'all') params.set('owned', owned);
    if (topicId !== 'all') params.set('topic', topicId);
    if (model !== 'all') params.set('model', model);
    if (search.trim()) params.set('search', search.trim());
    if (gapOnly) params.set('gap', 'true');
    return params.toString();
  }, [tab, range, owned, topicId, model, search, gapOnly]);

  /* ─── Data fetching (table + filters) ─────────────────────── */

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    fetch(`/api/sources?${queryString}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data?.error) {
          setError(typeof data.error === 'string' ? data.error : 'Impossible de charger les sources.');
          setPayload(null);
          return;
        }
        setPayload(data);
      })
      .catch(() => {
        if (!isMounted) return;
        setError('Impossible de charger les sources.');
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });
    return () => { isMounted = false; };
  }, [queryString]);

  /* ─── Summary fetching (KPIs + latest run) ────────────────── */

  useEffect(() => {
    let isMounted = true;
    setSummaryLoading(true);
    setRunLoading(true);
    fetch(`/api/projects/${projectId}/sources/summary?window=${range}d`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data?.error) {
          setRunError(typeof data.error === 'string' ? data.error : 'Impossible de charger le statut.');
          setSummary(null);
          return;
        }
        setSummary(data);
        setRunInfo({ latestRun: data?.latestRun ?? null });
      })
      .catch(() => {
        if (!isMounted) return;
        setRunError('Impossible de charger le statut.');
      })
      .finally(() => {
        if (!isMounted) return;
        setSummaryLoading(false);
        setRunLoading(false);
      });
    return () => { isMounted = false; };
  }, [projectId, range]);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/cron/status')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data?.error) return;
        setCronStatus(data as CronStatus);
      })
      .catch(() => {
        // best effort only
      });
    return () => { isMounted = false; };
  }, [projectId]);

  /* ─── Manual run ──────────────────────────────────────────── */

  const triggerManualRun = async () => {
    setManualRunning(true);
    setRunError(null);
    try {
      const res = await fetch('/api/monitoring/manual-run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) setRunError(data?.error || 'Impossible de relancer.');
    } catch {
      setRunError('Impossible de relancer.');
    } finally {
      setManualRunning(false);
      // refresh summary after manual run
      setSummaryLoading(true);
      fetch(`/api/projects/${projectId}/sources/summary?window=${range}d`)
        .then((res) => res.json())
        .then((data) => {
          setSummary(data);
          setRunInfo({ latestRun: data?.latestRun ?? null });
        })
        .catch(() => setRunError('Impossible de charger le statut.'))
        .finally(() => setSummaryLoading(false));
      fetch('/api/cron/status')
        .then((res) => res.json())
        .then((data) => {
          if (data?.error) return;
          setCronStatus(data as CronStatus);
        })
        .catch(() => {
          // best effort only
        });
    }
  };

  /* ─── CSV export ──────────────────────────────────────────── */

  const exportCsv = () => {
    if (!payload?.table?.length) return;
    const rows = payload.table.map((row: SourceTableRow) => ({
      source: row.key,
      type: row.type,
      owned: row.is_owned ? 'owned' : 'earned',
      used_total: row.used_total,
      used_share: row.used_share,
      avg_citations_per_run: row.avg_citations_per_run,
      last_seen: row.last_seen,
      brand_mentioned_rate: row.brand_mentioned_rate,
      quality_score: row.quality_score,
    }));
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((r: Record<string, unknown>) => headers.map((h: string) => JSON.stringify(r[h] ?? '')).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sources-${tab}-${range}d.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ─── Table sort ──────────────────────────────────────────── */

  const sortedTable = useMemo(() => {
    if (!payload?.table?.length) return [];
    return [...payload.table].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [payload, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d: 'desc' | 'asc') => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const showHeaderTooltip = (text: string, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    setHeaderTooltip({
      text,
      x: rect.left + (rect.width / 2),
      y: rect.bottom + 8,
    });
  };

  const hideHeaderTooltip = () => setHeaderTooltip(null);

  /* ─── Evidence ────────────────────────────────────────────── */

  const openEvidence = async (scope: 'domain' | 'url', key: string) => {
    try {
      const res = await fetch(`/api/sources/evidence?scope=${scope}&key=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (data?.items) setEvidence({ key, scope, items: data.items });
    } catch { /* silent */ }
  };

  /* ─── Chart data ──────────────────────────────────────────── */

  const chartData = useMemo(
    () => (summary?.metrics?.series ?? []).map((s) => ({ ...s, label: formatChartDate(s.date) })),
    [summary?.metrics?.series]
  );

  /* ─── Derived ─────────────────────────────────────────────── */

  const metrics = summary?.metrics;
  const hasData = !!metrics && metrics.total_citations > 0;
  const isRunning = runInfo.latestRun?.status === 'running';

  /* ─── Render ──────────────────────────────────────────────── */

  return (
    <div className="space-y-8">
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="quorum-kicker">Sources</p>
            <h1 className="mt-2 text-4xl font-bold tracking-[-0.05em] quorum-text-primary">Influence éditoriale des réponses IA</h1>
            <p className="mt-2 text-sm quorum-text-muted">
              Quelles sources influencent les réponses IA sur votre marché.
            </p>
          </div>
          <button
            onClick={exportCsv}
            disabled={!hasData}
            className="quorum-btn-secondary hidden md:inline-flex"
          >
            <Download className="h-3.5 w-3.5" />
            Exporter
          </button>
        </div>

        {/* Status bar */}
        <StatusBar
          runInfo={runInfo}
          isLoading={runLoading || summaryLoading}
          onManualRun={triggerManualRun}
          isManualRunning={manualRunning}
          error={runError}
          cronStatus={cronStatus}
        />
      </div>

      {/* ── Loading skeleton ────────────────────────────────── */}
      {loading && !payload && <SourcesSkeleton />}

      {/* ── Error ───────────────────────────────────────────── */}
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-5 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {payload && !hasData && (
        <div className="quorum-panel-strong p-12 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border quorum-border-default quorum-surface-strong">
            <Globe className="h-6 w-6 quorum-text-primary" />
          </div>
          <h3 className="text-lg font-medium quorum-text-primary mb-2">Aucune donnée de monitoring</h3>
          <p className="mx-auto mb-6 max-w-sm text-sm quorum-text-muted">
            Les sources s'alimentent via les exécutions automatiques. Configurez des enjeux et des questions pour lancer le monitoring.
          </p>
          <a
            href="/monitoring"
            className="quorum-btn-primary"
          >
            Configurer le monitoring
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────── */}
      {hasData && metrics && (
        <>
          {/* A. Hero Section */}
          <ScoreHero
            qualityScore={metrics.avg_quality_score}
            ownedShare={metrics.owned_share}
            competitorShare={metrics.competitor_share}
            totalCitations={metrics.total_citations}
            isRunning={isRunning}
          />

          {/* B. KPI Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Domaines uniques"
              value={metrics.unique_domains}
              icon={Globe}
              color="blue"
              description="Sites différents citant votre marché"
              tooltip="Nombre de sites web distincts cités par les IA sur votre marché."
            />
            <MetricCard
              label="URLs uniques"
              value={metrics.unique_urls}
              icon={Link2}
              color="cyan"
              description="Pages précises référencées"
              tooltip="Nombre de pages web précises (avec leur chemin complet) citées par les IA."
            />
            <MetricCard
              label="Citations observées"
              value={metrics.observed_citations}
              icon={Eye}
              color="emerald"
              description="URLs explicitement citées par l'IA"
              tooltip="URLs explicitement présentes dans la réponse IA — détection directe et fiable."
            />
            <MetricCard
              label="Citations probables"
              value={metrics.probable_citations}
              icon={BarChart3}
              color="violet"
              description="Sources inférées sans URL explicite"
              tooltip="Sources inférées par un follow-up IA quand aucune URL n'est citée directement — moins fiables."
            />
          </div>

          {/* Owned share warning */}
          {metrics.owned_share === 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-300 leading-relaxed">
              Part propriétaires à 0%. Vérifiez que le site de votre marque est renseigné dans
              <a href="/brand-settings" className="underline underline-offset-2 ml-1 text-amber-200 hover:quorum-text-primary">Brand settings</a>.
            </div>
          )}

          {/* C. Share breakdown + Trend chart */}
          <div className="grid gap-6 md:grid-cols-2">
            <ShareBar
              ownedShare={metrics.owned_share}
              competitorShare={metrics.competitor_share}
              thirdPartyShare={metrics.third_party_share}
            />

            {/* Trend chart */}
            <div className="quorum-panel p-6">
              <div className="mb-4">
                <h3 className="text-sm font-medium quorum-text-primary">Évolution des citations</h3>
                <p className="mt-0.5 text-xs quorum-text-subtle">Volume quotidien sur {range} jours</p>
              </div>
              {chartData.length > 0 ? (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: 'rgba(255,255,255,0.38)', fontSize: 10 }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: 'rgba(255,255,255,0.38)', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={30}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="total_citations"
                        stroke="#f3efe6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0, fill: '#f3efe6' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-12 text-center text-sm quorum-text-muted">Pas encore de données de tendance.</p>
              )}
            </div>
          </div>

          {/* ── D. Sources table ─────────────────────────────── */}
          <div className="quorum-panel overflow-hidden">
            {/* Table header with filters */}
            <div className="p-5 border-b quorum-border-default">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium quorum-text-primary">
                    Top {tab === 'domains' ? 'domaines' : 'URLs'}
                  </h3>
                  {gapOnly && <OpportunityBadge />}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Tab switch */}
                  <div className="flex items-center rounded-full border quorum-border-default quorum-surface-strong p-0.5">
                    <FilterChip active={tab === 'domains'} onClick={() => setTab('domains')}>
                      Domaines
                    </FilterChip>
                    <FilterChip active={tab === 'urls'} onClick={() => setTab('urls')}>
                      URLs
                    </FilterChip>
                  </div>

                  {/* Range */}
                  <FilterSelect value={String(range)} onChange={(v) => setRange(Number(v) as 7 | 30 | 90)}>
                    <option value="7">7 jours</option>
                    <option value="30">30 jours</option>
                    <option value="90">90 jours</option>
                  </FilterSelect>

                  {/* Ownership */}
                  <FilterSelect value={owned} onChange={(v) => setOwned(v as 'all' | 'owned' | 'earned')}>
                    <option value="all">Toutes sources</option>
                    <option value="owned">Propriétaires</option>
                    <option value="earned">Acquises</option>
                  </FilterSelect>

                  {/* Topic */}
                  {topics.length > 0 && (
                    <FilterSelect value={topicId} onChange={setTopicId}>
                      <option value="all">Tous les enjeux</option>
                      {topics.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </FilterSelect>
                  )}

                  {/* Model */}
                  <FilterSelect value={model} onChange={setModel}>
                    <option value="all">Tous modèles</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o mini</option>
                  </FilterSelect>

                  {/* Opportunities toggle */}
                  <button
                    onClick={() => setGapOnly((prev: boolean) => !prev)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                      gapOnly
                        ? 'border quorum-border-strong quorum-surface-strong quorum-text-primary'
                        : 'border quorum-border-default quorum-text-muted hover:quorum-text-primary'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    Opportunités
                  </button>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 quorum-text-subtle" />
                    <input
                      value={search}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                      placeholder="Rechercher…"
                      className="w-36 rounded-full border quorum-border-default quorum-surface-strong py-1.5 pl-8 pr-3 text-xs quorum-text-primary outline-none transition-colors placeholder:quorum-text-subtle hover:quorum-border-strong focus:quorum-border-strong"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Table content */}
            {payload?.table?.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm quorum-text-muted">Aucune source détectée avec ces filtres.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b quorum-border-default">
                      <th className="text-left px-5 py-3 text-xs font-medium quorum-text-subtle uppercase tracking-wider">
                        Source
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium quorum-text-subtle uppercase tracking-wider">
                        <HeaderWithInfo
                          label="Type"
                          tooltip="Catégorie éditoriale de la source (Éditorial, UGC, Institutionnel, etc.)"
                          onShowInfo={showHeaderTooltip}
                          onHideInfo={hideHeaderTooltip}
                        />
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-medium quorum-text-subtle uppercase tracking-wider"
                      >
                        <HeaderWithInfo
                          label="Usage"
                          tooltip="Nombre de fois que cette source a été citée sur la période sélectionnée"
                          sortable
                          active={sortKey === 'used_total'}
                          direction={sortDir}
                          onClick={() => toggleSort('used_total')}
                          onShowInfo={showHeaderTooltip}
                          onHideInfo={hideHeaderTooltip}
                        />
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-medium quorum-text-subtle uppercase tracking-wider"
                      >
                        <HeaderWithInfo
                          label="Part"
                          tooltip="Pourcentage de citations que représente cette source sur le total"
                          sortable
                          active={sortKey === 'used_share'}
                          direction={sortDir}
                          onClick={() => toggleSort('used_share')}
                          onShowInfo={showHeaderTooltip}
                          onHideInfo={hideHeaderTooltip}
                        />
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-medium quorum-text-subtle uppercase tracking-wider"
                      >
                        <HeaderWithInfo
                          label="Marque"
                          tooltip="Pourcentage des citations de cette source où ta marque apparaît dans la réponse"
                          sortable
                          active={sortKey === 'brand_mentioned_rate'}
                          direction={sortDir}
                          onClick={() => toggleSort('brand_mentioned_rate')}
                          onShowInfo={showHeaderTooltip}
                          onHideInfo={hideHeaderTooltip}
                        />
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-medium quorum-text-subtle uppercase tracking-wider"
                      >
                        <HeaderWithInfo
                          label="Qualité"
                          tooltip="Score de fiabilité et d'autorité de la source, de 0 à 100"
                          sortable
                          active={sortKey === 'quality_score'}
                          direction={sortDir}
                          onClick={() => toggleSort('quality_score')}
                          onShowInfo={showHeaderTooltip}
                          onHideInfo={hideHeaderTooltip}
                        />
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-medium quorum-text-subtle uppercase tracking-wider"
                      >
                        <HeaderWithInfo
                          label="Dernière vue"
                          tooltip="Date de la dernière détection de cette source dans une réponse IA"
                          sortable
                          active={sortKey === 'last_seen'}
                          direction={sortDir}
                          onClick={() => toggleSort('last_seen')}
                          onShowInfo={showHeaderTooltip}
                          onHideInfo={hideHeaderTooltip}
                        />
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTable.map((row: SourceTableRow) => (
                      <tr
                        key={row.key}
                        className="border-t quorum-border-default transition-colors hover:quorum-surface group"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            {row.is_owned ? (
                              <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                            ) : (
                              <Users className="h-3.5 w-3.5 shrink-0 quorum-text-subtle" />
                            )}
                            <span className="max-w-[240px] truncate font-medium quorum-text-primary">{row.key}</span>
                            {row.opportunity && <OpportunityBadge />}
                          </div>
                        </td>
                        <td className="px-4 py-3 quorum-text-muted">{TYPE_LABELS[row.type] ?? row.type}</td>
                        <td className="px-4 py-3 quorum-text-primary tabular-nums">{row.used_total}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full quorum-surface-strong">
                              <div
                                className="h-full rounded-full bg-white/75 transition-all duration-500"
                                style={{ width: `${Math.min(row.used_share, 100)}%` }}
                              />
                            </div>
                            <span className="quorum-text-muted tabular-nums text-xs">{row.used_share}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`tabular-nums ${
                            row.brand_mentioned_rate >= 50
                              ? 'text-emerald-300'
                              : row.brand_mentioned_rate >= 20
                                ? 'text-amber-300'
                                : 'quorum-text-subtle'
                          }`}>
                            {row.brand_mentioned_rate}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`tabular-nums ${
                            row.quality_score >= 60 ? 'quorum-text-primary' : 'quorum-text-muted'
                          }`}>
                            {row.quality_score}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs quorum-text-subtle tabular-nums">{formatShortDate(row.last_seen)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openEvidence(tab === 'domains' ? 'domain' : 'url', row.key)}
                            className="rounded-full quorum-surface-strong px-2.5 py-1 text-[11px] quorum-text-muted opacity-0 transition-all hover:quorum-surface hover:quorum-text-primary group-hover:opacity-100"
                          >
                            Voir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {headerTooltip && (
        <div
          className="fixed z-[90] max-w-xs -translate-x-1/2 rounded-2xl border quorum-border-strong quorum-surface-strong px-3 py-2 text-[11px] quorum-text-primary shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl"
          style={{ left: `${headerTooltip.x}px`, top: `${headerTooltip.y}px` }}
        >
          {headerTooltip.text}
        </div>
      )}

      {/* ── Evidence modal ──────────────────────────────────── */}
      {evidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center quorum-backdrop backdrop-blur-sm px-4">
          <div className="w-full max-w-3xl rounded-[30px] border quorum-border-default quorum-surface-strong shadow-[0_40px_120px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
            <div className="flex items-center justify-between p-5 border-b quorum-border-default">
              <div>
                <h3 className="text-base font-semibold quorum-text-primary">Evidence</h3>
                <p className="text-xs quorum-text-subtle mt-0.5">
                  {evidence.scope === 'domain' ? 'Domaine' : 'URL'} : {evidence.key}
                </p>
              </div>
              <button
                onClick={() => setEvidence(null)}
                className="quorum-btn-secondary px-3 py-1.5 text-xs"
              >
                Fermer
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[60vh] overflow-auto">
              {evidence.items.length === 0 && (
                <p className="py-8 text-center text-sm quorum-text-muted">Aucune evidence disponible.</p>
              )}
              {evidence.items.map((item: EvidenceItem, idx: number) => (
                <div key={`${item.id || item.response_id || 'r'}-${idx}`} className="relative pl-6">
                  <div className="absolute left-2 top-2 bottom-0 w-px quorum-surface-strong" />
                  <div className="absolute left-[5px] top-2 h-3 w-3 rounded-full border quorum-border-default bg-white/80" />
                  <div className="quorum-panel-soft p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          item.method === 'observed'
                            ? 'border border-emerald-400/20 bg-emerald-500/15 text-emerald-300'
                            : 'border border-amber-400/20 bg-amber-500/15 text-amber-300'
                        }`}>
                          {item.method === 'observed' ? 'Observée' : 'Probable'}
                        </span>
                      </div>
                      <div className="text-right text-[11px] quorum-text-subtle">
                        <div>{new Date(item.cited_at).toLocaleString('fr-FR')}</div>
                        <div>{item.ai_model || 'modèle inconnu'}</div>
                      </div>
                    </div>

                    {item.prompt_text && (
                      <p className="text-base md:text-lg font-semibold quorum-text-primary leading-snug">{item.prompt_text}</p>
                    )}

                    {typeof item.confidence === 'number' && (
                      <div className="space-y-1">
                        {(() => {
                          const confidenceScore = toConfidencePercent(item.confidence);
                          return (
                            <>
                              <div className="flex items-center justify-between text-[11px] quorum-text-muted">
                                <span>Score de confiance</span>
                                <span>{confidenceScore}%</span>
                              </div>
                              <div style={{ width: '100%', backgroundColor: '#374151', borderRadius: '9999px', height: '6px' }}>
                                <div style={{
                                  width: `${confidenceScore}%`,
                                backgroundColor: '#f3efe6',
                                borderRadius: '9999px',
                                height: '6px',
                              }} />
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {item.source_urls && item.source_urls.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {item.source_urls.map((sourceUrl) => (
                          <a
                            key={sourceUrl}
                            href={sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border quorum-border-default quorum-surface px-2.5 py-1 text-[11px] quorum-text-muted hover:quorum-surface hover:quorum-text-primary"
                          >
                            {sourceUrl}
                          </a>
                        ))}
                      </div>
                    )}

                    {cleanEvidenceSnippet(item.response_snippet) && (
                      <p className="whitespace-pre-wrap text-xs leading-relaxed quorum-text-muted">{cleanEvidenceSnippet(item.response_snippet)}</p>
                    )}
                    {item.rationale && (
                      <p className="text-[11px] italic quorum-text-subtle">Rationale : {item.rationale}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
