import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { projectId, promptText } = await request.json();

    if (!projectId || !promptText) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }
    const trimmedPrompt = String(promptText).trim();
    if (!trimmedPrompt) {
      return NextResponse.json({ error: "Prompt invalide" }, { status: 400 });
    }

    // Vérifier que le projet appartient à l'utilisateur
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Projet non trouvé" }, { status: 404 });
    }

    // Créer le prompt
    const { data: newPrompt, error } = await supabase
      .from("prompt_templates")
      .insert({
        project_id: projectId,
        name: trimmedPrompt.slice(0, 60),
        prompt_text: trimmedPrompt,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ error: "Erreur création" }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: newPrompt.id });
  } catch (error) {
    console.error("POST error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
