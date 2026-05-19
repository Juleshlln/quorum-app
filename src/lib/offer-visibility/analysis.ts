import type { OfferEntityType, OfferMention, OfferSentiment } from '@/lib/offer-visibility/types';

type EntityCandidate = {
  name: string;
  entity_type: OfferEntityType;
  matched_domain?: string | null;
};

type DetectedMention = Omit<OfferMention, 'id' | 'offer_prompt_run_id' | 'offer_category_id' | 'created_at'>;

const RECOMMENDATION_TOKENS = [
  'recommande',
  'recommandé',
  'recommandee',
  'conseille',
  'meilleur',
  'meilleure',
  'choisir',
  'idéal',
  'ideal',
  'pertinent',
  'référence',
  'reference',
  'leader',
];

const POSITIVE_TOKENS = ['fiable', 'excellent', 'recommand', 'meilleur', 'leader', 'solide', 'performant', 'qualité', 'qualite'];
const NEGATIVE_TOKENS = ['éviter', 'eviter', 'mauvais', 'cher', 'limité', 'limite', 'problème', 'probleme', 'décevant', 'decevant'];

function normalizeText(input: string | null | undefined) {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getEvidenceQuote(answer: string, index: number) {
  if (index < 0) return null;
  const start = Math.max(0, index - 120);
  const end = Math.min(answer.length, index + 220);
  return answer.slice(start, end).replace(/\s+/g, ' ').trim().slice(0, 320);
}

function estimatePosition(answer: string, index: number, fallback: number) {
  if (index < 0) return null;
  const before = answer.slice(Math.max(0, index - 180), index + 1);
  const explicitRank = before.match(/(?:^|\n|\s)(\d{1,2})[\).\-]\s*[^\n]{0,120}$/);
  if (explicitRank?.[1]) {
    const value = Number(explicitRank[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return fallback > 0 ? fallback : null;
}

function inferSentiment(windowText: string): OfferSentiment {
  const normalized = normalizeText(windowText);
  const positive = POSITIVE_TOKENS.some((token) => normalized.includes(normalizeText(token)));
  const negative = NEGATIVE_TOKENS.some((token) => normalized.includes(normalizeText(token)));
  if (positive && negative) return 'mixed';
  if (positive) return 'positive';
  if (negative) return 'negative';
  return 'neutral';
}

function isRecommended(windowText: string) {
  const normalized = normalizeText(windowText);
  return RECOMMENDATION_TOKENS.some((token) => normalized.includes(normalizeText(token)));
}

function findEntity(answer: string, entityName: string) {
  const normalizedAnswer = normalizeText(answer);
  const normalizedEntity = normalizeText(entityName);
  if (!normalizedEntity || normalizedEntity.length < 2) return -1;

  const directIndex = normalizedAnswer.search(new RegExp(`\\b${escapeRegExp(normalizedEntity)}\\b`, 'i'));
  if (directIndex >= 0) return directIndex;

  const compactEntity = normalizedEntity.replace(/[^a-z0-9]/g, '');
  if (compactEntity.length < 4) return -1;
  const compactAnswer = normalizedAnswer.replace(/[^a-z0-9]/g, '');
  return compactAnswer.indexOf(compactEntity);
}

function dedupeCandidates(candidates: EntityCandidate[]) {
  const byKey = new Map<string, EntityCandidate>();
  for (const candidate of candidates) {
    const key = normalizeText(candidate.name);
    if (!key || byKey.has(key)) continue;
    byKey.set(key, candidate);
  }
  return Array.from(byKey.values());
}

export function analyzeOfferAnswer(args: {
  answer: string;
  brandName: string;
  brandDomain?: string | null;
  competitors: Array<{ name: string; domain?: string | null }>;
}): DetectedMention[] {
  const answer = args.answer || '';
  const candidates = dedupeCandidates([
    {
      name: args.brandName,
      entity_type: 'own_brand',
      matched_domain: args.brandDomain || null,
    },
    ...args.competitors.map((competitor) => ({
      name: competitor.name,
      entity_type: 'competitor' as const,
      matched_domain: competitor.domain || null,
    })),
  ]);

  const detected = candidates
    .map((candidate) => {
      const matchIndex = findEntity(answer, candidate.name);
      if (matchIndex < 0) return null;
      const quote = getEvidenceQuote(answer, matchIndex);
      const position = estimatePosition(answer, matchIndex, 0);
      const sentiment = inferSentiment(quote || answer);
      return {
        entity_name: candidate.name,
        entity_type: candidate.entity_type,
        matched_domain: candidate.matched_domain || null,
        position,
        is_recommended: isRecommended(quote || answer),
        sentiment,
        evidence_quote: quote,
        confidence_score: quote ? 0.85 : 0.55,
        match_index: matchIndex,
      };
    })
    .filter(Boolean) as Array<DetectedMention & { match_index: number }>;

  detected.sort((left, right) => left.match_index - right.match_index);

  return detected.map((mention, index) => ({
    entity_name: mention.entity_name,
    entity_type: mention.entity_type,
    matched_domain: mention.matched_domain,
    position: mention.position || index + 1,
    is_recommended: mention.is_recommended,
    sentiment: mention.sentiment,
    evidence_quote: mention.evidence_quote,
    confidence_score: mention.confidence_score,
  }));
}
