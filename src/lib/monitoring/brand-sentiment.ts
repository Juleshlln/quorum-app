export type BrandSentimentLabel = 'positive' | 'neutral' | 'negative';

export type BrandSentimentAnalysis = {
  label: BrandSentimentLabel;
  score: number;
  confidence: number;
  brandMentioned: boolean;
  positiveSignals: number;
  negativeSignals: number;
  evidenceCount: number;
};

const POSITIVE_TERMS = [
  'recommande',
  'recommandee',
  'recommandé',
  'recommandée',
  'fiable',
  'solide',
  'pertinent',
  'pertinente',
  'performant',
  'performante',
  'efficace',
  'excellent',
  'excellente',
  'leader',
  'reference',
  'référence',
  'reconnu',
  'reconnue',
  'qualite',
  'qualité',
  'bon choix',
  'meilleur',
  'meilleure',
  'ideal',
  'idéal',
  'avantage',
  'avantages',
  'large catalogue',
  'livraison rapide',
  'service client',
  'professionnel',
  'professionnelle',
  'specialiste',
  'spécialiste',
  'robuste',
  'trusted',
  'reliable',
  'strong',
  'recommended',
  'best',
  'leading',
];

const NEGATIVE_TERMS = [
  'cher',
  'chere',
  'chère',
  'limite',
  'limité',
  'limitée',
  'faible',
  'probleme',
  'problème',
  'retard',
  'complexe',
  'lent',
  'lente',
  'moins adapte',
  'moins adapté',
  'moins adaptée',
  'pas recommande',
  'pas recommandé',
  'pas recommandée',
  'deconseille',
  'déconseille',
  'deconseillé',
  'déconseillé',
  'mauvais',
  'mauvaise',
  'insuffisant',
  'insuffisante',
  'risque',
  'defaut',
  'défaut',
  'negative',
  'négative',
  'expensive',
  'poor',
  'bad',
  'avoid',
  'limited',
  'slow',
  'issue',
  'issues',
];

const NEGATIONS = ['pas', 'peu', 'aucun', 'aucune', 'sans', 'jamais', 'not', 'no', 'never', 'ne'];
const INTENSIFIERS = ['tres', 'très', 'particulierement', 'particulièrement', 'vraiment', 'fortement', 'very', 'highly'];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function splitSentences(answer: string): string[] {
  return answer
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function hasBrand(sentence: string, brandName: string): boolean {
  const normalizedSentence = normalizeText(sentence);
  const normalizedBrand = normalizeText(brandName);
  if (!normalizedSentence || !normalizedBrand) return false;
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedBrand)}([^a-z0-9]|$)`, 'i');
  return pattern.test(normalizedSentence);
}

function contextSentences(answer: string, brandName: string): string[] {
  const sentences = splitSentences(answer);
  const contexts: string[] = [];

  sentences.forEach((sentence, index) => {
    if (!hasBrand(sentence, brandName)) return;
    const previous = sentences[index - 1] || '';
    const next = sentences[index + 1] || '';
    contexts.push([previous, sentence, next].filter(Boolean).join(' '));
  });

  if (contexts.length > 0) return contexts;
  if (!hasBrand(answer, brandName)) return [];

  const normalized = normalizeText(answer);
  const normalizedBrand = normalizeText(brandName);
  const index = normalized.indexOf(normalizedBrand);
  if (index < 0) return [];
  return [answer.slice(Math.max(0, index - 260), index + normalizedBrand.length + 360)];
}

function termWeight(context: string, term: string, polarity: 'positive' | 'negative'): number {
  const normalizedContext = normalizeText(context);
  const normalizedTerm = normalizeText(term);
  const index = normalizedContext.indexOf(normalizedTerm);
  if (index < 0) return 0;

  const before = tokenize(normalizedContext.slice(Math.max(0, index - 80), index));
  const previousWords = before.slice(-4);
  const hasNegation = previousWords.some((word) => NEGATIONS.includes(word));
  const hasIntensifier = previousWords.some((word) => INTENSIFIERS.includes(word));
  const base = normalizedTerm.includes(' ') ? 1.25 : 1;
  const weighted = hasIntensifier ? base * 1.35 : base;

  if (!hasNegation) return weighted;
  return polarity === 'positive' ? -weighted : weighted;
}

export function analyzeBrandSentiment(answer: string | null | undefined, brandName: string): BrandSentimentAnalysis | null {
  if (!answer || !brandName) return null;
  const contexts = contextSentences(answer, brandName);
  if (contexts.length === 0) {
    return {
      label: 'neutral',
      score: 50,
      confidence: 0,
      brandMentioned: false,
      positiveSignals: 0,
      negativeSignals: 0,
      evidenceCount: 0,
    };
  }

  let positive = 0;
  let negative = 0;

  for (const context of contexts) {
    for (const term of POSITIVE_TERMS) {
      const weight = termWeight(context, term, 'positive');
      if (weight >= 0) positive += weight;
      else negative += Math.abs(weight);
    }
    for (const term of NEGATIVE_TERMS) {
      const weight = termWeight(context, term, 'negative');
      if (weight >= 0) negative += weight;
      else positive += Math.abs(weight);
    }
  }

  const totalSignals = positive + negative;
  const rawPolarity = totalSignals > 0 ? (positive - negative) / totalSignals : 0;
  const score = Math.max(0, Math.min(100, Math.round(50 + rawPolarity * 50)));
  const confidence = Math.max(0.35, Math.min(0.95, totalSignals / Math.max(contexts.length * 2.5, 1)));

  let label: BrandSentimentLabel = 'neutral';
  if (score >= 62 && positive >= negative + 0.75) label = 'positive';
  if (score <= 38 && negative >= positive + 0.75) label = 'negative';

  return {
    label,
    score,
    confidence: Number(confidence.toFixed(2)),
    brandMentioned: true,
    positiveSignals: Number(positive.toFixed(2)),
    negativeSignals: Number(negative.toFixed(2)),
    evidenceCount: contexts.length,
  };
}

export function aggregateBrandSentiment(analyses: BrandSentimentAnalysis[]) {
  const brandAnalyses = analyses.filter((analysis) => analysis.brandMentioned);
  if (brandAnalyses.length === 0) {
    return {
      score: null as number | null,
      label: null as BrandSentimentLabel | null,
      positiveCount: 0,
      neutralCount: 0,
      negativeCount: 0,
      analyzedMentions: 0,
    };
  }

  const totalWeight = brandAnalyses.reduce((sum, analysis) => sum + analysis.confidence, 0);
  const weightedScore = totalWeight > 0
    ? Math.round(brandAnalyses.reduce((sum, analysis) => sum + analysis.score * analysis.confidence, 0) / totalWeight)
    : 50;

  const positiveCount = brandAnalyses.filter((analysis) => analysis.label === 'positive').length;
  const neutralCount = brandAnalyses.filter((analysis) => analysis.label === 'neutral').length;
  const negativeCount = brandAnalyses.filter((analysis) => analysis.label === 'negative').length;

  let label: BrandSentimentLabel = 'neutral';
  if (weightedScore >= 62 && positiveCount >= negativeCount) label = 'positive';
  if (weightedScore <= 38 && negativeCount >= positiveCount) label = 'negative';

  return {
    score: weightedScore,
    label,
    positiveCount,
    neutralCount,
    negativeCount,
    analyzedMentions: brandAnalyses.length,
  };
}
