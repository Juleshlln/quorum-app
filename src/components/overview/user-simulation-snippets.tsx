type SimulationSnippet = {
  prompt: string;
  response: string;
  model?: string | null;
  createdAt?: string | null;
};

export function UserSimulationSnippets({ snippets }: { snippets: SimulationSnippet[] }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-white">Simulation utilisateur</p>
        <p className="text-xs text-zinc-500 mt-1">
          Extraits concrets de réponses IA pour comprendre la perception réelle.
        </p>
      </div>
      <div className="space-y-3">
        {snippets.length === 0 && (
          <div className="text-sm text-zinc-500">Aucune simulation récente disponible.</div>
        )}
        {snippets.map((s, i) => (
          <div key={`${s.prompt}_${i}`} className="rounded-xl border border-white/[0.06] p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Prompt</p>
            <p className="text-sm text-zinc-200">{s.prompt}</p>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mt-3 mb-2">Extrait</p>
            <p className="text-sm text-zinc-300 line-clamp-4">{s.response}</p>
            {s.model && (
              <p className="text-xs text-zinc-500 mt-2">Modèle: {s.model}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
