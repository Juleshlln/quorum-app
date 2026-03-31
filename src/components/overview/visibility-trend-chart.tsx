'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts';

const BRAND_COLORS = [
  '#22d3ee', // cyan-400  (own brand)
  '#f87171', // red-400
  '#a78bfa', // violet-400
  '#fb923c', // orange-400
  '#34d399', // emerald-400
  '#facc15', // yellow-400
];

export function VisibilityTrendChart({
  data,
  brands,
  avg7,
  brandName,
}: {
  data: Record<string, string | number>[];
  brands?: string[];
  avg7?: number | null;
  brandName?: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-8 text-center text-zinc-500">
        Aucun point de trend disponible.
      </div>
    );
  }

  const lineKeys = brands && brands.length > 0
    ? brands
    : Object.keys(data[0] || {}).filter((k) => k !== 'date');

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-white">Trend de visibilité</p>
        <span className="text-xs text-zinc-500">%</span>
      </div>
      <p className="text-xs text-zinc-500 mb-4">Visibilité journalière par marque (%)</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                color: '#fff',
              }}
              formatter={(value: number, name: string) => [`${value}%`, name]}
            />
            {typeof avg7 === 'number' && (
              <ReferenceLine
                y={avg7}
                stroke="#22d3ee"
                strokeDasharray="6 4"
                strokeOpacity={0.5}
                label={{
                  value: `Moy. 7j${brandName ? ` ${brandName}` : ''}: ${avg7}%`,
                  position: 'right',
                  fill: '#22d3ee',
                  fontSize: 11,
                  opacity: 0.7,
                }}
              />
            )}
            {lineKeys.length > 1 && (
              <Legend
                wrapperStyle={{ fontSize: 12, color: '#9ca3af' }}
              />
            )}
            {lineKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={BRAND_COLORS[i % BRAND_COLORS.length]}
                strokeWidth={i === 0 ? 2.5 : 1.5}
                strokeDasharray={i === 0 ? undefined : '4 3'}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
