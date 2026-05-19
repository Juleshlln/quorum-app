import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createMonitoringRun, executeMonitoringRun } from '@/lib/monitoring/run-orchestrator';
import {
  backfillProductVisibilityResultsForRun,
  buildWindowFromDays,
  generateProductVisibilityPrompts,
  generateProductVisibilityRecommendations,
} from '@/lib/product-visibility/service';
import { requireActiveProjectForProductVisibility } from '@/lib/product-visibility/request';

export const runtime = 'nodejs';
export const maxDuration = 300;

function errorMessage(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (typeof error === 'object') {
    const record = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      error?: unknown;
    };
    const parts = [record.message, record.details, record.hint, record.error, record.code]
      .map((part) => typeof part === 'string' ? part.trim() : '')
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' · ');
  }
  return fallback;
}

/**
 * Résout la liste des IDs de prompts à exécuter pour le scope "Visibilité produit".
 * Stratégie en deux niveaux :
 *   1. prompts marqués prompt_origin='product_visibility' et is_active=true
 *   2. à défaut, prompts actifs liés via monitoring_prompt_products (M:N produits)
 * Retourne [] si rien n'est trouvé : l'appelant doit alors générer des prompts.
 */
async function resolveProductVisibilityPromptIds(args: {
  supabase: any;
  projectId: string;
}): Promise<string[]> {
  const byOrigin = await args.supabase
    .from('monitoring_prompts')
    .select('id')
    .eq('project_id', args.projectId)
    .eq('prompt_origin', 'product_visibility')
    .eq('is_active', true);

  if (!byOrigin.error && Array.isArray(byOrigin.data) && byOrigin.data.length > 0) {
    return (byOrigin.data as Array<{ id: string }>).map((row) => row.id);
  }

  const relations = await args.supabase
    .from('monitoring_prompt_products')
    .select('prompt_id')
    .eq('project_id', args.projectId);

  if (relations.error) {
    throw new Error(errorMessage(relations.error, 'Impossible de lire les liens entre requêtes IA et produits.'));
  }

  const candidateIds = Array.from(new Set(
    ((relations.data || []) as Array<{ prompt_id: string | null }>)
      .map((row) => row.prompt_id)
      .filter((id): id is string => Boolean(id)),
  ));

  if (candidateIds.length === 0) return [];

  const linkedPrompts = await args.supabase
    .from('monitoring_prompts')
    .select('id, is_active')
    .eq('project_id', args.projectId)
    .in('id', candidateIds);

  if (linkedPrompts.error) {
    throw new Error(errorMessage(linkedPrompts.error, 'Impossible de lire les requêtes IA liées aux produits.'));
  }

  return ((linkedPrompts.data || []) as Array<{ id: string; is_active: boolean | null }>)
    .filter((prompt) => prompt.is_active !== false)
    .map((prompt) => prompt.id);
}

export async function POST() {
  const context = await requireActiveProjectForProductVisibility();
  if (context.error) return context.error;

  let stage = 'initialisation';

  try {
    const supabase = createAdminClient();

    stage = 'checking_openai_key';
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Clé API IA manquante. Ajoutez votre clé pour lancer une analyse réelle.',
        },
        { status: 400 },
      );
    }

    stage = 'checking_product_prompts';
    let productPromptIds = await resolveProductVisibilityPromptIds({
      supabase,
      projectId: context.project.id,
    });

    if (productPromptIds.length === 0) {
      stage = 'generating_product_prompts';
      await generateProductVisibilityPrompts({
        supabase,
        projectId: context.project.id,
        persist: true,
        activateValid: true,
      });

      stage = 'rechecking_product_prompts';
      productPromptIds = await resolveProductVisibilityPromptIds({
        supabase,
        projectId: context.project.id,
      });
    }

    if (productPromptIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Aucune requête produit active. Ajoutez un produit suivi, puis générez les requêtes IA produit avant de lancer une analyse réelle.',
        },
        { status: 400 },
      );
    }

    stage = 'creating_monitoring_run';
    const { run } = await createMonitoringRun({
      supabase,
      projectId: context.project.id,
      windowDays: 30,
      createdBy: context.user.id,
      force: true,
    });

    stage = 'executing_monitoring_run';
    // Scope critique : on n'exécute QUE les prompts produit, pas tous les prompts
    // actifs du projet. Évite la pollution des résultats par les prompts Radar IA
    // génériques et limite la consommation OpenAI.
    const execution = await executeMonitoringRun({
      supabase,
      runId: run.id,
      promptIds: productPromptIds,
    });

    const requestsAnalyzed = execution.summary?.runs || 0;
    const responsesCollected = execution.summary?.answers || 0;

    if (requestsAnalyzed === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Aucune requête IA n’a été exécutée. Vérifiez que les requêtes produit sont actives.',
          run_id: run.id,
          run_status: execution.status,
          summary: {
            requests_analyzed: requestsAnalyzed,
            responses_collected: responsesCollected,
            status: execution.status,
          },
        },
        { status: 422 },
      );
    }

    if (responsesCollected === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Analyse lancée, mais aucune réponse IA réelle n’a été collectée. Vérifiez la clé API, les modèles configurés et les journaux du run.',
          run_id: run.id,
          run_status: execution.status,
          summary: {
            requests_analyzed: requestsAnalyzed,
            responses_collected: responsesCollected,
            status: execution.status,
          },
        },
        { status: 422 },
      );
    }

    stage = 'syncing_product_visibility_results';
    const productResults = await backfillProductVisibilityResultsForRun({
      supabase,
      projectId: context.project.id,
      runId: run.id,
      brandName: context.project.name,
    });

    if (productResults.parsed === 0) {
      const details = productResults.errors?.length
        ? ` Détail technique : ${productResults.errors.join(' | ')}`
        : '';
      return NextResponse.json(
        {
          ok: false,
          error: `Les réponses IA ont été collectées, mais aucun résultat de visibilité produit n’a pu être synchronisé.${details}`,
          run_id: run.id,
          run_status: execution.status,
          summary: {
            requests_analyzed: requestsAnalyzed,
            responses_collected: responsesCollected,
            product_answers_found: productResults.answers,
            product_results_synced: productResults.parsed,
            product_results_failed: productResults.failed,
            product_results_skipped: productResults.skipped,
            product_sync_errors: productResults.errors,
            status: execution.status,
          },
        },
        { status: 422 },
      );
    }

    stage = 'generating_recommendations';
    const recommendations = await generateProductVisibilityRecommendations({
      supabase,
      projectId: context.project.id,
      window: buildWindowFromDays(30),
      persist: true,
    });

    return NextResponse.json({
      ok: true,
      message: 'Analyse terminée',
      run_id: run.id,
      run_status: execution.status,
      summary: {
        requests_analyzed: requestsAnalyzed,
        responses_collected: responsesCollected,
        product_answers_found: productResults.answers,
        product_results_synced: productResults.parsed,
        product_results_failed: productResults.failed,
        product_results_skipped: productResults.skipped,
        product_sync_errors: productResults.errors,
        status: execution.status,
      },
      generated_recommendations: recommendations.recommendations.length,
      last_run_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = errorMessage(error, 'Impossible de lancer l’analyse de visibilité produit.');
    const friendlyMessage = message.includes('OPENAI_API_KEY')
      ? 'Clé API IA manquante. Ajoutez votre clé pour lancer une analyse réelle.'
      : message;

    return NextResponse.json(
      {
        ok: false,
        error: friendlyMessage,
        stage,
      },
      { status: 500 },
    );
  }
}
