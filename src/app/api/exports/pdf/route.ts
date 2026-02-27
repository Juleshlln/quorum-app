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
  const start7 = new Date(now.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  const start14 = new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);

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
  const negCount = metrics.reduce((s, r) => s + r.negative_count, 0);
  const sentimentScore = totalMentions > 0
    ? Number(((posCount - negCount) / totalMentions).toFixed(2))
    : null;

  // 7d / prev-7d split
  const metrics7 = metrics.filter(r => r.day >= start7);
  const metricsPrev7 = metrics.filter(r => r.day >= start14 && r.day < start7);
  const total7 = metrics7.reduce((s, r) => s + r.responses_count, 0);
  const mentions7 = metrics7.reduce((s, r) => s + r.mentions_count, 0);
  const vis7 = total7 > 0 ? pct(mentions7, total7) : 0;
  const totalPrev7 = metricsPrev7.reduce((s, r) => s + r.responses_count, 0);
  const mentionsPrev7 = metricsPrev7.reduce((s, r) => s + r.mentions_count, 0);
  const visPrev7 = totalPrev7 > 0 ? pct(mentionsPrev7, totalPrev7) : 0;

  // 3. Competitors — detailed benchmark
  const { data: competitors } = await supabase
    .from('competitors')
    .select('name')
    .eq('project_id', projectId);
  const competitorNames: string[] = (competitors || []).map((c: any) => c.name as string);

  const competitorBenchmark = competitorNames.map((name) => {
    let total = 0;
    let total7d = 0;
    let totalPrev7d = 0;
    let bestVis = 0;
    for (const dr of metrics) {
      const entry = (dr.competitor_data || []).find(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );
      if (entry) {
        total += entry.mentions;
        if (entry.visibility > bestVis) bestVis = entry.visibility;
        if (dr.day >= start7) total7d += entry.mentions;
        if (dr.day >= start14 && dr.day < start7) totalPrev7d += entry.mentions;
      }
    }
    const avgVis = totalResponses > 0 ? pct(total, totalResponses) : 0;
    const vis7d = total7 > 0 ? pct(total7d, total7) : 0;
    const visPrev = totalPrev7 > 0 ? pct(totalPrev7d, totalPrev7) : 0;
    const trendDelta = vis7d - visPrev;
    const trend = trendDelta > 2 ? 'up' : trendDelta < -2 ? 'down' : 'stable';
    return { name, mentions: total, avgVisibility: avgVis, bestVisibility: bestVis, trend, trendDelta };
  });

  // Rank
  const leaderboard = [
    { name: project.name, mentions: totalMentions },
    ...competitorBenchmark.map(c => ({ name: c.name, mentions: c.mentions })),
  ].sort((a, b) => b.mentions - a.mentions);
  const brandRank = leaderboard.findIndex(e => e.name === project.name) + 1;

  // Brand trend
  const brandTrendDelta = vis7 - visPrev7;
  const brandTrend = brandTrendDelta > 2 ? 'up' : brandTrendDelta < -2 ? 'down' : 'stable';

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

  // 6. Real citations for table
  const { data: realCitations } = await supabase
    .from('citations')
    .select(`
      cited_at,
      ai_model,
      method,
      confidence,
      brand_mentioned,
      competitor_mentioned,
      prompt_run_id,
      domain:sources_domains(domain, category),
      url:sources_urls(url)
    `)
    .eq('project_id', projectId)
    .eq('is_fallback', false)
    .gte('cited_at', `${start30}T00:00:00Z`)
    .order('cited_at', { ascending: false })
    .limit(500);

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

  // 8. Per-prompt analysis
  const { data: promptsData } = await supabase
    .from('monitoring_prompts')
    .select('id, prompt_text, topic_id, is_active')
    .eq('project_id', projectId)
    .eq('is_active', true);

  const { data: promptRunsData } = await supabase
    .from('prompt_runs')
    .select('prompt_id, brand_mentioned, competitors_mentioned, scheduled_at')
    .eq('project_id', projectId)
    .eq('run_type', 'monitoring')
    .eq('status', 'success')
    .gte('scheduled_at', `${start30}T00:00:00Z`);

  const promptAnalysis = (promptsData || []).map((p: any) => {
    const runs = (promptRunsData || []).filter((r: any) => r.prompt_id === p.id);
    const brandMentions = runs.filter((r: any) => r.brand_mentioned === true).length;
    const competitorsDetected = new Set<string>();
    for (const r of runs) {
      for (const c of (r as any).competitors_mentioned || []) {
        competitorsDetected.add(c);
      }
    }
    const runs7 = runs.filter((r: any) => r.scheduled_at?.slice(0, 10) >= start7);
    const runsPrev7 = runs.filter((r: any) => {
      const d = r.scheduled_at?.slice(0, 10);
      return d >= start14 && d < start7;
    });
    const vis = runs.length > 0 ? pct(brandMentions, runs.length) : 0;
    const vis7d = runs7.length > 0 ? pct(runs7.filter((r: any) => r.brand_mentioned).length, runs7.length) : 0;
    const visPrev = runsPrev7.length > 0 ? pct(runsPrev7.filter((r: any) => r.brand_mentioned).length, runsPrev7.length) : 0;
    const delta = vis7d - visPrev;
    const trend = delta > 5 ? 'up' : delta < -5 ? 'down' : 'stable';
    return {
      prompt: p.prompt_text,
      runs: runs.length,
      brandMentioned: brandMentions > 0,
      visibility: vis,
      competitors: [...competitorsDetected].slice(0, 4),
      trend,
    };
  }).sort((a: any, b: any) => b.visibility - a.visibility);

  // 9. Recommendations (data-driven)
  const recommendations: string[] = [];

  // Compare with top competitor
  const topCompetitor = competitorBenchmark.sort((a, b) => b.avgVisibility - a.avgVisibility)[0];
  if (topCompetitor && topCompetitor.avgVisibility > visibility) {
    recommendations.push(
      `${topCompetitor.name} vous depasse avec ${topCompetitor.avgVisibility}% de visibilite contre ${visibility}%. Renforcez votre contenu sur les thematiques ou ce concurrent est cite.`
    );
  }

  // Sentiment
  const sentimentPct = totalMentions > 0 ? pct(posCount, totalMentions) : 0;
  if (sentimentPct < 30 && totalMentions > 0) {
    recommendations.push(
      `Sentiment positif faible (${sentimentPct}%). Analysez les reponses negatives et mettez en avant vos elements differenciants.`
    );
  }

  // Owned media share
  const ownedPct = totalCitations > 0 ? pct(ownedCount, totalCitations) : 0;
  if (ownedPct < 25 && totalCitations > 0) {
    recommendations.push(
      `Seulement ${ownedPct}% de vos citations proviennent de vos domaines owned. Creez du contenu sur ${(project as any).website || 'votre site'} ciblant les prompts ou vous etes absent.`
    );
  }

  // Top third-party domains
  const thirdPartyDomains = topDomains.filter(d => d.category === 'third_party').slice(0, 3);
  if (thirdPartyDomains.length > 0) {
    recommendations.push(
      `Les domaines tiers les plus influents sont : ${thirdPartyDomains.map(d => d.domain).join(', ')}. Assurez-vous d'y etre reference.`
    );
  }

  // Worst performing prompt
  const worstPrompt = promptAnalysis.find((p: any) => p.visibility === 0 && p.runs > 0);
  if (worstPrompt) {
    const truncated = worstPrompt.prompt.length > 60 ? worstPrompt.prompt.slice(0, 60) + '...' : worstPrompt.prompt;
    recommendations.push(
      `Le prompt "${truncated}" genere 0% de visibilite sur ${worstPrompt.runs} runs. C'est votre plus grande opportunite.`
    );
  }

  // General
  if (visibility >= 60) {
    recommendations.push('Excellente visibilite. Maintenez votre strategie et surveillez les mouvements concurrentiels.');
  } else if (visibility < 30) {
    recommendations.push('Visibilite faible (< 30%). Creez du contenu optimise pour les requetes IA sur vos thematiques cles.');
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
      brandTrend,
      brandTrendDelta,
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
    competitorBenchmark: [
      {
        name: project.name,
        mentions: totalMentions,
        avgVisibility: visibility,
        bestVisibility: metrics.reduce((best, r) => {
          const v = r.visibility_score != null
            ? (r.visibility_score >= 0 && r.visibility_score <= 1 ? Math.round(r.visibility_score * 100) : r.visibility_score)
            : 0;
          return Math.max(best, v);
        }, 0),
        trend: brandTrend,
        trendDelta: brandTrendDelta,
        isBrand: true,
      },
      ...competitorBenchmark.map(c => ({ ...c, isBrand: false })),
    ],
    promptAnalysis,
    recommendations,
  });
}
