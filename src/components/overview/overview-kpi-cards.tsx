type CoverageMeta = {
  runsPerPrompt: number;
  promptCount: number;
  modelsUsed: string[];
  lastRunAt?: string | null;
};

type OverviewKpisProps = {
  visibilityRate: number | null;
  sentimentPositive: number | null;
  avgPosition: number | null;
  coverage: CoverageMeta;
};

export function OverviewKpiCards({
  visibilityRate,
  sentimentPositive,
  avgPosition,
  coverage,
}: OverviewKpisProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Visibilité (7j)</p>
        <p className="text-2xl font-semibold text-white mt-2">
          {visibilityRate !== null ? `${visibilityRate}%` : '—'}
        </p>
        <p className="text-xs text-zinc-500 mt-2">
          Basé sur les dernières analyses
        </p>
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Sentiment (mentionné)</p>
        <p className="text-2xl font-semibold text-white mt-2">
          {sentimentPositive !== null ? `${sentimentPositive}% positif` : '—'}
        </p>
        <p className="text-xs text-zinc-500 mt-2">
          Calculé uniquement quand la marque est citée
        </p>
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Position moyenne</p>
        <p className="text-2xl font-semibold text-white mt-2">
          {avgPosition !== null ? `#${avgPosition}` : '—'}
        </p>
        <p className="text-xs text-zinc-500 mt-2">Sur les réponses où la marque est citée</p>
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Couverture</p>
        <div className="mt-2 space-y-1 text-sm text-zinc-200">
          <div>{coverage.runsPerPrompt} runs / prompt</div>
          <div>{coverage.promptCount} prompts</div>
          <div className="text-xs text-zinc-500">
            Modèles: {coverage.modelsUsed.length > 0 ? coverage.modelsUsed.join(', ') : '—'}
          </div>
          {coverage.lastRunAt && (
            <div className="text-xs text-zinc-500">Dernière analyse: {coverage.lastRunAt}</div>
          )}
        </div>
      </div>
    </div>
  );
}
