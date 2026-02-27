'use client';

type DomainInsight = {
  domain: string;
  count: number;
  category: string;
};

type PromptInsight = {
  text: string;
  visibility: number;
  runs: number;
};

type ActionInsight = {
  title: string;
  detail: string;
  type: 'warning' | 'info' | 'success';
};

type WhyModuleProps = {
  topDomains: DomainInsight[];
  topPrompts: PromptInsight[];
  actions: ActionInsight[];
  ownedPercent: number;
};

function categoryLabel(cat: string) {
  if (cat === 'owned') return 'Owned';
  if (cat === 'competitor') return 'Concurrent';
  return 'Tiers';
}

function categoryColor(cat: string) {
  if (cat === 'owned') return 'bg-emerald-500/10 text-emerald-400';
  if (cat === 'competitor') return 'bg-red-500/10 text-red-400';
  return 'bg-zinc-500/10 text-zinc-400';
}

function actionIcon(type: 'warning' | 'info' | 'success') {
  if (type === 'warning') return '⚠';
  if (type === 'success') return '✓';
  return 'ℹ';
}

function actionBorderColor(type: 'warning' | 'info' | 'success') {
  if (type === 'warning') return 'border-l-amber-500';
  if (type === 'success') return 'border-l-emerald-500';
  return 'border-l-cyan-500';
}

export function InsightsWhyModule({ topDomains, topPrompts, actions, ownedPercent }: WhyModuleProps) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-white">Why you win / lose</p>
        <p className="text-xs text-zinc-500 mt-1">
          Insights basés sur les citations réelles et la performance par prompt.
        </p>
      </div>

      {/* Sources dominantes */}
      <div className="rounded-xl border border-white/[0.06] p-4 space-y-2">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Sources dominantes</p>
        {topDomains.length > 0 ? (
          <div className="space-y-2">
            {topDomains.map((d) => (
              <div key={d.domain} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-200">{d.domain}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${categoryColor(d.category)}`}>
                    {categoryLabel(d.category)}
                  </span>
                </div>
                <span className="text-xs text-zinc-400">{d.count} citations</span>
              </div>
            ))}
            {/* Owned % indicator */}
            <div className="pt-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${ownedPercent >= 30 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.max(ownedPercent, 2)}%` }}
                />
              </div>
              <span className="text-xs text-zinc-500">{ownedPercent}% owned</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Aucune source détectée</p>
        )}
      </div>

      {/* Prompts déclencheurs */}
      <div className="rounded-xl border border-white/[0.06] p-4 space-y-2">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Prompts déclencheurs</p>
        {topPrompts.length > 0 ? (
          <div className="space-y-2">
            {topPrompts.map((p, i) => (
              <div key={`${p.text}_${i}`} className="flex items-start justify-between gap-2">
                <p className="text-sm text-zinc-200 leading-snug flex-1">
                  {p.text.length > 55 ? p.text.slice(0, 55) + '...' : p.text}
                </p>
                <span className={`text-xs font-medium whitespace-nowrap ${
                  p.visibility > 50 ? 'text-emerald-400' : p.visibility >= 20 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {p.visibility}% · {p.runs} runs
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Pas assez de données</p>
        )}
      </div>

      {/* Actions recommandées */}
      <div className="rounded-xl border border-white/[0.06] p-4 space-y-2">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Actions recommandées</p>
        {actions.length > 0 ? (
          <div className="space-y-2">
            {actions.map((a, i) => (
              <div
                key={`${a.title}_${i}`}
                className={`border-l-2 ${actionBorderColor(a.type)} pl-3 py-1`}
              >
                <p className="text-sm text-white font-medium">
                  <span className="mr-1.5">{actionIcon(a.type)}</span>
                  {a.title}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">{a.detail}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Aucune recommandation pour le moment.</p>
        )}
      </div>
    </div>
  );
}
