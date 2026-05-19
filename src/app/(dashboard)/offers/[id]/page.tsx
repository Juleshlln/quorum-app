import Link from 'next/link';
import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ChevronDown, CircleAlert, Eye, LineChart, Search, Share2, Target, Trophy } from 'lucide-react';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import { getOfferDetail, getOfferVisibilityPlanForProject, getOfferVisibilityPlanUsage } from '@/lib/offer-visibility/service';
import type { OfferCompetitorScore, OfferDetail, OfferMention } from '@/lib/offer-visibility/types';
import { OfferHeaderActions, OfferPromptActions } from '@/components/offers/offer-detail-actions';
import { OfferVisibilityChart } from '@/components/offers/offer-visibility-chart';
import { formatDateTime, formatPercent, formatPosition, formatScore, offerTypeLabel, priorityLabel } from '@/components/offers/offer-format';

export const metadata = {
  title: 'Détail offre suivie | Quorum',
};

export default async function OfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabaseUser = await createClient();
  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) redirect('/login');

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return (
      <div className="rounded-3xl border quorum-border-default quorum-surface-strong p-10 text-center quorum-text-muted">
        Aucune marque active. Créez votre marque pour commencer.
      </div>
    );
  }

  const supabase = createAdminClient();
  const detail = await getOfferDetail({ supabase, projectId: project.id, offerId: id });
  if (!detail) notFound();
  const [plan, usage] = await Promise.all([
    getOfferVisibilityPlanForProject({ supabase, projectId: project.id }),
    getOfferVisibilityPlanUsage({ supabase, projectId: project.id, offerId: id }),
  ]);

  return <OfferDetailView detail={detail} plan={plan} projectName={project.name} usage={usage} />;
}

