'use client';

import { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Download, Filter, Info, Sparkles } from 'lucide-react';

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
  table: Array<{
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
  }>;
};

const TYPE_COLORS: Record<string, string> = {
  Institutional: '#818cf8',
  Editorial: '#f472b6',
  Corporate: '#38bdf8',
  UGC: '#22d3ee',
  Other: '#94a3b8',
};

const QUALITY_TOOLTIP = `Score (0–100) basé sur:
- Type de source
- Fréquence d’apparition
- Volume d’usage
- Fraîcheur`;

function HelpTip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group">
      <Info className="ml-1 h-3 w-3 text-zinc-500" />
      <span className="pointer-events-none absolute left-1/2 top-5 z-30 w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-2 text-[11px] leading-relaxed text-zinc-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

export function SourcesHub({ topics }: { topics: TopicOption[] }) {
  const [tab, setTab] = useState<'domains' | 'urls'>('domains');
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [owned, setOwned] = useState<'all' | 'owned' | 'earned'>('all');
  const [topicId, setTopicId] = useState<string | 'all'>('all');
  const [model, setModel] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [gapOnly, setGapOnly] = useState(false);
  const [payload, setPayload] = useState<SourcesPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runInfo, setRunInfo] = useState<{
    lastRun: {
      id: string;
      run_date: string;
      status: string;
      started_at: string;
      finished_at: string | null;
      error_message?: string | null;
    } | null;
  }>({ lastRun: null });
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [manualRunning, setManualRunning] = useState(false);
  const [actionModal, setActionModal] = useState<{
    title: string;
    reason: string;
    actions: string[];
  } | null>(null);
  const [evidence, setEvidence] = useState<{
    key: string;
    scope: 'domain' | 'url';
    items: Array<{
      cited_at: string;
      method: string | null;
      confidence: number | null;
      rationale: string | null;
      ai_model: string | null;
      prompt_text: string | null;
      response_snippet: string | null;
      response_id: string | null;
    }>;
  } | null>(null);
  const [sortKey, setSortKey] = useState<'used_total' | 'used_share' | 'quality_score' | 'last_seen' | 'brand_mentioned_rate'>('used_share');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const formatShortDate = (value: string) =>
    new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

  const typeLabel = (value: string) => {
    const map: Record<string, string> = {
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
    return map[value] || value;
  };

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
    return () => {
      isMounted = false;
    };
  }, [queryString]);

  const refreshRuns = () => {
    setRunLoading(true);
    setRunError(null);
    fetch('/api/monitoring/daily-runs')
      .then((res) => res.json())
      .then((data) => {
        const runs = Array.isArray(data?.runs) ? data.runs : [];
        const lastRun = runs.length > 0 ? runs[0] : null;
        setRunInfo({ lastRun });
      })
      .catch(() => {
        setRunError('Impossible de charger le statut du run.');
      })
      .finally(() => setRunLoading(false));
  };

  useEffect(() => {
    refreshRuns();
  }, []);

  const triggerManualRun = async () => {
    setManualRunning(true);
    setRunError(null);
    try {
      const res = await fetch('/api/monitoring/manual-run', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setRunError(data?.error || 'Impossible de relancer le monitoring.');
      }
    } catch {
      setRunError('Impossible de relancer le monitoring.');
    } finally {
      setManualRunning(false);
      refreshRuns();
    }
  };

  const statusLabel = (status?: string | null) => {
    const map: Record<string, string> = {
      success: 'succès',
      failed: 'échec',
      running: 'en cours',
      partial: 'partiel',
      pending: 'en attente',
      completed: 'succès',
    };
    if (!status) return 'inconnu';
    return map[status] || status;
  };

  const exportCsv = () => {
    if (!payload || !Array.isArray(payload.table)) return;
    const rows = payload.table.map((row) => ({
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
    const headers = Object.keys(rows[0] || {});
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => JSON.stringify((r as any)[h] ?? '')).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sources-${tab}-${range}d.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const subtitle = `${range} jours • ${tab === 'domains' ? 'Domaines' : 'URLs'} • ${
    owned === 'all' ? 'Toutes sources' : owned === 'owned' ? 'Propriétaires' : 'Acquises'
  }`;

  const sortedTable = useMemo(() => {
    if (!payload || !Array.isArray(payload.table)) return [];
    const sorted = [...payload.table].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [payload, sortKey, sortDir]);

  const openEvidence = async (scope: 'domain' | 'url', key: string) => {
    try {
      const res = await fetch(`/api/sources/evidence?scope=${scope}&key=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (!data?.items) return;
      setEvidence({ key, scope, items: data.items });
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Sources</h1>
        <p className="text-zinc-400 mt-1">
          Analyse des sources qui influencent les réponses IA.
        </p>
        <p className="text-xs text-zinc-500 mt-2">{subtitle}</p>
        <p className="text-xs text-zinc-500 mt-1">
          Basé uniquement sur le monitoring automatique (le sandbox est exclu).
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span>
            Dernier run:{' '}
            {runInfo.lastRun
              ? `${new Date(runInfo.lastRun.run_date).toLocaleDateString('fr-FR')} • ${statusLabel(runInfo.lastRun.status)}`
              : runLoading
                ? 'chargement…'
                : 'aucun'}
          </span>
          {runInfo.lastRun?.error_message && (
            <span className="text-rose-300">
              • {runInfo.lastRun.error_message}
            </span>
          )}
          <button
            onClick={triggerManualRun}
            disabled={manualRunning}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300 disabled:opacity-50"
          >
            {manualRunning ? 'Relance...' : 'Relancer maintenant'}
          </button>
          {runError && <span className="text-rose-300">• {runError}</span>}
        </div>
        {payload?.kpis && (
          <p className="text-xs text-zinc-500 mt-1">
            Observées: {payload.kpis.observed_citations ?? 0} • Probables: {payload.kpis.probable_citations ?? 0}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTab('domains')}
          className={`px-3 py-1.5 rounded-full text-xs border ${tab === 'domains' ? 'border-cyan-500/40 text-cyan-300' : 'border-white/10 text-zinc-400'}`}
        >
          Domaines
          <HelpTip text="Vue par site (ex: lemondedigital.fr). Idéal pour savoir quels sites influencent l’IA." />
        </button>
        <button
          onClick={() => setTab('urls')}
          className={`px-3 py-1.5 rounded-full text-xs border ${tab === 'urls' ? 'border-cyan-500/40 text-cyan-300' : 'border-white/10 text-zinc-400'}`}
        >
          URLs
          <HelpTip text="Vue par page précise (ex: /blog/article). Utile pour voir quelles pages exactes sont citées." />
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300">
            <Filter className="h-3 w-3" />
            <select
              value={range}
              onChange={(e) => setRange(Number(e.target.value) as 7 | 30 | 90)}
              className="bg-transparent outline-none"
            >
              <option value={7}>7 jours</option>
              <option value={30}>30 jours</option>
              <option value={90}>90 jours</option>
            </select>
            <HelpTip text="Choisis la période d’analyse." />
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300">
            <select
              value={owned}
              onChange={(e) => setOwned(e.target.value as 'all' | 'owned' | 'earned')}
              className="bg-transparent outline-none"
            >
              <option value="all">Toutes sources</option>
              <option value="owned">Propriétaires</option>
              <option value="earned">Acquises</option>
            </select>
            <HelpTip text="Propriétaires = votre site. Acquises = médias, forums, tiers." />
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300">
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="bg-transparent outline-none"
            >
              <option value="all">Tous les enjeux</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <HelpTip text="Filtre par enjeu (topic) pour analyser une thématique précise." />
          </div>
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-300">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="bg-transparent outline-none"
            >
              <option value="all">Tous modèles</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4o-mini">GPT-4o mini</option>
            </select>
            <HelpTip text="Filtre par modèle IA utilisé pour les analyses." />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une source"
            className="rounded-full border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-200"
          />
          <button
            onClick={() => setGapOnly((prev) => !prev)}
            className={`px-3 py-1.5 rounded-full text-xs border ${gapOnly ? 'border-rose-500/40 text-rose-300' : 'border-white/10 text-zinc-400'}`}
          >
            Opportunités
            <HelpTip text="Affiche uniquement les sources où la marque est peu citée (opportunités d’optimisation)." />
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-zinc-300"
          >
            <Download className="h-3 w-3" />
            Exporter CSV
            <HelpTip text="Télécharge les données du tableau au format CSV." />
          </button>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6 text-sm text-zinc-400">
          Chargement des sources...
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          {error}
        </div>
      )}

      {payload && payload.kpis.total_citations === 0 && (
        <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6 text-sm text-zinc-300">
          <p className="text-white font-medium mb-1">Aucune donnée de monitoring.</p>
          <p className="text-zinc-400 mb-4">
            Les sources s’alimentent uniquement via les exécutions automatiques. Configure des enjeux et des questions pour lancer le monitoring.
          </p>
          <a
            href="/monitoring"
            className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-200"
          >
            Configurer le monitoring
          </a>
        </div>
      )}

      {payload && payload.kpis && payload.kpis.total_citations > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-7">
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500">
                Citations totales
                <HelpTip text="Nombre total de fois où une source est citée." />
              </p>
              <p className="text-xl font-semibold text-white">{payload.kpis.total_citations}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500">
                Domaines uniques
                <HelpTip text="Nombre de sites différents cités." />
              </p>
              <p className="text-xl font-semibold text-white">{payload.kpis.unique_domains}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500">
                URLs uniques
                <HelpTip text="Nombre de pages précises citées." />
              </p>
              <p className="text-xl font-semibold text-white">{payload.kpis.unique_urls}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500">
                Part propriétaires
                <HelpTip text="Part des citations provenant de votre propre site." />
              </p>
              <p className="text-xl font-semibold text-white">{payload.kpis.owned_share}%</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500">
                Part concurrents
                <HelpTip text="Part des citations provenant des sites de concurrents." />
              </p>
              <p className="text-xl font-semibold text-white">{payload.kpis.competitor_share}%</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500">
                Part tiers
                <HelpTip text="Part des citations provenant de sites tiers." />
              </p>
              <p className="text-xl font-semibold text-white">{payload.kpis.third_party_share}%</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                Score qualité
                <HelpTip text={QUALITY_TOOLTIP} />
              </p>
              <p className="text-xl font-semibold text-white">{payload.kpis.avg_quality_score}</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
              <p className="text-sm font-medium text-white mb-3">
                Répartition par type
                <HelpTip text="Montre quels types de sources (médias, institutions, UGC…) influencent l’IA." />
              </p>
              {payload.breakdown.length === 0 ? (
                <p className="text-sm text-zinc-500">Aucune source détectée.</p>
              ) : (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={payload.breakdown} dataKey="count" nameKey="type" innerRadius={40} outerRadius={70}>
                        {payload.breakdown.map((entry) => (
                          <Cell key={entry.type} fill={TYPE_COLORS[entry.type] || '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [value, typeLabel(name)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4 md:col-span-2">
              <p className="text-sm font-medium text-white mb-3">
                Usage dans le temps
                <HelpTip text="Évolution du nombre de citations par jour." />
              </p>
              {payload.series.length === 0 ? (
                <p className="text-sm text-zinc-500">Aucune donnée de tendance.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={payload.series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15, 23, 42, 0.9)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '12px',
                          color: '#fff',
                        }}
                      />
                      <Line type="monotone" dataKey="total_citations" stroke="#22d3ee" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-white">Top {tab === 'domains' ? 'Domaines' : 'URLs'}</p>
              {gapOnly && (
                <span className="text-xs text-rose-300 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Opportunités
                </span>
              )}
            </div>
            {payload.table.length === 0 ? (
              <p className="text-sm text-zinc-500">Aucune source détectée.</p>
            ) : (
              <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-900/60 text-zinc-400">
                    <tr>
                      <th className="text-left px-3 py-2">
                        Source
                        <HelpTip text="Domaine ou URL cité dans la réponse." />
                      </th>
                      <th className="text-left px-3 py-2">
                        Type
                        <HelpTip text="Catégorie de la source (média, institution, UGC…)." />
                      </th>
                      <th
                        className="text-left px-3 py-2 cursor-pointer"
                        onClick={() => {
                          setSortKey('used_total');
                          setSortDir(sortDir === 'desc' && sortKey === 'used_total' ? 'asc' : 'desc');
                        }}
                      >
                        Usage
                        <HelpTip text="Nombre total de citations sur la période." />
                      </th>
                      <th
                        className="text-left px-3 py-2 cursor-pointer"
                        onClick={() => {
                          setSortKey('used_share');
                          setSortDir(sortDir === 'desc' && sortKey === 'used_share' ? 'asc' : 'desc');
                        }}
                      >
                        Part
                        <HelpTip text="Pourcentage des citations totales." />
                      </th>
                      <th className="text-left px-3 py-2">
                        Méthode
                        <HelpTip text="Répartition Observées vs Probables." />
                      </th>
                      <th
                        className="text-left px-3 py-2 cursor-pointer"
                        onClick={() => {
                          setSortKey('brand_mentioned_rate');
                          setSortDir(sortDir === 'desc' && sortKey === 'brand_mentioned_rate' ? 'asc' : 'desc');
                        }}
                      >
                        Mention marque
                        <HelpTip text="Taux de réponses où la marque est mentionnée." />
                      </th>
                      <th
                        className="text-left px-3 py-2 cursor-pointer"
                        onClick={() => {
                          setSortKey('quality_score');
                          setSortDir(sortDir === 'desc' && sortKey === 'quality_score' ? 'asc' : 'desc');
                        }}
                      >
                        Qualité
                        <HelpTip text="Score global de fiabilité et d’impact de la source." />
                      </th>
                      <th
                        className="text-left px-3 py-2 cursor-pointer"
                        onClick={() => {
                          setSortKey('last_seen');
                          setSortDir(sortDir === 'desc' && sortKey === 'last_seen' ? 'asc' : 'desc');
                        }}
                      >
                        Dernière vue
                        <HelpTip text="Dernière apparition de cette source dans les réponses." />
                      </th>
                      <th className="text-left px-3 py-2">
                        Evidence
                        <HelpTip text="Voir les réponses qui justifient cette source." />
                      </th>
                      <th className="text-left px-3 py-2">
                        Action
                        <HelpTip text="Actions recommandées selon la performance de la source." />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTable.map((row) => (
                      <tr key={row.key} className="border-t border-white/[0.06]">
                        <td className="px-3 py-2 text-zinc-200">{row.key}</td>
                        <td className="px-3 py-2 text-zinc-400">{typeLabel(row.type)}</td>
                        <td className="px-3 py-2 text-zinc-400">{row.used_total}</td>
                        <td className="px-3 py-2 text-zinc-400">{row.used_share}%</td>
                        <td className="px-3 py-2 text-zinc-400">
                          {row.observed_share}% obs • {row.probable_share}% prob
                        </td>
                        <td className="px-3 py-2 text-zinc-400">{row.brand_mentioned_rate}%</td>
                        <td className="px-3 py-2 text-zinc-200">{row.quality_score}</td>
                        <td className="px-3 py-2 text-zinc-400">{formatShortDate(row.last_seen)}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => openEvidence(tab === 'domains' ? 'domain' : 'url', row.key)}
                            className="rounded-full bg-white/10 text-zinc-200 px-3 py-1 text-xs"
                          >
                            Voir
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          {row.opportunity ? (
                            <button
                              onClick={() =>
                                setActionModal({
                                  title: 'Opportunité détectée',
                                  reason: 'Faible mention de la marque sur une source externe.',
                                  actions: [
                                    'Créer une page ciblée pour cette source.',
                                    'Renforcer le linking vers votre contenu.',
                                    'Préparer un outreach éditorial.',
                                  ],
                                })
                              }
                              className="rounded-full bg-rose-500/15 text-rose-200 px-3 py-1 text-xs"
                            >
                              Opportunité
                            </button>
                          ) : row.is_owned ? (
                            <button
                              onClick={() =>
                                setActionModal({
                                  title: 'Optimiser page propriétaire',
                                  reason: 'Source propriétaire mais visibilité faible.',
                                  actions: [
                                    'Optimiser la page avec FAQ IA.',
                                    'Ajouter des preuves sociales.',
                                    'Améliorer les meta données.',
                                  ],
                                })
                              }
                              className="rounded-full bg-emerald-500/15 text-emerald-200 px-3 py-1 text-xs"
                            >
                              Audit
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-500">—</span>
                          )}
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

      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white">{actionModal.title}</h3>
            <p className="text-sm text-zinc-400">{actionModal.reason}</p>
            <ul className="text-sm text-zinc-300 space-y-2">
              {actionModal.actions.map((action) => (
                <li key={action}>• {action}</li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                onClick={() => setActionModal(null)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {evidence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-zinc-950 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Evidence — {evidence.scope === 'domain' ? 'Domaine' : 'URL'}: {evidence.key}
              </h3>
              <button
                onClick={() => setEvidence(null)}
                className="rounded-lg border border-white/10 px-3 py-1 text-sm text-zinc-300"
              >
                Fermer
              </button>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-auto">
              {evidence.items.length === 0 && (
                <p className="text-sm text-zinc-400">Aucune evidence disponible.</p>
              )}
              {evidence.items.map((item, idx) => (
                <div key={`${item.response_id || 'resp'}-${idx}`} className="rounded-xl border border-white/[0.08] bg-zinc-900/40 p-4">
                  <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                    <span>{new Date(item.cited_at).toLocaleString('fr-FR')}</span>
                    <span>•</span>
                    <span>{item.ai_model || 'model'}</span>
                    <span>•</span>
                    <span>{item.method || 'observed'}</span>
                    {typeof item.confidence === 'number' && (
                      <>
                        <span>•</span>
                        <span>conf: {Math.round(item.confidence * 100)}%</span>
                      </>
                    )}
                  </div>
                  {item.prompt_text && (
                    <p className="text-sm text-zinc-200 mt-2">{item.prompt_text}</p>
                  )}
                  {item.response_snippet && (
                    <p className="text-sm text-zinc-400 mt-2 whitespace-pre-wrap">{item.response_snippet}</p>
                  )}
                  {item.rationale && (
                    <p className="text-xs text-zinc-500 mt-2">Rationale: {item.rationale}</p>
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
