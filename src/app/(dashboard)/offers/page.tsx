import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { getOfferVisibilityPlanForProject, getOffers } from '@/lib/offer-visibility/service';
import type { OfferListItem } from '@/lib/offer-visibility/types';
import { OffersListClient } from '@/components/offers/offers-list-client';

export const metadata = {
  title: 'Offres suivies | Quorum',
};

export default async function OffersPage() {
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) redirect('/login');

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return (
      <div className="rounded-3xl border quorum-border-default quorum-surface-strong p-10 text-center quorum-text-muted">
        <p className="text-sm font-medium quorum-text-primary">Aucune marque active.</p>
        <p className="mt-2 text-xs">Créez ou activez une marque pour suivre vos offres.</p>
      </div>
    );
  }

  const supabase = createAdminClient();
  let offers: OfferListItem[] = [];
  const plan = await getOfferVisibilityPlanForProject({ supabase, projectId: project.id });
  try {
    const payload = await getOffers({ supabase, projectId: project.id });
    offers = payload.offers;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de charger les offres.';
    return (
      <div className="quorum-panel-strong p-8">
        <p className="quorum-kicker">Offres suivies</p>
        <h1 className="mt-3 text-2xl font-semibold quorum-text-primary">Module en cours d’installation</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed quorum-text-muted">
          Les tables de visibilité des offres viennent d’être ajoutées. Rafraîchissez la page dans quelques secondes si Supabase termine encore la mise à jour de son cache.
        </p>
        <p className="mt-4 rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3 text-xs quorum-text-muted">
          Détail technique : {message}
        </p>
      </div>
    );
  }

  return <OffersListClient initialOffers={offers} plan={plan} />;
}
