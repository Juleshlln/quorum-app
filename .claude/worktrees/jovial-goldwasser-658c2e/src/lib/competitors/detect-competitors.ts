import OpenAI from 'openai';

type Candidate = {
  name: string;
  website?: string | null;
  domain?: string | null;
  description?: string | null;
  confidence?: number | null;
  method?: string | null;
  evidence?: Array<{ url?: string; title?: string; snippet?: string }>;
};

function normalizeDomain(website?: string | null): string | null {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function dedupe(list: Candidate[], brandName: string, brandDomain: string | null) {
  const byDomain = new Map<string, Candidate>();
  const byName = new Map<string, Candidate>();
  for (const item of list) {
    const domain = normalizeDomain(item.website || item.domain || null);
    const nameKey = item.name.toLowerCase();
    if (domain) {
      if (brandDomain && (domain === brandDomain || domain.endsWith(`.${brandDomain}`))) continue;
      if (!byDomain.has(domain)) byDomain.set(domain, { ...item, domain });
    } else if (!byName.has(nameKey)) {
      if (nameKey.includes(brandName.toLowerCase())) continue;
      byName.set(nameKey, item);
    }
  }
  return [...byDomain.values(), ...byName.values()];
}

async function llmSuggest({
  brandName,
  website,
  industry,
  country,
  language,
}: {
  brandName: string;
  website?: string | null;
  industry?: string | null;
  country?: string | null;
  language?: string | null;
}): Promise<Candidate[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];
  const client = new OpenAI({ apiKey });
  const system = [
    'You are an analyst. Provide competitor suggestions ONLY if reasonably confident.',
    'Return ONLY a valid JSON array (no markdown) with fields: name, website, description, confidence (0..1), method, evidence.',
    'evidence must be an array of objects like { url?, title?, snippet? } or an empty array.',
    'Do NOT invent evidence. If unsure about a website, set website to null and confidence <= 0.3.',
    'Do NOT include the brand itself.',
  ].join(' ');

  const user = [
    `Brand: ${brandName}`,
    website ? `Website: ${website}` : '',
    industry ? `Industry: ${industry}` : '',
    country ? `Country: ${country}` : '',
    language ? `Language: ${language}` : '',
    'Goal: suggest 5-15 competitors with short descriptions.',
  ].filter(Boolean).join('\n');

  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0,
    max_tokens: 700,
  });

  const raw = completion.choices[0]?.message?.content || '[]';
  let parsed = parseJsonArray(raw);
  if (!parsed.length) {
    parsed = await llmSuggestStrict(client, user);
  }
  if (!parsed.length) {
    const fallback = fallbackExtractCandidates(raw);
    if (fallback.length > 0) {
      return fallback;
    }
  }
  if (!parsed.length && process.env.NODE_ENV !== 'production') {
    console.warn('detect-competitors: failed to parse JSON. raw=', raw);
  }
  return parsed;
}

async function llmSuggestStrict(client: OpenAI, user: string): Promise<Candidate[]> {
  const strictSystem = [
    'Return ONLY JSON array. No markdown, no commentary, no trailing text.',
    'Each item must include: name (string), website (string or null), description (string or null), confidence (number 0..1), method (string), evidence (array of {url?, title?, snippet?}).',
    'If unsure, use confidence <= 0.3 and evidence [].',
  ].join(' ');
  const completion = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: strictSystem },
      { role: 'user', content: user },
    ],
    temperature: 0,
    max_tokens: 700,
  });
  const raw = completion.choices[0]?.message?.content || '[]';
  return parseJsonArray(raw);
}

function parseJsonArray(raw: string): Candidate[] {
  const sanitize = (input: string) => {
    // Remove trailing commas before } or ]
    return input.replace(/,\s*([}\]])/g, '$1');
  };
  const normalizeEvidence = (evidence: any) => {
    if (Array.isArray(evidence)) return evidence;
    if (typeof evidence === 'string' && evidence.trim()) {
      return [{ snippet: evidence }];
    }
    return [];
  };

  const tryParse = (input: string) => {
    const cleaned = sanitize(input);
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: any) => ({
      name: String(item.name || '').trim(),
      website: item.website || null,
      description: item.description || null,
      confidence: typeof item.confidence === 'number' ? item.confidence : 0.2,
      method: item.method || 'llm_synthesis',
      evidence: normalizeEvidence(item.evidence),
    })).filter((c: Candidate) => c.name);
  };

  try {
    return tryParse(raw);
  } catch {
    // Try extracting JSON from code blocks or surrounding text
    const codeBlock = raw.match(/```json\s*([\s\S]*?)```/i)?.[1]
      || raw.match(/```\s*([\s\S]*?)```/i)?.[1];
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

function fallbackExtractCandidates(raw: string): Candidate[] {
  const results: Candidate[] = [];
  const blocks = raw.split(/"name"\s*:/).slice(1);
  for (const block of blocks) {
    const name = block.match(/\s*"([^"]+)"/)?.[1];
    const website = block.match(/"website"\s*:\s*"([^"]+)"/)?.[1];
    const description = block.match(/"description"\s*:\s*"([^"]+)"/)?.[1];
    if (!name) continue;
    results.push({
      name: name.trim(),
      website: website || null,
      description: description || null,
      confidence: 0.4,
      method: 'llm_fallback_extract',
      evidence: [],
    });
  }
  return results;
}

export async function detectCompetitors(input: {
  brandName: string;
  website?: string | null;
  industry?: string | null;
  country?: string | null;
  language?: string | null;
}) {
  const brandDomain = normalizeDomain(input.website || null);
  const llmCandidates = await llmSuggest(input);

  const cleaned = dedupe(llmCandidates, input.brandName, brandDomain).map((c) => {
    const domain = normalizeDomain(c.website || c.domain || null);
    const evidence = c.evidence || [];
    const confidence = Math.min(
      c.confidence ?? 0.2,
      evidence.length > 0 ? 0.9 : 0.6
    );
    return {
      ...c,
      domain,
      confidence,
      method: c.method || 'llm_synthesis',
      evidence,
      description: c.description || null,
    };
  });

  return cleaned.slice(0, 15);
}
