// Default prompt templates for new projects
// Variables: {brand}, {industry}, {competitors}, {location}, {website}

export type AnalysisObjective = 'visibility' | 'position' | 'sentiment';

export type PromptTemplate = {
  id: string;
  name: string;
  prompt_text: string;
  primary_objective: AnalysisObjective;
  secondary_objectives?: AnalysisObjective[];
  is_active: boolean;
};

export const DEFAULT_PROMPT_TEMPLATES: PromptTemplate[] = [
  // Visibility prompts
  {
    id: 'visibility_general',
    name: 'Recommandation générale',
    prompt_text: 'Quels sont les meilleurs {industry} à {location} ?',
    primary_objective: 'visibility',
    secondary_objectives: ['position'],
    is_active: true,
  },
  {
    id: 'visibility_local',
    name: 'Recommandation locale',
    prompt_text: 'Quelles marques de {industry} recommandes-tu à {location} ?',
    primary_objective: 'visibility',
    secondary_objectives: ['position', 'sentiment'],
    is_active: true,
  },
  {
    id: 'visibility_direct',
    name: 'Mention directe',
    prompt_text: 'Quelles enseignes de {industry} sont les plus visibles à {location} ?',
    primary_objective: 'visibility',
    secondary_objectives: ['position'],
    is_active: true,
  },
  {
    id: 'visibility_top',
    name: 'Top 10 du secteur',
    prompt_text: 'Donne-moi le top 5 des {industry} les plus recommandés à {location}.',
    primary_objective: 'visibility',
    secondary_objectives: ['position'],
    is_active: true,
  },

  // Position prompts
  {
    id: 'position_compare',
    name: 'Comparaison concurrents',
    prompt_text: 'Compare {brand} avec {competitors}. Lequel recommandes-tu ?',
    primary_objective: 'position',
    secondary_objectives: ['sentiment'],
    is_active: true,
  },
  {
    id: 'position_advantages',
    name: 'Avantages vs concurrents',
    prompt_text: 'Quels sont les avantages de {brand} par rapport à ses concurrents ?',
    primary_objective: 'position',
    secondary_objectives: ['sentiment'],
    is_active: true,
  },
  {
    id: 'position_ranking',
    name: 'Classement perçu',
    prompt_text: 'Où placerais-tu {brand} parmi les acteurs de {industry} à {location} ?',
    primary_objective: 'position',
    secondary_objectives: ['visibility'],
    is_active: true,
  },

  // Sentiment prompts
  {
    id: 'sentiment_reputation',
    name: 'Avis et réputation',
    prompt_text: 'Que disent les gens de {brand} ? Quelle est leur réputation ?',
    primary_objective: 'sentiment',
    secondary_objectives: ['visibility'],
    is_active: true,
  },
  {
    id: 'sentiment_strengths',
    name: 'Points forts et faibles',
    prompt_text: 'Quels sont les points forts et les points faibles de {brand} ?',
    primary_objective: 'sentiment',
    secondary_objectives: ['position'],
    is_active: true,
  },
  {
    id: 'sentiment_recommendation',
    name: 'Recommandation',
    prompt_text: 'Recommanderais-tu {brand} ? Pourquoi ?',
    primary_objective: 'sentiment',
    is_active: true,
  },
];

// Industry-specific templates (can be added based on project industry)
export const INDUSTRY_TEMPLATES: Record<string, PromptTemplate[]> = {
  'saas': [
    {
      id: 'saas_pricing',
      name: 'Pricing SaaS',
      prompt_text: 'Quels sont les tarifs de {brand} ? Est-ce compétitif par rapport à {competitors} ?',
      primary_objective: 'position',
      secondary_objectives: ['sentiment'],
      is_active: true,
    },
    {
      id: 'saas_features',
      name: 'Fonctionnalités clés',
      prompt_text: 'Quelles sont les fonctionnalités principales de {brand} ?',
      primary_objective: 'position',
      secondary_objectives: ['sentiment'],
      is_active: true,
    },
  ],
  'ecommerce': [
    {
      id: 'ecommerce_reviews',
      name: 'Avis produits',
      prompt_text: 'Quels sont les avis sur les produits de {brand} ?',
      primary_objective: 'sentiment',
      secondary_objectives: ['visibility'],
      is_active: true,
    },
    {
      id: 'ecommerce_shipping',
      name: 'Livraison et retours',
      prompt_text: 'Comment sont la livraison et la politique de retour de {brand} ?',
      primary_objective: 'sentiment',
      secondary_objectives: ['position'],
      is_active: true,
    },
  ],
  'consulting': [
    {
      id: 'consulting_expertise',
      name: 'Expertise cabinet',
      prompt_text: 'Quelle est l\'expertise principale de {brand} ?',
      primary_objective: 'position',
      secondary_objectives: ['visibility'],
      is_active: true,
    },
    {
      id: 'consulting_clients',
      name: 'Clients et références',
      prompt_text: 'Quels types de clients travaillent avec {brand} ?',
      primary_objective: 'position',
      secondary_objectives: ['visibility'],
      is_active: true,
    },
  ],
};

// Function to get all templates for a project
export function getTemplatesForProject(industry?: string): PromptTemplate[] {
  const templates = [...DEFAULT_PROMPT_TEMPLATES];
  
  if (industry && INDUSTRY_TEMPLATES[industry.toLowerCase()]) {
    templates.push(...INDUSTRY_TEMPLATES[industry.toLowerCase()]);
  }
  
  return templates;
}
