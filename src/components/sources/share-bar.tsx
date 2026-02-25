'use client';

import { InfoTip } from './info-tip';

type ShareBarProps = {
  ownedShare: number;
  competitorShare: number;
  thirdPartyShare: number;
};

export function ShareBar({ ownedShare, competitorShare, thirdPartyShare }: ShareBarProps) {
  const segments = [
    { label: 'Votre marque', value: ownedShare, color: 'bg-emerald-500', textColor: 'text-emerald-400', dotColor: 'bg-emerald-400' },
    { label: 'Concurrents', value: competitorShare, color: 'bg-red-500', textColor: 'text-red-400', dotColor: 'bg-red-400' },
    { label: 'Tiers', value: thirdPartyShare, color: 'bg-zinc-600', textColor: 'text-zinc-400', dotColor: 'bg-zinc-500' },
  ];

  // Compute strategic insight
  const insight = ownedShare > competitorShare
    ? 'Votre marque domine les sources citées.'
    : competitorShare > ownedShare * 2
      ? 'Les concurrents captent la majorité des citations — territoire à conquérir.'
      : 'Équilibre serré avec vos concurrents — chaque point compte.';

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-white inline-flex items-center gap-1">
            Répartition des sources
            <InfoTip text="Répartition entre vos domaines (Marque), ceux de vos concurrents, et les sites tiers (comparateurs, médias, etc.)." />
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">Part de chaque acteur dans les citations IA</p>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-zinc-800 mb-5">
        {segments.map((seg) =>
          seg.value > 0 ? (
            <div
              key={seg.label}
              className={`${seg.color} transition-all duration-500 ease-out first:rounded-l-full last:rounded-r-full`}
              style={{ width: `${seg.value}%` }}
            />
          ) : null
        )}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-4">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${seg.dotColor} shrink-0`} />
            <div>
              <p className="text-xs text-zinc-500">{seg.label}</p>
              <p className={`text-lg font-semibold ${seg.textColor} tabular-nums`}>{seg.value}%</p>
            </div>
          </div>
        ))}
      </div>

      {/* Strategic micro-insight */}
      <div className="mt-5 pt-4 border-t border-white/[0.06]">
        <p className="text-xs text-zinc-400 leading-relaxed">{insight}</p>
      </div>
    </div>
  );
}
