import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { buildWindowFromDays, getProductVisibilityProductDetail } from '@/lib/product-visibility/service';
import { formatEffort, formatInteger, formatOwnership, formatPercent, formatPriority, formatRanking, formatSentiment, formatSourceType } from '@/lib/product-visibility/format';
import { ProductVisibilitySectionNav } from '@/components/product-visibility/section-nav';

export const metadata = {
  title: 'Détail produit | Quorum',
};

export default async function ProductVisibilityProductDetailPage({
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
  const payload = await getProductVisibilityProductDetail({
    supabase,
    projectId: project.id,
    productId: id,
    window: buildWindowFromDays(30),
  });

  if (!payload.product || !payload.metrics || !payload.ranking) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <ProductVisibilitySectionNav />

      <section className="quorum-panel-strong p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="quorum-kicker">Détail produit</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] quorum-text-primary md:text-4xl">
              {payload.product.product_name}
            </h1>
            <p className="mt-2 text-sm quorum-text-muted">
              {payload.product.brand_name || 'Marque non renseignée'} · {payload.product.category_name || 'Aucune catégorie'} · {formatOwnership(payload.product.is_owned_product)}
            </p>
            {payload.product.product_url && (
              <a href={payload.product.product_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-sm quorum-text-primary underline">
                Ouvrir l’URL du produit
              </a>
            )}
          </div>
          <Link href="/product-visibility/products" className="quorum-btn-secondary">
            Retour aux produits
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="quorum-panel p-4">
            <p className="quorum-kicker">Score de visibilité</p>
            <p className="mt-2 text-3xl font-semibold quorum-text-primary">{payload.metrics.mentions > 0 ? formatPercent(payload.metrics.visibility_score) : '—'}</p>
          </div>
          <div className="quorum-panel p-4">
            <p className="quorum-kicker">Position moyenne</p>
            <p className="mt-2 text-3xl font-semibold quorum-text-primary">{formatRanking(payload.metrics.avg_position)}</p>
          </div>
          <div className="quorum-panel p-4">
            <p className="quorum-kicker">Mentions</p>
            <p className="mt-2 text-3xl font-semibold quorum-text-primary">{formatInteger(payload.metrics.mentions)}</p>
          </div>
          <div className="quorum-panel p-4">
            <p className="quorum-kicker">Sentiment</p>
            <p className="mt-2 text-3xl font-semibold quorum-text-primary">{formatSentiment(payload.metrics.sentiment)}</p>
          </div>
        </div>
      </section>

      <section className="quorum-panel p-5">
        <p className="quorum-kicker">Classement de visibilité</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] quorum-text-muted">Rang actuel</p>
            <p className="mt-2 text-3xl font-semibold quorum-text-primary">
              {payload.ranking.rank ? `#${payload.ranking.rank}` : '—'}
            </p>
            <p className="mt-1 text-xs quorum-text-muted">/{payload.ranking.total_products}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] quorum-text-muted">Produits devant</p>
            <p className="mt-2 text-3xl font-semibold quorum-text-primary">{formatInteger(payload.ranking.ahead.length)}</p>
          </div>
          <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.14em] quorum-text-muted">Écart vs période précédente</p>
            <p className="mt-2 text-3xl font-semibold quorum-text-primary">
              {payload.ranking.delta_vs_previous > 0 ? `+${payload.ranking.delta_vs_previous}` : payload.ranking.delta_vs_previous}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div>
            <p className="text-sm font-medium quorum-text-primary">Produits devant</p>
            <div className="mt-3 space-y-2">
              {payload.ranking.ahead.length > 0 ? payload.ranking.ahead.map((item) => (
                <div key={item.product_id} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
                  <p className="text-sm quorum-text-primary">{item.product}</p>
                  <p className="text-xs quorum-text-muted">{item.brand || '—'} · rang {formatRanking(item.avg_position)}</p>
                </div>
              )) : (
                <p className="text-sm quorum-text-muted">Aucun produit devant.</p>
              )}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium quorum-text-primary">Produits derrière</p>
            <div className="mt-3 space-y-2">
              {payload.ranking.behind.length > 0 ? payload.ranking.behind.map((item) => (
                <div key={item.product_id} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
                  <p className="text-sm quorum-text-primary">{item.product}</p>
                  <p className="text-xs quorum-text-muted">{item.brand || '—'} · rang {formatRanking(item.avg_position)}</p>
                </div>
              )) : (
                <p className="text-sm quorum-text-muted">Aucun produit derrière.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="quorum-panel p-5">
          <p className="quorum-kicker">Requêtes où le produit apparaît</p>
          <div className="mt-4 space-y-2">
            {payload.prompts.length > 0 ? payload.prompts.map((prompt) => (
              <div key={prompt.prompt_id} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
                <p className="text-sm quorum-text-primary">{prompt.prompt_text}</p>
                <p className="mt-1 text-xs quorum-text-muted">{formatInteger(prompt.mentions)} mentions</p>
              </div>
            )) : (
              <p className="text-sm quorum-text-muted">Aucune requête ne détecte encore ce produit.</p>
            )}
          </div>
        </div>

        <div className="quorum-panel p-5">
          <p className="quorum-kicker">Concurrents cités à proximité</p>
          <div className="mt-4 space-y-2">
            {payload.related_competitors.length > 0 ? payload.related_competitors.map((competitor) => (
              <div key={competitor.name} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm quorum-text-primary">{competitor.name}</p>
                  <span className="text-xs quorum-text-muted">{formatInteger(competitor.mentions)} mentions</span>
                </div>
              </div>
            )) : (
              <p className="text-sm quorum-text-muted">Aucune mention concurrente proche détectée.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="quorum-panel p-5">
          <p className="quorum-kicker">Sources IA associées</p>
          <div className="mt-4 space-y-2">
            {payload.sources.length > 0 ? payload.sources.map((source) => (
              <div key={source.url} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
                <p className="text-sm quorum-text-primary">{source.domain}</p>
                <p className="mt-1 text-xs quorum-text-muted">{formatSourceType(source.source_type)} · {formatInteger(source.count)} citations</p>
              </div>
            )) : (
              <p className="text-sm quorum-text-muted">Aucune source détectée pour le moment.</p>
            )}
          </div>
        </div>

        <div className="quorum-panel p-5">
          <p className="quorum-kicker">Attributs détectés</p>
          <div className="mt-4 space-y-2">
            {payload.attributes.length > 0 ? payload.attributes.map((attribute) => (
              <div key={attribute.attribute} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm quorum-text-primary">{attribute.attribute}</p>
                  <span className="text-xs quorum-text-muted">{formatInteger(attribute.count)}</span>
                </div>
              </div>
            )) : (
              <p className="text-sm quorum-text-muted">Aucun attribut détecté pour le moment.</p>
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
                <span className="text-xs uppercase tracking-[0.14em] quorum-text-muted">{formatPriority(recommendation.priority)} · {formatEffort(recommendation.effort)}</span>
              </div>
              <p className="mt-2 text-sm quorum-text-muted">{recommendation.description}</p>
            </div>
          )) : (
            <p className="text-sm quorum-text-muted">Aucune recommandation disponible pour ce produit.</p>
          )}
        </div>
      </section>
    </div>
  );
}
