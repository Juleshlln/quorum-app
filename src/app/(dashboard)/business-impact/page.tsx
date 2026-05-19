import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { getBusinessImpactOverview } from '@/lib/business-impact/service';
import { BusinessImpactDashboard } from '@/components/business-impact/business-impact-dashboard';
import { getBusinessImpactMigrationHelp, isBusinessImpactSchemaMissingError } from '@/lib/business-impact/errors';

export const metadata = {
  title: 'Business Impact | Quorum',
};

function subtractDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

function formatWindowLabel(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const end = new Date(`${endDate}T00:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return `${start} → ${end}`;
}

export default async function BusinessImpactPage() {
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

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = subtractDays(new Date(), 29).toISOString().slice(0, 10);
  const supabase = createAdminClient();

  try {
    const overview = await getBusinessImpactOverview({
      supabase,
      projectId: project.id,
      projectWebsite: project.website,
      startDate,
      endDate,
    });

    return (
      <BusinessImpactDashboard
        windowLabel={formatWindowLabel(startDate, endDate)}
        {...overview}
      />
    );
  } catch (error) {
    if (isBusinessImpactSchemaMissingError(error)) {
      const help = getBusinessImpactMigrationHelp();
      return (
        <div className="space-y-6">
          <section className="quorum-panel-strong p-6 md:p-7">
            <p className="quorum-kicker">Business Impact</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] quorum-text-primary md:text-4xl">
              Le schéma Business Impact n’est pas encore appliqué à la base.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed quorum-text-muted">
              Le code de la feature est présent, mais Supabase ne connaît pas encore les tables `analytics_connections`, `traffic_daily_page_metrics`, `ai_attribution_events` et `brand_search_daily`.
            </p>
          </section>

          <section className="quorum-panel p-6">
            <p className="quorum-kicker">Fix</p>
            <div className="mt-4 space-y-3 text-sm quorum-text-primary">
              <p>Applique la migration puis recharge la page :</p>
              <pre className="overflow-x-auto rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3 text-sm">
                <code>{help.command}</code>
              </pre>
              <p className="quorum-text-muted">
                Migration attendue : {help.migrationFile}
              </p>
            </div>
          </section>
        </div>
      );
    }

    throw error;
  }
}
