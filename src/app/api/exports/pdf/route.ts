import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';

export const runtime = 'nodejs';
export const maxDuration = 60;

function pct(n: number, d: number) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

export async function GET(_request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return NextResponse.json({ error: 'No active project' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const projectId = project.id;

  const now = new Date();
  const start30 = new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10);

  // 1. Daily metrics for the 30-day trend
  const { data: dailyMetrics } = await supabase
    .from('monitoring_daily_metrics')
    .select('day, responses_count, mentions_count, visibility_score, avg_position, sentiment_score, positive_count, neutral_count, negative_count, competitor_data')
    .eq('project_id', projectId)
    .gte('day', start30)
    .order('day', { ascending: true });

  const metrics = (dailyMetrics || []) as Array<{
    day: string;
    responses_count: number;
    mentions_count: number;
    visibility_score: number | null;
    avg_position: number | null;
    sentiment_score: number | null;
    positive_count: number;
    neutral_count: number;
    negative_count: number;
    competitor_data: Array<{ name: string; mentions: number; visibility: number }> | null;
  }>;

  // 2. Aggregate KPIs
  const totalResponses = metrics.reduce((s, r) => s + r.responses_count, 0);
  const totalMentions = metrics.reduce((s, r) => s + r.mentions_count, 0);
  const visibility = totalResponses > 0 ? pct(totalMentions, totalResponses) : 0;

  const posCount = metrics.reduce((s, r) => s + r.positive_count, 0);
  const neuCount = metrics.reduce((s, r) => s + r.neutral_count, 0);
  const negCount = metrics.reduce((s, r) => s + r.negative_count, 0);
  const sentimentScore = totalMentions > 0
    ? Number(((posCount - negCount) / totalMentions).toFixed(2))
    : null;

  // 3. Competitors
  const { data: competitors } = await supabase
    .from('competitors')
    .select('name')
    .eq('project_id', projectId);
  const competitorNames: string[] = (competitors || []).map((c: any) => c.name as string);

  const competitorMentions = competitorNames.map((name) => {
    let total = 0;
    for (const dr of metrics) {
      const entry = (dr.competitor_data || []).find(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );
      if (entry) total += entry.mentions;
    }
    return { name, mentions: total, visibility: totalResponses > 0 ? pct(total, totalResponses) : 0 };
  });

  // Rank
  const leaderboard = [
    { name: project.name, mentions: totalMentions },
    ...competitorMentions.map(c => ({ name: c.name, mentions: c.mentions })),
  ].sort((a, b) => b.mentions - a.mentions);
  const brandRank = leaderboard.findIndex(e => e.name === project.name) + 1;

  // 4. Completed runs count
  const { count: runsCount } = await supabase
    .from('monitoring_runs')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .in('status', ['success', 'partial'])
    .gte('finished_at', `${start30}T00:00:00Z`);

  // 5. Top domains (from citations)
  const { data: domainCitations } = await supabase
    .from('citations')
    .select('domain:sources_domains(domain, category)')
    .eq('project_id', projectId)
    .eq('is_fallback', false)
    .gte('cited_at', `${start30}T00:00:00Z`);

  const domainCounts: Record<string, { count: number; category: string }> = {};
  for (const c of (domainCitations || []) as Array<{ domain: { domain: string; category: string } | null }>) {
    const d = c.domain?.domain;
    if (!d) continue;
    if (!domainCounts[d]) domainCounts[d] = { count: 0, category: c.domain?.category || 'third_party' };
    domainCounts[d].count++;
  }
  const topDomains = Object.entries(domainCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5)
    .map(([domain, info]) => ({ domain, count: info.count, category: info.category }));

  // Category breakdown
  const ownedCount = Object.values(domainCounts).filter(d => d.category === 'owned').reduce((s, d) => s + d.count, 0);
  const competitorCount = Object.values(domainCounts).filter(d => d.category === 'competitor').reduce((s, d) => s + d.count, 0);
  const thirdPartyCount = Object.values(domainCounts).filter(d => d.category === 'third_party').reduce((s, d) => s + d.count, 0);
  const totalCitations = ownedCount + competitorCount + thirdPartyCount;

  // 6. Real citations (is_fallback=false) for table
  const { data: realCitations } = await supabase
    .from('citations')
    .select(`
      cited_at,
      ai_model,
      method,
      confidence,
      brand_mentioned,
      prompt_run_id,
      domain:sources_domains(domain, category),
      url:sources_urls(url)
    `)
    .eq('project_id', projectId)
    .eq('is_fallback', false)
    .gte('cited_at', `${start30}T00:00:00Z`)
    .order('cited_at', { ascending: false })
    .limit(50);

  // Get prompt texts for citations
  const citationPrIds = [...new Set((realCitations || []).map((c: any) => c.prompt_run_id).filter(Boolean))];
  const { data: citationPrs } = citationPrIds.length > 0
    ? await supabase.from('prompt_runs').select('id, prompt_id').in('id', citationPrIds)
    : { data: [] as any[] };
  const prPromptMap = new Map((citationPrs || []).map((pr: any) => [pr.id, pr.prompt_id]));
  const citationPromptIds = [...new Set(Array.from(prPromptMap.values()))];
  const { data: citationPrompts } = citationPromptIds.length > 0
    ? await supabase.from('monitoring_prompts').select('id, prompt_text').in('id', citationPromptIds)
    : { data: [] as any[] };
  const citPromptTextMap = new Map((citationPrompts || []).map((p: any) => [p.id, p.prompt_text]));

  const citationsTable = (realCitations || []).map((c: any) => {
    const promptId = prPromptMap.get(c.prompt_run_id);
    return {
      date: c.cited_at ? new Date(c.cited_at).toLocaleDateString('fr-FR') : '',
      domain: c.domain?.domain || '',
      url: c.url?.url || '',
      category: c.domain?.category || 'third_party',
      model: c.ai_model || '',
      prompt: promptId ? (citPromptTextMap.get(promptId) || '') : '',
      confidence: c.confidence,
      brandMentioned: c.brand_mentioned,
    };
  });

  // 7. Trend data for chart
  const trend = metrics
    .filter(r => r.responses_count > 0)
    .map(r => ({
      date: r.day,
      visibility: r.visibility_score != null
        ? (r.visibility_score >= 0 && r.visibility_score <= 1 ? Math.round(r.visibility_score * 100) : r.visibility_score)
        : 0,
    }));

  // 8. Recommendations
  const recommendations: string[] = [];

  if (visibility < 30) {
    recommendations.push('Votre visibilite est faible (< 30%). Creez du contenu optimise pour les requetes IA sur vos thematiques cles.');
  } else if (visibility < 60) {
    recommendations.push('Visibilite moderee. Renforcez votre presence sur les domaines tiers les plus cites.');
  } else {
    recommendations.push('Excellente visibilite. Maintenez votre strategie et surveillez les mouvements concurrentiels.');
  }

  if (sentimentScore !== null && sentimentScore < 0) {
    recommendations.push('Sentiment negatif detecte. Analysez les reponses negatives et adaptez votre communication.');
  }

  if (brandRank > 1) {
    recommendations.push(`Vous etes ${brandRank}${brandRank === 1 ? 'er' : 'e'} dans le classement. Ciblez les prompts ou vos concurrents sont mieux positionnes.`);
  }

  if (thirdPartyCount > ownedCount * 2) {
    recommendations.push('La majorite de vos citations proviennent de tiers. Renforcez vos contenus owned media.');
  }

  if (topDomains.length > 0) {
    recommendations.push(`Les domaines les plus cites sont : ${topDomains.slice(0, 3).map(d => d.domain).join(', ')}. Assurez-vous d\'y avoir un contenu a jour.`);
  }

  return NextResponse.json({
    project: { name: project.name, website: (project as any).website || '' },
    period: { start: start30, end: now.toISOString().slice(0, 10) },
    summary: {
      visibility,
      sentimentScore,
      sentimentPositive: totalMentions > 0 ? pct(posCount, totalMentions) : null,
      brandRank,
      totalBrands: leaderboard.length,
      runsCount: runsCount || 0,
      totalResponses,
      totalMentions,
    },
    breakdown: {
      owned: totalCitations > 0 ? pct(ownedCount, totalCitations) : 0,
      competitor: totalCitations > 0 ? pct(competitorCount, totalCitations) : 0,
      thirdParty: totalCitations > 0 ? pct(thirdPartyCount, totalCitations) : 0,
      ownedCount,
      competitorCount,
      thirdPartyCount,
      topDomains,
    },
    trend,
    citations: citationsTable,
    competitors: competitorMentions,
    recommendations,
  });
}
