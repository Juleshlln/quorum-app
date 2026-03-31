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
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Visibilité (moy. 7j)</p>
        <p className="text-2xl font-semibold text-white mt-2">
          {visibilityRate !== null ? `${visibilityRate}%` : '—'}
        </p>
        <p className="text-xs text-zinc-500 mt-2">
          Moyenne pondérée sur les 7 derniers jours
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
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Rang compétitif</p>
        <p className="text-2xl font-semibold text-white mt-2">
          {avgPosition !== null ? `#${avgPosition}` : '—'}
        </p>
        <p className="text-xs text-zinc-500 mt-2">Basé sur le nombre de mentions vs concurrents</p>
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Couverture</p>
        <div className="mt-2 space-y-1 text-sm text-zinc-200">
          <div>{coverage.runsPerPrompt} run{coverage.runsPerPrompt !== 1 ? 's' : ''}</div>
          <div>{coverage.promptCount} prompt{coverage.promptCount !== 1 ? 's' : ''} actif{coverage.promptCount !== 1 ? 's' : ''}</div>
          <div className="text-xs text-zinc-500">
            Modèles: {coverage.modelsUsed.length > 0 ? coverage.modelsUsed.join(', ') : '—'}
          </div>
          {coverage.lastRunAt && (
            <div className="text-xs text-zinc-500">
              Dernière analyse: {new Date(coverage.lastRunAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
