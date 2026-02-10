import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';

export const metadata = {
  title: 'Concurrents | Quorum',
};

export default async function ConcurrentsRedirectPage() {
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

  redirect(`/projects/${project.id}/concurrents`);
}
