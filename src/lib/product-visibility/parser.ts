import { getDomainFromUrl, normalizeUrl } from '@/lib/sources/normalize';

export type ProductCategoryLite = {
  id: string;
  name: string;
  description?: string | null;
  business_intent?: string | null;
};

export type ProductLite = {
  id: string;
  category_id: string | null;
  product_name: string;
  brand_name: string | null;
  is_owned_product: boolean;
  competitor_brand: string | null;
  attributes: unknown;
  target_keywords: string[] | null;
};

export type ProductAttributeLite = {
  id: string;
  category_id: string | null;
  name: string;
};

export type CitationLite = {
  url?: string | null;
  domain?: string | null;
  method?: string | null;
};

export type ParsedProductMention = {
  product_id: string;
  category_id: string | null;
  product_name: string;
  brand_name: string | null;
  is_owned_product: boolean;
  rank_position: number | null;
  sentiment_score: number;
  attributes: string[];
  match_index: number;
};

export type ParsedSource = {
  url: string;
  domain: string;
  source_type: 'owned' | 'competitor' | 'third_party';
};

export type ParsedRecommendation = {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  expected_impact: string;
  source_reason: string;
  related_product_id?: string | null;
  related_category_id?: string | null;
};

export type ProductVisibilityParsedResult = {
  category: string | null;
  category_id: string | null;
  buying_intent: 'discovery' | 'comparison' | 'decision' | 'attribute-based';
  owned_products_mentioned: ParsedProductMention[];
  competitor_products_mentioned: ParsedProductMention[];
  attributes_detected: string[];
  sources_detected: ParsedSource[];
  accuracy_issues: Array<{ field: string; issue: string }>;
  recommendations: ParsedRecommendation[];
  visibility_score: number;
  sentiment_score: number;
  accuracy_score: number;
};

const DEFAULT_ATTRIBUTE_KEYWORDS = [
  'prix',
  'disponibilite',
  'livraison',
  'robustesse',
  'conformite',
  'capacite',
  'capacite de charge',
  'marque',
  'garantie',
  'installation',
  'securite',
  'maintenance',
  'avis clients',
  'certification',
  'batterie',
  'autonomie',
  'service apres vente',
  'support',
  'delai',
  'qualite',
  'performance',
  'cout total',
  'fiabilite',
  'durabilite',
];

const POSITIVE_TOKENS = [
  'excellent',
  'fiable',
  'robuste',
  'recommande',
  'meilleur',
  'ideal',
  'performant',
  'efficace',
  'rapide',
  'qualite',
  'solide',
  'bon',
  'avantage',
  'leader',
];

const NEGATIVE_TOKENS = [
  'cher',
  'limite',
  'faible',
  'probleme',
  'lourd',
  'lent',
  'obsolete',
  'insuffisant',
  'mauvais',
  'defaut',
  'risque',
  'negatif',
  'critique',
  'retard',
];

