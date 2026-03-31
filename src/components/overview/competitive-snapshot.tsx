'use client';

import { useMemo, useState } from 'react';
import { VisibilityTrendChart } from '@/components/overview/visibility-trend-chart';
import { BrandsLeaderboardTable } from '@/components/overview/brands-leaderboard-table';

type BrandRow = {
  brand: string;
  visibilityRate: number | null;
  delta: number | null;
  avgSentiment: number | null;
  avgPosition: number | null;
  mentions: number;
  runs: number;
};

export function CompetitiveSnapshot({
  trendData,
  trendBrands,
  leaderboard,
  avg7,
  brandName,
}: {
  trendData: Record<string, string | number>[];
  trendBrands: string[];
  leaderboard: BrandRow[];
  avg7?: number | null;
  brandName?: string;
}) {
  const [activeTab, setActiveTab] = useState<'trend' | 'leaderboard'>('trend');
  const [range, setRange] = useState<7 | 30>(7);

  const filteredTrend = useMemo(() => {
    if (trendData.length === 0) return [];
    if (range === 30) return trendData;
    return trendData.slice(-7);
  }, [trendData, range]);

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">Competitive Snapshot</p>
          <p className="text-xs text-zinc-500">
            Vue combinée des tendances et du classement des marques.
          </p>
        </div>
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
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('trend')}
          className={`px-3 py-1.5 rounded-full text-xs border ${
            activeTab === 'trend' ? 'border-cyan-500/40 text-cyan-300' : 'border-white/10 text-zinc-400'
          }`}
        >
          Trend
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-3 py-1.5 rounded-full text-xs border ${
            activeTab === 'leaderboard' ? 'border-cyan-500/40 text-cyan-300' : 'border-white/10 text-zinc-400'
          }`}
        >
          Leaderboard
        </button>
      </div>
      {activeTab === 'trend' ? (
        <VisibilityTrendChart data={filteredTrend} brands={trendBrands} avg7={avg7} brandName={brandName} />
      ) : (
        <BrandsLeaderboardTable rows={leaderboard} />
      )}
    </div>
  );
}
