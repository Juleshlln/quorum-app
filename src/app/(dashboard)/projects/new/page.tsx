import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ProjectForm } from '@/components/projects/project-form';

export const metadata = {
  title: 'Nouvelle marque | Quorum',
};

export default async function ProjectsNewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="py-12 text-center">
        <p className="text-zinc-400">Veuillez vous connecter.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="quorum-panel-strong flex items-center justify-between p-6">
        <div>
          <p className="quorum-kicker">Brands</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.05em] quorum-text-primary">
            Ajouter une nouvelle marque
          </h1>
          <p className="mt-2 text-sm quorum-text-muted">
            Créez un nouveau workspace pour monitorer une autre marque dans Quorum.
          </p>
        </div>
        <Link href="/overview" className="quorum-btn-secondary">
          Retour à l’overview
        </Link>
      </div>

      <ProjectForm mode="create" />
    </div>
  );
}
