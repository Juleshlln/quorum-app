'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ChartRow = {
  label: string;
  value: number;
  tone: 'brand' | 'competitor' | 'neutral';
};

const COLORS: Record<ChartRow['tone'], string> = {
  brand: '#34d399',
  competitor: '#fb923c',
  neutral: '#94a3b8',
};

export function OfferVisibilityChart({
  brandName,
  competitors,
  competitorMentions,
  ownBrandMentions,
}: {
  brandName: string;
  competitors: Array<{
    name: string;
    mentions: number;
  }>;
  competitorMentions: number;
  ownBrandMentions: number;
}) {
  const data: ChartRow[] = [
    { label: brandName, value: ownBrandMentions, tone: 'brand' },
    ...competitors.slice(0, 5).map((competitor) => ({
      label: competitor.name,
      value: competitor.mentions,
      tone: 'competitor' as const,
    })),
  ];
  const hasData = ownBrandMentions > 0 || competitorMentions > 0;

  if (!hasData) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-[color:var(--quorum-border)] text-center text-sm quorum-text-muted">
        Lancez une analyse pour afficher la répartition de visibilité.
      </div>
    );
  }

  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 18, right: 12, top: 12, bottom: 12 }}>
          <CartesianGrid stroke="rgba(148, 163, 184, 0.18)" strokeDasharray="4 4" horizontal={false} />
          <XAxis type="number" stroke="rgba(148, 163, 184, 0.8)" fontSize={11} allowDecimals={false} />
          <YAxis type="category" dataKey="label" stroke="rgba(148, 163, 184, 0.8)" fontSize={11} width={150} />
          <Tooltip
            cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
            contentStyle={{
              background: 'var(--quorum-panel-strong)',
              border: '1px solid var(--quorum-border)',
              borderRadius: '14px',
              color: 'var(--quorum-text)',
            }}
            formatter={(value, _name, item) => {
              const row = item.payload as ChartRow;
              return [`${value} mentions`, row.label];
            }}
          />
          <Bar dataKey="value" radius={[0, 10, 10, 0]}>
            {data.map((entry) => (
              <Cell key={entry.label} fill={COLORS[entry.tone]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
