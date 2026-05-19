import type { PromptIntent, PromptQualityStatus, PromptScope } from '@/lib/product-visibility/prompt-types';

export type GenerateProductPromptsInput = {
  productName: string;
  category?: string;
  description?: string;
  useCase?: string;
  targetCustomer?: string;
  attributes?: readonly string[];
  brandName?: string;
  competitors?: readonly string[];
  locale?: 'fr-FR' | 'en-US';
};

export type GeneratedProductPrompt = {
  text: string;
  scope: PromptScope;
  intent: PromptIntent;
  rationale: string;
  qualityStatus: PromptQualityStatus;
};

export type ProductPromptQualityContext = {
  productName?: string;
  category?: string;
  useCase?: string;
  targetCustomer?: string;
  attributes?: readonly string[];
  brandName?: string;
  competitors?: readonly string[];
};

type PromptDraft = Omit<GeneratedProductPrompt, 'qualityStatus'>;

const GENERIC_WEAK_PATTERNS = [
  /quel est le meilleur fournisseur\s*\?/i,
  /quel est le meilleur produit\s*\?/i,
  /quelle entreprise choisir\s*\?/i,
  /meilleur fournisseur\s*\?/i,
  /best supplier\s*\?/i,
  /best product\s*\?/i,
];

const BIASED_PATTERNS = [
  /\bpourquoi\b.+\b(meilleur|meilleure|best)\b/i,
  /\bpourquoi acheter absolument\b/i,
  /\bach[eè]te(?:r|z)? absolument\b/i,
  /\bforc[eé]ment\b.+\bchoisir\b/i,
  /\bdois-je absolument\b/i,
];

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, ' ').replace(/\s+\?/g, ' ?').trim();
}

function normalizeForMatch(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function lowerFirst(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^[A-ZÀ-ÖØ-Þ]{2}/.test(trimmed)) return trimmed;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function stripTrailingPunctuation(value: string | null | undefined) {
  return (value || '').trim().replace(/[.?!]+$/g, '').trim();
}

function firstUsefulSegment(value: string | null | undefined) {
  return stripTrailingPunctuation(value).split(/[,;]/)[0]?.trim() || '';
}

function firstUsefulCustomerSegment(value: string | null | undefined) {
  const segment = firstUsefulSegment(value);
  if (!segment) return '';
  if (/\b(responsables?|acheteurs?|futurs?|clients?|utilisateurs?)\b/i.test(segment)) {
    return 'une entreprise';
  }
  return segment;
}

function compactList(values: readonly string[], max = 3) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, max);
}

function wordCount(value: string) {
  return normalizeSpaces(value).split(/\s+/).filter(Boolean).length;
}

function cleanAttribute(value: string) {
  const segment = firstUsefulSegment(value.split(/[.!?]/)[0]);
  return segment
    .replace(/\b(le|la|les|un|une|des|ce|cet|cette)\s+produit\b/gi, '')
    .replace(/\boffre\b.+$/i, '')
    .trim();
}

function compactBuyerAttributes(values: readonly string[], max = 4) {
  const seen = new Set<string>();
  const attributes: string[] = [];

  for (const value of values) {
    const cleaned = cleanAttribute(value);
    const normalized = normalizeForMatch(cleaned);
    if (!cleaned || cleaned.length > 70 || wordCount(cleaned) > 8) continue;
    if (normalized.length < 3 || seen.has(normalized)) continue;
    seen.add(normalized);
    attributes.push(cleaned);
    if (attributes.length >= max) break;
  }

  return attributes;
}

function isGenericCategory(category: string) {
  const normalized = normalizeForMatch(category);
  return [
    'securite',
    'materiel',
    'equipement',
    'equipements',
    'produits',
    'fournitures',
    'industrie',
    'commerce',
  ].includes(normalized);
}

function productFamilyFromName(productName: string) {
  const cleaned = stripTrailingPunctuation(productName)
    .replace(/\b(master\s*lock|manutan|amazon\s*business|bruneau|raja|seton)\b/gi, '')
    .trim();
  const beforeFeature = cleaned.split(/\s+(?:avec|et|pour|dot[eé] de|muni de)\s+/i)[0]?.trim();
  return beforeFeature || cleaned || productName;
}

function pluralizeFrenchProduct(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const [first, ...rest] = trimmed.split(/\s+/);
  const pluralFirst = /s$/i.test(first) ? first : `${first}s`;
  return [pluralFirst, ...rest].join(' ');
}

