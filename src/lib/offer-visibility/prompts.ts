import type { OfferCategory, OfferCreateInput, OfferIntentType, OfferType } from '@/lib/offer-visibility/types';

type PromptTemplate = {
  label: string;
  intent_type: OfferIntentType;
  build: (args: PromptArgs) => string;
};

type PromptArgs = {
  name: string;
  type: OfferType;
  targetMarket: string;
  country: string;
  brandName: string;
  competitors: string[];
};

const DEFAULT_COUNTRY = 'France';

const PRODUCT_TEMPLATES: PromptTemplate[] = [
  {
    label: 'Où acheter',
    intent_type: 'purchase',
    build: ({ name, country }) => `Où acheter ${withArticle(name)} professionnel en ${country} ?`,
  },
  {
    label: 'Meilleur fournisseur',
    intent_type: 'purchase',
    build: ({ name, targetMarket }) => `Quel est le meilleur fournisseur de ${name} pour ${targetMarket || 'une entreprise'} ?`,
  },
  {
    label: 'Comparatif fournisseurs',
    intent_type: 'comparison',
    build: ({ name, country }) => `Quels sont les meilleurs fournisseurs de ${name} en ${country} ?`,
  },
  {
    label: 'Équipement entreprise',
    intent_type: 'problem_solution',
    build: ({ name }) => `Quelle entreprise choisir pour acheter ${withArticle(name)} ?`,
  },
  {
    label: 'Recommandation B2B',
    intent_type: 'discovery',
    build: ({ name, targetMarket }) => `Quel fournisseur B2B recommandes-tu pour ${name} ${targetMarket ? `pour ${targetMarket}` : ''} ?`.trim(),
  },
  {
    label: 'Alternative concurrent',
    intent_type: 'alternative',
    build: ({ name, competitors }) => {
      const competitor = competitors[0];
      return competitor
        ? `Quelles sont les alternatives à ${competitor} pour acheter ${name} ?`
        : `Quelles sont les meilleures alternatives pour acheter ${name} ?`;
    },
  },
  {
    label: 'Usage professionnel',
    intent_type: 'problem_solution',
    build: ({ name }) => `Où trouver ${withArticle(name)} fiable pour un usage professionnel ?`,
  },
  {
    label: 'Avis et choix',
    intent_type: 'review',
    build: ({ name }) => `Quels avis consulter avant de choisir un fournisseur de ${name} ?`,
  },
];

const SERVICE_TEMPLATES: PromptTemplate[] = [
  {
    label: 'Choix prestataire',
    intent_type: 'purchase',
    build: ({ name, targetMarket }) => `Quelle agence choisir pour ${name} ${targetMarket ? `pour ${targetMarket}` : 'pour une entreprise'} ?`,
  },
  {
    label: 'Prestataire recommandé',
    intent_type: 'purchase',
    build: ({ name }) => `Quel prestataire recommandes-tu pour ${name} ?`,
  },
  {
    label: 'Meilleures agences',
    intent_type: 'comparison',
    build: ({ name, country }) => `Meilleures agences de ${name} en ${country} ?`,
  },
  {
    label: 'Accompagnement PME',
    intent_type: 'problem_solution',
    build: ({ name }) => `Qui peut accompagner une PME sur ${name} ?`,
  },
  {
    label: 'Cabinet spécialisé',
    intent_type: 'discovery',
    build: ({ name, targetMarket }) => `Quel cabinet choisir pour ${name} ${targetMarket ? `dans un contexte ${targetMarket}` : 'en B2B'} ?`,
  },
  {
    label: 'Alternatives',
    intent_type: 'alternative',
    build: ({ name, competitors }) => {
      const competitor = competitors[0];
      return competitor
        ? `Quelles alternatives à ${competitor} pour ${name} ?`
        : `Quelles alternatives pour trouver un prestataire en ${name} ?`;
    },
  },
  {
    label: 'Budget',
    intent_type: 'price',
    build: ({ name }) => `Quel budget prévoir pour une prestation de ${name} ?`,
  },
  {
    label: 'Comment choisir',
    intent_type: 'comparison',
    build: ({ name }) => `Comment choisir une agence ou un cabinet de ${name} pour une entreprise B2B ?`,
  },
];

function withArticle(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return 'cette offre';
  const lower = trimmed.toLowerCase();
  if (/^(un|une|des|du|de la|de l'|d')\s/.test(lower)) return trimmed;
  return lower.endsWith('s') ? `des ${trimmed}` : `un ${trimmed}`;
}

function normalizePrompt(prompt: string) {
  return prompt.replace(/\s+/g, ' ').replace(/\s+\?/g, ' ?').trim();
}

export function getDefaultOfferIntents(type: OfferType) {
  const templates = type === 'service' ? SERVICE_TEMPLATES : PRODUCT_TEMPLATES;
  const seen = new Set<OfferIntentType>();

  return templates
    .filter((template) => {
      if (seen.has(template.intent_type)) return false;
      seen.add(template.intent_type);
      return true;
    })
    .map((template) => ({
      label: template.label,
      intent_type: template.intent_type,
      description: null as string | null,
      is_active: true,
    }));
}

export function generateOfferPrompts(args: {
  offer: Pick<OfferCategory, 'name' | 'type' | 'target_market' | 'country' | 'language'> | OfferCreateInput;
  brandName: string;
  competitors?: string[];
}) {
  const type = args.offer.type;
  const templates = type === 'service' ? SERVICE_TEMPLATES : PRODUCT_TEMPLATES;
  const promptArgs: PromptArgs = {
    name: args.offer.name.trim(),
    type,
    targetMarket: args.offer.target_market?.trim() || 'une entreprise',
    country: args.offer.country?.trim() || DEFAULT_COUNTRY,
    brandName: args.brandName.trim(),
    competitors: args.competitors || [],
  };

  const seen = new Set<string>();
  return templates
    .map((template) => ({
      label: template.label,
      intent_type: template.intent_type,
      prompt: normalizePrompt(template.build(promptArgs)),
    }))
    .filter((item) => {
      const key = item.prompt.toLowerCase();
      if (!item.prompt || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
