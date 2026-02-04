type CategoryKey = 'visibility' | 'position' | 'sentiment';

const STYLES: Record<CategoryKey, { label: string; solid: string; outline: string }> = {
  visibility: {
    label: 'Visibilité',
    solid: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    outline: 'border-blue-500/40 text-blue-300',
  },
  position: {
    label: 'Position',
    solid: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    outline: 'border-violet-500/40 text-violet-300',
  },
  sentiment: {
    label: 'Sentiment',
    solid: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    outline: 'border-pink-500/40 text-pink-300',
  },
};

const LEGACY = {
  solid: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  outline: 'border-zinc-500/40 text-zinc-300',
};

export function PromptBadge({
  category,
  variant = 'solid',
}: {
  category: CategoryKey | string | null | undefined;
  variant?: 'solid' | 'outline';
}) {
  const style = STYLES[category as CategoryKey] ?? {
    label: 'Autre',
    solid: LEGACY.solid,
    outline: LEGACY.outline,
  };
  const cls = variant === 'outline' ? style.outline : style.solid;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs rounded-full border ${cls}`}>
      {style.label}
    </span>
  );
}
