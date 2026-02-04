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
      <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-10 text-center text-zinc-400">
        Aucun projet actif. Créez votre marque pour commencer.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Brand settings</h1>
          <p className="text-zinc-400 mt-1">
            Mettez à jour les informations de votre marque.
          </p>
        </div>
        <Link
          href="/overview"
          className="text-sm text-zinc-400 hover:text-white"
        >
          Retour à l’overview
        </Link>
      </div>
      <ProjectForm project={project} mode="edit" />
    </div>
  );
}
