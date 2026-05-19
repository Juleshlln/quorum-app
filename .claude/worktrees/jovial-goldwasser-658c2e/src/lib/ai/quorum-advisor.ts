import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';

// ─── Output Schema ────────────────────────────────────────────────────────────

const ActionSchema = z.object({
  title: z.string(),
  reason: z.string(),
  impact: z.enum(['high', 'medium', 'low']),
  effort: z.enum(['high', 'medium', 'low']),
  priority: z.number().int().min(1).max(5),
});

export const AdvisorOutputSchema = z.object({
  summary: z.string().max(800),
  diagnosis: z.array(z.string()).max(5),
  opportunities: z.array(z.string()).max(4),
  recommended_actions: z.array(ActionSchema).max(5),
  content_brief: z
    .object({
      title: z.string(),
      sections: z.array(z.string()),
      faq: z.array(z.string()),
    })
    .nullable(),
});

export type AdvisorOutput = z.infer<typeof AdvisorOutputSchema>;

// ─── Context Types ────────────────────────────────────────────────────────────

export type AdvisorContext = {
  brand: string;
  industry: string | null;
  location: string | null;
  period: string;
  metrics_summary: {
    avg_visibility_score: number;
    trend: 'improving' | 'stable' | 'declining';
    avg_position: number | null;
    sentiment: { positive: number; neutral: number; negative: number };
    total_responses: number;
    days_with_data: number;
  };
  competitors_visibility: Array<{ name: string; mention_count: number }>;
  domain_breakdown: { owned: number; competitor: number; third_party: number };
  active_topics: string[];
};

// ─── Build Context ────────────────────────────────────────────────────────────

export async function buildAdvisorContext(
  projectId: string,
  project: { name: string; industry: string | null; location: string | null },
): Promise<{
  context: AdvisorContext;
  periodStart: string;
  periodEnd: string;
  hasEnoughData: boolean;
}> {
  const supabase = createAdminClient();

  const now = new Date();
  const periodEnd = now.toISOString().slice(0, 10);
  const periodStart = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);
  const period7Start = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);

  // 1. 30-day daily metrics
  const { data: metricsRaw } = await supabase
    .from('monitoring_daily_metrics')
    .select(
      'day, visibility_score, avg_position, positive_count, neutral_count, negative_count, responses_count, competitor_data',
    )
    .eq('project_id', projectId)
    .gte('day', periodStart)
    .order('day', { ascending: true });

  type MetricRow = {
    day: string;
    visibility_score: number | null;
    avg_position: number | null;
    positive_count: number;
    neutral_count: number;
    negative_count: number;
    responses_count: number;
    competitor_data: Array<{ name: string; mentions: number; visibility: number }> | null;
  };

  const metrics = (metricsRaw || []) as MetricRow[];
  const valid = metrics.filter((m) => m.visibility_score !== null);
  const hasEnoughData = valid.length >= 3;

  // 2. Visibility average + trend
  const avgVis =
    valid.length > 0
      ? Math.round(avg(valid.map((m) => normalizeScore(m.visibility_score))))
      : 0;

  const recent7 = valid.filter((m) => m.day >= period7Start);
  const prior7 = valid.filter((m) => m.day < period7Start);
  const recentAvg = avg(recent7.map((m) => normalizeScore(m.visibility_score)));
  const priorAvg = avg(prior7.map((m) => normalizeScore(m.visibility_score)));
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (recentAvg > priorAvg + 5) trend = 'improving';
  else if (recentAvg < priorAvg - 5) trend = 'declining';

  // 3. Sentiment totals
  const totalPos = metrics.reduce((s, m) => s + (m.positive_count || 0), 0);
  const totalNeu = metrics.reduce((s, m) => s + (m.neutral_count || 0), 0);
  const totalNeg = metrics.reduce((s, m) => s + (m.negative_count || 0), 0);
  const totalSent = totalPos + totalNeu + totalNeg || 1;

  // 4. Avg position
  const posMetrics = valid.filter((m) => m.avg_position !== null);
  const avgPos =
    posMetrics.length > 0
      ? Math.round(avg(posMetrics.map((m) => m.avg_position as number)) * 10) / 10
      : null;

  const totalResponses = metrics.reduce((s, m) => s + (m.responses_count || 0), 0);

  // 5. Competitor visibility from competitor_data JSONB
  const competitorMap = new Map<string, number>();
  for (const m of metrics) {
    if (!Array.isArray(m.competitor_data)) continue;
    for (const c of m.competitor_data) {
      if (c?.name) {
        competitorMap.set(c.name, (competitorMap.get(c.name) || 0) + (c.mentions || 0));
      }
    }
  }
  const competitors_visibility = [...competitorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, mention_count]) => ({ name, mention_count }));

  // 6. Domain breakdown
  const { data: domainsRaw } = await supabase
    .from('sources_domains')
    .select('category')
    .eq('project_id', projectId);

  const domain_breakdown = { owned: 0, competitor: 0, third_party: 0 };
  for (const d of domainsRaw || []) {
    const cat = (d as { category: string }).category;
    if (cat === 'owned') domain_breakdown.owned++;
    else if (cat === 'competitor') domain_breakdown.competitor++;
    else domain_breakdown.third_party++;
  }

  // 7. Active topics
  const { data: topicsRaw } = await supabase
    .from('monitoring_topics')
    .select('name')
    .eq('project_id', projectId)
    .eq('is_active', true)
    .limit(8);

  const active_topics = (topicsRaw || [])
    .map((t: { name: string }) => t.name)
    .filter(Boolean);

  const context: AdvisorContext = {
    brand: project.name,
    industry: project.industry,
    location: project.location,
    period: `${periodStart} au ${periodEnd}`,
    metrics_summary: {
      avg_visibility_score: avgVis,
      trend,
      avg_position: avgPos,
      sentiment: {
        positive: Math.round((totalPos / totalSent) * 100) / 100,
        neutral: Math.round((totalNeu / totalSent) * 100) / 100,
        negative: Math.round((totalNeg / totalSent) * 100) / 100,
      },
      total_responses: totalResponses,
      days_with_data: valid.length,
    },
    competitors_visibility,
    domain_breakdown,
    active_topics,
  };

  return { context, periodStart, periodEnd, hasEnoughData };
}

