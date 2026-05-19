import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { buildWindowFromDays, getProductVisibilityCategoryDetail } from '@/lib/product-visibility/service';
import { formatBuyingIntent, formatFrequency, formatInteger, formatOwnership, formatPercent, formatPriority, formatRanking, formatSentiment, formatSourceType, formatStatus } from '@/lib/product-visibility/format';
import { ProductVisibilitySectionNav } from '@/components/product-visibility/section-nav';

export const metadata = {
  title: 'Détail catégorie | Quorum',
};

export default async function ProductVisibilityCategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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
  const payload = await getProductVisibilityCategoryDetail({
    supabase,
    projectId: project.id,
    categoryId: id,
    window: buildWindowFromDays(30),
  });

  if (!payload.category) {
    notFound();
  }

  const matrixCards = [
    {
      label: 'Visibilité élevée / sentiment positif',
      value: payload.matrix.high_visibility_positive,
    },
    {
      label: 'Visibilité élevée / sentiment négatif',
      value: payload.matrix.high_visibility_negative,
    },
    {
      label: 'Visibilité faible / sentiment positif',
      value: payload.matrix.low_visibility_positive,
    },
    {
      label: 'Visibilité faible / sentiment négatif',
      value: payload.matrix.low_visibility_negative,
    },
  ];

  return (
    <div className="space-y-6">
      <ProductVisibilitySectionNav />

      <section className="quorum-panel-strong p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="quorum-kicker">Détail catégorie</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] quorum-text-primary md:text-4xl">
              {payload.category.name}
            </h1>
            <p className="mt-2 text-sm quorum-text-muted">{payload.category.description || 'Aucune description renseignée.'}</p>
          </div>
          <Link href="/product-visibility/categories" className="quorum-btn-secondary">
            Retour aux catégories
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="quorum-panel p-4">
            <p className="quorum-kicker">Vos produits suivis</p>
            <p className="mt-2 text-3xl font-semibold quorum-text-primary">{formatInteger(payload.summary.owned_products_tracked)}</p>
          </div>
          <div className="quorum-panel p-4">
            <p className="quorum-kicker">Produits concurrents détectés</p>
            <p className="mt-2 text-3xl font-semibold quorum-text-primary">{formatInteger(payload.summary.competitor_products_detected)}</p>
          </div>
          <div className="quorum-panel p-4">
            <p className="quorum-kicker">Mentions totales</p>
            <p className="mt-2 text-3xl font-semibold quorum-text-primary">{formatInteger(payload.summary.total_mentions)}</p>
          </div>
          <div className="quorum-panel p-4">
            <p className="quorum-kicker">Sentiment moyen</p>
            <p className="mt-2 text-3xl font-semibold quorum-text-primary">{formatSentiment(payload.summary.avg_sentiment)}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="quorum-panel p-5">
          <p className="quorum-kicker">Requêtes actives</p>
          <div className="mt-4 space-y-2">
            {payload.prompts.length > 0 ? payload.prompts.map((prompt) => (
              <div key={prompt.id} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
                <p className="text-sm font-medium quorum-text-primary">{prompt.prompt_text}</p>
                <p className="mt-1 text-xs quorum-text-muted">
                  {formatBuyingIntent(prompt.buying_intent)} · {formatFrequency(prompt.monitoring_frequency)} · {formatStatus(prompt.status)}
                </p>
              </div>
            )) : (
              <p className="text-sm quorum-text-muted">Aucune requête active pour cette catégorie.</p>
            )}
          </div>
        </div>

        <div className="quorum-panel p-5">
          <p className="quorum-kicker">Matrice visibilité / sentiment</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {matrixCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-4">
                <p className="text-xs uppercase tracking-[0.14em] quorum-text-muted">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold quorum-text-primary">{card.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="quorum-panel p-5">
        <p className="quorum-kicker">Classement IA par produit</p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] quorum-text-muted">
              <tr>
                <th className="pb-3 pr-4 font-medium">Produit</th>
                <th className="pb-3 pr-4 font-medium">Marque</th>
                <th className="pb-3 pr-4 font-medium">Type</th>
                <th className="pb-3 pr-4 font-medium">Rang moyen</th>
                <th className="pb-3 pr-4 font-medium">Mentions</th>
                <th className="pb-3 pr-4 font-medium">Score de visibilité</th>
                <th className="pb-3 pr-4 font-medium">Sentiment</th>
                <th className="pb-3 pr-4 font-medium">Attribut principal</th>
              </tr>
            </thead>
            <tbody>
              {payload.product_ranking.length > 0 ? payload.product_ranking.map((row) => (
                <tr key={row.product_id} className="border-t border-[color:var(--quorum-border)]">
                  <td className="py-3 pr-4 quorum-text-primary">{row.product}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{row.brand || '—'}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatOwnership(row.owned)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatRanking(row.avg_rank)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatInteger(row.mentions)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatPercent(row.visibility_score)}</td>
                  <td className="py-3 pr-4 quorum-text-primary">{formatSentiment(row.sentiment)}</td>
                  <td className="py-3 pr-4 quorum-text-muted">{row.top_attribute || '—'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center quorum-text-muted">
                    Aucune donnée de classement disponible.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="quorum-panel p-5">
          <p className="quorum-kicker">Attributs les plus utilisés par les IA</p>
          <div className="mt-4 space-y-2">
            {payload.top_attributes.length > 0 ? payload.top_attributes.map((row) => (
              <div key={row.attribute} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium quorum-text-primary">{row.attribute}</p>
                  <span className="text-xs quorum-text-muted">{formatInteger(row.total_mentions)} mentions</span>
                </div>
                <p className="mt-1 text-xs quorum-text-muted">
                  Vos produits {formatInteger(row.owned_mentions)} · Concurrents {formatInteger(row.competitor_mentions)}
                </p>
              </div>
            )) : (
              <p className="text-sm quorum-text-muted">Aucun attribut détecté pour le moment.</p>
            )}
          </div>
        </div>

        <div className="quorum-panel p-5">
          <p className="quorum-kicker">Sources citées</p>
          <div className="mt-4 space-y-2">
            {payload.cited_sources.length > 0 ? payload.cited_sources.map((source) => (
              <div key={`${source.domain}-${source.source_type}`} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium quorum-text-primary">{source.domain}</p>
                  <span className="text-xs quorum-text-muted">{formatInteger(source.count)} citations</span>
                </div>
                <p className="mt-1 text-xs quorum-text-muted">{formatSourceType(source.source_type)}</p>
              </div>
            )) : (
              <p className="text-sm quorum-text-muted">Aucune source détectée pour le moment.</p>
            )}
          </div>
        </div>
      </section>

      <section className="quorum-panel p-5">
        <p className="quorum-kicker">Recommandations</p>
        <div className="mt-4 space-y-3">
          {payload.recommendations.length > 0 ? payload.recommendations.map((recommendation) => (
            <div key={recommendation.id} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium quorum-text-primary">{recommendation.title}</p>
                <span className="text-xs uppercase tracking-[0.14em] quorum-text-muted">{formatPriority(recommendation.priority)}</span>
              </div>
              <p className="mt-2 text-sm quorum-text-muted">{recommendation.description}</p>
            </div>
          )) : (
            <p className="text-sm quorum-text-muted">Aucune recommandation disponible pour cette catégorie.</p>
          )}
        </div>
      </section>
    </div>
  );
}
