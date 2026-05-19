import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { buildWindowFromDays, getProductVisibilityAttributes } from '@/lib/product-visibility/service';
import { formatInteger, formatPercent, formatSentiment } from '@/lib/product-visibility/format';
import { ProductVisibilitySectionNav } from '@/components/product-visibility/section-nav';

export const metadata = {
  title: 'Attributs | Quorum',
};

export default async function ProductVisibilityAttributesPage() {
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
  const payload = await getProductVisibilityAttributes({
    supabase,
    projectId: project.id,
    window: buildWindowFromDays(30),
  });

  return (
    <div className="space-y-6">
      <ProductVisibilitySectionNav />

      <section className="quorum-panel-strong p-6 md:p-7">
        <p className="quorum-kicker">Attributs</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] quorum-text-primary md:text-4xl">Analyse des attributs produit</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed quorum-text-muted">
          Identifiez quels attributs influencent le plus les recommandations IA et ou les concurrents prennent l avantage.
        </p>
      </section>

      <section className="quorum-panel p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] quorum-text-muted">
              <tr>
                <th className="pb-3 pr-4 font-medium">Attribut</th>
                <th className="pb-3 pr-4 font-medium">Catégorie</th>
                <th className="pb-3 pr-4 font-medium">Produit leader</th>
                <th className="pb-3 pr-4 font-medium">Marque leader</th>
                <th className="pb-3 pr-4 font-medium">Vos produits</th>
                <th className="pb-3 pr-4 font-medium">Concurrents</th>
                <th className="pb-3 pr-4 font-medium">Sentiment moyen</th>
                <th className="pb-3 pr-4 font-medium">Fréquence de citation</th>
                <th className="pb-3 pr-4 font-medium">Opportunité</th>
              </tr>
            </thead>
            <tbody>
              {payload.attributes.length > 0 ? payload.attributes.map((row) => (
                <tr key={`${row.attribute}-${row.category_id || 'none'}`} className="border-t border-[color:var(--quorum-border)]">
                  <td className="py-3 pr-4 font-medium quorum-text-primary">{row.attribute}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{row.category || '—'}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{row.product_leader || '—'}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{row.brand_leader || '—'}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatPercent(row.owned_visibility)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatPercent(row.competitor_visibility)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatSentiment(row.sentiment_avg)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatInteger(row.citation_frequency)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatPercent(row.opportunity)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center quorum-text-muted">
                    Aucun attribut détecté pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="quorum-panel p-5">
        <p className="quorum-kicker">Produits par part d’attribut</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] quorum-text-muted">
              <tr>
                <th className="pb-3 pr-4 font-medium">Attribut</th>
                <th className="pb-3 pr-4 font-medium">Produits principaux</th>
                <th className="pb-3 pr-4 font-medium">Part de vos produits</th>
                <th className="pb-3 pr-4 font-medium">Écart vs période précédente</th>
              </tr>
            </thead>
            <tbody>
              {payload.items_by_attribute_share.length > 0 ? payload.items_by_attribute_share.map((row) => (
                <tr key={row.attribute} className="border-t border-[color:var(--quorum-border)]">
                  <td className="py-3 pr-4 font-medium quorum-text-primary">{row.attribute}</td>
                  <td className="py-3 pr-4 quorum-text-muted">
                    {row.top_products.map((product) => `${product.product} (${product.score})`).join(' • ') || '—'}
                  </td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatPercent(row.share)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{row.delta > 0 ? `+${row.delta}` : row.delta}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center quorum-text-muted">
                    Aucune part d’attribut disponible pour le moment.
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
