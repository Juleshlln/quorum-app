import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { ProductVisibilitySectionNav } from '@/components/product-visibility/section-nav';
import { ProductCatalogSourcesManager } from '@/components/product-visibility/sources-manager';
import { toPublicSource } from '@/lib/product-catalog/sync';
import type { CatalogSourceRow } from '@/lib/product-catalog/types';

export const metadata = {
  title: 'Sources catalogue · Visibilité produit | Quorum',
};

export default async function ProductVisibilitySourcesPage() {
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
          Créez ou activez une marque pour configurer vos sources de catalogue.
        </p>
      </div>
    );
  }

  const supabase = createAdminClient();

  const [sourcesRes, categoriesRes] = await Promise.all([
    supabase
      .from('product_catalog_sources')
      .select('*')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('product_categories')
      .select('id, name')
      .eq('project_id', project.id)
      .order('name', { ascending: true }),
  ]);

  const sources = (sourcesRes.data || []).map((row: any) => toPublicSource(row as CatalogSourceRow));
  const categories = (categoriesRes.data || []).map((c: any) => ({ id: c.id as string, name: c.name as string }));

  return (
    <div className="space-y-6">
      <ProductVisibilitySectionNav />
      <ProductCatalogSourcesManager initialSources={sources} categories={categories} />
    </div>
  );
}
