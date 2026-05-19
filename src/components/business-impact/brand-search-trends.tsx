'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@/components/theme/theme-provider';

type BrandSearchPoint = {
  date: string;
  clicks: number;
  impressions: number;
  avgCtr: number;
  avgPosition: number;
};

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function formatInteger(value: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value);
}

export function BrandSearchTrends({ data }: { data: BrandSearchPoint[] }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (data.length === 0) {
    return (
      <div className="quorum-panel p-6">
        <div className="mb-5">
          <p className="quorum-kicker">Brand Search</p>
          <h3 className="mt-2 text-lg font-semibold quorum-text-primary">Recherches de marque (GSC)</h3>
        </div>
        <div className="rounded-[22px] border border-dashed border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-6 text-center text-sm quorum-text-muted">
          Aucune donnée de recherche de marque. Connectez Google Search Console pour suivre les requêtes brand.
        </div>
      </div>
    );
  }

  const totalClicks = data.reduce((sum, point) => sum + point.clicks, 0);
  const totalImpressions = data.reduce((sum, point) => sum + point.impressions, 0);
  const avgPosition = data.length > 0
    ? (data.reduce((sum, point) => sum + point.avgPosition, 0) / data.length).toFixed(1)
    : '—';

  return (
    <div className="quorum-panel p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="quorum-kicker">Brand Search</p>
          <h3 className="mt-2 text-lg font-semibold quorum-text-primary">Recherches de marque (GSC)</h3>
        </div>
        <div className="rounded-full border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-3 py-1 text-[11px] uppercase tracking-[0.2em] quorum-text-muted">
          30 jours
        </div>
      </div>

      {/* KPI mini-row */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-[18px] border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3 text-center">
          <p className="text-lg font-semibold quorum-text-primary">{formatInteger(totalClicks)}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] quorum-text-muted">Clics</p>
        </div>
        <div className="rounded-[18px] border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3 text-center">
          <p className="text-lg font-semibold quorum-text-primary">{formatInteger(totalImpressions)}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] quorum-text-muted">Impressions</p>
        </div>
        <div className="rounded-[18px] border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3 text-center">
          <p className="text-lg font-semibold quorum-text-primary">{avgPosition}</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] quorum-text-muted">Position moy.</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 4 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,17,19,0.08)'}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDateLabel}
              tick={{ fill: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(17,17,19,0.48)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              dy={8}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(17,17,19,0.48)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(17,17,19,0.48)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: isDark ? 'rgba(10,10,10,0.94)' : 'rgba(255,255,255,0.98)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,19,0.08)'}`,
                borderRadius: '18px',
                backdropFilter: 'blur(18px)',
              }}
              labelFormatter={formatDateLabel}
              formatter={(value: number, name: string) => {
                if (name === 'Clics') return [formatInteger(value), name];
                if (name === 'Impressions') return [formatInteger(value), name];
                return [value, name];
              }}
            />
            <Bar
              yAxisId="left"
              dataKey="impressions"
              name="Impressions"
              fill={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,19,0.06)'}
              radius={[6, 6, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="clicks"
              name="Clics"
              stroke="#f3efe6"
              strokeWidth={2.4}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-xs quorum-text-muted">
        Données issues de Google Search Console. Seules les requêtes contenant le nom de marque ou ses variantes sont comptabilisées.
      </p>
    </div>
  );
}
