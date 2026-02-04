type ResultsExplanationBannerProps = {
  mode: 'trend' | 'simulation';
  runCount?: number;
};

export function ResultsExplanationBanner({ mode, runCount }: ResultsExplanationBannerProps) {
  if (mode === 'simulation') {
    return (
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5 text-sm text-cyan-100">
        <p className="font-medium">Simulation – réponse non garantie</p>
        <p className="text-cyan-200/80 mt-1">
          Ce mode simule une réponse plausible pour un utilisateur, sans scores probabilistes.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 text-sm text-blue-100">
      <p className="font-medium">Tendance IA – résultats statistiques</p>
      <p className="text-blue-200/80 mt-1">
        Ces résultats représentent une tendance statistique basée sur {runCount ?? 1} runs par prompt.
      </p>
    </div>
  );
}
