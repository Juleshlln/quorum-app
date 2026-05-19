import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { buildWindowFromDays, getProductVisibilityProducts } from '@/lib/product-visibility/service';
import {
  formatInteger,
  formatOwnership,
  formatPercent,
  formatRanking,
  formatSentiment,
} from '@/lib/product-visibility/format';
import { ProductVisibilitySectionNav } from '@/components/product-visibility/section-nav';
import { ProductVisibilityProductForm } from '@/components/product-visibility/product-form';

export const metadata = {
  title: 'Produits suivis | Quorum',
};

export default async function ProductVisibilityProductsPage() {
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
  const payload = await getProductVisibilityProducts({
    supabase,
    projectId: project.id,
    window: buildWindowFromDays(30),
  });
  const { data: categories } = await supabase
    .from('product_categories')
    .select('id, name')
    .eq('project_id', project.id)
    .order('name', { ascending: true });

  return (
    <div className="space-y-6">
      <ProductVisibilitySectionNav />

      <section className="quorum-panel-strong p-6 md:p-7">
        <p className="quorum-kicker">Visibilité produit</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] quorum-text-primary md:text-4xl">Produits suivis</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed quorum-text-muted">
          Ajoutez les produits que vous voulez suivre dans les réponses IA, ainsi que les produits concurrents utiles pour la comparaison.
        </p>
      </section>

      <ProductVisibilityProductForm categories={(categories || []) as Array<{ id: string; name: string }>} />

      <section className="quorum-panel p-5">
        <p className="quorum-kicker">Catalogue suivi</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] quorum-text-muted">
              <tr>
                <th className="pb-3 pr-4 font-medium">Produit</th>
                <th className="pb-3 pr-4 font-medium">Marque</th>
                <th className="pb-3 pr-4 font-medium">Catégorie</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 font-medium">Score de visibilité</th>
                <th className="pb-3 pr-4 font-medium">Position moyenne</th>
                <th className="pb-3 pr-4 font-medium">Mentions</th>
                <th className="pb-3 pr-4 font-medium">Sentiment</th>
                <th className="pb-3 pr-4 font-medium">Attribut principal</th>
                <th className="pb-3 pr-4 font-medium">Tendance</th>
                <th className="pb-3 pr-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {payload.products.length > 0 ? payload.products.map((product) => (
                <tr key={product.product_id} className="border-t border-[color:var(--quorum-border)]">
                  <td className="py-3 pr-4 font-medium quorum-text-primary">
                    <Link href={`/product-visibility/products/${product.product_id}`} className="hover:underline">
                      {product.product}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 quorum-text-muted">{product.brand || '—'}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{product.category || '—'}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatOwnership(product.owned)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{product.mentions > 0 ? formatPercent(product.visibility_score) : '—'}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatRanking(product.avg_position)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatInteger(product.mentions)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatSentiment(product.sentiment)}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{product.top_attribute || '—'}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{product.trend > 0 ? `+${product.trend}` : product.trend}</td>
                  <td className="py-3 pr-4 quorum-text-muted">
                    {product.actions === 'Optimize' ? 'Optimiser' : product.actions === 'Track' ? 'Suivre' : 'Surveiller'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={11} className="py-8 text-center quorum-text-muted">
                    Ajoutez vos premiers produits pour commencer à mesurer leur visibilité dans les réponses IA.
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
