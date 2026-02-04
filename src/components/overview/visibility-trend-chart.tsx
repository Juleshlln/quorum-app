'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

type TrendPoint = {
  date: string;
  visibilityRate: number;
};

export function VisibilityTrendChart({ data }: { data: TrendPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-8 text-center text-zinc-500">
        Aucun point de trend disponible.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-white">Trend de visibilité</p>
        <span className="text-xs text-zinc-500">%</span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                color: '#fff',
              }}
            />
            <Line
              type="monotone"
              dataKey="visibilityRate"
              stroke="#22d3ee"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
