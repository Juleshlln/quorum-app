import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowLeft, MessageSquare, Info } from "lucide-react";
import { PromptsClient } from "./prompts-client";

export default async function PromptsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const supabase = await createClient();

  // Récupérer le projet
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, industry, brand_name")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return (
      <div className="space-y-6">
        <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <h1 className="text-xl font-semibold text-white">Projet introuvable</h1>
        </div>
      </div>
    );
  }

  // Récupérer les concurrents
  const { data: competitors } = await supabase
    .from("competitors")
    .select("name")
    .eq("project_id", projectId);

  // Récupérer les prompts existants
  const { data: prompts } = await supabase
    .from("prompt_templates")
    .select("id, prompt_text, is_active, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour au projet
      </Link>

      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/30 to-pink-500/20 border border-white/[0.08] flex items-center justify-center">
          <MessageSquare className="w-7 h-7 text-violet-400" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold text-white">Prompts personnalisés</h1>
          <p className="text-zinc-400 mt-1">{project.name}</p>
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-blue-400 mb-1">Comment ça fonctionne ?</p>
          <p className="text-zinc-400">
            Les prompts sont les questions envoyées aux IA pour tester si votre marque est mentionnée.
            Personnalisez-les pour des analyses plus pertinentes.
          </p>
        </div>
      </div>

      <PromptsClient
        projectId={projectId}
        brandName={project.brand_name || project.name}
        industry={project.industry || ""}
        competitors={(competitors || []).map((c: { name: string }) => c.name)}
        initialPrompts={prompts || []}
      />
    </div>
  );
}