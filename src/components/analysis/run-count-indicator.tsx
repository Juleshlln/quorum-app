type RunCountIndicatorProps = {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
};

export function RunCountIndicator({
  value,
  min = 1,
  max = 10,
  onChange,
}: RunCountIndicatorProps) {
  const clamped = Math.min(max, Math.max(min, value));

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Nombre de runs par prompt</p>
        <span className="text-xs text-zinc-500">{clamped} runs</span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, clamped - 1))}
          className="h-9 w-9 rounded-lg border border-white/10 text-white hover:bg-white/5 disabled:opacity-40"
          disabled={clamped <= min}
          aria-label="Réduire le nombre de runs"
        >
          -
        </button>
        <div className="flex-1">
          <div className="h-2 rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all"
              style={{ width: `${((clamped - min) / (max - min)) * 100}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Plus de runs = plus de fiabilité, mais plus de coût.
          </div>
        </div>
        <button
          onClick={() => onChange(Math.min(max, clamped + 1))}
          className="h-9 w-9 rounded-lg border border-white/10 text-white hover:bg-white/5 disabled:opacity-40"
          disabled={clamped >= max}
          aria-label="Augmenter le nombre de runs"
        >
          +
        </button>
      </div>
    </div>
  );
}