function buyerUseCaseFromContext(input: GenerateProductPromptsInput, productFamily: string) {
  const explicitUseCase = stripTrailingPunctuation(input.useCase);
  if (explicitUseCase) return lowerFirst(explicitUseCase);

  const haystack = normalizeForMatch(`${input.productName} ${input.category || ''} ${input.description || ''} ${(input.attributes || []).join(' ')}`);
  if (/\bcadenas?\b/.test(haystack)) {
    return 'sécuriser un casier, une réserve ou un accès professionnel';
  }
  if (/\btranspalette\b/.test(haystack)) {
    return 'déplacer des palettes en entrepôt';
  }

  return `répondre à un besoin professionnel avec ${lowerFirst(productFamily)}`;
}

function buyerProblemPrompt(productFamily: string, useCase: string, contextText: string) {
  const normalized = normalizeForMatch(contextText);
  if (/\bcadenas?\b/.test(normalized) && /\b(combinaison|code|cle|cles?)\b/.test(normalized)) {
    return `Quel ${lowerFirst(productFamily)} choisir quand plusieurs salariés doivent partager un accès sans gérer de clés ?`;
  }
  return `Quelle solution recommander pour ${useCase} ?`;
}

function specificationPrompt(productLabel: string, productFamily: string, attributes: readonly string[], contextText: string) {
  const normalized = normalizeForMatch(`${contextText} ${attributes.join(' ')}`);
  if (/\bcadenas?\b/.test(normalized)) {
    if (/\b4\s*chiffres?\b|\bcombinaisons?\b/.test(normalized)) {
      const family = /\bcombinaison\b/i.test(productFamily)
        ? lowerFirst(productFamily)
        : `${lowerFirst(productFamily)} à combinaison`;
      return `Quel ${family} 4 chiffres choisir pour un usage professionnel ?`;
    }
    if (/\bcoupe\b|\bsciage\b|\banse\b|\bacier\b/.test(normalized)) {
      return `Quel ${lowerFirst(productFamily)} résiste le mieux à la coupe et au sciage ?`;
    }
  }

  const attribute = attributes.find((item) => !/usage professionnel/i.test(item));
  return attribute
    ? `Quel ${lowerFirst(productLabel)} choisir avec ${lowerFirst(attribute)} ?`
    : `Quel ${lowerFirst(productLabel)} recommander avec des critères professionnels fiables ?`;
}

function usageContextSuffix(useCase: string) {
  const lower = lowerFirst(useCase);
  const match = lower.match(/\b(en|dans|pour)\s+(.+)$/i);
  if (!match) return '';
  return ` ${match[1]} ${match[2]}`;
}

function includesContextTerm(prompt: string, context: ProductPromptQualityContext) {
  const normalizedPrompt = normalizeForMatch(prompt);
  const terms = [
    context.productName,
    context.productName ? productFamilyFromName(context.productName) : '',
    context.category,
    context.useCase,
    firstUsefulSegment(context.targetCustomer),
    ...(context.attributes || []),
  ]
    .map(normalizeForMatch)
    .filter((term) => term.length >= 4);

  return terms.some((term) => normalizedPrompt.includes(term));
}

function containsBrand(prompt: string, brandName?: string) {
  const brand = normalizeForMatch(brandName);
  if (!brand) return false;
  return normalizeForMatch(prompt).includes(brand);
}

function isQuestionLike(prompt: string) {
  return /[?]$/.test(prompt.trim()) || /^(quel|quelle|quels|quelles|où|ou|compare|comment|which|where|what|compare)\b/i.test(prompt.trim());
}

export function validateProductPromptQuality(
  prompt: string,
  context: ProductPromptQualityContext,
): PromptQualityStatus {
  const text = normalizeSpaces(prompt);
  const normalized = normalizeForMatch(text);
  if (!text || text.length < 18 || !isQuestionLike(text)) return 'needs_review';

  if (GENERIC_WEAK_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'too_generic';
  }

  const brandMentioned = containsBrand(text, context.brandName);
  if (brandMentioned && BIASED_PATTERNS.some((pattern) => pattern.test(text))) {
    return 'too_biased';
  }

  if (
    brandMentioned
    && /\b(meilleur|meilleure|leader incontestable|numero 1|n1|best)\b/i.test(normalized)
    && !/\b(compare|comparer|par rapport|avis|fiable|recommande|recommander)\b/i.test(normalized)
  ) {
    return 'too_biased';
  }

  const hasProductContext = includesContextTerm(text, context);
  if (!hasProductContext) {
    return 'missing_product_context';
  }

  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount < 5) return 'too_generic';

  return 'valid';
}

