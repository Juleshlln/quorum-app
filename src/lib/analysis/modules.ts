export type RawItem = {
  prompt_text: string;
  ai_response: string | null;
  brand_mentioned: boolean | null;
  brand_position: number | null;
  competitors_mentioned: string[];
  website_cited: boolean | null;
  sentiment_label: string | null;
};

export type ModuleKey = 'visibility' | 'position' | 'sentiment' | 'global';

export type ModuleResult = {
  module_key: ModuleKey;
  score: number;
  details: Record<string, unknown>;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeVisibility(items: RawItem[]): ModuleResult {
  const total = items.length;
  const mentionedCount = items.filter((i) => i.brand_mentioned === true).length;
  const score = total > 0 ? (mentionedCount / total) * 100 : 0;
  return {
    module_key: 'visibility',
    score: clampScore(score),
    details: { total, mentionedCount },
  };
}

export function computePosition(items: RawItem[]): ModuleResult {
  const mentioned = items.filter((i) => i.brand_mentioned === true);
  if (mentioned.length === 0) {
    return {
      module_key: 'position',
      score: 0,
      details: { avgPosition: null, samples: 0, reason: 'no_brand_mentioned' },
    };
  }

  const positions = mentioned
    .map((i) => i.brand_position)
    .filter((p): p is number => typeof p === 'number');

  let score = 50;
  let avgPosition: number | null = null;
  if (positions.length > 0) {
    avgPosition = positions.reduce((a, b) => a + b, 0) / positions.length;
    score = Math.max(0, 100 - (avgPosition - 1) * 12.5);
  }

  return {
    module_key: 'position',
    score: clampScore(score),
    details: { avgPosition, samples: positions.length },
  };
}

export function computeSentiment(items: RawItem[]): ModuleResult {
  const mentioned = items.filter((i) => i.brand_mentioned === true);
  if (mentioned.length === 0) {
    return {
      module_key: 'sentiment',
      score: 0,
      details: { counts: {}, samples: 0, reason: 'no_brand_mentioned' },
    };
  }

  const labels = mentioned
    .map((i) => i.sentiment_label)
    .filter((l): l is string => !!l);

  let score = 50;
  if (labels.length > 0) {
    const mapped: number[] = labels.map((l) => {
      if (l === 'positive') return 100;
      if (l === 'negative') return 0;
      return 50;
    });
    score = mapped.reduce((a, b) => a + b, 0) / mapped.length;
  }

  const counts = labels.reduce(
    (acc, l) => {
      acc[l] = (acc[l] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    module_key: 'sentiment',
    score: clampScore(score),
    details: { counts, samples: labels.length },
  };
}

export function computeGlobal(modules: ModuleResult[]): ModuleResult {
  const byKey = Object.fromEntries(modules.map((m) => [m.module_key, m]));
  const visibility = byKey.visibility?.score ?? 0;
  const position = byKey.position?.score ?? 0;
  const sentiment = byKey.sentiment?.score ?? 0;

  const score = visibility * 0.4 + position * 0.3 + sentiment * 0.3;
  return {
    module_key: 'global',
    score: clampScore(score),
    details: { visibility, position, sentiment, weights: { visibility: 0.4, position: 0.3, sentiment: 0.3 } },
  };
}

export function computeModules(items: RawItem[], keys: ModuleKey[]): ModuleResult[] {
  const results: ModuleResult[] = [];

  if (keys.includes('visibility')) results.push(computeVisibility(items));
  if (keys.includes('position')) results.push(computePosition(items));
  if (keys.includes('sentiment')) results.push(computeSentiment(items));
  if (keys.includes('global')) {
    const base = results.filter((r) => r.module_key !== 'global');
    results.push(computeGlobal(base));
  }

  return results;
}