function OfferDetailView({
  detail,
  plan,
  projectName,
  usage,
}: {
  detail: OfferDetail;
  plan: Awaited<ReturnType<typeof getOfferVisibilityPlanForProject>>;
  projectName: string;
  usage: Awaited<ReturnType<typeof getOfferVisibilityPlanUsage>>;
}) {
  const latestRuns = detail.runs.slice(0, 8);
  const ownBrandSeen = latestRuns.some((run) => run.mentions.some((mention) => mention.entity_type === 'own_brand'));
  const interpretation = buildOfferInterpretation(detail);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/offers" className="inline-flex items-center gap-2 text-sm quorum-text-muted hover:quorum-text-primary">
          <ArrowLeft className="h-4 w-4" />
          Offres suivies
        </Link>
      </div>

      <section className="quorum-panel-strong p-6 md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="quorum-soft-badge">{offerTypeLabel(detail.offer.type)}</span>
              <span className="quorum-soft-badge">{detail.offer.is_active ? 'Actif' : 'Inactif'}</span>
              <span className="quorum-soft-badge">{priorityLabel(detail.offer.business_priority)}</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] quorum-text-primary md:text-4xl">
              {detail.offer.name}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed quorum-text-muted">
              {detail.offer.description || 'Aucune description renseignée pour cette offre.'}
            </p>
          </div>
          <OfferHeaderActions
            offer={detail.offer}
            plan={plan}
            runsThisMonth={usage.offerRunsThisMonth || 0}
          />
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Kpi
          label="Score de visibilité IA"
          value={formatScore(detail.metrics.visibility_score)}
          icon={Eye}
          explanation="Score global sur 100 qui combine l’apparition de votre marque, son taux de recommandation et sa position moyenne dans les réponses IA."
        />
        <Kpi
          label="Apparition IA"
          value={formatPercent(detail.metrics.appearance_rate)}
          icon={CheckCircle2}
          explanation="Part des réponses analysées dans lesquelles votre marque est citée au moins une fois sur cette offre."
        />
        <Kpi
          label="Taux de recommandation"
          value={formatPercent(detail.metrics.recommendation_rate)}
          icon={Trophy}
          explanation="Part des réponses où l’IA ne fait pas que citer votre marque, mais la recommande explicitement."
        />
        <Kpi
          label="Position moyenne"
          value={formatPosition(detail.metrics.average_position)}
          icon={LineChart}
          explanation="Rang moyen de votre marque quand elle apparaît dans une liste ou un classement généré par l’IA."
        />
        <Kpi
          label="Part de visibilité"
          value={formatPercent(detail.metrics.category_share_of_voice)}
          icon={Share2}
          explanation="Part de vos mentions par rapport au total des mentions de votre marque et des concurrents sur cette offre."
        />
        <Kpi
          label="Réponses analysées"
          value={`${detail.metrics.successful_runs}/${detail.metrics.total_runs}`}
          icon={CircleAlert}
          explanation="Nombre de réponses IA exploitables par rapport au nombre total d’analyses lancées pour cette offre."
        />
      </section>

      {detail.metrics.successful_runs === 0 ? (
        <section className="quorum-panel p-8 text-center">
          <p className="text-lg font-semibold quorum-text-primary">Aucun résultat pour le moment.</p>
          <p className="mx-auto mt-2 max-w-xl text-sm quorum-text-muted">
            Lancez une première analyse pour mesurer votre visibilité IA sur cette offre.
          </p>
        </section>
      ) : null}

      <section className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
        <div className="quorum-panel p-6 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="quorum-kicker">Interprétation des données</p>
              <h2 className="mt-2 text-lg font-semibold quorum-text-primary">{interpretation.title}</h2>
            </div>
            <span className="quorum-soft-badge text-[11px]">{interpretation.tone}</span>
          </div>
          <p className="mt-5 max-w-4xl text-base leading-relaxed quorum-text-muted">{interpretation.summary}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {interpretation.points.map((point) => (
              <div key={point.label} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] quorum-text-muted">{point.label}</p>
                <p className="mt-3 text-base leading-snug quorum-text-primary">{point.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="quorum-panel p-6 md:p-7">
          <p className="quorum-kicker">Graphique clé</p>
          <h2 className="mt-2 text-lg font-semibold quorum-text-primary">Votre visibilité vs concurrents</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed quorum-text-muted">
            Marque analysée : <span className="font-semibold quorum-text-primary">{projectName}</span>. Le graphique détaille les mentions de cette marque face aux concurrents cités par l’IA.
          </p>
          <div className="mt-6">
            <OfferVisibilityChart
              brandName={projectName}
              competitors={detail.competitors}
              ownBrandMentions={detail.metrics.own_brand_mentions}
              competitorMentions={detail.metrics.competitor_mentions}
            />
          </div>
          <div className="mt-5 rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] quorum-text-muted">Concurrents cités</p>
              <span className="text-xs quorum-text-muted">{detail.metrics.competitor_mentions} mentions au total</span>
            </div>
            <div className="mt-3 space-y-2">
              {detail.competitors.length > 0 ? detail.competitors.slice(0, 5).map((competitor) => (
                <div key={competitor.name} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium quorum-text-primary">{competitor.name}</span>
                  <span className="text-xs quorum-text-muted">
                    {competitor.mentions} mentions · recommandation {formatPercent(competitor.recommendation_rate)} · position {formatPosition(competitor.average_position)}
                  </span>
                </div>
              )) : (
                <p className="text-sm quorum-text-muted">Aucun concurrent cité pour le moment.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="quorum-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="quorum-kicker">Questions suivies</p>
            <h2 className="mt-2 text-lg font-semibold quorum-text-primary">Intentions d’achat et questions IA</h2>
          </div>
          <span className="quorum-soft-badge">{detail.metrics.prompts_tracked} actives</span>
        </div>
        <div className="mt-5">
            <OfferPromptActions
              offerId={detail.offer.id}
              prompts={detail.prompts}
              intents={detail.intents}
              plan={plan}
              activePromptCount={usage.activePromptsForOffer || 0}
            />
          {detail.prompts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-4 py-6 text-center text-sm quorum-text-muted">
              Aucune question suivie. Générez des questions pour démarrer le suivi.
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="quorum-panel p-5">
          <p className="quorum-kicker">Réponses IA</p>
          <h2 className="mt-2 text-lg font-semibold quorum-text-primary">Dernières analyses</h2>
          <div className="mt-4 space-y-3">
            {latestRuns.length > 0 ? latestRuns.map((run) => {
              const own = run.mentions.find((mention) => mention.entity_type === 'own_brand');
              const competitors = run.mentions.filter((mention) => mention.entity_type === 'competitor').map((mention) => mention.entity_name);
              const answerPreview = run.answer
                ? run.answer.replace(/\s+/g, ' ').trim().slice(0, 180)
                : null;
              return (
                <article key={run.id} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] quorum-text-muted">
                      {run.ai_provider} · {run.status === 'success' ? 'Réussie' : run.status === 'failed' ? 'Échec' : 'En attente'}
                    </p>
                    <span className="text-xs quorum-text-muted">{formatDateTime(run.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium quorum-text-primary">{run.prompt}</p>
                  {run.error_message ? <p className="mt-2 text-sm text-rose-300">{run.error_message}</p> : null}
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                    <div className="rounded-xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface-soft)] px-3 py-2 quorum-text-muted">
                      Marque détectée : <span className="font-medium quorum-text-primary">{own ? 'oui' : 'non'}</span>
                    </div>
                    <div className="rounded-xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface-soft)] px-3 py-2 quorum-text-muted">
                      Concurrents : <span className="font-medium quorum-text-primary">{competitors.slice(0, 3).join(', ') || 'aucun'}</span>
                    </div>
                  </div>

                  {answerPreview || own?.evidence_quote ? (
                    <details className="group mt-3">
                      <summary className="cursor-pointer list-none text-xs font-medium quorum-text-primary transition hover:opacity-75">
                        <span className="inline-flex rounded-full border border-[color:var(--quorum-border)] bg-[var(--quorum-surface-soft)] px-3 py-2">
                          Voir le détail
                        </span>
                      </summary>
                      <div className="mt-3 rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface-soft)] px-4 py-3">
                        {answerPreview ? (
                          <>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] quorum-text-muted">Extrait</p>
                            <p className="mt-2 text-sm leading-relaxed quorum-text-muted">
                              {answerPreview}{run.answer && run.answer.length > answerPreview.length ? '…' : ''}
                            </p>
                          </>
                        ) : null}
                        {run.answer ? (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs font-medium quorum-text-primary">
                              Afficher la réponse complète
                            </summary>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed quorum-text-muted">
                              {run.answer}
                            </p>
                          </details>
                        ) : null}
                        {own?.evidence_quote ? (
                          <p className="mt-3 text-xs quorum-text-muted">
                            Preuve : {own.evidence_quote}
                          </p>
                        ) : null}
                      </div>
                    </details>
                  ) : null}
                </article>
              );
            }) : (
              <p className="rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-4 py-6 text-center text-sm quorum-text-muted">
                Aucun résultat pour le moment.
              </p>
            )}
          </div>
        </div>

        <div className="quorum-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="quorum-kicker">Concurrents visibles</p>
              <h2 className="mt-2 text-lg font-semibold quorum-text-primary">Marques recommandées à votre place</h2>
              <p className="mt-2 text-xs quorum-text-muted">
                Analyse concurrentielle face à <span className="font-semibold quorum-text-primary">{projectName}</span>. Cliquez sur une marque pour comprendre où et pourquoi elle ressort.
              </p>
            </div>
            <span className="quorum-soft-badge">{detail.competitors.length} détectés</span>
          </div>
          <div className="mt-4 space-y-3">
            {detail.competitors.length > 0 ? detail.competitors.map((competitor) => {
              const analysis = buildCompetitorAnalysis({ competitor, detail, projectName });
              return (
                <details
                  key={competitor.name}
                  className="group rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-4 transition open:bg-[var(--quorum-surface-strong)]"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold quorum-text-primary">{competitor.name}</p>
                          <span className={analysis.priorityClass}>{analysis.priorityLabel}</span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed quorum-text-muted">{analysis.summary}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full border border-[color:var(--quorum-border)] bg-[var(--quorum-surface-soft)] px-3 py-1 text-xs quorum-text-muted">
                          {competitor.mentions} apparitions
                        </span>
                        <span className="hidden rounded-full border border-[color:var(--quorum-border)] bg-[var(--quorum-surface-soft)] px-3 py-1 text-xs font-medium quorum-text-primary sm:inline-flex">
                          Voir l’analyse complète
                        </span>
                        <ChevronDown className="h-4 w-4 quorum-text-muted transition group-open:rotate-180" />
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <MiniMetric label="Recommandation" value={formatPercent(competitor.recommendation_rate)} />
                      <MiniMetric label="Position moyenne" value={formatPosition(competitor.average_position)} />
                      <MiniMetric label="Questions touchées" value={`${analysis.promptCount}/${detail.metrics.prompts_tracked || detail.prompts.length}`} />
                    </div>
                  </summary>

                  <div className="mt-4 border-t border-[color:var(--quorum-border)] pt-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 quorum-text-primary" />
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] quorum-text-muted">Lecture concurrentielle</p>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed quorum-text-muted">{analysis.interpretation}</p>
                      </div>

                      <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 quorum-text-primary" />
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] quorum-text-muted">Impact pour {projectName}</p>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed quorum-text-muted">{analysis.impact}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] quorum-text-muted">Questions où ce concurrent apparaît</p>
                      <div className="mt-2 space-y-2">
                        {analysis.prompts.length > 0 ? analysis.prompts.map((prompt) => (
                          <div key={prompt.id} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface-soft)] px-4 py-3">
                            <p className="text-sm font-medium quorum-text-primary">{prompt.prompt}</p>
                          </div>
                        )) : (
                          <p className="rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-4 py-3 text-sm quorum-text-muted">
                            Données insuffisantes pour rattacher ce concurrent à une question précise.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] quorum-text-muted">Détail des apparitions</p>
                      <div className="mt-2 space-y-2">
                        {analysis.appearances.length > 0 ? analysis.appearances.map((appearance) => (
                          <div key={`${appearance.runId}-${appearance.mentionId}`} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface-soft)] px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium quorum-text-primary">{appearance.prompt}</p>
                              <span className="text-xs quorum-text-muted">{formatDateTime(appearance.date)}</span>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                              <MiniMetric label="Position" value={formatPosition(appearance.position)} />
                              <MiniMetric label="Recommandé" value={appearance.isRecommended ? 'Oui' : 'Non'} />
                              <MiniMetric label="Confiance" value={formatConfidence(appearance.confidence)} />
                            </div>
                            {appearance.quote ? (
                              <p className="mt-3 text-sm leading-relaxed quorum-text-muted">Preuve : {appearance.quote}</p>
                            ) : null}
                          </div>
                        )) : (
                          <p className="rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-4 py-3 text-sm quorum-text-muted">
                            Aucune apparition détaillée disponible pour le moment.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] quorum-text-muted">Preuves détectées</p>
                        <div className="mt-2 space-y-2">
                          {analysis.evidence.length > 0 ? analysis.evidence.map((quote) => (
                            <p key={quote} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface-soft)] px-4 py-3 text-sm leading-relaxed quorum-text-muted">
                              “{quote}”
                            </p>
                          )) : (
                            <p className="rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-4 py-3 text-sm quorum-text-muted">
                              Aucune preuve courte n’a été extraite pour ce concurrent.
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] quorum-text-muted">Actions recommandées</p>
                        <div className="mt-2 space-y-2">
                          {analysis.actions.map((action) => (
                            <p key={action} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface-soft)] px-4 py-3 text-sm leading-relaxed quorum-text-muted">
                              {action}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              );
            }) : (
              <p className="rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-4 py-6 text-center text-sm quorum-text-muted">
                Aucun concurrent détecté dans les réponses analysées pour le moment.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="quorum-panel p-5">
          <p className="quorum-kicker">Pourquoi je suis visible ?</p>
          <h2 className="mt-2 text-lg font-semibold quorum-text-primary">Lecture business des résultats</h2>
          <div className="mt-4 space-y-3 text-sm quorum-text-muted">
            <Insight>
              {ownBrandSeen
                ? 'Votre marque apparaît dans certaines réponses. Les preuves courtes ci-dessus indiquent les angles où l’IA vous associe à cette offre.'
                : 'Votre marque n’apparaît pas encore dans les réponses analysées sur cette offre.'}
            </Insight>
            <Insight>
              {detail.competitors.length > 0
                ? `Les concurrents les plus visibles sont ${detail.competitors.slice(0, 3).map((competitor) => competitor.name).join(', ')}.`
                : 'Aucun concurrent n’est suffisamment détecté pour identifier un angle dominant.'}
            </Insight>
            <Insight>Données insuffisantes pour calculer une évolution fiable.</Insight>
          </div>
        </div>

        <div className="quorum-panel p-5">
          <p className="quorum-kicker">Actions recommandées</p>
          <h2 className="mt-2 text-lg font-semibold quorum-text-primary">Priorités éditoriales et offre</h2>
          <div className="mt-4 space-y-3">
            {detail.recommendations.map((recommendation) => (
              <div key={recommendation.id} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold quorum-text-primary">{recommendation.title}</p>
                  <span className="text-xs uppercase tracking-[0.14em] quorum-text-muted">{priorityLabel(recommendation.priority)}</span>
                </div>
                <p className="mt-2 text-sm quorum-text-muted">{recommendation.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface-soft)] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] quorum-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold quorum-text-primary">{value}</p>
    </div>
  );
}

function Kpi({
  explanation,
  icon: Icon,
  label,
  value,
}: {
  explanation: string;
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="quorum-panel group flex min-h-[210px] flex-col justify-between p-6 transition hover:border-[color:var(--quorum-border-strong)]">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-[82%] text-[12px] font-bold uppercase tracking-[0.16em] quorum-text-muted">{label}</p>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] outline-none transition group-hover:bg-[var(--quorum-surface-strong)] group-focus-within:bg-[var(--quorum-surface-strong)]"
          tabIndex={0}
          aria-label={explanation}
        >
          <Icon className="h-5 w-5 quorum-text-primary" />
        </div>
      </div>

      <div className="py-5">
        <p className="text-5xl font-semibold tracking-[-0.06em] quorum-text-primary">
          {value}
        </p>
      </div>

      <p className="text-sm leading-relaxed quorum-text-muted transition group-hover:quorum-text-primary group-focus-within:quorum-text-primary">
        {explanation}
      </p>
    </div>
  );
}

function buildCompetitorAnalysis({
  competitor,
  detail,
  projectName,
}: {
  competitor: OfferCompetitorScore;
  detail: OfferDetail;
  projectName: string;
}) {
  const mentions = getCompetitorMentions(detail, competitor);
  const appearances = getCompetitorAppearances(detail, competitor);
  const promptCount = new Set(competitor.prompts.map((prompt) => prompt.id)).size;
  const recommendationRate = competitor.recommendation_rate ?? 0;
  const averagePosition = competitor.average_position;
  const evidence = uniqueStrings(
    mentions
      .map((mention) => mention.evidence_quote?.trim())
      .filter((quote): quote is string => Boolean(quote))
  ).slice(0, 4);

  const priority = getCompetitorPriority(competitor, detail);
  const summary = `${competitor.name} apparaît ${competitor.mentions} fois sur cette offre, avec ${formatPercent(competitor.recommendation_rate)} de recommandation et une position moyenne ${formatPosition(competitor.average_position)}.`;

  const interpretation = buildCompetitorInterpretation({
    averagePosition,
    competitorName: competitor.name,
    promptCount,
    recommendationRate,
    totalPrompts: detail.metrics.prompts_tracked || detail.prompts.length,
  });

  const impact = buildCompetitorImpact({
    competitorName: competitor.name,
    projectName,
    recommendationRate,
    averagePosition,
  });

  return {
    actions: buildCompetitorActions({
      averagePosition,
      competitorName: competitor.name,
      offerName: detail.offer.name,
      recommendationRate,
    }),
    appearances,
    evidence,
    impact,
    interpretation,
    priorityClass: priority.className,
    priorityLabel: priority.label,
    promptCount,
    prompts: competitor.prompts,
    summary,
  };
}

function getCompetitorAppearances(detail: OfferDetail, competitor: OfferCompetitorScore) {
  const target = normalizeName(competitor.name);
  return detail.runs.flatMap((run) =>
    run.mentions
      .filter((mention) => mention.entity_type === 'competitor' && normalizeName(mention.entity_name) === target)
      .map((mention) => ({
        confidence: mention.confidence_score,
        date: run.created_at,
        isRecommended: mention.is_recommended,
        mentionId: mention.id,
        position: mention.position,
        prompt: run.prompt,
        quote: mention.evidence_quote,
        runId: run.id,
      }))
  );
}

function getCompetitorMentions(detail: OfferDetail, competitor: OfferCompetitorScore): OfferMention[] {
  const target = normalizeName(competitor.name);
  return detail.runs.flatMap((run) =>
    run.mentions.filter((mention) => mention.entity_type === 'competitor' && normalizeName(mention.entity_name) === target)
  );
}

function getCompetitorPriority(competitor: OfferCompetitorScore, detail: OfferDetail) {
  const totalPrompts = detail.metrics.prompts_tracked || detail.prompts.length || 1;
  const promptCoverage = new Set(competitor.prompts.map((prompt) => prompt.id)).size / totalPrompts;
  const recommendationRate = competitor.recommendation_rate ?? 0;
  const averagePosition = competitor.average_position ?? Number.POSITIVE_INFINITY;

  if (promptCoverage >= 0.4 || recommendationRate >= 0.5 || averagePosition <= 2) {
    return {
      label: 'Priorité élevée',
      className: 'rounded-full border border-rose-200/70 bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700',
    };
  }

  if (promptCoverage >= 0.2 || recommendationRate >= 0.25 || averagePosition <= 3) {
    return {
      label: 'À surveiller',
      className: 'rounded-full border border-amber-200/70 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700',
    };
  }

  return {
    label: 'Signal faible',
    className: 'rounded-full border border-[color:var(--quorum-border)] bg-[var(--quorum-surface-soft)] px-2.5 py-1 text-[11px] font-medium quorum-text-muted',
  };
}

function buildCompetitorInterpretation({
  averagePosition,
  competitorName,
  promptCount,
  recommendationRate,
  totalPrompts,
}: {
  averagePosition: number | null;
  competitorName: string;
  promptCount: number;
  recommendationRate: number;
  totalPrompts: number;
}) {
  const coverage = totalPrompts > 0 ? promptCount / totalPrompts : 0;

  if (recommendationRate >= 0.5) {
    return `${competitorName} n’est pas seulement cité : il est régulièrement recommandé. C’est le signal concurrentiel le plus fort, car l’IA le présente comme une option crédible à choisir.`;
  }

  if (averagePosition !== null && averagePosition <= 2) {
    return `${competitorName} ressort très haut dans les réponses. Même avec peu de recommandations explicites, cette position lui donne une forte visibilité au moment où l’utilisateur compare les solutions.`;
  }

  if (coverage >= 0.4) {
    return `${competitorName} apparaît sur plusieurs questions suivies. Le sujet est donc bien associé à ce concurrent dans les réponses IA, même si son niveau de recommandation reste à confirmer.`;
  }

  return `${competitorName} apparaît dans les réponses, mais le signal reste limité. Il faut surtout surveiller les questions précises où il prend la place de votre marque.`;
}

function buildCompetitorImpact({
  averagePosition,
  competitorName,
  projectName,
  recommendationRate,
}: {
  averagePosition: number | null;
  competitorName: string;
  projectName: string;
  recommendationRate: number;
}) {
  if (recommendationRate > 0) {
    return `Quand ${competitorName} est recommandé, ${projectName} risque de perdre une intention d’achat proche de la conversion. Il faut répondre directement aux mêmes questions avec des preuves plus fortes.`;
  }

  if (averagePosition !== null && averagePosition <= 3) {
    return `${competitorName} est visible dans les premières positions. Même sans recommandation explicite, il capte l’attention avant ${projectName} sur certains scénarios de recherche.`;
  }

  return `Le risque est encore modéré, mais ${competitorName} occupe déjà une partie de l’espace mental de l’IA sur cette offre. C’est un bon candidat pour une veille éditoriale.`;
}

function buildCompetitorActions({
  averagePosition,
  competitorName,
  offerName,
  recommendationRate,
}: {
  averagePosition: number | null;
  competitorName: string;
  offerName: string;
  recommendationRate: number;
}) {
  const actions = [
    `Créer ou renforcer une page dédiée à “${offerName}” qui répond aux questions où ${competitorName} apparaît.`,
    `Ajouter des preuves concrètes : avis clients, cas d’usage, délais, disponibilité, certifications et éléments de prix si possible.`,
  ];

  if (recommendationRate >= 0.25) {
    actions.push(`Préparer un contenu comparatif ou une page “alternative à ${competitorName}” si cette comparaison est pertinente commercialement.`);
  }

  if (averagePosition !== null && averagePosition <= 3) {
    actions.push(`Travailler les contenus de type “meilleur fournisseur”, “où acheter” et “comment choisir” pour reprendre les premières positions.`);
  }

  return actions;
}

function buildOfferInterpretation(detail: OfferDetail) {
  const metrics = detail.metrics;
  const score = metrics.visibility_score;
  const appearance = metrics.appearance_rate;
  const recommendation = metrics.recommendation_rate;
  const share = metrics.category_share_of_voice;
  const topCompetitor = detail.competitors[0]?.name || null;

  if (metrics.successful_runs === 0) {
    return {
      title: 'Aucune conclusion fiable pour le moment',
      tone: 'Données insuffisantes',
      summary: 'Aucune analyse réussie n’est disponible sur cette offre. Lancez une première analyse pour obtenir une lecture fiable de votre présence IA.',
      points: [
        { label: 'Priorité', value: 'Lancer une analyse' },
        { label: 'Donnée clé', value: '0 réponse analysée' },
        { label: 'Confiance', value: 'Insuffisante' },
      ],
    };
  }

  const weakRecommendation = recommendation !== null && appearance !== null && recommendation < appearance;
  const strongVisibility = score !== null && score >= 70;
  const mediumVisibility = score !== null && score >= 40;

  let title = 'Visibilité à renforcer';
  let tone = 'Attention';
  let summary = `Votre marque est visible sur ${detail.offer.name}, mais les signaux montrent encore des opportunités d’amélioration.`;

  if (strongVisibility && !weakRecommendation) {
    title = 'Bonne visibilité IA';
    tone = 'Favorable';
    summary = `Votre marque est bien positionnée sur ${detail.offer.name}. Les IA vous citent et vous recommandent sur une part solide des questions suivies.`;
  } else if (strongVisibility && weakRecommendation) {
    title = 'Visible, mais pas assez recommandée';
    tone = 'À optimiser';
    summary = `Votre marque apparaît souvent, mais elle n’est pas recommandée aussi souvent qu’elle est citée. Il faut renforcer les preuves qui justifient le choix de votre offre.`;
  } else if (mediumVisibility) {
    summary = `Votre visibilité est intermédiaire : les IA connaissent l’offre, mais les concurrents captent encore une partie importante des recommandations.`;
  } else {
    summary = `Votre marque est peu visible sur cette offre. Il faut créer ou renforcer les contenus qui répondent directement aux intentions d’achat suivies.`;
  }

  return {
    title,
    tone,
    summary,
    points: [
      {
        label: 'Ce que ça veut dire',
        value: appearance !== null && appearance >= 0.75
          ? 'Les IA vous citent souvent.'
          : 'Les IA ne vous citent pas assez souvent.',
      },
      {
        label: 'Risque principal',
        value: topCompetitor
          ? `${topCompetitor} capte une partie de la visibilité.`
          : 'Aucun concurrent dominant détecté.',
      },
      {
        label: 'Action prioritaire',
        value: share !== null && share >= 0.5
          ? 'Transformer les citations en recommandations.'
          : 'Renforcer la page et les preuves dédiées à cette offre.',
      },
    ],
  };
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase('fr-FR');
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function formatConfidence(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'Non évaluée';
  return formatPercent(value);
}

function Insight({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
      {children}
    </div>
  );
}
