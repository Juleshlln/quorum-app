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
} from "lucide-react";
import { StartRunButton } from "@/components/runs/start-run-button";

// Types explicites pour éviter les erreurs TypeScript
type ProjectRow = {
  id: string;
  name: string;
  brand_name?: string | null;
  website?: string | null;
  industry?: string | null;
  description?: string | null;
  brand?: string | null;
  keywords?: string[] | null;
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
  const { id: projectId } = await params;
  const supabase = await createClient();

  // Fetch project
  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  // Cast explicite pour TypeScript
  const project = projectData as ProjectRow | null;

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
          <p className="mt-2 text-sm text-zinc-300">
            La page n'arrive pas à charger le projet. Causes fréquentes :
          </p>
          <ul className="mt-3 list-disc pl-6 text-sm text-zinc-300 space-y-1">
            <li>Le projet n'existe pas (id incorrect).</li>
            <li>RLS Supabase bloque la lecture (droits).</li>
            <li>Table / schéma différent.</li>
          </ul>
          <div className="mt-4 text-xs text-zinc-400 space-y-1">
            <div>
              <span className="text-zinc-500">projectId:</span> {projectId}
            </div>
            <div>
              <span className="text-zinc-500">Détail Supabase:</span>{" "}
              {projectError?.message || "Aucun message"}
            </div>
          </div>
          <div className="mt-6">
            <Link
              href="/projects"
              className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-400 hover:to-cyan-400"
            >
              Revenir à la liste des projets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fetch runs
  const { data: runsData, error: runsError } = await supabase
    .from("runs")
    .select("id, project_id, status, created_at, score_overall, score_visibility, score_accuracy, score_sentiment")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);

  // Cast explicite
  const safeRuns: RunRow[] = runsError || !runsData ? [] : (runsData as RunRow[]);
  const lastCompletedRun = safeRuns.find((r) => r.status === "completed") ?? null;

  const scoreOverall = lastCompletedRun?.score_overall ?? 0;
  const scoreVisibility = lastCompletedRun?.score_visibility ?? 0;
  const scoreAccuracy = lastCompletedRun?.score_accuracy ?? 0;
  const scoreSentiment = lastCompletedRun?.score_sentiment ?? 0;

  // Mini chart : 10 derniers runs complétés
  const history = safeRuns
    .filter((r) => r.status === "completed" && r.score_overall !== null)
    .slice(0, 10)
    .reverse();

  const historyPoints = history.map((r) => r.score_overall ?? 0);

  // Champs safe
  const projectName = project.name ?? "Projet";
  const projectWebsite = project.website ?? null;
  const projectIndustry = project.industry ?? null;
  const projectBrandText = project.brand_name ?? project.description ?? null;

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
          <StartRunButton projectId={projectId} projectName={projectName} />
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
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-2">
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
                    {projectWebsite.replace(/^https?:\/\//, '')}
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
          {projectBrandText && (
            <p className="text-zinc-400 max-w-2xl">{projectBrandText}</p>
          )}
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

      {/* Evolution + détail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              Évolution du score
            </h2>
            <span className="text-xs text-zinc-500">
              {history.length ? `${history.length} derniers runs` : "—"}
            </span>
          </div>
          <ScoreHistoryChart points={historyPoints} />
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-6">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
            Détail des scores
          </h2>
          <div className="space-y-4">
            <ProgressRow label="Score Global" value={scoreOverall} color="from-blue-500 to-cyan-500" />
            <ProgressRow label="Visibilité" value={scoreVisibility} color="from-cyan-500 to-teal-500" />
            <ProgressRow label="Position" value={scoreAccuracy} color="from-violet-500 to-purple-500" />
            <ProgressRow label="Sentiment" value={scoreSentiment} color="from-pink-500 to-rose-500" />
          </div>
        </div>
      </div>

      {/* Analyses récentes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
            Analyses récentes
          </h2>
          <Link
            href={`/projects/${projectId}/runs`}
            className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors inline-flex items-center gap-1"
          >
            Voir tout
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {safeRuns.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-8 text-center">
            <p className="text-zinc-400 mb-4">
              Aucune analyse pour le moment. Lancez une analyse pour voir l'historique ici.
            </p>
            <StartRunButton projectId={projectId} projectName={projectName} />
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
                      {(run.score_overall ?? 0)}%
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

/* ===== UI Components ===== */

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

function ProgressRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-300">{label}</span>
        <span className={`font-medium bg-gradient-to-r ${color} bg-clip-text text-transparent`}>{v}%</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${v}%` }}
        />
      </div>
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

function ScoreHistoryChart({ points }: { points: number[] }) {
  const safe = points.length ? points : [0, 0, 0, 0, 0, 0, 0, 0];
  return (
    <div className="h-32 flex items-end gap-2">
      {safe.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-gradient-to-t from-blue-600 via-cyan-500 to-violet-500 hover:opacity-80 transition-opacity cursor-pointer group relative"
          style={{ height: `${Math.max(6, Math.min(100, v))}%` }}
        >
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
            {v}%
          </span>
        </div>
      ))}
    </div>
  );
}
