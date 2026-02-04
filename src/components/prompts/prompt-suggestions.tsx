'use client';

import { useMemo } from 'react';
import { Plus, Sparkles } from 'lucide-react';

interface PromptSuggestionsProps {
  brandName: string;
  industry: string;
  competitors: string[];
  existingPrompts: string[];
  onAddPrompt: (promptText: string) => void;
}

const DEFAULT_SUGGESTIONS = [
  'Quels sont les meilleurs {industry} en France ?',
  'Que penses-tu de {brand} par rapport à {competitors} ?',
  'Quels sont les leaders du marché {industry} ?',
  'Recommanderais-tu {brand} à une entreprise similaire ?',
  'Quels avantages et inconvénients de {brand} ?',
];

export function PromptSuggestions({
  brandName,
  industry,
  competitors,
  existingPrompts,
  onAddPrompt,
}: PromptSuggestionsProps) {
  const suggestions = useMemo(() => {
    const competitorsStr = competitors.length > 0 ? competitors.join(', ') : 'ses concurrents';
    const industryStr = industry || 'logiciels';

    return DEFAULT_SUGGESTIONS
      .map((s) =>
        s
          .replace(/{brand}/g, brandName)
          .replace(/{industry}/g, industryStr)
          .replace(/{competitors}/g, competitorsStr)
      )
      .filter((s) => !existingPrompts.includes(s));
  }, [brandName, industry, competitors, existingPrompts]);

  if (suggestions.length === 0) {
    return (
      <div className="text-center text-sm text-zinc-500">
        Aucune suggestion disponible.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <Sparkles className="w-4 h-4 text-cyan-400" />
        Suggestions prêtes à l’emploi
      </div>
      <div className="space-y-3">
        {suggestions.map((s, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.06] bg-zinc-900/40 p-4"
          >
            <p className="text-sm text-zinc-300">{s}</p>
            <button
              onClick={() => onAddPrompt(s)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white text-black hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