// ─── Call Claude ──────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6';

export async function callClaude(
  context: AdvisorContext,
): Promise<{ rawOutput: string; inputTokens: number; outputTokens: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  const client = new Anthropic({ apiKey });

  const systemPrompt = `Tu es Quorum Advisor, un consultant GEO (Generative Engine Optimization) spécialisé en product visibility B2B.

Ta mission :
- analyser la visibilité IA de la marque dans les réponses des moteurs génératifs
- expliquer les causes des tendances observées
- identifier les opportunités concrètes d'amélioration
- recommander des actions prioritaires et actionnables
- proposer un brief de contenu ciblé

Contraintes STRICTES :
- Réponds UNIQUEMENT en JSON valide selon le schéma fourni
- Maximum 5 actions recommandées, triées par priorité (1 = plus haute)
- Ne jamais inventer de données non présentes dans le contexte
- Baser chaque recommandation sur les données fournies
- Langue : français`;

  const userMessage = `Voici les données de monitoring de la marque "${context.brand}" pour la période ${context.period} :

${JSON.stringify(context, null, 2)}

Génère une analyse complète au format JSON STRICT :
{
  "summary": "Résumé exécutif en 2-3 phrases sur l'état de la visibilité IA",
  "diagnosis": [
    "Point de diagnostic 1 (basé sur les données)",
    "Point de diagnostic 2",
    "..."
  ],
  "opportunities": [
    "Opportunité identifiée 1",
    "Opportunité identifiée 2",
    "..."
  ],
  "recommended_actions": [
    {
      "title": "Titre court de l'action",
      "reason": "Pourquoi cette action (basé sur les données observées)",
      "impact": "high",
      "effort": "low",
      "priority": 1
    }
  ],
  "content_brief": {
    "title": "Titre du contenu à créer",
    "sections": ["Section 1", "Section 2", "Section 3"],
    "faq": ["Question fréquente 1 ?", "Question fréquente 2 ?"]
  }
}

Réponds UNIQUEMENT avec le JSON valide, sans texte avant ou après.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const rawOutput = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return {
    rawOutput,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// ─── Validate Output ──────────────────────────────────────────────────────────

export function validateOutput(raw: string): AdvisorOutput {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, '')
    .replace(/\s*```\s*$/m, '')
    .trim();
  const parsed = JSON.parse(cleaned);
  return AdvisorOutputSchema.parse(parsed);
}

// ─── Cost Estimation ──────────────────────────────────────────────────────────

// claude-sonnet-4-6: $3/MTok input, $15/MTok output
export function estimateCost(inputTokens: number, outputTokens: number): number {
  return Number(((inputTokens * 3 + outputTokens * 15) / 1_000_000).toFixed(6));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}

function normalizeScore(raw: number | null): number {
  if (raw === null || raw === undefined) return 0;
  if (raw >= 0 && raw <= 1) return raw * 100;
  return raw;
}
