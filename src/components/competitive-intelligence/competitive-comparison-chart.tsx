'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@/components/theme/theme-provider';

type ComparisonRow = {
  brand: string;
  share: number;
};

export function CompetitiveComparisonChart({ data }: { data: ComparisonRow[] }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (data.length === 0) {
    return (
      <div className="quorum-panel-soft p-8 text-center quorum-text-muted">
        Aucune donnée compétitive à comparer.
      </div>
    );
  }

  return (
    <div className="quorum-panel-strong p-6">
      <div className="mb-5">
        <p className="quorum-kicker">Competitor Comparison</p>
        <h3 className="mt-2 text-lg font-semibold quorum-text-primary">Share of answer par marque</h3>
      </div>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 6 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,17,19,0.08)'}
              vertical={false}
            />
            <XAxis
              dataKey="brand"
              tick={{ fill: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(17,17,19,0.48)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(value: number) => `${value}%`}
              tick={{ fill: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(17,17,19,0.48)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number) => [`${value}%`, 'Share of answer']}
              contentStyle={{
                background: isDark ? 'rgba(10,10,10,0.94)' : 'rgba(255,255,255,0.98)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,19,0.08)'}`,
                borderRadius: '18px',
                backdropFilter: 'blur(18px)',
              }}
            />
            <Bar dataKey="share" radius={[12, 12, 4, 4]} fill="#f3efe6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
