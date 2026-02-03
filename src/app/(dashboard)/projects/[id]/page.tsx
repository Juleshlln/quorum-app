import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowLeft,
  TrendingUp,
  Eye,
  Target,
  Heart,
  ChevronRight,
  Settings,
  Play,
  MessageSquare,
} from "lucide-react";

// ===== TYPES =====
type ProjectRow = {
  id: string;
  name: string;
  brand_name?: string | null;
  website?: string | null;
  industry?: string | null;
  description?: string | null;
  created_at: string;
};

type RunRow = {
  id: string;
  project_id: string;
  status: string;
  created_at: string;
  score_overall: number | null;
  score_visibility: number | null;
  score_accuracy: number | null;
  score_sentiment: number | null;
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ✅ CORRECTION : await params avant d'utiliser .id
  const { id: projectId } = await params;
  
  const supabase = await createClient();

  // --- Project ---
  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  const project = (projectData as ProjectRow | null) ?? null;

  if (projectError || !project) {
    return (
      <div className="space-y-6">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux projets
        </Link>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <h1 className="text-xl font-semibold text-white">Projet introuvable</h1>
          <p className="mt-2 text-sm text-zinc-300">ID: {projectId}</p>
        </div>
      </div>
    );
  }

  // --- Runs ---
  const { data: runsData } = await supabase
    .from("runs")
    .select("id, project_id, status, created_at, score_overall, score_visibility, score_accuracy, score_sentiment")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);

  const safeRuns: RunRow[] = Array.isArray(runsData) ? (runsData as RunRow[]) : [];

  const completedRuns = safeRuns.filter(
    (r) => r && r.status === "completed" && r.score_overall !== null
  );

  const lastCompletedRun = completedRuns.length > 0 ? completedRuns[0] : null;

  const scoreOverall = lastCompletedRun?.score_overall ?? 0;
  const scoreVisibility = lastCompletedRun?.score_visibility ?? 0;
  const scoreAccuracy = lastCompletedRun?.score_accuracy ?? 0;
  const scoreSentiment = lastCompletedRun?.score_sentiment ?? 0;

  const projectName = project.name ?? "Projet";
  const projectWebsite = project.website ?? null;
  const projectIndustry = project.industry ?? null;

  return (
    <div className="space-y-8">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/projects"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux projets
        </Link>

        <div className="flex items-center gap-3">
          {/* Bouton Lancer une analyse */}
          <Link
            href={`/projects/${projectId}/runs/new`}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90"
          >
            <Play className="w-4 h-4" />
            Lancer une analyse
          </Link>

          <Link
            href={`/projects/${projectId}/prompts`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-zinc-900/30 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900/50 hover:text-white transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Prompts
          </Link>

          <Link
            href={`/projects/${projectId}/edit`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-zinc-900/30 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900/50 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            Modifier
          </Link>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/30 via-cyan-500/20 to-violet-500/20 border border-white/[0.08] flex items-center justify-center text-white font-bold text-xl">
          {projectName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="text-3xl font-semibold text-white">{projectName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
            {projectWebsite && (
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                {projectWebsite.replace(/^https?:\/\//, "")}
              </span>
            )}
            {projectIndustry && (
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                {projectIndustry}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard
          label="Score Global"
          value={scoreOverall}
          icon={<TrendingUp className="w-5 h-5" />}
          gradient="from-blue-500 to-cyan-500"
        />
        <ScoreCard
          label="Visibilité"
          value={scoreVisibility}
          icon={<Eye className="w-5 h-5" />}
          gradient="from-cyan-500 to-teal-500"
        />
        <ScoreCard
          label="Position"
          value={scoreAccuracy}
          icon={<Target className="w-5 h-5" />}
          gradient="from-violet-500 to-purple-500"
        />
        <ScoreCard
          label="Sentiment"
          value={scoreSentiment}
          icon={<Heart className="w-5 h-5" />}
          gradient="from-pink-500 to-rose-500"
        />
      </div>

      {/* Recent Analyses */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Analyses récentes
          </h2>
          {safeRuns.length > 0 && (
            <Link
              href={`/projects/${projectId}/runs`}
              className="text-sm text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
            >
              Voir tout
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {safeRuns.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-8 text-center">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-violet-500/20 border border-white/[0.1] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Play className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-white font-medium mb-2">Aucune analyse</h3>
            <p className="text-zinc-400 text-sm">
              Lancez votre première analyse pour voir comment les IA perçoivent votre marque.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {safeRuns.slice(0, 8).map((run) => (
              <Link
                key={run.id}
                href={`/projects/${projectId}/runs/${run.id}`}
                className="block rounded-xl border border-white/[0.06] bg-zinc-900/30 hover:bg-zinc-900/50 hover:border-white/[0.1] transition-colors p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm text-white font-medium">
                      Analyse {run.id.slice(0, 8)}…
                    </div>
                    <div className="text-xs text-zinc-500">
                      {new Date(run.created_at).toLocaleString("fr-FR")}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPill status={run.status} />
                    <div className="text-sm font-semibold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                      {run.score_overall ?? 0}%
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== COMPOSANTS LOCAUX =====

function ScoreCard({
  label,
  value,
  icon,
  gradient,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <div className="p-5 rounded-2xl border border-white/[0.08] bg-zinc-900/30">
      <div className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center mb-3 shadow-lg`}>
        <div className="text-white">{icon}</div>
      </div>
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-semibold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
        {Math.round(value)}%
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    running: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
    pending: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  const labels: Record<string, string> = {
    completed: "Terminé",
    running: "En cours",
    failed: "Échec",
    pending: "En attente",
  };
  const cls = map[status] ?? map.pending;
  return (
    <span className={`text-xs px-2.5 py-1 rounded-lg border ${cls}`}>
      {labels[status] ?? status}
    </span>
  );
}