function makePrompt(draft: PromptDraft, context: ProductPromptQualityContext): GeneratedProductPrompt {
  const text = normalizeSpaces(draft.text);
  return {
    ...draft,
    text,
    qualityStatus: validateProductPromptQuality(text, context),
  };
}

function dedupePrompts(prompts: GeneratedProductPrompt[]) {
  const seen = new Set<string>();
  return prompts.filter((prompt) => {
    const key = normalizeForMatch(prompt.text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function generateFrenchProductPrompts(input: GenerateProductPromptsInput): PromptDraft[] {
  const productName = stripTrailingPunctuation(input.productName);
  const productLower = lowerFirst(productName);
  const productFamily = productFamilyFromName(productName);
  const productFamilyLower = lowerFirst(productFamily);
  const productFamilyPlural = pluralizeFrenchProduct(productFamilyLower);
  const category = stripTrailingPunctuation(input.category);
  const categoryLower = category && !isGenericCategory(category) ? lowerFirst(category) : '';
  const useCase = buyerUseCaseFromContext(input, productFamily);
  const usageSuffix = usageContextSuffix(useCase);
  const target = firstUsefulCustomerSegment(input.targetCustomer) || 'une entreprise';
  const targetLower = lowerFirst(target);
  const attributes = compactBuyerAttributes(input.attributes || []);
  const firstAttribute = attributes[0] || '';
  const deliveryAttribute = attributes.find((attribute) => /livraison|delivery|delai|d[eé]lai/i.test(attribute)) || '';
  const competitors = compactList(input.competitors || [], 3);
  const brandName = stripTrailingPunctuation(input.brandName);
  const contextText = `${input.productName} ${input.category || ''} ${input.description || ''} ${input.useCase || ''} ${(input.attributes || []).join(' ')}`;
  const categorySubject = categoryLower || productFamilyPlural || productLower;
  const purchaseQualifier = firstAttribute && !/usage professionnel/i.test(firstAttribute)
    ? /\bcombinaison\b/i.test(firstAttribute) && /\bcombinaison\b/i.test(productFamilyLower)
      ? ` ${lowerFirst(firstAttribute).replace(/\bcombinaison\s*(?:à|a)?\s*/i, '').trim()}`
      : ` avec ${lowerFirst(firstAttribute)}`
    : ' fiable';

  const drafts: PromptDraft[] = [
    {
      text: `Quel ${productFamilyLower} choisir pour ${useCase} ?`,
      scope: 'product',
      intent: 'discovery',
      rationale: 'Se place dans la tête d’un acheteur qui cherche une solution sans connaître encore la marque.',
    },
    {
      text: `Où acheter un ${productFamilyLower}${purchaseQualifier} pour ${targetLower} ?`,
      scope: 'product',
      intent: 'purchase',
      rationale: 'Mesure la visibilité sur une intention d’achat réaliste et non brandée.',
    },
    {
      text: categoryLower
        ? `Quels fournisseurs recommander pour acheter ${categoryLower} en entreprise ?`
        : `Quels sont les meilleurs ${productFamilyPlural} pour un usage professionnel ?`,
      scope: categoryLower ? 'category' : 'product',
      intent: categoryLower ? 'category' : 'purchase',
      rationale: 'Teste une recherche amont, formulée comme un acheteur qui compare les options du marché.',
    },
    {
      text: `Compare les meilleurs sites pour acheter un ${productFamilyLower} professionnel.`,
      scope: 'competitive',
      intent: 'comparison',
      rationale: 'Teste la visibilité concurrentielle dans une comparaison de canaux d’achat.',
    },
    {
      text: buyerProblemPrompt(productFamily, useCase, contextText),
      scope: 'product',
      intent: 'use_case',
      rationale: 'Simule une recherche orientée problème, avant que l’acheteur ait forcément choisi le produit.',
    },
    {
      text: deliveryAttribute
        ? `Où trouver un ${productFamilyLower} professionnel avec ${lowerFirst(deliveryAttribute)} ?`
        : specificationPrompt(productLower, productFamilyLower, attributes, contextText),
      scope: 'product',
      intent: 'specification',
      rationale: 'Teste un critère de choix concret qu’un futur client peut demander à une IA.',
    },
  ];

  if (brandName && competitors.length >= 2) {
    drafts.push({
      text: `${[brandName, ...competitors.slice(0, 2)].join(', ')} : lequel choisir pour acheter un ${productLower} ?`,
      scope: 'competitive',
      intent: 'comparison',
      rationale: 'Compare la marque suivie à des concurrents explicites sans formuler de préférence artificielle.',
    });
  } else if (competitors.length > 0) {
    drafts.push({
      text: `Quelles alternatives à ${competitors[0]} pour acheter un ${productLower} ?`,
      scope: 'competitive',
      intent: 'comparison',
      rationale: 'Mesure la position concurrentielle du produit face à une alternative connue.',
    });
  }

  if (brandName) {
    drafts.push({
      text: `${brandName} est-il un fournisseur fiable pour acheter un ${productLower} ?`,
      scope: 'product',
      intent: 'brand',
      rationale: 'Teste la perception directe de la marque sur ce produit sans présupposer une réponse positive.',
    });
  }

  return drafts;
}

function generateEnglishProductPrompts(input: GenerateProductPromptsInput): PromptDraft[] {
  const productName = stripTrailingPunctuation(input.productName);
  const category = stripTrailingPunctuation(input.category);
  const useCase = stripTrailingPunctuation(input.useCase);
  const target = firstUsefulSegment(input.targetCustomer) || 'a business';
  const attributes = compactList(input.attributes || []);
  const competitors = compactList(input.competitors || [], 3);
  const brandName = stripTrailingPunctuation(input.brandName);

  const drafts: PromptDraft[] = [
    {
      text: `Which ${productName} should a company choose${useCase ? ` to ${lowerFirst(useCase)}` : ''}?`,
      scope: 'product',
      intent: 'discovery',
      rationale: 'Tests spontaneous product visibility on an unbranded discovery question.',
    },
    {
      text: attributes[0]
        ? `Where can ${target} buy a ${productName} with ${lowerFirst(attributes[0])}?`
        : `Where can ${target} buy a professional ${productName}?`,
      scope: 'product',
      intent: 'purchase',
      rationale: 'Captures a transaction-oriented product query.',
    },
    {
      text: category
        ? `What are the best suppliers of ${category} for businesses?`
        : `Which suppliers are recommended for buying a ${productName}?`,
      scope: category ? 'category' : 'product',
      intent: category ? 'category' : 'purchase',
      rationale: 'Covers supplier visibility at category level.',
    },
    {
      text: `Compare the best websites to buy a professional ${productName}.`,
      scope: 'competitive',
      intent: 'comparison',
      rationale: 'Measures competitor visibility in a supplier comparison context.',
    },
    {
      text: useCase
        ? `What equipment would you recommend to ${lowerFirst(useCase)}?`
        : `What equipment would you recommend for a company looking for a ${productName}?`,
      scope: 'product',
      intent: 'use_case',
      rationale: 'Simulates a need-based product search.',
    },
    {
      text: attributes[2] || attributes[0]
        ? `Where can a company find a ${productName} with ${lowerFirst(attributes[2] || attributes[0])}?`
        : `Which professional ${productName} has reliable business-grade specifications?`,
      scope: 'product',
      intent: 'specification',
      rationale: 'Tests product visibility on a specification-oriented query.',
    },
  ];

  if (brandName && competitors.length >= 2) {
    drafts.push({
      text: `${[brandName, ...competitors.slice(0, 2)].join(', ')}: which one should a company choose to buy a ${productName}?`,
      scope: 'competitive',
      intent: 'comparison',
      rationale: 'Compares the tracked brand against explicit competitors without biasing the answer.',
    });
  }

  if (brandName) {
    drafts.push({
      text: `Is ${brandName} a reliable supplier for buying a ${productName}?`,
      scope: 'product',
      intent: 'brand',
      rationale: 'Tests direct brand perception for this product without assuming a positive answer.',
    });
  }

  return drafts;
}

export function generateProductPrompts(input: GenerateProductPromptsInput): GeneratedProductPrompt[] {
  const productName = stripTrailingPunctuation(input.productName);
  if (!productName) return [];

  const context: ProductPromptQualityContext = {
    productName,
    category: input.category,
    useCase: input.useCase,
    targetCustomer: input.targetCustomer,
    attributes: input.attributes || [],
    brandName: input.brandName,
    competitors: input.competitors || [],
  };

  const drafts = input.locale === 'en-US'
    ? generateEnglishProductPrompts({ ...input, productName })
    : generateFrenchProductPrompts({ ...input, productName });

  return dedupePrompts(drafts.map((draft) => makePrompt(draft, context)));
}
