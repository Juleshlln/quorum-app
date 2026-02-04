import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResultsExplanationBanner } from "@/components/analysis/results-explanation-banner";
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  Eye,
  Target,
  Heart,
  CheckCircle,
  XCircle,
  ChevronDown,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

// ===== METADATA =====
export async function generateMetadata() {
  return { title: "Résultats de l'analyse | Quorum" };
}

// ===== HELPER =====
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractSummaryBullets(response: string | null, maxBullets: number = 3): string[] {
  if (!response) return [];
  const sentences = response
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 250);
  if (sentences.length === 0) {
    return [response.substring(0, 150) + (response.length > 150 ? "..." : "")];
  }
  return sentences.slice(0, maxBullets);
}

// ===== TYPES =====
type RunRow = {
  id: string;
  project_id: string;
  status: string;
  created_at: string;
  objectives?: string[] | null;
  analysis_mode?: string | null;
  run_count?: number | null;
  error_message?: string | null;
  total_prompts?: number | null;
  completed_prompts?: number | null;
  score_overall: number | null;
  score_visibility: number | null;
  score_accuracy: number | null;
  score_sentiment: number | null;
};

type RunItemRow = {
  id: string;
  run_id: string;
  prompt?: string | null;
  prompt_text?: string | null;
  response?: string | null;
  ai_response?: string | null;
  provider?: string | null;
  model?: string | null;
  ai_model?: string | null;
  brand_mentioned?: boolean | null;
  mentioned?: boolean | null;
  response_time_ms?: number | null;
  latency_ms?: number | null;
  created_at?: string;
};

