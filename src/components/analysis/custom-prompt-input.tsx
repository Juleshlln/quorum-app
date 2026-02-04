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
    <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Option A — Prompts personnalisés</p>
        <PromptBadge category={category} />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Ex: Que penses-tu de Tonus par rapport à ses concurrents ?"
        rows={3}
        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 resize-none"
      />
      <div className="flex items-center justify-between gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryKey)}
          className="bg-zinc-900 border border-white/10 text-sm text-white rounded-lg px-3 py-2"
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
          className="px-4 py-2 rounded-xl bg-white text-black text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>
      {remaining <= 0 && (
        <p className="text-xs text-red-400">Limite de prompts atteinte.</p>
      )}
      <p className="text-xs text-zinc-500">
        Chaque prompt hérite par défaut de la catégorie choisie, mais tu peux la changer.
      </p>
    </div>
  );
}
