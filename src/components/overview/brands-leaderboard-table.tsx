type BrandRow = {
  brand: string;
  visibilityRate: number | null;
  avgSentiment: number | null;
  avgPosition: number | null;
  mentions: number;
  runs: number;
};

export function BrandsLeaderboardTable({ rows }: { rows: BrandRow[] }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-8 text-center text-zinc-500">
        Aucun comparatif disponible pour le moment.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-900/60 text-zinc-400">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Brand</th>
            <th className="text-left px-4 py-3 font-medium">Visibilité</th>
            <th className="text-left px-4 py-3 font-medium">Sentiment</th>
            <th className="text-left px-4 py-3 font-medium">Position</th>
            <th className="text-left px-4 py-3 font-medium">Mentions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.brand} className="border-t border-white/[0.06]">
              <td className="px-4 py-3 text-white">{row.brand}</td>
              <td className="px-4 py-3 text-zinc-200">
                {row.visibilityRate !== null ? `${row.visibilityRate}%` : '—'}
              </td>
              <td className="px-4 py-3 text-zinc-200">
                {row.avgSentiment !== null ? `${row.avgSentiment}%` : '—'}
              </td>
              <td className="px-4 py-3 text-zinc-200">
                {row.avgPosition !== null ? `#${row.avgPosition}` : '—'}
              </td>
              <td className="px-4 py-3 text-zinc-400">
                {row.mentions}/{row.runs}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
