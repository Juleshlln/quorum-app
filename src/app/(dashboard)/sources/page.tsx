import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { SourcesDashboard } from '@/components/sources/sources-dashboard';

export const metadata = {
  title: 'Sources | Quorum',
};

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

export default async function SourcesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">Veuillez vous connecter.</p>
      </div>
    );
  }

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return (
      <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-10 text-center text-zinc-400">
        Aucun projet actif. Créez votre marque pour commencer.
      </div>
    );
  }

  const start30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: citationsData } = await supabase
    .from('response_citations')
    .select('url, domain, domain_type, created_at, analysis_run:analysis_runs!inner(analysis_id, analyses!inner(project_id, kind))')
    .eq('analysis_run.analyses.project_id', project.id)
    .eq('analysis_run.analyses.kind', 'scheduled')
    .gte('created_at', start30)
    .order('created_at', { ascending: true });

  const citations = (citationsData || []) as Array<{
    domain: string;
    domain_type: string;
    created_at: string;
  }>;

  const typeCounts = citations.reduce((acc, c) => {
    const key = c.domain_type || 'other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const domainCounts = citations.reduce((acc, c) => {
    acc[c.domain] = (acc[c.domain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalCitations = citations.length || 1;

  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => {
      const domainType = citations.find((c) => c.domain === domain)?.domain_type || 'other';
      return {
        domain,
        domain_type: domainType,
        used_pct: Math.round((count / totalCitations) * 100),
        avg_citations_per_run: count,
      };
    });

  const trendMap = citations.reduce((acc, c) => {
    const date = c.created_at.slice(0, 10);
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const trend = Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date: formatShortDate(date),
      citations: count,
    }));

  const domainTypes = Object.entries(typeCounts).map(([type, count]) => ({ type, count }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Sources</h1>
        <p className="text-zinc-400 mt-1">
          Basé sur analyses quotidiennes · 30 jours · modèle gpt-4o
        </p>
      </div>
      <SourcesDashboard domainTypes={domainTypes} topDomains={topDomains} trend={trend} rangeDays={30} />
    </div>
  );
}