function normalizeText(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inferBuyingIntent(promptText: string, explicitIntent?: string | null): ProductVisibilityParsedResult['buying_intent'] {
  const explicit = normalizeText(explicitIntent || '');
  if (explicit.includes('compar')) return 'comparison';
  if (explicit.includes('decision') || explicit.includes('achat') || explicit.includes('purchase')) return 'decision';
  if (explicit.includes('attribut')) return 'attribute-based';
  if (explicit.includes('discover') || explicit.includes('decouverte')) return 'discovery';

  const prompt = normalizeText(promptText);
  if (/\b(vs|versus|comparer|compare|alternative|meilleur|top)\b/.test(prompt)) return 'comparison';
  if (/\b(acheter|ou acheter|prix|livraison|commande|fournisseur)\b/.test(prompt)) return 'decision';
  if (/\b(avec|sans|capacite|garantie|certification|batterie|conformite|poids)\b/.test(prompt)) return 'attribute-based';
  return 'discovery';
}

function pickCategory(args: {
  categories: ProductCategoryLite[];
  products: ProductLite[];
  promptCategoryId?: string | null;
  promptText: string;
  rawAnswer: string;
}) {
  const byId = new Map(args.categories.map((category) => [category.id, category]));
  if (args.promptCategoryId && byId.has(args.promptCategoryId)) {
    const category = byId.get(args.promptCategoryId)!;
    return { category_id: category.id, category: category.name };
  }

  const prompt = normalizeText(args.promptText);
  const answer = normalizeText(args.rawAnswer);
  const joined = `${prompt} ${answer}`;

  for (const category of args.categories) {
    const normalizedName = normalizeText(category.name);
    if (!normalizedName) continue;
    if (joined.includes(normalizedName)) {
      return { category_id: category.id, category: category.name };
    }
  }

  const productCategoryCounter = new Map<string, number>();
  const lowerAnswer = normalizeText(args.rawAnswer);
  for (const product of args.products) {
    const name = normalizeText(product.product_name);
    if (!name || !product.category_id) continue;
    if (lowerAnswer.includes(name)) {
      productCategoryCounter.set(product.category_id, (productCategoryCounter.get(product.category_id) || 0) + 1);
    }
  }

  if (productCategoryCounter.size > 0) {
    const [bestCategoryId] = Array.from(productCategoryCounter.entries()).sort((left, right) => right[1] - left[1])[0];
    const category = byId.get(bestCategoryId);
    if (category) return { category_id: category.id, category: category.name };
  }

  return { category_id: null, category: null };
}

function scoreSentiment(windowText: string): number {
  const text = normalizeText(windowText);
  if (!text) return 0;

  let positive = 0;
  let negative = 0;

  for (const token of POSITIVE_TOKENS) {
    if (text.includes(token)) positive += 1;
  }
  for (const token of NEGATIVE_TOKENS) {
    if (text.includes(token)) negative += 1;
  }

  if (positive === 0 && negative === 0) return 0;
  const raw = (positive - negative) / Math.max(positive + negative, 1);
  return Math.max(-1, Math.min(1, Number(raw.toFixed(2))));
}

function detectAttributePool(args: {
  categoryId: string | null;
  products: ProductLite[];
  productAttributes: ProductAttributeLite[];
}) {
  const pool = new Set<string>();
  for (const raw of DEFAULT_ATTRIBUTE_KEYWORDS) {
    pool.add(normalizeText(raw));
  }

  for (const attribute of args.productAttributes) {
    if (args.categoryId && attribute.category_id && attribute.category_id !== args.categoryId) continue;
    const normalized = normalizeText(attribute.name);
    if (normalized) pool.add(normalized);
  }

  for (const product of args.products) {
    if (args.categoryId && product.category_id && product.category_id !== args.categoryId) continue;

    const attrs = product.attributes;
    if (Array.isArray(attrs)) {
      for (const value of attrs) {
        const normalized = normalizeText(String(value));
        if (normalized) pool.add(normalized);
      }
      continue;
    }

    if (attrs && typeof attrs === 'object') {
      for (const key of Object.keys(attrs as Record<string, unknown>)) {
        const normalized = normalizeText(key);
        if (normalized) pool.add(normalized);
      }
    }
  }

  return Array.from(pool).filter(Boolean);
}

function detectAttributes(text: string, attributePool: string[]): string[] {
  const normalized = normalizeText(text);
  const matches: string[] = [];

  for (const attribute of attributePool) {
    if (!attribute) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(attribute)}\\b`, 'i');
    if (pattern.test(normalized)) {
      matches.push(attribute);
    }
  }

  return Array.from(new Set(matches));
}

function estimateRankPosition(response: string, mentionIndex: number, fallbackRank: number): number | null {
  if (mentionIndex < 0) return null;

  const before = response.slice(Math.max(0, mentionIndex - 120), mentionIndex + 1);
  const explicitRank = before.match(/(?:^|\n|\s)(\d{1,2})[\).\-]\s*[^\n]{0,80}$/);
  if (explicitRank && explicitRank[1]) {
    const value = Number(explicitRank[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }

  return fallbackRank > 0 ? fallbackRank : null;
}

function extractSources(args: {
  rawAnswer: string;
  citations: CitationLite[];
  brandName: string;
  competitorNames: string[];
}): ParsedSource[] {
  const sources = new Map<string, ParsedSource>();
  const brandToken = normalizeText(args.brandName).replace(/[^a-z0-9]/g, '');
  const competitorTokens = args.competitorNames
    .map((name) => normalizeText(name).replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);

  const pushSource = (urlOrNull: string | null | undefined, domainOrNull: string | null | undefined) => {
    const normalizedUrl = normalizeUrl(urlOrNull || '');
    const domain = domainOrNull || (normalizedUrl ? getDomainFromUrl(normalizedUrl) : null);
    if (!domain) return;

    const normalizedDomain = normalizeText(domain).replace(/^www\./, '');
    const key = normalizedUrl || normalizedDomain;

    let sourceType: ParsedSource['source_type'] = 'third_party';
    const domainToken = normalizedDomain.replace(/[^a-z0-9]/g, '');
    if (brandToken && domainToken.includes(brandToken)) {
      sourceType = 'owned';
    } else if (competitorTokens.some((token) => token && domainToken.includes(token))) {
      sourceType = 'competitor';
    }

    sources.set(key, {
      url: normalizedUrl || `https://${normalizedDomain}`,
      domain: normalizedDomain,
      source_type: sourceType,
    });
  };

  const urlRegex = /https?:\/\/[^\s)\]]+/gi;
  const fromAnswer = args.rawAnswer.match(urlRegex) || [];
  for (const url of fromAnswer) {
    pushSource(url, null);
  }

  for (const citation of args.citations) {
    pushSource(citation.url || null, citation.domain || null);
  }

  return Array.from(sources.values());
}

