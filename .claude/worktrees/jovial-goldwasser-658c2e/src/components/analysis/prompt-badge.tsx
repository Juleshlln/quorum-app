type CategoryKey = 'visibility' | 'position' | 'sentiment';

const STYLES: Record<CategoryKey, { label: string; solid: string; outline: string }> = {
  visibility: {
    label: 'Visibilité',
    solid: 'quorum-border-strong quorum-surface-strong quorum-text-primary',
    outline: 'quorum-border-strong quorum-text-muted',
  },
  position: {
    label: 'Position',
    solid: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    outline: 'border-amber-500/20 text-amber-300',
  },
  sentiment: {
    label: 'Sentiment',
    solid: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    outline: 'border-emerald-500/20 text-emerald-300',
  },
};

const LEGACY = {
  solid: 'quorum-border-strong quorum-surface-strong quorum-text-primary',
  outline: 'quorum-border-strong quorum-text-muted',
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
