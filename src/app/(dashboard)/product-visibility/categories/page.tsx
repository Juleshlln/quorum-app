import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { buildWindowFromDays, getProductVisibilityCategories } from '@/lib/product-visibility/service';
import {
  formatInteger,
  formatOpportunityLevel,
  formatPercent,
  formatPriority,
  formatStatus,
} from '@/lib/product-visibility/format';
import { ProductVisibilitySectionNav } from '@/components/product-visibility/section-nav';

export const metadata = {
  title: 'Catégories | Quorum',
};

export default async function ProductVisibilityCategoriesPage() {
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

  const supabase = createAdminClient();
  const payload = await getProductVisibilityCategories({
    supabase,
    projectId: project.id,
    window: buildWindowFromDays(30),
  });

  return (
    <div className="space-y-6">
      <ProductVisibilitySectionNav />

      <section className="quorum-panel-strong p-6 md:p-7">
        <p className="quorum-kicker">Visibilité produit</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] quorum-text-primary md:text-4xl">Catégories</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed quorum-text-muted">
          Pilotez la visibilité produit par univers d’achat B2B et détectez les zones où les concurrents dominent.
        </p>
      </section>

      <section className="quorum-panel p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] quorum-text-muted">
              <tr>
                <th className="pb-3 pr-4 font-medium">Catégorie</th>
                <th className="pb-3 pr-4 font-medium">Produits suivis</th>
                <th className="pb-3 pr-4 font-medium">Vos produits</th>
                <th className="pb-3 pr-4 font-medium">Concurrents</th>
                <th className="pb-3 pr-4 font-medium">Leader actuel</th>
                <th className="pb-3 pr-4 font-medium">Attributs clés</th>
                <th className="pb-3 pr-4 font-medium">Opportunité</th>
                <th className="pb-3 pr-4 font-medium">Priorité</th>
                <th className="pb-3 pr-4 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {payload.categories.length > 0 ? payload.categories.map((category) => (
                <tr key={category.category_id} className="border-t border-[color:var(--quorum-border)]">
                  <td className="py-3 pr-4 font-medium quorum-text-primary">
                    <Link href={`/product-visibility/categories/${category.category_id}`} className="hover:underline">
                      {category.category}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatInteger(category.products_tracked)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatPercent(category.owned_visibility)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatPercent(category.competitor_visibility)}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{category.top_competitor || '—'}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{category.top_attributes.join(', ') || '—'}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatOpportunityLevel(category.opportunity_score)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatPriority(category.priority)}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{formatStatus(category.status)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center quorum-text-muted">
                    Ajoutez un produit avec une catégorie pour structurer vos univers d’achat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