function buildAccuracyIssues(args: {
  ownedMentions: ParsedProductMention[];
  competitorMentions: ParsedProductMention[];
  attributesDetected: string[];
  sourcesDetected: ParsedSource[];
  categoryName: string | null;
}): Array<{ field: string; issue: string }> {
  const issues: Array<{ field: string; issue: string }> = [];

  if (!args.categoryName) {
    issues.push({ field: 'category', issue: 'Categorie non determinee clairement dans la reponse IA.' });
  }

  if (args.ownedMentions.length === 0 && args.competitorMentions.length > 0) {
    issues.push({
      field: 'owned_products_mentioned',
      issue: 'Aucun produit de la marque n est mentionne alors que des concurrents le sont.',
    });
  }

  if (args.attributesDetected.length === 0) {
    issues.push({
      field: 'attributes_detected',
      issue: 'Aucun attribut produit clair detecte dans la reponse.',
    });
  }

  if (args.sourcesDetected.length === 0) {
    issues.push({
      field: 'sources_detected',
      issue: 'Aucune source explicite detectee dans la reponse IA.',
    });
  }

  return issues;
}

function buildRecommendations(args: {
  ownedMentions: ParsedProductMention[];
  competitorMentions: ParsedProductMention[];
  attributesDetected: string[];
  sourcesDetected: ParsedSource[];
  categoryId: string | null;
  categoryName: string | null;
}): ParsedRecommendation[] {
  const recommendations: ParsedRecommendation[] = [];

  if (args.ownedMentions.length === 0 && args.competitorMentions.length > 0) {
    recommendations.push({
      title: 'Renforcer les fiches de vos produits',
      description: 'Ajouter des attributs décisionnels (prix, délai, garantie, disponibilité) sur les produits prioritaires de la catégorie.',
      priority: 'high',
      expected_impact: 'Améliorer la présence de vos produits dans les requêtes IA transactionnelles.',
      source_reason: 'auto-generated: concurrents cités avant vos produits',
      related_category_id: args.categoryId,
    });
  }

  if (!args.attributesDetected.includes('livraison') && !args.attributesDetected.includes('delai')) {
    recommendations.push({
      title: 'Ajouter une FAQ livraison sur la catégorie',
      description: 'Créer une section FAQ claire sur délais, zones desservies et conditions logistiques.',
      priority: 'medium',
      expected_impact: 'Mieux couvrir les requêtes de décision orientées logistique.',
      source_reason: 'auto-generated: attribut livraison peu visible',
      related_category_id: args.categoryId,
    });
  }

  if (args.sourcesDetected.filter((source) => source.source_type === 'owned').length === 0) {
    recommendations.push({
      title: 'Augmenter la couverture de vos sources',
      description: 'Structurer les pages catégorie et fiches produits avec données schema.org et contenus comparatifs exploitables par les IA.',
      priority: 'high',
      expected_impact: 'Améliorer la proportion de citations de vos sources dans les recommandations IA.',
      source_reason: 'auto-generated: citations de vos sources insuffisantes',
      related_category_id: args.categoryId,
    });
  }

  if (args.competitorMentions.length > args.ownedMentions.length) {
    recommendations.push({
      title: `Créer un contenu comparatif ${args.categoryName || 'catégorie'}`,
      description: 'Produire une page comparative explicite contre les marques concurrentes les plus citees.',
      priority: 'medium',
      expected_impact: 'Gagner des positions sur les requêtes de comparaison.',
      source_reason: 'auto-generated: part de voix concurrente supérieure',
      related_category_id: args.categoryId,
    });
  }

  return recommendations.slice(0, 5);
}

