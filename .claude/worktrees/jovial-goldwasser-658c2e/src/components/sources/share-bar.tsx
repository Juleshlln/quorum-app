'use client';

import { InfoTip } from './info-tip';

type ShareBarProps = {
  ownedShare: number;
  competitorShare: number;
  thirdPartyShare: number;
};

export function ShareBar({ ownedShare, competitorShare, thirdPartyShare }: ShareBarProps) {
  const segments = [
    { label: 'Votre marque', value: ownedShare, color: 'bg-emerald-300', textColor: 'text-emerald-300', dotColor: 'bg-emerald-300' },
    { label: 'Concurrents', value: competitorShare, color: 'bg-red-300', textColor: 'text-red-300', dotColor: 'bg-red-300' },
    { label: 'Tiers', value: thirdPartyShare, color: 'bg-white/50', textColor: 'quorum-text-muted', dotColor: 'bg-white/50' },
  ];

  // Compute strategic insight
  const insight = ownedShare > competitorShare
    ? 'Votre marque domine les sources citées.'
    : competitorShare > ownedShare * 2
      ? 'Les concurrents captent la majorité des citations — territoire à conquérir.'
      : 'Équilibre serré avec vos concurrents — chaque point compte.';

  return (
    <div className="quorum-panel p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium quorum-text-primary inline-flex items-center gap-1">
            Répartition des sources
            <InfoTip text="Répartition entre vos domaines (Marque), ceux de vos concurrents, et les sites tiers (comparateurs, médias, etc.)." />
          </h3>
          <p className="text-xs quorum-text-subtle mt-0.5">Part de chaque acteur dans les citations IA</p>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="mb-5 flex h-3 overflow-hidden rounded-full quorum-surface-strong">
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
              <p className="text-xs quorum-text-subtle">{seg.label}</p>
              <p className={`text-lg font-semibold ${seg.textColor} tabular-nums`}>{seg.value}%</p>
            </div>
          </div>
        ))}
      </div>

      {/* Strategic micro-insight */}
      <div className="mt-5 pt-4 border-t quorum-border-default">
        <p className="text-xs quorum-text-muted leading-relaxed">{insight}</p>
      </div>
    </div>
  );
}
