"use client";

import { useState } from "react";
import { Trash2, Edit2, Loader2, Check, X } from "lucide-react";

interface Prompt {
  id: string;
  prompt_text: string;
  is_active: boolean;
  created_at: string;
}

interface PromptListProps {
  prompts: Prompt[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, newText: string) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

export function PromptList({ prompts, onDelete, onUpdate, onToggleActive }: PromptListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleStartEdit = (prompt: Prompt) => {
    setEditingId(prompt.id);
    setEditText(prompt.prompt_text);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editText.trim()) return;
    setLoadingId(id);
    await onUpdate(id, editText.trim());
    setEditingId(null);
    setEditText("");
    setLoadingId(null);
  };

  const handleDelete = async (id: string) => {
    setLoadingId(id);
    await onDelete(id);
    setDeletingId(null);
    setLoadingId(null);
  };

  if (prompts.length === 0) {
    return (
      <div className="text-center py-12 rounded-2xl border border-dashed border-white/[0.1] bg-zinc-900/20">
        <p className="text-zinc-500">Aucun prompt personnalisé</p>
        <p className="text-sm text-zinc-600 mt-1">
          Ajoutez vos propres prompts ou utilisez les suggestions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {prompts.map((prompt, index) => (
        <div
          key={prompt.id}
          className={`rounded-xl border transition-all ${
            prompt.is_active
              ? "border-white/[0.08] bg-zinc-900/30"
              : "border-white/[0.05] bg-zinc-900/10 opacity-60"
          }`}
        >
          {editingId === prompt.id ? (
            <div className="p-4 space-y-3">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-white/[0.1] text-white text-sm focus:outline-none focus:border-cyan-500/50 resize-none"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveEdit(prompt.id)}
                  disabled={loadingId === prompt.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 text-white text-sm rounded-lg hover:bg-cyan-600 disabled:opacity-50"
                >
                  {loadingId === prompt.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Sauvegarder
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1.5 text-zinc-400 text-sm rounded-lg hover:text-white hover:bg-zinc-800"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : deletingId === prompt.id ? (
            <div className="p-4">
              <p className="text-sm text-zinc-300 mb-3">Supprimer ce prompt ?</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDelete(prompt.id)}
                  disabled={loadingId === prompt.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-50"
                >
                  {loadingId === prompt.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Supprimer
                </button>
                <button
                  onClick={() => setDeletingId(null)}
                  className="px-3 py-1.5 text-zinc-400 text-sm rounded-lg hover:text-white hover:bg-zinc-800"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-xs text-zinc-600 font-mono pt-1">#{index + 1}</span>
                <div className="flex-1">
                  <p className="text-white">{prompt.prompt_text}</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Ajouté le {new Date(prompt.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onToggleActive(prompt.id, !prompt.is_active)}
                  className={`p-2 rounded-lg ${prompt.is_active ? "text-cyan-400" : "text-zinc-600"}`}
                  title={prompt.is_active ? "Désactiver" : "Activer"}
                >
                  <div className={`w-8 h-4 rounded-full relative ${prompt.is_active ? "bg-cyan-500" : "bg-zinc-700"}`}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${prompt.is_active ? "left-4" : "left-0.5"}`} />
                  </div>
                </button>
                <button
                  onClick={() => handleStartEdit(prompt)}
                  className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeletingId(prompt.id)}
                  className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}