export function parseProductVisibilityResponse(args: {
  rawAnswer: string;
  promptText: string;
  brandName: string;
  categories: ProductCategoryLite[];
  products: ProductLite[];
  productAttributes: ProductAttributeLite[];
  citations?: CitationLite[];
  competitorNames?: string[];
  promptCategoryId?: string | null;
  promptBuyingIntent?: string | null;
  fallbackSentimentLabel?: 'positive' | 'neutral' | 'negative' | null;
  fallbackPosition?: number | null;
}): ProductVisibilityParsedResult {
  const rawAnswer = args.rawAnswer || '';
  const normalizedAnswer = normalizeText(rawAnswer);
  const buyingIntent = inferBuyingIntent(args.promptText, args.promptBuyingIntent || null);
  const categoryChoice = pickCategory({
    categories: args.categories,
    products: args.products,
    promptCategoryId: args.promptCategoryId || null,
    promptText: args.promptText,
    rawAnswer,
  });

  const attributePool = detectAttributePool({
    categoryId: categoryChoice.category_id,
    products: args.products,
    productAttributes: args.productAttributes,
  });

  const mentions: ParsedProductMention[] = [];
  for (const product of args.products) {
    const candidateTokens = [product.product_name, product.brand_name, `${product.brand_name || ''} ${product.product_name}`]
      .map((value) => normalizeText(value || ''))
      .filter((value) => value.length >= 3);

    let firstMatch = -1;
    for (const token of candidateTokens) {
      const matchIndex = normalizedAnswer.indexOf(token);
      if (matchIndex >= 0 && (firstMatch === -1 || matchIndex < firstMatch)) {
        firstMatch = matchIndex;
      }
    }

    if (firstMatch === -1) continue;

    const windowStart = Math.max(0, firstMatch - 120);
    const windowEnd = Math.min(rawAnswer.length, firstMatch + 260);
    const windowText = rawAnswer.slice(windowStart, windowEnd);

    mentions.push({
      product_id: product.id,
      category_id: product.category_id,
      product_name: product.product_name,
      brand_name: product.brand_name,
      is_owned_product: !!product.is_owned_product,
      rank_position: null,
      sentiment_score: scoreSentiment(windowText),
      attributes: detectAttributes(windowText, attributePool),
      match_index: firstMatch,
    });
  }

  mentions.sort((left, right) => left.match_index - right.match_index);
  mentions.forEach((mention, index) => {
    mention.rank_position = estimateRankPosition(rawAnswer, mention.match_index, index + 1);
  });

  const ownedMentions = mentions.filter((mention) => mention.is_owned_product);
  const competitorMentions = mentions.filter((mention) => !mention.is_owned_product);

  const attributesDetected = Array.from(
    new Set(
      mentions.flatMap((mention) => mention.attributes).concat(detectAttributes(rawAnswer, attributePool)),
    ),
  );

  const sourcesDetected = extractSources({
    rawAnswer,
    citations: args.citations || [],
    brandName: args.brandName,
    competitorNames: args.competitorNames || [],
  });

  const issues = buildAccuracyIssues({
    ownedMentions,
    competitorMentions,
    attributesDetected,
    sourcesDetected,
    categoryName: categoryChoice.category,
  });

  const visibilityScore = mentions.length === 0
    ? 0
    : Number(((ownedMentions.length / mentions.length) * 100).toFixed(1));

  const baseSentimentFromMentions = mentions.length > 0
    ? Number((mentions.reduce((sum, mention) => sum + mention.sentiment_score, 0) / mentions.length).toFixed(2))
    : 0;

  const fallbackSentiment =
    args.fallbackSentimentLabel === 'positive'
      ? 0.7
      : args.fallbackSentimentLabel === 'negative'
        ? -0.7
        : 0;

  const sentimentScore = mentions.length > 0 ? baseSentimentFromMentions : fallbackSentiment;

  const accuracyPenalty = issues.length * 0.15;
  const accuracyScore = Math.max(0, Math.min(1, Number((1 - accuracyPenalty).toFixed(2))));

  const recommendations = buildRecommendations({
    ownedMentions,
    competitorMentions,
    attributesDetected,
    sourcesDetected,
    categoryId: categoryChoice.category_id,
    categoryName: categoryChoice.category,
  });

  return {
    category: categoryChoice.category,
    category_id: categoryChoice.category_id,
    buying_intent: buyingIntent,
    owned_products_mentioned: ownedMentions,
    competitor_products_mentioned: competitorMentions,
    attributes_detected: attributesDetected,
    sources_detected: sourcesDetected,
    accuracy_issues: issues,
    recommendations,
    visibility_score: visibilityScore,
    sentiment_score: sentimentScore,
    accuracy_score: accuracyScore,
  };
}
