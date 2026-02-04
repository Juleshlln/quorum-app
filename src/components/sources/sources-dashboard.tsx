'use client';

import { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

type DomainRow = {
  domain: string;
  domain_type: string;
  used_pct: number;
  avg_citations_per_run: number;
};

type TrendPoint = {
  date: string;
  citations: number;
};

type TypeBreakdown = { type: string; count: number };

export function SourcesDashboard({
  domainTypes,
  topDomains,
  trend,
  rangeDays,
}: {
  domainTypes: TypeBreakdown[];
  topDomains: DomainRow[];
  trend: TrendPoint[];
  rangeDays: 7 | 30;
}) {
  const [range, setRange] = useState<7 | 30>(rangeDays);
  const [filterType, setFilterType] = useState<string>('all');

  const filteredDomains = useMemo(() => {
    if (filterType === 'all') return topDomains;
    return topDomains.filter((d) => d.domain_type === filterType);
  }, [filterType, topDomains]);

  const filteredTrend = useMemo(() => {
    if (range === 30) return trend;
    return trend.slice(-7);
  }, [range, trend]);

  const colors: Record<string, string> = {
    ugc: '#22d3ee',
    institutional: '#818cf8',
    corporate: '#38bdf8',
    editorial: '#f472b6',
    other: '#94a3b8',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setRange(7)}
          className={`px-3 py-1.5 rounded-full text-xs border ${
            range === 7 ? 'border-cyan-500/40 text-cyan-300' : 'border-white/10 text-zinc-400'
          }`}
        >
          7 jours
        </button>
        <button
          onClick={() => setRange(30)}
          className={`px-3 py-1.5 rounded-full text-xs border ${
            range === 30 ? 'border-cyan-500/40 text-cyan-300' : 'border-white/10 text-zinc-400'
          }`}
        >
          30 jours
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
          <p className="text-sm font-medium text-white mb-3">Domain Types</p>
          {domainTypes.length === 0 ? (
            <p className="text-sm text-zinc-500">Aucune source détectée.</p>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={domainTypes} dataKey="count" nameKey="type" innerRadius={40} outerRadius={70}>
                    {domainTypes.map((entry) => (
                      <Cell key={entry.type} fill={colors[entry.type] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-white">Top Domains</p>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-zinc-900 border border-white/10 text-xs text-white rounded-lg px-2 py-1"
            >
              <option value="all">Tous</option>
              <option value="ugc">UGC</option>
              <option value="institutional">Institutional</option>
              <option value="corporate">Corporate</option>
              <option value="editorial">Editorial</option>
              <option value="other">Other</option>
            </select>
          </div>
          {filteredDomains.length === 0 ? (
            <p className="text-sm text-zinc-500">Aucune source détectée.</p>
          ) : (
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/60 text-zinc-400">
                  <tr>
                    <th className="text-left px-3 py-2">Domain</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDomains.map((d) => (
                    <tr key={d.domain} className="border-t border-white/[0.06]">
                      <td className="px-3 py-2 text-zinc-200">{d.domain}</td>
                      <td className="px-3 py-2 text-zinc-400">{d.domain_type}</td>
                      <td className="px-3 py-2 text-zinc-400">{d.used_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
        <p className="text-sm font-medium text-white mb-3">Citations Over Time</p>
        {filteredTrend.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucune donnée de tendance.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredTrend}>
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
                <Line type="monotone" dataKey="citations" stroke="#22d3ee" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
