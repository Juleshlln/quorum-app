import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { buildWindowFromDays, getProductVisibilityPromptsData } from '@/lib/product-visibility/service';
import {
  formatBuyingIntent,
  formatDateFr,
  formatFrequency,
  formatInteger,
  formatStatus,
} from '@/lib/product-visibility/format';
import { ProductVisibilitySectionNav } from '@/components/product-visibility/section-nav';
import { ProductVisibilityPromptsActions } from '@/components/product-visibility/prompts-actions';

export const metadata = {
  title: 'Requêtes IA | Quorum',
};

export default async function ProductVisibilityPromptsPage() {
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
  const payload = await getProductVisibilityPromptsData({
    supabase,
    projectId: project.id,
    window: buildWindowFromDays(30),
  });

  return (
    <div className="space-y-6">
      <ProductVisibilitySectionNav />

      <section className="quorum-panel-strong p-6 md:p-7">
        <p className="quorum-kicker">Visibilité produit</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] quorum-text-primary md:text-4xl">Requêtes IA</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed quorum-text-muted">
          Associez chaque requête à une catégorie, une intention d’achat, des produits cibles et une fréquence de suivi.
        </p>
      </section>

      <ProductVisibilityPromptsActions />

      <section className="quorum-panel p-5">
        <p className="quorum-kicker">Requêtes suivies</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] quorum-text-muted">
              <tr>
                <th className="pb-3 pr-4 font-medium">Requête IA</th>
                <th className="pb-3 pr-4 font-medium">Catégorie</th>
                <th className="pb-3 pr-4 font-medium">Intention d’achat</th>
                <th className="pb-3 pr-4 font-medium">Produits ciblés</th>
                <th className="pb-3 pr-4 font-medium">Fréquence</th>
                <th className="pb-3 pr-4 font-medium">Statut</th>
                <th className="pb-3 pr-4 font-medium">Dernière analyse</th>
                <th className="pb-3 pr-4 font-medium">Réponses</th>
                <th className="pb-3 pr-4 font-medium">Vos produits</th>
                <th className="pb-3 pr-4 font-medium">Concurrents</th>
              </tr>
            </thead>
            <tbody>
              {payload.prompts.length > 0 ? payload.prompts.map((prompt) => (
                <tr key={prompt.id} className="border-t border-[color:var(--quorum-border)]">
                  <td className="py-3 pr-4 quorum-text-primary">{prompt.prompt_text}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{prompt.category || '—'}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatBuyingIntent(prompt.buying_intent || 'discovery')}</td>
                  <td className="py-3 pr-4 quorum-text-muted">
                    {prompt.target_products.map((product) => product.product_name).join(', ') || '—'}
                  </td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatFrequency(prompt.monitoring_frequency)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatStatus(prompt.status)}</td>
                  <td className="py-3 pr-4 quorum-text-muted">
                    {formatDateFr(prompt.last_run)}
                  </td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatInteger(prompt.responses_collected)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatInteger(prompt.visibility_owned)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatInteger(prompt.visibility_competitors)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={10} className="py-8 text-center quorum-text-muted">
                    Vos produits sont ajoutés. Générez maintenant les requêtes IA à tester.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="quorum-panel p-5">
        <p className="quorum-kicker">Suggestions par catégorie</p>
        <div className="mt-4 space-y-2">
          {payload.suggested_prompts.length > 0 ? payload.suggested_prompts.map((suggestion, index) => (
            <div key={`${suggestion.category_id}-${index}`} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
              <p className="text-sm quorum-text-primary">{suggestion.prompt_text}</p>
              <p className="mt-1 text-xs quorum-text-muted">
                {formatBuyingIntent(suggestion.buying_intent)} · {formatFrequency(suggestion.monitoring_frequency)} · {formatInteger(suggestion.target_product_ids.length)} produits
              </p>
            </div>
          )) : (
            <p className="text-sm quorum-text-muted">Ajoutez des produits et des catégories pour générer des suggestions utiles.</p>
          )}
        </div>
      </section>
    </div>
  );
}
