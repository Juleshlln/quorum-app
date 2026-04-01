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
  const items = [
    {
      label: 'Visibilité moyenne',
      value: visibilityRate !== null ? `${visibilityRate}%` : '—',
      detail: 'Moyenne pondérée sur les 7 derniers jours',
    },
    {
      label: 'Sentiment détecté',
      value: sentimentPositive !== null ? `${sentimentPositive}% positif` : '—',
      detail: 'Calculé uniquement quand la marque est citée',
    },
    {
      label: 'Rang compétitif',
      value: avgPosition !== null ? `#${avgPosition}` : '—',
      detail: 'Basé sur le nombre de mentions vs concurrents',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="quorum-panel p-5">
          <p className="quorum-kicker">{item.label}</p>
          <p className="mt-3 text-3xl font-bold tracking-[-0.04em] quorum-text-primary">
            {item.value}
          </p>
          <p className="mt-3 text-sm leading-relaxed quorum-text-muted">
            {item.detail}
          </p>
        </div>
      ))}
      <div className="quorum-panel-strong p-5">
        <p className="quorum-kicker">Couverture</p>
        <div className="mt-3 space-y-1 text-sm quorum-text-primary">
          <div>{coverage.runsPerPrompt} run{coverage.runsPerPrompt !== 1 ? 's' : ''}</div>
          <div>{coverage.promptCount} prompt{coverage.promptCount !== 1 ? 's' : ''} actif{coverage.promptCount !== 1 ? 's' : ''}</div>
          <div className="text-xs quorum-text-muted">
            Modèles: {coverage.modelsUsed.length > 0 ? coverage.modelsUsed.join(', ') : '—'}
          </div>
          {coverage.lastRunAt && (
            <div className="text-xs quorum-text-muted">
              Dernière analyse: {new Date(coverage.lastRunAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