// ===== PAGE =====
export default async function RunResultsPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  // ✅ Await params (Next.js 15)
  const { id: projectId, runId } = await params;

  const supabase = await createClient();

  // ✅ REQUÊTE 1: Récupérer le run (SANS JOIN)
  const { data: runData, error: runError } = await supabase
    .from("analyses")
    .select("id, project_id, status, created_at, objectives, analysis_mode, run_count, error_message, total_prompts, completed_prompts")
    .eq("id", runId)
    .single();

  // Cast
  const run = runData as RunRow | null;

  // ✅ Si run introuvable → UI propre (pas de notFound())
  if (runError || !run) {
    return (
      <div className="space-y-6">
        <Link
          href="/overview"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au projet
        </Link>

        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Analyse introuvable</h1>
              <p className="text-sm text-zinc-400 mt-1">
                Cette analyse n'existe pas ou a été supprimée.
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-zinc-900/50 border border-white/[0.06]">
            <p className="text-xs text-zinc-500 mb-2">Debug info:</p>
            <div className="text-xs text-zinc-400 space-y-1 font-mono">
              <div>projectId: {projectId}</div>
              <div>runId: {runId}</div>
              <div>error: {runError?.message || "null"}</div>
              <div>code: {runError?.code || "none"}</div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Link
              href="/overview"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour au projet
            </Link>
            <Link
              href="/overview"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border border-white/[0.1] text-zinc-300 hover:bg-white/[0.05]"
            >
              Voir toutes les analyses
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ✅ REQUÊTE 2: Récupérer le projet (séparément, sans risque)
  const { data: projectData } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();

  const projectName = (projectData as { name: string } | null)?.name || "Projet";

  // ✅ REQUÊTE 3: Récupérer les run_items
  const { data: runItemsData } = await supabase
    .from("analysis_items")
    .select("*")
    .eq("analysis_id", runId)
    .order("created_at", { ascending: true });

  const items = (runItemsData as RunItemRow[] | null) || [];
  const objectives = (run?.objectives && run.objectives.length > 0)
    ? run.objectives
    : ["visibility", "position", "sentiment", "global"];

  const { data: moduleResultsData } = await supabase
    .from("analysis_module_results")
    .select("module_key, score, details")
    .eq("analysis_id", runId);

  const moduleResults = (moduleResultsData as Array<{ module_key: string; score: number | null }> | null) || [];
  const moduleMap = new Map(moduleResults.map((m) => [m.module_key, m.score]));
  const showEmptyWarning = items.length === 0;
  const analysisMode = (run?.analysis_mode as 'trend' | 'simulation' | null) ?? 'trend';
  const runCount = run?.run_count ?? 1;

  // Calculs
  const mentionedCount = items.filter(
    (item) => item.mentioned === true || item.brand_mentioned === true
  ).length;
  const totalItems = items.length;
  const mentionRate = totalItems > 0 ? Math.round((mentionedCount / totalItems) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Back link */}
      <Link
        href="/overview"
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au projet
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white">Résultats de l'analyse</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-zinc-400">
            <span>{projectName}</span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {formatDate(run.created_at)}
            </span>
          </div>
        </div>
        <StatusBadge status={run.status} />
      </div>

      <ResultsExplanationBanner mode={analysisMode} runCount={runCount} />

      {analysisMode === 'trend' && (
        <>
          {/* Score Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {objectives.includes("global") && (
              <ScoreCard
                icon={<TrendingUp className="w-5 h-5" />}
                label="Score Global"
                value={moduleMap.get("global") ?? null}
                gradient="from-blue-500 to-cyan-500"
              />
            )}
            {objectives.includes("visibility") && (
              <ScoreCard
                icon={<Eye className="w-5 h-5" />}
                label="Visibilité"
                value={moduleMap.get("visibility") ?? null}
                gradient="from-cyan-500 to-teal-500"
              />
            )}
            {objectives.includes("position") && (
              <ScoreCard
                icon={<Target className="w-5 h-5" />}
                label="Position"
                value={moduleMap.get("position") ?? null}
                gradient="from-violet-500 to-purple-500"
              />
            )}
            {objectives.includes("sentiment") && (
              <ScoreCard
                icon={<Heart className="w-5 h-5" />}
                label="Sentiment"
                value={moduleMap.get("sentiment") ?? null}
                gradient="from-pink-500 to-rose-500"
              />
            )}
          </div>

          {/* Summary */}
          <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-6">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Résumé
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <p className="text-zinc-500 text-sm mb-1">Prompts analysés</p>
                <p className="text-3xl font-semibold text-white">{run?.total_prompts ?? totalItems}</p>
                <p className="text-xs text-zinc-500 mt-1">{runCount} runs par prompt</p>
              </div>
              <div>
                <p className="text-zinc-500 text-sm mb-1">Mentions de la marque</p>
                <p className="text-3xl font-semibold text-white">
                  {mentionedCount}{" "}
                  <span className="text-lg text-zinc-500">/ {totalItems}</span>
                </p>
              </div>
              <div>
                <p className="text-zinc-500 text-sm mb-1">Taux de mention</p>
                <p className="text-3xl font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  {mentionRate}%
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {showEmptyWarning && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-200">
          Aucun résultat n’a été enregistré pour cette analyse.
          {run.error_message && (
            <span className="block mt-2 text-amber-300/90">
              Détail: {run.error_message}
            </span>
          )}
        </div>
      )}

      {/* Run Items */}
      <div>
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
          Détail des réponses ({totalItems})
        </h2>

        {totalItems === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-8 text-center text-zinc-400">
            Aucune réponse enregistrée pour cette analyse.
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => {
              const promptText = item.prompt || item.prompt_text || "—";
              const responseText = item.response || item.ai_response || null;
              const bullets = extractSummaryBullets(responseText);
              const isMentioned = item.mentioned ?? item.brand_mentioned ?? null;
              const provider = item.provider || "ChatGPT";
              const model = item.model || item.ai_model || "gpt-4o-mini";
              const responseTime = item.response_time_ms || item.latency_ms;

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-zinc-500 font-mono">#{index + 1}</span>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <span className="font-medium text-white">{provider}</span>
                      </div>
                      <span className="text-xs text-zinc-500 px-2 py-0.5 bg-zinc-800 rounded">
                        {model}
                      </span>
                    </div>
                    {isMentioned !== null && (
                      <div
                        className={`flex items-center gap-1.5 text-sm ${
                          isMentioned ? "text-cyan-400" : "text-zinc-500"
                        }`}
                      >
                        {isMentioned ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        {isMentioned ? "Mentionné" : "Non mentionné"}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5 space-y-4">
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                        Prompt
                      </p>
                      <p className="text-zinc-300">{promptText}</p>
                    </div>

                    {bullets.length > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                          Points clés
                        </p>
                        <ul className="space-y-2">
                          {bullets.map((bullet, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-sm text-zinc-400"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 mt-2 flex-shrink-0" />
                              {bullet}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {responseText && (
                      <details className="group">
                        <summary className="flex items-center gap-2 text-sm text-cyan-400 cursor-pointer hover:text-cyan-300 transition-colors">
                          <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                          Voir la réponse complète
                        </summary>
                        <div className="mt-3 p-4 rounded-xl bg-zinc-800/50 border border-white/[0.06] text-sm text-zinc-300 whitespace-pre-wrap max-h-80 overflow-y-auto">
                          {responseText}
                        </div>
                      </details>
                    )}

                    {responseTime && (
                      <p className="text-xs text-zinc-600">Temps: {responseTime}ms</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== COMPONENTS =====

function ScoreCard({
  icon,
  label,
  value,
  gradient,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  gradient: string;
}) {
  return (
    <div className="p-5 rounded-2xl border border-white/[0.08] bg-zinc-900/30">
      <div
        className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center mb-3 shadow-lg`}
      >
        <div className="text-white">{icon}</div>
      </div>
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p
        className={`text-2xl font-semibold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}
      >
        {value !== null ? `${value}%` : "—"}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    completed: {
      bg: "bg-cyan-500/10 border-cyan-500/20",
      text: "text-cyan-400",
      label: "Terminé",
    },
    running: {
      bg: "bg-blue-500/10 border-blue-500/20",
      text: "text-blue-400",
      label: "En cours",
    },
    failed: {
      bg: "bg-red-500/10 border-red-500/20",
      text: "text-red-400",
      label: "Échec",
    },
    pending: {
      bg: "bg-zinc-500/10 border-zinc-500/20",
      text: "text-zinc-400",
      label: "En attente",
    },
  };
  const { bg, text, label } = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${bg} ${text}`}>
      <CheckCircle className="w-4 h-4" />
      {label}
    </span>
  );
}
