import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Paramètres',
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Paramètres</h1>
        <p className="text-text-secondary mt-1">
          Gérez votre compte et vos préférences.
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="font-medium text-text-primary">Profil</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="label">Email</label>
              <p className="text-text-primary">{user?.email}</p>
            </div>
            <div>
              <label className="label">Nom</label>
              <p className="text-text-primary">{profile?.full_name || '—'}</p>
            </div>
            <div>
              <label className="label">Entreprise</label>
              <p className="text-text-primary">{profile?.company_name || '—'}</p>
            </div>
            <div>
              <label className="label">Membre depuis</label>
              <p className="text-text-primary">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                }) : '—'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <p className="text-sm text-text-tertiary text-center">
          Plus d'options de paramètres seront disponibles prochainement.
        </p>
      </div>
    </div>
  );
}
