import { PromptBadge } from '@/components/analysis/prompt-badge';

type CategoryKey = 'visibility' | 'position' | 'sentiment';

const CARDS: Array<{ key: CategoryKey; title: string; description: string }> = [
  {
    key: 'visibility',
    title: 'Visibilité',
    description: 'Mesurer si la marque est mentionnée spontanément.',
  },
  {
    key: 'position',
    title: 'Position',
    description: 'Évaluer la place de la marque par rapport aux concurrents.',
  },
  {
    key: 'sentiment',
    title: 'Sentiment',
    description: 'Qualifier la perception positive, neutre ou négative.',
  },
];

export function AnalysisGoalSelector({
  value,
  onChange,
}: {
  value: CategoryKey;
  onChange: (val: CategoryKey) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm quorum-text-muted">
        Étape 1 — Choisis l’objectif principal de l’analyse
      </p>
      <div className="grid md:grid-cols-3 gap-3">
        {CARDS.map((c) => (
          <button
            key={c.key}
            onClick={() => onChange(c.key)}
            className={`text-left rounded-2xl border p-4 transition-all ${
              value === c.key
                ? 'quorum-border-strong quorum-surface-strong'
                : 'quorum-border-default quorum-surface-strong hover:quorum-surface'
            }`}
          >
            <div className="flex items-center justify-between">
              <h4 className="font-semibold quorum-text-primary">{c.title}</h4>
              <PromptBadge category={c.key} />
            </div>
            <p className="mt-2 text-xs quorum-text-muted">{c.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
