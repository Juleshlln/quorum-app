type PromptRow = {
  promptId: string;
  promptText: string;
  topicName: string | null;
  brandShare: number;
  topCompetitor: string | null;
  topCompetitorShare: number;
  ownedClickableShare: number;
  sourceOverlap: number;
  priority: 'high' | 'medium' | 'low';
};

function alpha(value: number) {
  return Math.max(0.08, Math.min(0.42, value / 160));
}

function cellStyle(value: number, tint: 'neutral' | 'positive' | 'alert') {
  if (tint === 'positive') {
    return {
      background: `rgba(52, 211, 153, ${alpha(value)})`,
      borderColor: 'rgba(52, 211, 153, 0.14)',
    };
  }
  if (tint === 'alert') {
    return {
      background: `rgba(251, 146, 60, ${alpha(value)})`,
      borderColor: 'rgba(251, 146, 60, 0.14)',
    };
  }
  return {
    background: `rgba(255, 255, 255, ${alpha(value)})`,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  };
}

function priorityClass(priority: PromptRow['priority']) {
  if (priority === 'high') return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
  if (priority === 'medium') return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
  return 'border-zinc-400/20 bg-zinc-400/10 text-zinc-300';
}

export function PromptHeatmap({ rows }: { rows: PromptRow[] }) {
  return (
    <div className="quorum-panel p-6">
      <div className="mb-5">
        <p className="quorum-kicker">Prompt Map</p>
        <h3 className="mt-2 text-lg font-semibold quorum-text-primary">Heatmap compétitive par prompt</h3>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px] space-y-3">
          <div className="grid grid-cols-[minmax(320px,1.8fr)_repeat(4,minmax(110px,0.6fr))_minmax(110px,0.55fr)] gap-3 text-[11px] uppercase tracking-[0.18em] quorum-text-muted">
            <div>Prompt</div>
            <div>Brand</div>
            <div>Top competitor</div>
            <div>Owned share</div>
            <div>Overlap</div>
            <div>Priority</div>
          </div>

          {rows.length > 0 ? rows.map((row) => (
            <div
              key={row.promptId}
              className="grid grid-cols-[minmax(320px,1.8fr)_repeat(4,minmax(110px,0.6fr))_minmax(110px,0.55fr)] gap-3"
            >
              <div className="rounded-[24px] border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-4">
                <p className="font-medium quorum-text-primary">{row.promptText}</p>
                <p className="mt-1 text-xs quorum-text-muted">{row.topicName || 'Sans topic'}</p>
              </div>
              <div className="rounded-[22px] border px-4 py-4 text-sm font-medium quorum-text-primary" style={cellStyle(row.brandShare, 'positive')}>
                {row.brandShare}%
              </div>
              <div className="rounded-[22px] border px-4 py-4 text-sm font-medium quorum-text-primary" style={cellStyle(row.topCompetitorShare, 'alert')}>
                <div>{row.topCompetitorShare}%</div>
                <div className="mt-1 text-xs quorum-text-muted">{row.topCompetitor || '—'}</div>
              </div>
              <div className="rounded-[22px] border px-4 py-4 text-sm font-medium quorum-text-primary" style={cellStyle(row.ownedClickableShare, 'neutral')}>
                {row.ownedClickableShare}%
              </div>
              <div className="rounded-[22px] border px-4 py-4 text-sm font-medium quorum-text-primary" style={cellStyle(row.sourceOverlap, 'neutral')}>
                {row.sourceOverlap}%
              </div>
              <div className="flex items-center">
                <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.16em] ${priorityClass(row.priority)}`}>
                  {row.priority}
                </span>
              </div>
            </div>
          )) : (
            <div className="rounded-[24px] border border-dashed border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-8 text-center text-sm quorum-text-muted">
              Aucun prompt compétitif calculé pour cette période.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
