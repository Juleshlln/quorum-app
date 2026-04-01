import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { ProjectForm } from '@/components/projects/project-form';

export const metadata = {
  title: 'Brand settings | Quorum',
};

export default async function BrandSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">Veuillez vous connecter.</p>
      </div>
    );
  }

  const project = await getActiveProjectForUser(user.id);

  if (!project) {
    return (
      <div className="rounded-3xl border quorum-border-default quorum-surface-strong p-10 text-center text-zinc-400">
        Aucun projet actif. Créez votre marque pour commencer.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="quorum-panel-strong flex items-center justify-between p-6">
        <div>
          <p className="quorum-kicker">Brand settings</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.05em] quorum-text-primary">Paramètres de marque</h1>
          <p className="mt-2 text-sm quorum-text-muted">
            Mettez à jour les informations de votre marque.
          </p>
        </div>
        <Link
          href="/overview"
          className="quorum-btn-secondary"
        >
          Retour à l’overview
        </Link>
      </div>
      <ProjectForm project={project} mode="edit" />
    </div>
  );
}
