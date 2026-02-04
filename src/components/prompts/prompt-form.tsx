"use client";

import { useState } from "react";
import { Plus, Loader2, AlertCircle } from "lucide-react";

interface PromptFormProps {
  projectId: string;
  onSuccess: (created: { id: string; prompt_text: string; is_active: boolean; created_at: string }) => void;
}

export function PromptForm({ projectId, onSuccess }: PromptFormProps) {
  const [promptText, setPromptText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!promptText.trim()) {
      setError("Le prompt ne peut pas être vide");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/runs/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          promptText: promptText.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      const data = await response.json();
      const created = {
        id: data.id,
        prompt_text: promptText.trim(),
        is_active: true,
        created_at: new Date().toISOString(),
      };
      setPromptText("");
      onSuccess(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Nouveau prompt personnalisé
        </label>
        <textarea
          value={promptText}
          onChange={(e) => {
            setPromptText(e.target.value);
            setError(null);
          }}
          placeholder="Ex: Quels sont les meilleurs logiciels de comptabilité pour PME ?"
          rows={3}
          className="w-full px-4 py-3 rounded-xl bg-zinc-900/50 border border-white/[0.08] text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50 resize-none"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Écrivez une question que vos clients potentiels pourraient poser à une IA
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !promptText.trim()}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-violet-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Plus className="w-4 h-4" />
        )}
        Ajouter le prompt
      </button>
    </form>
  );
}
