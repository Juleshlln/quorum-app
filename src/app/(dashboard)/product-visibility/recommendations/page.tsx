import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { buildWindowFromDays, getProductVisibilityRecommendations } from '@/lib/product-visibility/service';
import { formatEffort, formatPriority, formatStatus } from '@/lib/product-visibility/format';
import { ProductVisibilitySectionNav } from '@/components/product-visibility/section-nav';
import { ProductVisibilityRecommendationsActions } from '@/components/product-visibility/recommendations-actions';

export const metadata = {
  title: 'Recommandations | Quorum',
};

export default async function ProductVisibilityRecommendationsPage() {
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
  const payload = await getProductVisibilityRecommendations({
    supabase,
    projectId: project.id,
    window: buildWindowFromDays(30),
  });

  return (
    <div className="space-y-6">
      <ProductVisibilitySectionNav />

      <section className="quorum-panel-strong p-6 md:p-7">
        <p className="quorum-kicker">Visibilité produit</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] quorum-text-primary md:text-4xl">Recommandations</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed quorum-text-muted">
          Priorisez des actions concrètes pour augmenter la visibilité produit sur les intentions d’achat B2B.
        </p>
      </section>

      <ProductVisibilityRecommendationsActions />

      <section className="quorum-panel p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] quorum-text-muted">
              <tr>
                <th className="pb-3 pr-4 font-medium">Titre</th>
                <th className="pb-3 pr-4 font-medium">Description</th>
                <th className="pb-3 pr-4 font-medium">Catégorie liée</th>
                <th className="pb-3 pr-4 font-medium">Produit lié</th>
                <th className="pb-3 pr-4 font-medium">Priorité</th>
                <th className="pb-3 pr-4 font-medium">Impact attendu</th>
                <th className="pb-3 pr-4 font-medium">Effort</th>
                <th className="pb-3 pr-4 font-medium">Origine</th>
                <th className="pb-3 pr-4 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {payload.recommendations.length > 0 ? payload.recommendations.map((recommendation) => (
                <tr key={recommendation.id} className="border-t border-[color:var(--quorum-border)]">
                  <td className="py-3 pr-4 font-medium quorum-text-primary">{recommendation.title}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{recommendation.description}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{recommendation.related_category || '—'}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{recommendation.related_product || '—'}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatPriority(recommendation.priority)}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{recommendation.expected_impact || '—'}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatEffort(recommendation.effort)}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{recommendation.source_reason ? 'Analyse automatique' : '—'}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatStatus(recommendation.status)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center quorum-text-muted">
                    Lancez une analyse pour générer des recommandations adaptées à vos produits et catégories.
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
