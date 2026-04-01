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
  '#f3efe6',
  '#b8b0a1',
  '#938a7a',
  '#d0c7ba',
  '#746b5d',
  '#ece6da',
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
      <div className="quorum-panel-soft p-8 text-center quorum-text-muted">
        Aucun point de trend disponible.
      </div>
    );
  }

  const lineKeys = brands && brands.length > 0
    ? brands
    : Object.keys(data[0] || {}).filter((k) => k !== 'date');

  return (
    <div className="quorum-panel-soft p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium quorum-text-primary">Trend de visibilité</p>
        <span className="text-xs quorum-text-subtle">%</span>
      </div>
      <p className="mb-4 text-xs quorum-text-subtle">Visibilité journalière par marque (%)</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.42)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: 'rgba(255,255,255,0.42)', fontSize: 12 }}
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: 'rgba(10, 10, 10, 0.94)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '18px',
                color: '#fff',
                backdropFilter: 'blur(18px)',
              }}
              formatter={(value: number, name: string) => [`${value}%`, name]}
            />
            {typeof avg7 === 'number' && (
              <ReferenceLine
                y={avg7}
                stroke="rgba(255,255,255,0.5)"
                strokeDasharray="6 4"
                strokeOpacity={0.5}
                label={{
                  value: `Moy. 7j${brandName ? ` ${brandName}` : ''}: ${avg7}%`,
                  position: 'right',
                  fill: 'rgba(255,255,255,0.58)',
                  fontSize: 11,
                  opacity: 0.7,
                }}
              />
            )}
            {lineKeys.length > 1 && (
              <Legend
                wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.42)' }}
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
                activeDot={{ r: 4, fill: BRAND_COLORS[i % BRAND_COLORS.length], strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
