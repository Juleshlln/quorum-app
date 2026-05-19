import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import {
  buildAdvisorContext,
  callClaude,
  validateOutput,
  estimateCost,
} from '@/lib/ai/quorum-advisor';

const RATE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(_request: NextRequest) {
  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  // 2. Active project
  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return NextResponse.json({ error: 'Aucun projet actif' }, { status: 404 });
  }

  // 3. Rate limit: 1 génération / 10 min / projet
  const limitSince = new Date(Date.now() - RATE_LIMIT_MS).toISOString();
  const { data: recent } = await supabase
    .from('advisor_recommendations')
    .select('generated_at')
    .eq('project_id', project.id)
    .gte('generated_at', limitSince)
    .limit(1);

  if (recent && recent.length > 0) {
    const nextAllowed = new Date(
      new Date(recent[0].generated_at).getTime() + RATE_LIMIT_MS,
    ).toISOString();
    return NextResponse.json(
      {
        error: 'Limite atteinte. Patientez 10 minutes entre chaque génération.',
        next_allowed_at: nextAllowed,
      },
      { status: 429 },
    );
  }

  // 4. Build context
  const { context, periodStart, periodEnd, hasEnoughData } = await buildAdvisorContext(
    project.id,
    {
      name: project.name,
      industry: project.industry ?? null,
      location: project.location ?? null,
    },
  );

  if (!hasEnoughData) {
    return NextResponse.json(
      {
        error:
          'Données insuffisantes. Lancez au moins 3 jours de monitoring avant de générer une recommandation.',
      },
      { status: 422 },
    );
  }

  // 5. Call Claude
  let rawOutput: string;
  let inputTokens: number;
  let outputTokens: number;
  try {
    ({ rawOutput, inputTokens, outputTokens } = await callClaude(context));
  } catch (err) {
    console.error('[advisor] Claude API error:', err);
    return NextResponse.json(
      { error: 'Erreur lors de l\'appel à l\'IA. Vérifiez la configuration ANTHROPIC_API_KEY.' },
      { status: 502 },
    );
  }

  // 6. Validate JSON output
  let output;
  try {
    output = validateOutput(rawOutput);
  } catch (err) {
    console.error('[advisor] JSON validation failed:', err, '\nRaw:', rawOutput.slice(0, 300));
    return NextResponse.json(
      { error: 'Réponse IA invalide. Veuillez réessayer.' },
      { status: 502 },
    );
  }

  // 7. Estimate cost + log
  const estimatedCost = estimateCost(inputTokens, outputTokens);
  console.log(
    `[advisor] project=${project.id} model=claude-sonnet-4-6 tokens=${inputTokens}+${outputTokens} cost=$${estimatedCost}`,
  );

  // 8. Save to DB
  const { data: saved, error: saveError } = await supabase
    .from('advisor_recommendations')
    .insert({
      project_id: project.id,
      period_start: periodStart,
      period_end: periodEnd,
      input_snapshot: context as unknown as Record<string, unknown>,
      output: output as unknown as Record<string, unknown>,
      model: 'claude-sonnet-4-6',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost: estimatedCost,
    })
    .select()
    .single();

  if (saveError) {
    console.error('[advisor] Save error:', saveError);
    return NextResponse.json({ error: 'Erreur de sauvegarde' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, recommendation: saved });
}
