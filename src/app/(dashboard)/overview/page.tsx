import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { getOverview, resolveOverviewRange } from '@/lib/overview/product-visibility-overview';
import { ProductVisibilityOverviewBusinessDashboard } from '@/components/overview/product-visibility-overview-dashboard';

export const metadata = {
  title: 'Vue d’ensemble | Quorum',
};

type SearchParams = {
  range?: string;
  provider?: string;
};

export default async function OverviewPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) redirect('/login');

  const activeProject = await getActiveProjectForUser(user.id);
  if (!activeProject) {
    return (
      <div className="rounded-3xl border quorum-border-default quorum-surface-strong p-10 text-center quorum-text-muted">
        <p className="text-sm font-medium quorum-text-primary">Aucune marque active.</p>
        <p className="mt-2 text-xs">Créez ou activez une marque pour commencer le suivi de visibilité produit.</p>
      </div>
    );
  }

  const params = await searchParams;
  const url = `https://quorum.local/overview?${new URLSearchParams({
    range: params?.range || '30d',
    provider: params?.provider || 'all',
  }).toString()}`;
  const { range, selectedProvider, window, previousWindow } = resolveOverviewRange(url);
  const supabase = createAdminClient();
  const overview = await getOverview({
    supabase,
    projectId: activeProject.id,
    projectName: activeProject.name,
    range,
    selectedProvider,
    window,
    previousWindow,
  });

  return <ProductVisibilityOverviewBusinessDashboard data={overview} />;
}
