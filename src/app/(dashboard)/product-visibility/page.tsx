import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import {
  buildPreviousWindow,
  buildWindowFromDays,
  getProductVisibilityOverviewStandard,
} from '@/lib/product-visibility/service';
import {
  parseRange,
  rangeToDays,
  type ProductVisibilityRange,
} from '@/lib/product-visibility/format';
import { ProductVisibilitySectionNav } from '@/components/product-visibility/section-nav';
import { ProductVisibilityOverviewDashboard } from '@/components/product-visibility/overview-dashboard';

export const metadata = {
  title: 'Visibilité produit | Quorum',
};

type SearchParams = { range?: string };

export default async function ProductVisibilityOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabaseUser = await createClient();
  const {
    data: { user },
  } = await supabaseUser.auth.getUser();

  if (!user) redirect('/login');

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return (
      <div className="rounded-3xl border quorum-border-default quorum-surface-strong p-10 text-center quorum-text-muted">
        <p className="text-sm font-medium quorum-text-primary">Aucune marque active.</p>
        <p className="mt-2 text-xs quorum-text-muted">
          Créez ou activez une marque pour commencer le suivi de visibilité produit.
        </p>
      </div>
    );
  }

  const range: ProductVisibilityRange = parseRange(params?.range, '30d');
  const window = buildWindowFromDays(rangeToDays(range));
  const previousWindow = buildPreviousWindow(window);
  const supabase = createAdminClient();

  const data = await getProductVisibilityOverviewStandard({
    supabase,
    projectId: project.id,
    range,
    window,
    previousWindow,
  });

  return (
    <div className="space-y-6">
      <ProductVisibilitySectionNav />
      <ProductVisibilityOverviewDashboard data={data} />
    </div>
  );
}
