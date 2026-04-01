import { useEffect, useState } from 'react';
import { PromptBadge } from '@/components/analysis/prompt-badge';

type CategoryKey = 'visibility' | 'position' | 'sentiment';

export function CustomPromptInput({
  defaultCategory,
  onAdd,
  remaining,
}: {
  defaultCategory: CategoryKey;
  onAdd: (text: string, category: CategoryKey) => void;
  remaining: number;
}) {
  const [text, setText] = useState('');
  const [category, setCategory] = useState<CategoryKey>(defaultCategory);

  useEffect(() => {
    setCategory(defaultCategory);
  }, [defaultCategory]);

  return (
    <div className="quorum-panel-soft p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium quorum-text-primary">Option A — Prompts personnalisés</p>
        <PromptBadge category={category} />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ex: Que penses-tu de Tonus par rapport à ses concurrents ?"
        rows={3}
        className="quorum-textarea"
      />
      <div className="flex items-center justify-between gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryKey)}
          className="quorum-select"
        >
          <option value="visibility">Visibilité</option>
          <option value="position">Position</option>
          <option value="sentiment">Sentiment</option>
        </select>
        <button
          onClick={() => {
            const value = text.trim();
            if (!value) return;
            onAdd(value, category);
            if (remaining > 0) setText('');
          }}
          disabled={remaining <= 0}
          className="quorum-btn-primary"
        >
          Ajouter
        </button>
      </div>
      {remaining <= 0 && (
        <p className="text-xs text-red-300">Limite de prompts atteinte.</p>
      )}
      <p className="text-xs quorum-text-subtle">
        Chaque prompt hérite par défaut de la catégorie choisie, mais tu peux la changer.
      </p>
    </div>
  );
}
