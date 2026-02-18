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
  cited_at: string;
  method: string | null;
  confidence: number | null;
  rationale: string | null;
  ai_model: string | null;
  prompt_text: string | null;
  response_snippet: string | null;
  response_id: string | null;
};

type EvidenceData = {
  key: string;
  scope: 'domain' | 'url';
  items: EvidenceItem[];
};

type RunInfo = {
  lastRun: {
    id: string;
    run_date: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    error_message?: string | null;
  } | null;
  lastSuccess: {
    id: string;
    run_date: string;
    status: string;
    started_at: string;
    finished_at: string | null;
  } | null;
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

/* ─── Skeleton loader ───────────────────────────────────────────── */

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl bg-zinc-900/40 border border-white/[0.06] ${className ?? ''}`} />
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
    <div className="rounded-xl border border-white/[0.08] bg-zinc-900/95 backdrop-blur-sm px-3 py-2 shadow-xl">
      <p className="text-xs text-zinc-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-white">{payload[0].value} citations</p>
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
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
        active
          ? 'bg-white/[0.08] text-white border border-white/[0.12]'
          : 'text-zinc-500 border border-transparent hover:text-zinc-300 hover:bg-white/[0.04]'
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
        className="appearance-none rounded-lg border border-white/[0.08] bg-zinc-900/60 pl-3 pr-7 py-1.5 text-xs text-zinc-300 outline-none transition-colors hover:border-white/[0.12] focus:border-white/[0.16]"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
    </div>
  );
}

/* ─── Opportunity badge ─────────────────────────────────────────── */

function OpportunityBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-[10px] font-medium text-violet-400">
      <Sparkles className="w-2.5 h-2.5" />
      Opportunité
    </span>
  );
}

/* ─── Main Component ────────────────────────────────────────────── */

export function SourcesHub({ topics }: { topics: TopicOption[] }) {
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* State – runs */
  const [runInfo, setRunInfo] = useState<RunInfo>({ lastRun: null, lastSuccess: null });
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [manualRunning, setManualRunning] = useState(false);

  /* State – modals */
  const [evidence, setEvidence] = useState<EvidenceData | null>(null);

  /* State – table sort */
  const [sortKey, setSortKey] = useState<'used_total' | 'used_share' | 'quality_score' | 'last_seen' | 'brand_mentioned_rate'>('used_share');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

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

  /* ─── Data fetching ───────────────────────────────────────── */

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

  /* ─── Run management ──────────────────────────────────────── */

  const refreshRuns = () => {
    setRunLoading(true);
    setRunError(null);
    fetch('/api/monitoring/daily-runs')
      .then((res) => res.json())
      .then((data) => {
        const runs = Array.isArray(data?.runs) ? data.runs : [];
        const lastRun = runs.length > 0 ? runs[0] : null;
        const lastSuccess = runs.find((r: any) => r.status === 'success' || r.status === 'partial') || null;
        setRunInfo({ lastRun, lastSuccess });
      })
      .catch(() => setRunError('Impossible de charger le statut.'))
      .finally(() => setRunLoading(false));
  };

  useEffect(() => { refreshRuns(); }, []);

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
      refreshRuns();
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
    () => (payload?.series ?? []).map((s: { date: string; total_citations: number }) => ({ ...s, label: formatChartDate(s.date) })),
    [payload?.series]
  );

  /* ─── Derived ─────────────────────────────────────────────── */

  const kpis = payload?.kpis;
  const hasData = !!kpis && kpis.total_citations > 0;
  const isRunning = runInfo.lastRun?.status === 'running';

  /* ─── Render ──────────────────────────────────────────────── */

  return (
    <div className="space-y-8">
      {/* ── Page header ─────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white tracking-tight">Sources</h1>
            <p className="text-zinc-500 text-sm mt-1">
              Quelles sources influencent les réponses IA sur votre marché.
            </p>
          </div>
          <button
            onClick={exportCsv}
            disabled={!hasData}
            className="hidden md:inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-xs text-zinc-300 transition-all duration-200 hover:bg-white/[0.06] hover:border-white/[0.12] disabled:opacity-30"
          >
            <Download className="h-3.5 w-3.5" />
            Exporter
          </button>
        </div>

        {/* Status bar */}
        <StatusBar
          runInfo={runInfo}
          isLoading={runLoading}
          onManualRun={triggerManualRun}
          isManualRunning={manualRunning}
          error={runError}
        />
      </div>

      {/* ── Loading skeleton ────────────────────────────────── */}
      {loading && !payload && <SourcesSkeleton />}

      {/* ── Error ───────────────────────────────────────────── */}
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-5 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────── */}
      {payload && !hasData && (
        <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-violet-500/20 border border-white/[0.08] flex items-center justify-center mx-auto mb-5">
            <Globe className="w-6 h-6 text-cyan-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">Aucune donnée de monitoring</h3>
          <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-6">
            Les sources s'alimentent via les exécutions automatiques. Configurez des enjeux et des questions pour lancer le monitoring.
          </p>
          <a
            href="/monitoring"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 via-cyan-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-cyan-500/20"
          >
            Configurer le monitoring
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────── */}
      {hasData && kpis && (
        <>
          {/* A. Hero Section */}
          <ScoreHero
            qualityScore={kpis.avg_quality_score}
            ownedShare={kpis.owned_share}
            competitorShare={kpis.competitor_share}
            totalCitations={kpis.total_citations}
            isRunning={isRunning}
          />

          {/* B. KPI Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Domaines uniques"
              value={kpis.unique_domains}
              icon={Globe}
              color="blue"
              description="Sites différents citant votre marché"
            />
            <MetricCard
              label="URLs uniques"
              value={kpis.unique_urls}
              icon={Link2}
              color="cyan"
              description="Pages précises référencées"
            />
            <MetricCard
              label="Citations observées"
              value={kpis.observed_citations}
              icon={Eye}
              color="emerald"
              description="URLs explicitement citées par l'IA"
            />
            <MetricCard
              label="Citations probables"
              value={kpis.probable_citations}
              icon={BarChart3}
              color="violet"
              description="Sources inférées sans URL explicite"
            />
          </div>

          {/* Owned share warning */}
          {kpis.owned_share === 0 && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-300 leading-relaxed">
              Part propriétaires à 0%. Vérifiez que le site de votre marque est renseigné dans
              <a href="/brand-settings" className="underline underline-offset-2 ml-1 text-amber-200 hover:text-white">Brand settings</a>.
            </div>
          )}

          {/* C. Share breakdown + Trend chart */}
          <div className="grid gap-6 md:grid-cols-2">
            <ShareBar
              ownedShare={kpis.owned_share}
              competitorShare={kpis.competitor_share}
              thirdPartyShare={kpis.third_party_share}
            />

            {/* Trend chart */}
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-white">Évolution des citations</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Volume quotidien sur {range} jours</p>
              </div>
              {chartData.length > 0 ? (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#52525b', fontSize: 10 }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#52525b', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={30}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="total_citations"
                        stroke="#22d3ee"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0, fill: '#22d3ee' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-zinc-500 py-12 text-center">Pas encore de données de tendance.</p>
              )}
            </div>
          </div>

          {/* ── D. Sources table ─────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40">
            {/* Table header with filters */}
            <div className="p-5 border-b border-white/[0.06]">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium text-white">
                    Top {tab === 'domains' ? 'domaines' : 'URLs'}
                  </h3>
                  {gapOnly && <OpportunityBadge />}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Tab switch */}
                  <div className="flex items-center rounded-lg border border-white/[0.08] bg-zinc-900/60 p-0.5">
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      gapOnly
                        ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                        : 'text-zinc-500 border border-white/[0.08] hover:text-zinc-300'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    Opportunités
                  </button>

                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                      value={search}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                      placeholder="Rechercher…"
                      className="rounded-lg border border-white/[0.08] bg-zinc-900/60 pl-8 pr-3 py-1.5 text-xs text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 hover:border-white/[0.12] focus:border-white/[0.16] w-36"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Table content */}
            {payload.table.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm text-zinc-500">Aucune source détectée avec ces filtres.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-5 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Source
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                        onClick={() => toggleSort('used_total')}
                      >
                        Usage {sortKey === 'used_total' && (sortDir === 'desc' ? '↓' : '↑')}
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                        onClick={() => toggleSort('used_share')}
                      >
                        Part {sortKey === 'used_share' && (sortDir === 'desc' ? '↓' : '↑')}
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                        onClick={() => toggleSort('brand_mentioned_rate')}
                      >
                        Marque {sortKey === 'brand_mentioned_rate' && (sortDir === 'desc' ? '↓' : '↑')}
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                        onClick={() => toggleSort('quality_score')}
                      >
                        Qualité {sortKey === 'quality_score' && (sortDir === 'desc' ? '↓' : '↑')}
                      </th>
                      <th
                        className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors"
                        onClick={() => toggleSort('last_seen')}
                      >
                        Dernière vue {sortKey === 'last_seen' && (sortDir === 'desc' ? '↓' : '↑')}
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTable.map((row: SourceTableRow) => (
                      <tr
                        key={row.key}
                        className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.02] group"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            {row.is_owned ? (
                              <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <Users className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            )}
                            <span className="text-zinc-200 font-medium truncate max-w-[240px]">{row.key}</span>
                            {row.opportunity && <OpportunityBadge />}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{TYPE_LABELS[row.type] ?? row.type}</td>
                        <td className="px-4 py-3 text-zinc-300 tabular-nums">{row.used_total}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-cyan-500/60 transition-all duration-500"
                                style={{ width: `${Math.min(row.used_share, 100)}%` }}
                              />
                            </div>
                            <span className="text-zinc-400 tabular-nums text-xs">{row.used_share}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`tabular-nums ${
                            row.brand_mentioned_rate >= 50
                              ? 'text-emerald-400'
                              : row.brand_mentioned_rate >= 20
                                ? 'text-amber-400'
                                : 'text-zinc-500'
                          }`}>
                            {row.brand_mentioned_rate}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`tabular-nums ${
                            row.quality_score >= 60 ? 'text-white' : 'text-zinc-400'
                          }`}>
                            {row.quality_score}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-500 text-xs tabular-nums">{formatShortDate(row.last_seen)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openEvidence(tab === 'domains' ? 'domain' : 'url', row.key)}
                            className="opacity-0 group-hover:opacity-100 rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] text-zinc-400 transition-all hover:bg-white/[0.1] hover:text-white"
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

      {/* ── Evidence modal ──────────────────────────────────── */}
      {evidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/[0.08] bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <div>
                <h3 className="text-base font-semibold text-white">Evidence</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {evidence.scope === 'domain' ? 'Domaine' : 'URL'} : {evidence.key}
                </p>
              </div>
              <button
                onClick={() => setEvidence(null)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:text-white hover:bg-white/[0.06]"
              >
                Fermer
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[60vh] overflow-auto">
              {evidence.items.length === 0 && (
                <p className="text-sm text-zinc-500 text-center py-8">Aucune evidence disponible.</p>
              )}
              {evidence.items.map((item: EvidenceItem, idx: number) => (
                <div key={`${item.response_id || 'r'}-${idx}`} className="rounded-xl border border-white/[0.06] bg-zinc-900/30 p-4 space-y-2">
                  <div className="flex flex-wrap gap-2 text-[11px] text-zinc-500">
                    <span>{new Date(item.cited_at).toLocaleString('fr-FR')}</span>
                    <span>•</span>
                    <span>{item.ai_model || 'model'}</span>
                    <span>•</span>
                    <span className={item.method === 'observed' ? 'text-emerald-400' : 'text-violet-400'}>
                      {item.method === 'observed' ? 'Observée' : 'Probable'}
                    </span>
                    {typeof item.confidence === 'number' && (
                      <>
                        <span>•</span>
                        <span>conf. {Math.round(item.confidence * 100)}%</span>
                      </>
                    )}
                  </div>
                  {item.prompt_text && (
                    <p className="text-sm text-zinc-300">{item.prompt_text}</p>
                  )}
                  {item.response_snippet && (
                    <p className="text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap">{item.response_snippet}</p>
                  )}
                  {item.rationale && (
                    <p className="text-[11px] text-zinc-600 italic">Rationale : {item.rationale}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
