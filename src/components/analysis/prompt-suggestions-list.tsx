import { useState } from 'react';
import { PromptBadge } from '@/components/analysis/prompt-badge';
import type { PromptSelection, CategoryKey } from '@/components/runs/start-run-button';
import { DEFAULT_PROMPT_TEMPLATES, type AnalysisObjective } from '@/lib/constants/prompt-templates';

type Suggestion = {
  id: string;
  text: string;
  primary_objective: AnalysisObjective;
  secondary_objectives: AnalysisObjective[];
  template_id: string;
};

function getSuggestions(brandName: string, industry?: string, location?: string, description?: string): Suggestion[] {
  const industryValue = industry || 'logiciels';
  const locationValue = location || 'France';
  const contextValue = description ? `${description}.` : '';
  return DEFAULT_PROMPT_TEMPLATES.map((t) => ({
    id: `suggested_${t.id}`,
    template_id: t.id,
    text: t.prompt_text
      .replace(/{brand}/g, brandName)
      .replace(/{industry}/g, industryValue)
      .replace(/{competitors}/g, 'ses concurrents')
      .replace(/{location}/g, locationValue)
      .replace(/{website}/g, brandName)
      .replace(/{context}/g, contextValue)
      .trim(),
    primary_objective: t.primary_objective,
    secondary_objectives: t.secondary_objectives || [],
  }));
}

export function PromptSuggestionsList({
  category,
  brandName,
  industry,
  location,
  description,
  selected,
  onToggle,
}: {
  category: CategoryKey;
  brandName: string;
  industry?: string | null;
  location?: string | null;
  description?: string | null;
  selected: PromptSelection[];
  onToggle: (prompt: PromptSelection, checked: boolean) => void;
}) {
  const suggestions = getSuggestions(brandName, industry || undefined, location || undefined, description || undefined);
  const selectedIds = new Set(selected.map((s) => s.id));
  const [visibleCount, setVisibleCount] = useState(4);
  const [showAll, setShowAll] = useState(false);
  const filtered = showAll
    ? suggestions
    : suggestions.filter((s) => s.primary_objective === category);

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Option B — Prompts suggérés</p>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-zinc-300 border border-white/10 px-2.5 py-1 rounded-lg hover:bg-white/5"
        >
          {showAll ? 'Filtrer par objectif' : 'Afficher tout'}
        </button>
      </div>
      <div className="space-y-2">
        {filtered
          .slice(0, visibleCount)
          .map((s) => {
          const checked = selectedIds.has(s.id);
          const prompt: PromptSelection = {
            id: s.id,
            text: s.text,
            category: s.primary_objective as CategoryKey,
            type: 'suggested',
            templateId: s.template_id,
            primaryObjective: s.primary_objective,
            secondaryObjectives: s.secondary_objectives,
          };
          return (
            <label
              key={s.id}
              className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-sm ${
                checked ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-white/10 hover:bg-white/5'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onToggle(prompt, e.target.checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="text-zinc-200">{s.text}</p>
                <div className="mt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <PromptBadge category={s.primary_objective} />
                    {s.secondary_objectives.map((obj) => (
                      <PromptBadge key={`${s.id}_${obj}`} category={obj} variant="outline" />
                    ))}
                    {s.primary_objective !== category && (
                      <span className="text-xs text-zinc-500">Hors objectif</span>
                    )}
                  </div>
                </div>
              </div>
            </label>
          );
        })}
      </div>
      {filtered.length > visibleCount && (
        <div className="flex justify-center">
          <button
            onClick={() => setVisibleCount((c) => c + 4)}
            className="text-xs text-zinc-300 border border-white/10 px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
            Afficher plus
          </button>
        </div>
      )}
    </div>
  );
}
