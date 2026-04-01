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
  if (cat === 'owned') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  if (cat === 'competitor') return 'border-red-500/20 bg-red-500/10 text-red-300';
  return 'quorum-border-default quorum-surface quorum-text-muted';
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
    <div className="quorum-panel p-5 space-y-4">
      <div>
        <p className="quorum-kicker">Why you win / lose</p>
        <p className="mt-2 text-sm font-semibold quorum-text-primary">Insights basés sur les citations réelles</p>
        <p className="text-xs quorum-text-muted mt-1">
          Insights basés sur les citations réelles et la performance par prompt.
        </p>
      </div>

      {/* Sources dominantes */}
      <div className="quorum-panel-soft p-4 space-y-2">
        <p className="text-xs quorum-text-subtle uppercase tracking-wider">Sources dominantes</p>
        {topDomains.length > 0 ? (
          <div className="space-y-2">
            {topDomains.map((d) => (
              <div key={d.domain} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm quorum-text-primary">{d.domain}</span>
                  <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${categoryColor(d.category)}`}>
                    {categoryLabel(d.category)}
                  </span>
                </div>
                <span className="text-xs quorum-text-muted">{d.count} citations</span>
              </div>
            ))}
            {/* Owned % indicator */}
            <div className="pt-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full quorum-surface-strong overflow-hidden">
                <div
                  className={`h-full rounded-full ${ownedPercent >= 30 ? 'bg-emerald-300' : 'bg-amber-300'}`}
                  style={{ width: `${Math.max(ownedPercent, 2)}%` }}
                />
              </div>
              <span className="text-xs quorum-text-muted">{ownedPercent}% owned</span>
            </div>
          </div>
        ) : (
          <p className="text-sm quorum-text-muted">Aucune source détectée</p>
        )}
      </div>

      {/* Prompts déclencheurs */}
      <div className="quorum-panel-soft p-4 space-y-2">
        <p className="text-xs quorum-text-subtle uppercase tracking-wider">Prompts déclencheurs</p>
        {topPrompts.length > 0 ? (
          <div className="space-y-2">
            {topPrompts.map((p, i) => (
              <div key={`${p.text}_${i}`} className="flex items-start justify-between gap-2">
                <p className="text-sm quorum-text-primary leading-snug flex-1">
                  {p.text.length > 55 ? p.text.slice(0, 55) + '...' : p.text}
                </p>
                <span className={`text-xs font-medium whitespace-nowrap ${
                  p.visibility > 50 ? 'text-emerald-300' : p.visibility >= 20 ? 'text-amber-300' : 'text-red-300'
                }`}>
                  {p.visibility}% · {p.runs} runs
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm quorum-text-muted">Pas assez de données</p>
        )}
      </div>

      {/* Actions recommandées */}
      <div className="quorum-panel-soft p-4 space-y-2">
        <p className="text-xs quorum-text-subtle uppercase tracking-wider">Actions recommandées</p>
        {actions.length > 0 ? (
          <div className="space-y-2">
            {actions.map((a, i) => (
              <div
                key={`${a.title}_${i}`}
                className={`border-l-2 ${actionBorderColor(a.type)} pl-3 py-1`}
              >
                <p className="text-sm quorum-text-primary font-medium">
                  <span className="mr-1.5">{actionIcon(a.type)}</span>
                  {a.title}
                </p>
                <p className="text-xs quorum-text-muted mt-0.5">{a.detail}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm quorum-text-muted">Aucune recommandation pour le moment.</p>
        )}
      </div>
    </div>
  );
}
