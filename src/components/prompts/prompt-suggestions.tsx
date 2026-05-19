"use client";

import { useState } from "react";
import { PROMPT_CATEGORIES, replacePromptVariables } from "@/lib/constants/suggested-prompts";
import { Plus, ChevronRight, Sparkles, Check } from "lucide-react";

interface PromptSuggestionsProps {
  brandName: string;
  industry: string;
  competitors: string[];
  onAddPrompt: (promptText: string) => void;
  existingPrompts: string[];
}

export function PromptSuggestions({
  brandName,
  industry,
  competitors,
  onAddPrompt,
  existingPrompts,
}: PromptSuggestionsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [addedPrompts, setAddedPrompts] = useState<Set<string>>(new Set());

  const competitorsStr = competitors.length > 0 ? competitors[0] : "la concurrence";

  const handleAddPrompt = (promptId: string, promptText: string) => {
    const filledPrompt = replacePromptVariables(promptText, {
      brand: brandName,
      industry: industry || "votre secteur",
      competitors: competitorsStr,
      location: "France",
    });

    if (existingPrompts.includes(filledPrompt)) return;

    onAddPrompt(filledPrompt);
    setAddedPrompts(prev => new Set([...prev, promptId]));
  };

  const isPromptAdded = (promptId: string, promptText: string) => {
    if (addedPrompts.has(promptId)) return true;
    const filledPrompt = replacePromptVariables(promptText, {
      brand: brandName,
      industry: industry || "votre secteur",
      competitors: competitorsStr,
      location: "France",
    });
    return existingPrompts.includes(filledPrompt);
  };

  const selectedCategoryData = selectedCategory
    ? PROMPT_CATEGORIES.find(c => c.id === selectedCategory)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-cyan-400" />
        <h3 className="font-semibold text-white">Suggestions de prompts</h3>
      </div>

      {!selectedCategory ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {PROMPT_CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className="group p-4 rounded-xl border border-white/[0.08] bg-zinc-900/30 hover:bg-zinc-900/50 hover:border-cyan-500/30 transition-all text-left"
            >
              <span className="text-2xl mb-2 block">{category.icon}</span>
              <h4 className="font-medium text-white text-sm group-hover:text-cyan-400">
                {category.name}
              </h4>
              <p className="text-xs text-zinc-500 mt-1">{category.description}</p>
              <div className="flex items-center gap-1 mt-2 text-xs text-zinc-600 group-hover:text-cyan-400">
                <span>{category.prompts.length} prompts</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Retour aux catégories
          </button>

          {selectedCategoryData && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/50 border border-white/[0.08]">
              <span className="text-3xl">{selectedCategoryData.icon}</span>
              <div>
                <h4 className="font-semibold text-white">{selectedCategoryData.name}</h4>
                <p className="text-sm text-zinc-400">{selectedCategoryData.description}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {selectedCategoryData?.prompts.map((prompt) => {
              const isAdded = isPromptAdded(prompt.id, prompt.text);
              const filledPrompt = replacePromptVariables(prompt.text, {
                brand: brandName,
                industry: industry || "votre secteur",
                competitors: competitorsStr,
                location: "France",
              });

              return (
                <div
                  key={prompt.id}
                  className={`p-4 rounded-xl border ${
                    isAdded
                      ? "border-cyan-500/30 bg-cyan-500/5"
                      : "border-white/[0.08] bg-zinc-900/30 hover:border-white/[0.15]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-white font-medium">{filledPrompt}</p>
                      <p className="text-xs text-zinc-500 mt-1">{prompt.description}</p>
                    </div>
                    <button
                      onClick={() => handleAddPrompt(prompt.id, prompt.text)}
                      disabled={isAdded}
                      className={`p-2 rounded-lg ${
                        isAdded
                          ? "bg-cyan-500/20 text-cyan-400"
                          : "bg-zinc-800 hover:bg-cyan-500 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}