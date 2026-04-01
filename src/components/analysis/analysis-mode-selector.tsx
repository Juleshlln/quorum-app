type AnalysisMode = 'trend' | 'simulation';

export function AnalysisModeSelector({
  value,
  onChange,
  runCount,
}: {
  value: AnalysisMode;
  onChange: (val: AnalysisMode) => void;
  runCount: number;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm quorum-text-muted">
        Étape 2 — Choisis le mode d’analyse
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        <button
          onClick={() => onChange('trend')}
          className={`text-left rounded-2xl border p-4 transition-all ${
            value === 'trend'
              ? 'quorum-border-strong quorum-surface-strong'
              : 'quorum-border-default quorum-surface-strong hover:quorum-surface'
          }`}
        >
          <h4 className="font-semibold quorum-text-primary">Tendance IA</h4>
          <p className="mt-2 text-xs quorum-text-muted">
            Plusieurs runs par prompt, résultats agrégés et probabilistes.
          </p>
          <p className="mt-3 text-xs quorum-text-muted">
            Plan Starter — {runCount} runs par prompt
          </p>
        </button>
        <button
          onClick={() => onChange('simulation')}
          className={`text-left rounded-2xl border p-4 transition-all ${
            value === 'simulation'
              ? 'quorum-border-strong quorum-surface-strong'
              : 'quorum-border-default quorum-surface-strong hover:quorum-surface'
          }`}
        >
          <h4 className="font-semibold quorum-text-primary">Simulation utilisateur</h4>
          <p className="mt-2 text-xs quorum-text-muted">
            Une réponse plausible, sans scores probabilistes.
          </p>
          <p className="mt-3 text-xs quorum-text-muted">
            1 réponse — sans scores probabilistes
          </p>
        </button>
      </div>
    </div>
  );
}
