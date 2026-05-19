import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { buildWindowFromDays, getProductVisibilityResults } from '@/lib/product-visibility/service';
import {
  formatBuyingIntent,
  formatDateFr,
  formatInteger,
  formatOwnership,
  formatPercent,
  formatRanking,
} from '@/lib/product-visibility/format';
import { ProductVisibilitySectionNav } from '@/components/product-visibility/section-nav';
import { ProductVisibilityQuickActions } from '@/components/product-visibility/quick-actions';

export const metadata = {
  title: 'Résultats | Quorum',
};

export default async function ProductVisibilityResultsPage() {
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
  const payload = await getProductVisibilityResults({
    supabase,
    projectId: project.id,
    window: buildWindowFromDays(30),
  });

  return (
    <div className="space-y-6">
      <ProductVisibilitySectionNav />

      <section className="quorum-panel-strong p-6 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="quorum-kicker">Visibilité produit</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] quorum-text-primary md:text-4xl">Résultats</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed quorum-text-muted">
              Consultez les réponses IA analysées, les produits détectés, les sources et les scores calculés.
            </p>
          </div>
          <ProductVisibilityQuickActions showGeneratePrompts={false} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Réponses collectées" value={formatInteger(payload.summary.responses_collected)} />
        <Metric label="Produits détectés" value={formatInteger(payload.summary.detected_products)} />
        <Metric label="Mentions de vos produits" value={formatInteger(payload.summary.owned_mentions)} />
        <Metric label="Mentions concurrentes" value={formatInteger(payload.summary.competitor_mentions)} />
      </section>

      <section className="quorum-panel p-5">
        <p className="quorum-kicker">Produits détectés dans les réponses IA</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] quorum-text-muted">
              <tr>
                <th className="pb-3 pr-4 font-medium">Produit</th>
                <th className="pb-3 pr-4 font-medium">Marque</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 font-medium">Catégorie</th>
                <th className="pb-3 pr-4 font-medium">Mentions</th>
                <th className="pb-3 pr-4 font-medium">Position</th>
                <th className="pb-3 pr-4 font-medium">Score</th>
                <th className="pb-3 pr-4 font-medium">Dernière détection</th>
              </tr>
            </thead>
            <tbody>
              {payload.results.length > 0 ? payload.results.slice(0, 80).map((row) => (
                <tr key={row.id} className="border-t border-[color:var(--quorum-border)] align-top">
                  <td className="py-3 pr-4 font-medium quorum-text-primary">{row.detected_product_name || row.product_name || 'Produit non reconnu'}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{row.brand_name || '—'}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatOwnership(row.is_owned_product)}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{row.category || '—'}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatInteger(row.mention_count)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatRanking(row.rank_position)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatPercent(row.visibility_score)}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{formatDateFr(row.created_at)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center quorum-text-muted">
                    Vos produits et requêtes sont prêts. Lancez votre première analyse pour collecter des résultats.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="quorum-panel p-5">
        <p className="quorum-kicker">Réponses brutes</p>
        <div className="mt-4 space-y-3">
          {payload.results.filter((row) => row.raw_answer).slice(0, 6).map((row) => (
            <details key={`${row.id}-answer`} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] p-4">
              <summary className="cursor-pointer text-sm font-medium quorum-text-primary">
                {row.prompt_text || 'Requête IA'} · {formatBuyingIntent(row.buying_intent)}
              </summary>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed quorum-text-muted">{row.raw_answer}</p>
              {row.sources_detected.length > 0 ? (
                <p className="mt-3 text-xs quorum-text-muted">
                  Sources : {row.sources_detected.map((source) => source.domain || source.url).join(', ')}
                </p>
              ) : null}
            </details>
          ))}
          {payload.results.every((row) => !row.raw_answer) ? (
            <p className="rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-4 py-6 text-center text-sm quorum-text-muted">
              Aucune réponse brute disponible sur la période.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="quorum-panel p-5">
      <p className="quorum-kicker">{label}</p>
      <p className="mt-3 text-2xl font-semibold quorum-text-primary">{value}</p>
    </div>
  );
}
