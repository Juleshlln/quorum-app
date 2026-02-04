type InsightItem = {
  title: string;
  detail: string;
};

type WhyModuleProps = {
  topDomains: string[];
  topPrompts: string[];
  actions: InsightItem[];
};

export function InsightsWhyModule({ topDomains, topPrompts, actions }: WhyModuleProps) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-white">Why you win / lose</p>
        <p className="text-xs text-zinc-500 mt-1">
          Insights basés sur les mentions et les sources citées.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Sources dominantes</p>
          <ul className="space-y-1 text-sm text-zinc-200">
            {topDomains.length > 0 ? topDomains.map((d) => (
              <li key={d}>• {d}</li>
            )) : <li className="text-zinc-500">Aucune source détectée</li>}
          </ul>
        </div>
        <div className="rounded-xl border border-white/[0.06] p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Prompts déclencheurs</p>
          <ul className="space-y-1 text-sm text-zinc-200">
            {topPrompts.length > 0 ? topPrompts.map((p, i) => (
              <li key={`${p}_${i}`}>• {p}</li>
            )) : <li className="text-zinc-500">Pas assez de données</li>}
          </ul>
        </div>
      </div>
      <div className="rounded-xl border border-white/[0.06] p-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Actions recommandées</p>
        <ul className="space-y-2 text-sm text-zinc-200">
          {actions.length > 0 ? actions.map((a, i) => (
            <li key={`${a.title}_${i}`}>
              <span className="text-cyan-300">{a.title}</span> — {a.detail}
            </li>
          )) : <li className="text-zinc-500">Aucune recommandation pour le moment.</li>}
        </ul>
      </div>
    </div>
  );
}
