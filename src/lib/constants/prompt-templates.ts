// Default prompt templates for new projects
// Variables: {brand}, {industry}, {competitors}, {location}, {website}

export const DEFAULT_PROMPT_TEMPLATES = [
  // Visibility prompts
  {
    name: 'Recommandation générale',
    prompt_text: 'Quels sont les meilleurs {industry} que tu recommandes ?',
    category: 'visibility',
    is_active: true,
  },
  {
    name: 'Recommandation locale',
    prompt_text: 'Quels sont les meilleurs {industry} en {location} ?',
    category: 'visibility',
    is_active: true,
  },
  {
    name: 'Mention directe',
    prompt_text: 'Que peux-tu me dire sur {brand} ?',
    category: 'visibility',
    is_active: true,
  },
  {
    name: 'Top 10 du secteur',
    prompt_text: 'Donne-moi le top 10 des {industry} les plus recommandés.',
    category: 'visibility',
    is_active: true,
  },

  // Accuracy prompts
  {
    name: 'Description entreprise',
    prompt_text: 'Peux-tu me décrire l\'entreprise {brand} et ce qu\'elle fait ?',
    category: 'accuracy',
    is_active: true,
  },
  {
    name: 'Services proposés',
    prompt_text: 'Quels services propose {brand} ?',
    category: 'accuracy',
    is_active: true,
  },
  {
    name: 'Site web',
    prompt_text: 'Quel est le site web de {brand} ?',
    category: 'accuracy',
    is_active: true,
  },

  // Comparison prompts
  {
    name: 'Comparaison concurrents',
    prompt_text: 'Compare {brand} avec {competitors}. Lequel recommandes-tu ?',
    category: 'comparison',
    is_active: true,
  },
  {
    name: 'Avantages vs concurrents',
    prompt_text: 'Quels sont les avantages de {brand} par rapport à ses concurrents ?',
    category: 'comparison',
    is_active: true,
  },

  // Sentiment prompts
  {
    name: 'Avis et réputation',
    prompt_text: 'Que disent les gens de {brand} ? Quelle est leur réputation ?',
    category: 'sentiment',
    is_active: true,
  },
  {
    name: 'Points forts et faibles',
    prompt_text: 'Quels sont les points forts et les points faibles de {brand} ?',
    category: 'sentiment',
    is_active: true,
  },
];

// Industry-specific templates (can be added based on project industry)
export const INDUSTRY_TEMPLATES: Record<string, typeof DEFAULT_PROMPT_TEMPLATES> = {
  'saas': [
    {
      name: 'Pricing SaaS',
      prompt_text: 'Quels sont les tarifs de {brand} ? Est-ce compétitif par rapport à {competitors} ?',
      category: 'accuracy',
      is_active: true,
    },
    {
      name: 'Fonctionnalités clés',
      prompt_text: 'Quelles sont les fonctionnalités principales de {brand} ?',
      category: 'accuracy',
      is_active: true,
    },
  ],
  'ecommerce': [
    {
      name: 'Avis produits',
      prompt_text: 'Quels sont les avis sur les produits de {brand} ?',
      category: 'sentiment',
      is_active: true,
    },
    {
      name: 'Livraison et retours',
      prompt_text: 'Comment sont la livraison et la politique de retour de {brand} ?',
      category: 'accuracy',
      is_active: true,
    },
  ],
  'consulting': [
    {
      name: 'Expertise cabinet',
      prompt_text: 'Quelle est l\'expertise principale de {brand} ?',
      category: 'accuracy',
      is_active: true,
    },
    {
      name: 'Clients et références',
      prompt_text: 'Quels types de clients travaillent avec {brand} ?',
      category: 'accuracy',
      is_active: true,
    },
  ],
};

// Function to get all templates for a project
export function getTemplatesForProject(industry?: string): typeof DEFAULT_PROMPT_TEMPLATES {
  const templates = [...DEFAULT_PROMPT_TEMPLATES];
  
  if (industry && INDUSTRY_TEMPLATES[industry.toLowerCase()]) {
    templates.push(...INDUSTRY_TEMPLATES[industry.toLowerCase()]);
  }
  
  return templates;
}
