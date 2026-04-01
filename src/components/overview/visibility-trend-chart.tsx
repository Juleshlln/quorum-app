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
import { useTheme } from '@/components/theme/theme-provider';

/* Premium palette — first color is the hero brand, rest are competitors */
const BRAND_COLORS_DARK = [
  '#34d399', // emerald — hero brand
  '#94a3b8', // slate
  '#a78bfa', // violet
  '#fbbf24', // amber
  '#f472b6', // pink
  '#38bdf8', // sky
];

const BRAND_COLORS_LIGHT = [
  '#059669', // emerald darker
  '#64748b', // slate
  '#7c3aed', // violet
  '#d97706', // amber
  '#db2777', // pink
  '#0284c7', // sky
];

function normalizeSeriesValue(raw: unknown): number | null {
  if (raw == null || raw === '') {
    return null;
  }

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      return null;
    }
    return raw >= 0 && raw <= 1 ? Math.round(raw * 100) : raw;
  }

  if (typeof raw === 'string') {
    const cleaned = raw.trim().replace('%', '').replace(',', '.');
    if (cleaned === '') {
      return null;
    }

    const numeric = Number(cleaned);
    if (!Number.isFinite(numeric)) {
      return null;
    }

    return numeric >= 0 && numeric <= 1 ? Math.round(numeric * 100) : numeric;
  }

  return null;
}

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
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const chartData = (data || []).map((point) => {
    const normalizedPoint: Record<string, string | number | null> = {
      date: String(point.date ?? ''),
    };

    for (const [key, value] of Object.entries(point)) {
      if (key === 'date') {
        continue;
      }
      normalizedPoint[key] = normalizeSeriesValue(value);
    }

    return normalizedPoint;
  });

  const candidateKeys = Array.from(
    new Set(
      (brands && brands.length > 0
        ? brands
        : Object.keys(chartData[0] || {}).filter((key) => key !== 'date')
      ).filter(Boolean)
    )
  );

  const lineKeys = candidateKeys.filter((key) =>
    chartData.some((point) => typeof point[key] === 'number')
  );

  if (chartData.length === 0 || lineKeys.length === 0) {
    return (
      <div className="quorum-panel-soft p-8 text-center quorum-text-muted">
        Aucun point de trend disponible.
      </div>
    );
  }

  const colors = isDark ? BRAND_COLORS_DARK : BRAND_COLORS_LIGHT;
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(17,17,19,0.06)';
  const tickColor = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(17,17,19,0.45)';
  const refLineColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(17,17,19,0.25)';
  const refLabelColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(17,17,19,0.5)';
  const tooltipBg = isDark ? 'rgba(10,10,10,0.94)' : 'rgba(255,255,255,0.96)';
  const tooltipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,17,19,0.1)';
  const tooltipText = isDark ? '#f7f4ee' : '#111113';

  return (
    <div className="quorum-panel-soft p-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold quorum-text-primary">Trend de visibilité</p>
        <span className="text-[11px] font-medium quorum-text-subtle">%</span>
      </div>
      <p className="mb-5 text-xs quorum-text-subtle">Visibilité journalière par marque</p>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: tickColor, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              dy={8}
            />
            <YAxis
              tick={{ fill: tickColor, fontSize: 11 }}
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              axisLine={false}
              tickLine={false}
              dx={-4}
            />
            <Tooltip
              contentStyle={{
                background: tooltipBg,
                border: `1px solid ${tooltipBorder}`,
                borderRadius: '14px',
                color: tooltipText,
                backdropFilter: 'blur(18px)',
                fontSize: '13px',
                padding: '10px 14px',
              }}
              formatter={(value: number | string, name: string) => {
                const numericValue = normalizeSeriesValue(value);
                return [numericValue !== null ? `${numericValue}%` : '—', name];
              }}
              cursor={{ stroke: refLineColor, strokeDasharray: '4 4' }}
            />
            {typeof avg7 === 'number' && (
              <ReferenceLine
                y={avg7}
                stroke={refLineColor}
                strokeDasharray="6 4"
                label={{
                  value: `Moy. 7j${brandName ? ` ${brandName}` : ''}: ${avg7}%`,
                  position: 'right',
                  fill: refLabelColor,
                  fontSize: 11,
                }}
              />
            )}
            {lineKeys.length > 1 && (
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                iconType="circle"
                iconSize={8}
              />
            )}
            {lineKeys.map((key, i) => (
              <Line
                key={key}
                type="monotone"
                dataKey={(point: Record<string, string | number | null>) => {
                  const value = point[key];
                  return typeof value === 'number' ? value : null;
                }}
                name={key}
                stroke={colors[i % colors.length]}
                strokeWidth={i === 0 ? 2.5 : 1.5}
                strokeDasharray={i === 0 ? undefined : '6 3'}
                connectNulls
                dot={false}
                activeDot={{
                  r: 5,
                  fill: colors[i % colors.length],
                  strokeWidth: 2,
                  stroke: isDark ? '#050505' : '#ffffff',
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
