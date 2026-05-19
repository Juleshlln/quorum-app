'use client';

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@/components/theme/theme-provider';

type TrendPoint = {
  date: string;
  visibility: number | null;
  observedAiSessions: number;
  conversions: number;
  revenue: number;
};

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export function BusinessImpactTrendChart({ data }: { data: TrendPoint[] }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (data.length === 0) {
    return (
      <div className="quorum-panel-soft p-8 text-center quorum-text-muted">
        Aucune série business impact disponible.
      </div>
    );
  }

  return (
    <div className="quorum-panel-strong p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="quorum-kicker">Impact Trend</p>
          <h3 className="mt-2 text-lg font-semibold quorum-text-primary">
            Visibilité, trafic IA observé et conversions
          </h3>
        </div>
        <div className="rounded-full border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-3 py-1 text-[11px] uppercase tracking-[0.2em] quorum-text-muted">
          30 jours
        </div>
      </div>

      <div className="h-[340px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, left: -16, bottom: 4 }}>
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
              domain={[0, 100]}
              tickFormatter={(value: number) => `${value}%`}
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
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 14 }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="visibility"
              name="Visibility"
              stroke="#f3efe6"
              strokeWidth={2.4}
              dot={false}
              connectNulls
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="observedAiSessions"
              name="AI observed sessions"
              stroke="#34d399"
              strokeWidth={2.1}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="conversions"
              name="Conversions observed"
              stroke="#38bdf8"
              strokeWidth={1.8}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
