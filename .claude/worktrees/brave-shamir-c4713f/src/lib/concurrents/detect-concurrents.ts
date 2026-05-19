import OpenAI from 'openai';

type Justification = {
  raison?: string;
  niveau_confiance?: string;
};

type ConcurrentCandidate = {
  nom: string;
  domaine?: string | null;
  score_proximite?: number | null;
  justification?: Justification | null;
};

function normalizeDomain(input?: string | null): string | null {
  if (!input) return null;
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return input.replace(/^www\./, '').toLowerCase();
  }
}

function clampScore(value: number | null | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function parseJsonArray(raw: string): ConcurrentCandidate[] {
  const sanitize = (input: string) => input.replace(/,\s*([}\]])/g, '$1');

  const tryParse = (input: string) => {
    const parsed = JSON.parse(sanitize(input));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item: any) => ({
        nom: String(item?.nom || '').trim(),
        domaine: item?.domaine ? String(item.domaine).trim() : null,
        score_proximite: typeof item?.score_proximite === 'number' ? item.score_proximite : null,
        justification: item?.justification
          ? {
              raison: item.justification?.raison ? String(item.justification.raison) : undefined,
              niveau_confiance: item.justification?.niveau_confiance
                ? String(item.justification.niveau_confiance)
                : undefined,
            }
          : null,
      }))
      .filter((item) => item.nom.length > 0);
  };

  try {
    return tryParse(raw);
  } catch {
    const codeBlock =
      raw.match(/```json\s*([\s\S]*?)```/i)?.[1] ||
      raw.match(/```\s*([\s\S]*?)```/i)?.[1];
    if (codeBlock) {
      try {
        return tryParse(codeBlock);
      } catch {
        // fall through
      }
    }
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start !== -1 && end !== -1 && end > start) {
      const slice = raw.slice(start, end + 1);
      try {
        return tryParse(slice);
      } catch {
        return [];
      }
    }
    return [];
  }
}

async function llmDetect(input: {
  brandName: string;
  website?: string | null;
  industry?: string | null;
  description?: string | null;
  keywords?: string[] | null;
}): Promise<ConcurrentCandidate[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const client = new OpenAI({ apiKey });
  const system = [
    'Tu es un analyste en stratégie de marque.',
    "Retourne UNIQUEMENT un JSON array (pas de markdown).",
    'Chaque item doit contenir: nom (string), domaine (string ou null), score_proximite (0-100), justification { raison, niveau_confiance }.',
    "Le champ justification.raison doit expliquer clairement pourquoi c'est un concurrent (catégorie, usage, comparaisons fréquentes).",
    "Le champ justification.niveau_confiance doit être l'un de: faible, moyen, élevé.",
    "Ne propose pas la marque elle-même.",
    'Si tu es incertain sur un domaine, mets domaine à null.',
  ].join(' ');

  const user = [
    `Marque: ${input.brandName}`,
    input.website ? `Site web: ${input.website}` : '',
    input.industry ? `Secteur: ${input.industry}` : '',
    input.description ? `Description: ${input.description}` : '',
    input.keywords?.length ? `Mots-clés: ${input.keywords.join(', ')}` : '',
    'Objectif: proposer 5 à 10 concurrents pertinents.',
  ]
    .filter(Boolean)
    .join('\n');

  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0,
    max_tokens: 800,
  });

  const raw = completion.choices[0]?.message?.content || '[]';
  const parsed = parseJsonArray(raw);
  return parsed;
}

export async function detectConcurrents(input: {
  brandName: string;
  website?: string | null;
  industry?: string | null;
  description?: string | null;
  keywords?: string[] | null;
}) {
  const suggestions = await llmDetect(input);

  return suggestions.map((item) => ({
    nom: item.nom,
    domaine: normalizeDomain(item.domaine || null),
    score_proximite: clampScore(item.score_proximite),
    justification: item.justification ?? null,
  }));
}
