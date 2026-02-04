import { createClient } from '@/lib/supabase/server';

type ProjectRow = {
  id: string;
  user_id: string;
  name: string;
  website: string | null;
  description: string | null;
  location: string | null;
  industry: string | null;
  keywords: string[] | null;
};

// MVP single-brand: ensure one active project per user.
export async function getActiveProjectForUser(userId: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_project_id')
    .eq('id', userId)
    .single();

  if (profile?.active_project_id) {
    const { data: project } = await supabase
      .from('projects')
      .select('*')
      .eq('id', profile.active_project_id)
      .eq('user_id', userId)
      .single();

    if (project) return project as ProjectRow;
  }

  const { data: existing } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  const fallback = existing?.[0] as ProjectRow | undefined;
  if (fallback) {
    await supabase
      .from('profiles')
      .update({ active_project_id: fallback.id })
      .eq('id', userId);
    return fallback;
  }

  const { data: created, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name: 'Brand',
    })
    .select('*')
    .single();

  if (error || !created) return null;

  await supabase
    .from('profiles')
    .update({ active_project_id: created.id })
    .eq('id', userId);

  return created as ProjectRow;
}
