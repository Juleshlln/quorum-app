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
      <p className="text-sm text-zinc-400">
        Étape 2 — Choisis le mode d’analyse
      </p>
      <div className="grid md:grid-cols-2 gap-3">
        <button
          onClick={() => onChange('trend')}
          className={`text-left rounded-xl border p-4 transition-all ${
            value === 'trend'
              ? 'border-cyan-500/40 bg-cyan-500/10'
              : 'border-white/10 hover:bg-white/5'
          }`}
        >
          <h4 className="font-semibold">Tendance IA</h4>
          <p className="text-xs text-zinc-400 mt-2">
            Plusieurs runs par prompt, résultats agrégés et probabilistes.
          </p>
          <p className="mt-3 text-xs text-zinc-300">
            Plan Starter — {runCount} runs par prompt
          </p>
        </button>
        <button
          onClick={() => onChange('simulation')}
          className={`text-left rounded-xl border p-4 transition-all ${
            value === 'simulation'
              ? 'border-cyan-500/40 bg-cyan-500/10'
              : 'border-white/10 hover:bg-white/5'
          }`}
        >
          <h4 className="font-semibold">Simulation utilisateur</h4>
          <p className="text-xs text-zinc-400 mt-2">
            Une réponse plausible, sans scores probabilistes.
          </p>
          <p className="mt-3 text-xs text-zinc-300">
            1 réponse — sans scores probabilistes
          </p>
        </button>
      </div>
    </div>
  );
}
