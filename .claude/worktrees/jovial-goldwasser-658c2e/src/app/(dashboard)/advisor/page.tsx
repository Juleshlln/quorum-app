import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { AdvisorClient } from './advisor-client';
import type { AdvisorOutput } from '@/lib/ai/quorum-advisor';

export const metadata = { title: 'Advisor | Quorum' };

type StoredRecommendation = {
  id: string;
  generated_at: string;
  period_start: string;
  period_end: string;
  output: AdvisorOutput;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost: number | null;
};

export default async function AdvisorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return (
      <div className="rounded-3xl border quorum-border-default quorum-surface-strong p-10 text-center quorum-text-muted">
        Aucun projet actif. Créez votre marque pour commencer.
      </div>
    );
  }

  const { data: latestRaw } = await supabase
    .from('advisor_recommendations')
    .select('id, generated_at, period_start, period_end, output, model, input_tokens, output_tokens, estimated_cost')
    .eq('project_id', project.id)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const latest = (latestRaw ?? null) as StoredRecommendation | null;

  return (
    <AdvisorClient
      projectName={project.name}
      initialRecommendation={latest}
    />
  );
}
