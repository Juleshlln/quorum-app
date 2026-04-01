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
    <div className="quorum-panel-soft p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium quorum-text-primary">Option B — Prompts suggérés</p>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="quorum-btn-secondary px-2.5 py-1 text-xs"
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
              className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-sm ${
                checked ? 'quorum-border-strong quorum-surface-strong' : 'quorum-border-default quorum-surface-strong hover:quorum-surface'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onToggle(prompt, e.target.checked)}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="quorum-text-primary">{s.text}</p>
                <div className="mt-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <PromptBadge category={s.primary_objective} />
                    {s.secondary_objectives.map((obj) => (
                      <PromptBadge key={`${s.id}_${obj}`} category={obj} variant="outline" />
                    ))}
                    {s.primary_objective !== category && (
                      <span className="text-xs quorum-text-subtle">Hors objectif</span>
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
            className="quorum-btn-secondary px-3 py-1.5 text-xs"
          >
            Afficher plus
          </button>
        </div>
      )}
    </div>
  );
}
