type BrandRow = {
  brand: string;
  visibilityRate: number | null;
  delta: number | null;
  avgSentiment: number | null;
  avgPosition: number | null;
  mentions: number;
  runs: number;
};

export function BrandsLeaderboardTable({ rows }: { rows: BrandRow[] }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="quorum-panel-soft p-8 text-center quorum-text-muted">
        Aucun comparatif disponible pour le moment.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[26px] border quorum-border-default quorum-surface-strong backdrop-blur-xl">
      <table className="w-full text-sm">
        <thead className="quorum-surface quorum-text-muted">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Brand</th>
            <th className="text-left px-4 py-3 font-medium">Visibilité</th>
            <th className="text-left px-4 py-3 font-medium">Δ 7j</th>
            <th className="text-left px-4 py-3 font-medium">Position</th>
            <th className="text-left px-4 py-3 font-medium">Mentions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.brand} className="border-t quorum-border-default transition-colors hover:quorum-surface">
              <td className="px-4 py-3 quorum-text-primary font-medium">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border quorum-border-default quorum-surface text-xs quorum-text-muted">
                    {index + 1}
                  </span>
                  <span>{row.brand}</span>
                </div>
              </td>
              <td className="px-4 py-3 quorum-text-primary">
                {row.visibilityRate !== null ? `${row.visibilityRate}%` : '—'}
              </td>
              <td className="px-4 py-3">
                {row.delta !== null ? (
                  <span className={row.delta > 0 ? 'text-emerald-300' : row.delta < 0 ? 'text-red-300' : 'quorum-text-subtle'}>
                    {row.delta > 0 ? '+' : ''}{row.delta}pt
                  </span>
                ) : (
                  <span className="quorum-text-subtle">—</span>
                )}
              </td>
              <td className="px-4 py-3 quorum-text-primary">
                {row.avgPosition !== null ? `#${row.avgPosition}` : '—'}
              </td>
              <td className="px-4 py-3 quorum-text-muted">
                {row.mentions}/{row.runs}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
