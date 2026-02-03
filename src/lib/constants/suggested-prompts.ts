// Bibliothèque de prompts suggérés par catégorie

export type PromptCategory = {
    id: string;
    name: string;
    description: string;
    icon: string;
    prompts: SuggestedPrompt[];
  };
  
  export type SuggestedPrompt = {
    id: string;
    text: string;
    description: string;
    variables: string[];
  };
  
  export const PROMPT_CATEGORIES: PromptCategory[] = [
    {
      id: "discovery",
      name: "Découverte & Recommandation",
      description: "Prompts pour tester si l'IA recommande votre marque",
      icon: "🔍",
      prompts: [
        {
          id: "discovery-1",
          text: "Quels sont les meilleurs {industry} en France ?",
          description: "Test de recommandation directe dans votre secteur",
          variables: ["industry"],
        },
        {
          id: "discovery-2",
          text: "Je cherche un bon {industry}, que me conseilles-tu ?",
          description: "Demande de conseil informelle",
          variables: ["industry"],
        },
        {
          id: "discovery-3",
          text: "Peux-tu me recommander des entreprises de {industry} fiables ?",
          description: "Recherche d'entreprises de confiance",
          variables: ["industry"],
        },
        {
          id: "discovery-4",
          text: "Quelles sont les alternatives à {competitors} ?",
          description: "Test de positionnement vs concurrents",
          variables: ["competitors"],
        },
        {
          id: "discovery-5",
          text: "Top 10 des {industry} pour les professionnels",
          description: "Classement B2B",
          variables: ["industry"],
        },
      ],
    },
    {
      id: "comparison",
      name: "Comparaison & Évaluation",
      description: "Prompts pour comparer votre marque aux concurrents",
      icon: "⚖️",
      prompts: [
        {
          id: "comparison-1",
          text: "Compare {brand} et {competitors}, lequel est le meilleur ?",
          description: "Comparaison directe avec un concurrent",
          variables: ["brand", "competitors"],
        },
        {
          id: "comparison-2",
          text: "Quels sont les avantages de {brand} par rapport à ses concurrents ?",
          description: "Mise en avant des points forts",
          variables: ["brand"],
        },
        {
          id: "comparison-3",
          text: "{brand} vs {competitors} : avis et différences",
          description: "Analyse comparative détaillée",
          variables: ["brand", "competitors"],
        },
        {
          id: "comparison-4",
          text: "Est-ce que {brand} est mieux que {competitors} pour {industry} ?",
          description: "Comparaison contextuelle",
          variables: ["brand", "competitors", "industry"],
        },
        {
          id: "comparison-5",
          text: "Quel est le rapport qualité-prix de {brand} ?",
          description: "Évaluation du positionnement prix",
          variables: ["brand"],
        },
      ],
    },
    {
      id: "reputation",
      name: "Réputation & Avis",
      description: "Prompts pour évaluer la perception de votre marque",
      icon: "⭐",
      prompts: [
        {
          id: "reputation-1",
          text: "Que penses-tu de {brand} ?",
          description: "Opinion générale sur la marque",
          variables: ["brand"],
        },
        {
          id: "reputation-2",
          text: "Est-ce que {brand} est une entreprise fiable ?",
          description: "Test de confiance",
          variables: ["brand"],
        },
        {
          id: "reputation-3",
          text: "Quels sont les avis sur {brand} ?",
          description: "Perception des clients",
          variables: ["brand"],
        },
        {
          id: "reputation-4",
          text: "{brand} est-il recommandé par les experts ?",
          description: "Crédibilité professionnelle",
          variables: ["brand"],
        },
        {
          id: "reputation-5",
          text: "Y a-t-il des problèmes connus avec {brand} ?",
          description: "Test de réputation négative",
          variables: ["brand"],
        },
      ],
    },
    {
      id: "expertise",
      name: "Expertise & Autorité",
      description: "Prompts pour tester votre positionnement expert",
      icon: "🎓",
      prompts: [
        {
          id: "expertise-1",
          text: "Qui sont les leaders du marché {industry} ?",
          description: "Test de leadership",
          variables: ["industry"],
        },
        {
          id: "expertise-2",
          text: "Quelles entreprises innovent le plus dans {industry} ?",
          description: "Positionnement innovation",
          variables: ["industry"],
        },
        {
          id: "expertise-3",
          text: "{brand} est-il un expert reconnu dans {industry} ?",
          description: "Validation d'expertise",
          variables: ["brand", "industry"],
        },
      ],
    },
    {
      id: "local",
      name: "Recherche Locale",
      description: "Prompts pour la visibilité géographique",
      icon: "📍",
      prompts: [
        {
          id: "local-1",
          text: "Meilleur {industry} à {location}",
          description: "Recherche locale directe",
          variables: ["industry", "location"],
        },
        {
          id: "local-2",
          text: "Je cherche un {industry} près de {location}, des suggestions ?",
          description: "Proximité géographique",
          variables: ["industry", "location"],
        },
        {
          id: "local-3",
          text: "{brand} est-il présent à {location} ?",
          description: "Vérification de présence",
          variables: ["brand", "location"],
        },
      ],
    },
    {
      id: "purchase",
      name: "Intention d'Achat",
      description: "Prompts simulant une décision d'achat",
      icon: "🛒",
      prompts: [
        {
          id: "purchase-1",
          text: "Je veux acheter {industry}, par où commencer ?",
          description: "Début de parcours d'achat",
          variables: ["industry"],
        },
        {
          id: "purchase-2",
          text: "Combien coûte {brand} ?",
          description: "Question tarifaire",
          variables: ["brand"],
        },
        {
          id: "purchase-3",
          text: "Est-ce que {brand} vaut son prix ?",
          description: "Justification du prix",
          variables: ["brand"],
        },
      ],
    },
  ];
  
  // Fonction pour remplacer les variables dans un prompt
  export function replacePromptVariables(
    promptText: string,
    variables: {
      brand?: string;
      industry?: string;
      competitors?: string;
      location?: string;
    }
  ): string {
    let result = promptText;
    
    if (variables.brand) {
      result = result.replace(/{brand}/g, variables.brand);
    }
    if (variables.industry) {
      result = result.replace(/{industry}/g, variables.industry);
    }
    if (variables.competitors) {
      result = result.replace(/{competitors}/g, variables.competitors);
    }
    if (variables.location) {
      result = result.replace(/{location}/g, variables.location);
    }
    
    return result;
  }