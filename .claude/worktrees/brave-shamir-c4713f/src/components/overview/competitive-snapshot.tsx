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
    <div className="quorum-panel-strong p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="quorum-kicker">Competitive Snapshot</p>
          <p className="mt-2 text-lg font-semibold quorum-text-primary">Vue combinée des tendances et du classement</p>
          <p className="text-xs quorum-text-muted">
            Vue combinée des tendances et du classement des marques.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRange(7)}
            className={`quorum-chip ${
              range === 7 ? 'quorum-chip-active' : ''
            }`}
          >
            7 jours
          </button>
          <button
            onClick={() => setRange(30)}
            className={`quorum-chip ${
              range === 30 ? 'quorum-chip-active' : ''
            }`}
          >
            30 jours
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('trend')}
          className={`quorum-chip ${
            activeTab === 'trend' ? 'quorum-chip-active' : ''
          }`}
        >
          Trend
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`quorum-chip ${
            activeTab === 'leaderboard' ? 'quorum-chip-active' : ''
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
