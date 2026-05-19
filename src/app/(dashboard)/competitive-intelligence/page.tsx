import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { getCompetitiveIntelligenceOverview } from '@/lib/business-impact/service';
import { CompetitiveIntelligenceDashboard } from '@/components/competitive-intelligence/competitive-intelligence-dashboard';

export const metadata = {
  title: 'Competitive Intelligence | Quorum',
};

function subtractDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

function formatWindowLabel(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const end = new Date(`${endDate}T00:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return `${start} → ${end}`;
}

export default async function CompetitiveIntelligencePage() {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) redirect('/login');

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return (
      <div className="rounded-3xl border quorum-border-default quorum-surface-strong p-10 text-center text-zinc-400">
        Aucun projet actif. Créez votre marque pour commencer.
      </div>
    );
  }

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = subtractDays(new Date(), 29).toISOString().slice(0, 10);
  const supabase = createAdminClient();
  const overview = await getCompetitiveIntelligenceOverview({
    supabase,
    projectId: project.id,
    brandName: project.name,
    startDate,
    endDate,
  });

  return (
    <CompetitiveIntelligenceDashboard
      brandName={project.name}
      windowLabel={formatWindowLabel(startDate, endDate)}
      overview={overview}
    />
  );
}
