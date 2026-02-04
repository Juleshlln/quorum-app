'use client';

import { useMemo, useState } from 'react';

type Topic = {
  id: string;
  name: string;
  is_active: boolean;
};

type MonitoringPrompt = {
  id: string;
  prompt_text: string;
  is_active: boolean;
  source: string;
  topic_id: string | null;
};

export function MonitoringPromptsClient({
  projectId,
  topics: initialTopics,
  prompts: initialPrompts,
}: {
  projectId: string;
  topics: Topic[];
  prompts: MonitoringPrompt[];
}) {
  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [prompts, setPrompts] = useState<MonitoringPrompt[]>(initialPrompts);
  const [topicName, setTopicName] = useState('');
  const [promptText, setPromptText] = useState('');
  const [activeTopic, setActiveTopic] = useState<string | 'all'>('all');

  const activeCount = prompts.filter((p) => p.is_active).length;
  const filteredPrompts = useMemo(() => {
    if (activeTopic === 'all') return prompts;
    return prompts.filter((p) => p.topic_id === activeTopic);
  }, [prompts, activeTopic]);

  const addTopic = async () => {
    const value = topicName.trim();
    if (!value) return;
    const res = await fetch('/api/monitoring/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name: value }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setTopics((prev) => [{ id: data.id, name: value, is_active: true }, ...prev]);
    setTopicName('');
  };

  const toggleTopic = async (id: string, is_active: boolean) => {
    await fetch(`/api/monitoring/topics/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    });
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, is_active } : t)));
  };

  const addPrompt = async () => {
    const value = promptText.trim();
    if (!value) return;
    const res = await fetch('/api/monitoring/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, prompt_text: value, source: 'custom', topic_id: activeTopic === 'all' ? null : activeTopic }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setPrompts((prev) => [{ id: data.id, prompt_text: value, is_active: true, source: 'custom', topic_id: activeTopic === 'all' ? null : activeTopic }, ...prev]);
    setPromptText('');
  };

  const togglePrompt = async (id: string, is_active: boolean) => {
    await fetch(`/api/monitoring/prompts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    });
    setPrompts((prev) => prev.map((p) => (p.id === id ? { ...p, is_active } : p)));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5">
        <p className="text-sm font-medium text-white">Fréquence</p>
        <p className="text-xs text-zinc-500 mt-1">Quotidienne (lecture seule, MVP)</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5 space-y-3">
          <p className="text-sm font-medium text-white">Topics</p>
          <div className="flex gap-2">
            <input
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              placeholder="Ex: Retail local"
              className="flex-1 bg-zinc-900 border border-white/10 text-sm text-white rounded-lg px-3 py-2"
            />
            <button
              onClick={addTopic}
              className="px-3 py-2 rounded-lg bg-white text-black text-sm font-medium hover:opacity-90"
            >
              Ajouter
            </button>
          </div>
          <div className="space-y-2">
            {topics.length === 0 && <p className="text-xs text-zinc-500">Aucun topic.</p>}
            {topics.map((t) => (
              <label key={t.id} className="flex items-center justify-between text-sm text-zinc-200 border border-white/10 rounded-lg px-3 py-2">
                <span>{t.name}</span>
                <input
                  type="checkbox"
                  checked={t.is_active}
                  onChange={(e) => toggleTopic(t.id, e.target.checked)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5 space-y-3">
          <p className="text-sm font-medium text-white">Prompts actifs</p>
          <p className="text-xs text-zinc-500">Actifs: {activeCount}</p>
          <div className="flex gap-2">
            <input
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Ajouter un prompt custom"
              className="flex-1 bg-zinc-900 border border-white/10 text-sm text-white rounded-lg px-3 py-2"
            />
            <button
              onClick={addPrompt}
              className="px-3 py-2 rounded-lg bg-white text-black text-sm font-medium hover:opacity-90"
            >
              Ajouter
            </button>
          </div>
          <div className="flex gap-2 text-xs text-zinc-500">
            <button
              onClick={() => setActiveTopic('all')}
              className={`px-2.5 py-1 rounded-full border ${activeTopic === 'all' ? 'border-cyan-500/40 text-cyan-300' : 'border-white/10'}`}
            >
              Tous
            </button>
            {topics.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTopic(t.id)}
                className={`px-2.5 py-1 rounded-full border ${activeTopic === t.id ? 'border-cyan-500/40 text-cyan-300' : 'border-white/10'}`}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {filteredPrompts.length === 0 && <p className="text-xs text-zinc-500">Aucun prompt.</p>}
            {filteredPrompts.map((p) => (
              <label key={p.id} className="flex items-center justify-between text-sm text-zinc-200 border border-white/10 rounded-lg px-3 py-2">
                <span>{p.prompt_text}</span>
                <input
                  type="checkbox"
                  checked={p.is_active}
                  onChange={(e) => togglePrompt(p.id, e.target.checked)}
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
