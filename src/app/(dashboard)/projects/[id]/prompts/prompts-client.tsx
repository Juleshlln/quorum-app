"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PromptForm } from "@/components/prompts/prompt-form";
import { PromptList } from "@/components/prompts/prompt-list";
import { PromptSuggestions } from "@/components/prompts/prompt-suggestions";
import { List, Sparkles } from "lucide-react";

interface Prompt {
  id: string;
  prompt_text: string;
  is_active: boolean;
  created_at: string;
}

interface PromptsClientProps {
  projectId: string;
  brandName: string;
  industry: string;
  competitors: string[];
  initialPrompts: Prompt[];
}

export function PromptsClient({
  projectId,
  brandName,
  industry,
  competitors,
  initialPrompts,
}: PromptsClientProps) {
  const router = useRouter();
  const [prompts, setPrompts] = useState<Prompt[]>(initialPrompts);
  const [activeTab, setActiveTab] = useState<"custom" | "suggestions">("custom");

  const handleAddPrompt = async (promptText: string) => {
    try {
      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, promptText }),
      });

      if (response.ok) {
        const data = await response.json();
        setPrompts(prev => [{
          id: data.id,
          prompt_text: promptText,
          is_active: true,
          created_at: new Date().toISOString(),
        }, ...prev]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePrompt = async (id: string) => {
    try {
      await fetch(`/api/prompts/${id}`, { method: "DELETE" });
      setPrompts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePrompt = async (id: string, newText: string) => {
    try {
      await fetch(`/api/prompts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptText: newText }),
      });
      setPrompts(prev => prev.map(p => p.id === id ? { ...p, prompt_text: newText } : p));
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/prompts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      setPrompts(prev => prev.map(p => p.id === id ? { ...p, is_active: isActive } : p));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-white/[0.08] bg-zinc-900/30">
          <p className="text-2xl font-semibold text-white">{prompts.length}</p>
          <p className="text-sm text-zinc-500">Total</p>
        </div>
        <div className="p-4 rounded-xl border border-white/[0.08] bg-zinc-900/30">
          <p className="text-2xl font-semibold text-cyan-400">{prompts.filter(p => p.is_active).length}</p>
          <p className="text-sm text-zinc-500">Actifs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-zinc-900/50 rounded-xl border border-white/[0.06] w-fit">
        <button
          onClick={() => setActiveTab("custom")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === "custom"
              ? "bg-gradient-to-r from-blue-500 via-cyan-500 to-violet-500 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <List className="w-4 h-4" />
          Mes prompts
        </button>
        <button
          onClick={() => setActiveTab("suggestions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
            activeTab === "suggestions"
              ? "bg-gradient-to-r from-blue-500 via-cyan-500 to-violet-500 text-white"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Suggestions
        </button>
      </div>

      {/* Content */}
      {activeTab === "custom" ? (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl border border-white/[0.08] bg-zinc-900/30">
            <PromptForm projectId={projectId} onSuccess={() => router.refresh()} />
          </div>
          <PromptList
            prompts={prompts}
            onDelete={handleDeletePrompt}
            onUpdate={handleUpdatePrompt}
            onToggleActive={handleToggleActive}
          />
        </div>
      ) : (
        <div className="p-6 rounded-2xl border border-white/[0.08] bg-zinc-900/30">
          <PromptSuggestions
            brandName={brandName}
            industry={industry}
            competitors={competitors}
            onAddPrompt={handleAddPrompt}
            existingPrompts={prompts.map(p => p.prompt_text)}
          />
        </div>
      )}
    </div>
  );
}