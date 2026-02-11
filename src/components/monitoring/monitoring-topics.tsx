'use client';

import { useMemo, useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, CircleDashed, Search, Sparkles } from 'lucide-react';

type Topic = {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
};

type Question = {
  id: string;
  prompt_text: string;
  is_active: boolean;
  source: string;
  topic_id: string | null;
  country?: string | null;
  language?: string | null;
  intent?: string | null;
  tags?: string[] | null;
};

type PromptTemplate = {
  id: string;
  prompt_text: string;
  topic_slug?: string | null;
};

const INTENTS = [
  { value: 'information', label: 'Information' },
  { value: 'comparison', label: 'Comparaison' },
  { value: 'recommendation', label: 'Recommandation' },
  { value: 'purchase', label: 'Achat' },
];

export function MonitoringTopics({
  projectId,
  topics: initialTopics,
  questions: initialQuestions,
  templates,
}: {
  projectId: string;
  topics: Topic[];
  questions: Question[];
  templates: PromptTemplate[];
}) {
  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [selectedTopicId, setSelectedTopicId] = useState<string | 'unassigned' | null>(
    initialTopics[0]?.id || 'unassigned'
  );
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'single' | 'bulk'>('single');
  const [form, setForm] = useState({
    text: '',
    topicId: initialTopics[0]?.id || '',
    country: 'France',
    language: 'Français',
    intent: 'information',
    tags: '',
  });
  const [bulkText, setBulkText] = useState('');
  const [filterTab, setFilterTab] = useState<'active' | 'inactive' | 'suggested'>('active');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTopicId && selectedTopicId !== 'unassigned') {
      setForm((prev) => ({ ...prev, topicId: selectedTopicId }));
    }
  }, [selectedTopicId]);

  const questionsByTopic = useMemo(() => {
    const map = new Map<string, Question[]>();
    topics.forEach((t) => map.set(t.id, []));
    questions.forEach((q) => {
      if (!q.topic_id) return;
      const list = map.get(q.topic_id) || [];
      list.push(q);
      map.set(q.topic_id, list);
    });
    return map;
  }, [topics, questions]);

  const unassigned = useMemo(() => questions.filter((q) => !q.topic_id), [questions]);

  const selectedQuestions = useMemo(() => {
    if (!selectedTopicId) return [];
    if (selectedTopicId === 'unassigned') return unassigned;
    return questionsByTopic.get(selectedTopicId) || [];
  }, [selectedTopicId, questionsByTopic, unassigned]);

  const templatesByTopic = useMemo(() => {
    const map = new Map<string, PromptTemplate[]>();
    topics.forEach((topic) => {
      const slug = topic.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      const matches = templates.filter((t) => t.topic_slug === slug);
      map.set(topic.id, matches);
    });
    return map;
  }, [templates, topics]);

  const suggestedForSelected = useMemo(() => {
    if (!selectedTopicId || selectedTopicId === 'unassigned') return [];
    const existing = new Set(selectedQuestions.map((q) => q.prompt_text.trim().toLowerCase()));
    return (templatesByTopic.get(selectedTopicId) || []).filter(
      (t) => !existing.has(t.prompt_text.trim().toLowerCase())
    );
  }, [selectedTopicId, selectedQuestions, templatesByTopic]);

  const filteredQuestions = useMemo(() => {
    const base = selectedQuestions.filter((q) => {
      if (filterTab === 'active' && !q.is_active) return false;
      if (filterTab === 'inactive' && q.is_active) return false;
      return true;
    });
    if (!search.trim()) return base;
    const term = search.toLowerCase();
    return base.filter((q) => q.prompt_text.toLowerCase().includes(term));
  }, [selectedQuestions, filterTab, search]);

  const coverage = useMemo(() => {
    const totalRecommended = templates.length || 1;
    const active = questions.filter((q) => q.is_active).length;
    return Math.min(100, Math.round((active / totalRecommended) * 100));
  }, [questions, templates]);

  const addTopic = async () => {
    const name = newTopicName.trim();
    if (!name) return;
    const res = await fetch('/api/monitoring/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name, description: newTopicDesc || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data?.error || 'Impossible de créer l’enjeu.');
      return;
    }
    const topic = { id: data.id, name, description: newTopicDesc || null, is_active: true };
    setTopics((prev) => [topic, ...prev]);
    setSelectedTopicId(topic.id);
    setNewTopicName('');
    setNewTopicDesc('');
  };

  const deleteTopic = async (topicId: string) => {
    if (!confirm('Supprimer cet enjeu ? Les questions restent disponibles sans enjeu.')) return;
    const res = await fetch(`/api/monitoring/topics/${topicId}`, { method: 'DELETE' });
    if (!res.ok) {
      setMessage('Impossible de supprimer l’enjeu.');
      return;
    }
    setTopics((prev) => prev.filter((t) => t.id !== topicId));
    setQuestions((prev) => prev.map((q) => (q.topic_id === topicId ? { ...q, topic_id: null } : q)));
    setSelectedTopicId('unassigned');
  };

  const toggleTopic = async (topicId: string, isActive: boolean) => {
    await fetch(`/api/monitoring/topics/${topicId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive }),
    });
    setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, is_active: isActive } : t)));
  };

  const toggleQuestion = async (questionId: string, isActive: boolean) => {
    await fetch(`/api/monitoring/prompts/${questionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive }),
    });
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, is_active: isActive } : q)));
  };

  const assignQuestion = async (questionId: string, topicId: string) => {
    await fetch(`/api/monitoring/prompts/${questionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_id: topicId }),
    });
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, topic_id: topicId } : q)));
  };

  const runSandboxTest = async () => {
    setTestMessage(null);
    const res = await fetch('/api/analyses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        objectives: ['visibility'],
        objective: 'visibility',
        analysis_mode: 'simulation',
        run_count: 1,
        prompts: [{ text: form.text, category: 'visibility', type: 'custom' }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTestMessage(data?.error || 'Erreur test.');
      return;
    }
    setTestMessage('Résultat de test disponible. Vous pouvez activer cette question.');
  };

  const addQuestion = async (overrideText?: string, overrideSource?: 'custom' | 'template') => {
    const rawText =
      typeof overrideText === 'string'
        ? overrideText
        : typeof form.text === 'string'
          ? form.text
          : '';
    const text = rawText.trim();
    if (!text) return;
    const res = await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        prompt_text: text,
        topic_id: form.topicId || null,
        source: overrideSource || 'custom',
        country: form.country,
        language: form.language,
        intent: form.intent,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data?.error || 'Impossible d’ajouter la question.');
      return;
    }
    setQuestions((prev) => [
      {
        id: data.id,
        prompt_text: text,
        is_active: true,
        source: overrideSource || 'custom',
        topic_id: form.topicId || null,
        country: form.country,
        language: form.language,
        intent: form.intent,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      },
      ...prev,
    ]);
    setModalOpen(false);
    setForm({ ...form, text: '', tags: '' });
    setTestMessage(null);
  };

  const addBulkQuestions = async () => {
    const lines = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const created: Question[] = [];
    for (const line of lines) {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          prompt_text: line,
          topic_id: form.topicId || null,
          source: 'custom',
          country: form.country,
          language: form.language,
          intent: form.intent,
          tags: form.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error || 'Impossible d’ajouter une question.');
        return;
      }
      created.push({
        id: data.id,
        prompt_text: line,
        is_active: true,
        source: 'custom',
        topic_id: form.topicId || null,
        country: form.country,
        language: form.language,
        intent: form.intent,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
    }
    setQuestions((prev) => [...created, ...prev]);
    setBulkText('');
    setModalOpen(false);
  };

  const topicsWithCounts = topics.map((t) => ({
    ...t,
    count: (questionsByTopic.get(t.id) || []).length,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">Monitoring</h1>
        <p className="text-zinc-400 mt-1">
          Surveillez des enjeux business via des questions analysées quotidiennement.
        </p>
        <p className="text-xs text-zinc-500 mt-2">
          {topics.length} enjeux • {questions.filter((q) => q.is_active).length} questions actives • Analyse quotidienne
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4 text-sm text-zinc-300 flex items-center justify-between">
        <span>Couverture du monitoring</span>
        <span className="text-white font-medium">{coverage}%</span>
      </div>

      {message && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-4 space-y-4">
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 uppercase">Enjeux</p>
            <button
              onClick={() => setSelectedTopicId('unassigned')}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                selectedTopicId === 'unassigned' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5'
              }`}
            >
              Questions sans enjeu ({unassigned.length})
            </button>
            {topicsWithCounts.map((topic) => (
              <button
                key={topic.id}
                onClick={() => setSelectedTopicId(topic.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  selectedTopicId === topic.id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:bg-white/5'
                }`}
              >
                {topic.name} <span className="text-xs text-zinc-500">({topic.count})</span>
              </button>
            ))}
          </div>

          <div className="border-t border-white/5 pt-4 space-y-2">
            <p className="text-xs text-zinc-500 uppercase">Créer un enjeu</p>
            <input
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="Nom de l’enjeu"
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
            <input
              value={newTopicDesc}
              onChange={(e) => setNewTopicDesc(e.target.value)}
              placeholder="Description (optionnel)"
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
            <button
              onClick={addTopic}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black"
            >
              <Plus className="h-4 w-4" />
              Créer l’enjeu
            </button>
          </div>
        </aside>

        <section className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-zinc-500">Détail de l’enjeu</p>
              <h2 className="text-xl font-semibold text-white">
                {selectedTopicId === 'unassigned'
                  ? 'Questions sans enjeu'
                  : topics.find((t) => t.id === selectedTopicId)?.name || 'Enjeu'}
              </h2>
            </div>
            {selectedTopicId && selectedTopicId !== 'unassigned' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleTopic(selectedTopicId, !(topics.find((t) => t.id === selectedTopicId)?.is_active))}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
                >
                  {(topics.find((t) => t.id === selectedTopicId)?.is_active)
                    ? <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                    : <CircleDashed className="h-3 w-3 text-orange-300" />}
                  {(topics.find((t) => t.id === selectedTopicId)?.is_active) ? 'Actif' : 'Inactif'}
                </button>
                <button
                  onClick={() => deleteTopic(selectedTopicId)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
                >
                  <Trash2 className="h-3 w-3" />
                  Supprimer
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/60 px-2 py-1 text-xs text-zinc-300">
              <Search className="h-3 w-3" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une question"
                className="bg-transparent outline-none text-xs text-zinc-200 w-48"
              />
            </div>
            <button
              onClick={() => setFilterTab('active')}
              className={`px-3 py-1 rounded-full text-xs border ${filterTab === 'active' ? 'border-cyan-500/40 text-cyan-300' : 'border-white/10 text-zinc-400'}`}
            >
              Actives
            </button>
            <button
              onClick={() => setFilterTab('inactive')}
              className={`px-3 py-1 rounded-full text-xs border ${filterTab === 'inactive' ? 'border-cyan-500/40 text-cyan-300' : 'border-white/10 text-zinc-400'}`}
            >
              Inactives
            </button>
            <button
              onClick={() => setFilterTab('suggested')}
              className={`px-3 py-1 rounded-full text-xs border ${filterTab === 'suggested' ? 'border-cyan-500/40 text-cyan-300' : 'border-white/10 text-zinc-400'}`}
            >
              Suggérées
            </button>
          </div>

          <div className="space-y-3">
            {filterTab !== 'suggested' && filteredQuestions.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-6 text-sm text-zinc-400">
                Aucune question pour cet enjeu pour le moment.
              </div>
            )}
            {filterTab !== 'suggested' && filteredQuestions.map((q) => (
              <div key={q.id} className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{q.prompt_text}</p>
                  <p className="text-xs text-zinc-500">
                    {q.intent || 'Information'} · {q.language || 'Français'} · {q.country || 'France'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={q.is_active}
                      onChange={(e) => toggleQuestion(q.id, e.target.checked)}
                    />
                    {q.is_active ? 'Actif' : 'Inactif'}
                  </label>
                  {selectedTopicId === 'unassigned' && topics[0] && (
                    <button
                      onClick={() => assignQuestion(q.id, topics[0].id)}
                      className="text-xs text-cyan-300 underline"
                    >
                      Ajouter à {topics[0].name}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {filterTab === 'suggested' && (
              <div className="space-y-3">
                {suggestedForSelected.length === 0 && (
                  <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-6 text-sm text-zinc-400">
                    Aucune recommandation supplémentaire.
                  </div>
                )}
                {suggestedForSelected.map((template) => (
                  <div key={template.id} className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 space-y-3">
                    <p className="text-sm text-white">{template.prompt_text}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          if (selectedTopicId && selectedTopicId !== 'unassigned') {
                            setForm((prev) => ({ ...prev, topicId: selectedTopicId, text: template.prompt_text }));
                          } else {
                            setForm((prev) => ({ ...prev, text: template.prompt_text }));
                          }
                          setModalTab('single');
                          setModalOpen(true);
                        }}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
                      >
                        Tester maintenant
                      </button>
                      <button
                        onClick={() => {
                          if (selectedTopicId && selectedTopicId !== 'unassigned') {
                            setForm((prev) => ({ ...prev, topicId: selectedTopicId }));
                          }
                          addQuestion(template.prompt_text, 'template');
                        }}
                        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-black"
                      >
                        Activer dans le monitoring
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (selectedTopicId && selectedTopicId !== 'unassigned') {
                  setForm((prev) => ({ ...prev, topicId: selectedTopicId }));
                }
                setModalOpen(true);
              }}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Ajouter une question
            </button>
            {selectedTopicId && selectedTopicId !== 'unassigned' && (
              <button
                onClick={() => setSelectedTopicId('unassigned')}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300"
              >
                Voir les questions sans enjeu
              </button>
            )}
          </div>
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-zinc-950 border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Ajouter une question</h3>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400">Fermer</button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setModalTab('single')}
                className={`px-3 py-1 rounded-full text-xs border ${modalTab === 'single' ? 'border-cyan-500/40 text-cyan-300' : 'border-white/10 text-zinc-400'}`}
              >
                Ajout unique
              </button>
              <button
                onClick={() => setModalTab('bulk')}
                className={`px-3 py-1 rounded-full text-xs border ${modalTab === 'bulk' ? 'border-cyan-500/40 text-cyan-300' : 'border-white/10 text-zinc-400'}`}
              >
                Bulk upload
              </button>
            </div>
            {modalTab === 'single' ? (
              <textarea
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                placeholder="Ex : Quel est le meilleur CRM pour PME ?"
                className="w-full min-h-[100px] rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
            ) : (
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Une question par ligne"
                className="w-full min-h-[140px] rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
            )}
            <p className="text-xs text-zinc-500">
              Les questions ne doivent pas citer votre marque.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-zinc-500">Enjeu</label>
                <select
                  value={form.topicId}
                  onChange={(e) => setForm({ ...form, topicId: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500">Intention</label>
                <select
                  value={form.intent}
                  onChange={(e) => setForm({ ...form, intent: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                >
                  {INTENTS.map((intent) => (
                    <option key={intent.value} value={intent.value}>
                      {intent.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-500">Pays</label>
                <input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500">Langue</label>
                <input
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Tags (optionnel, séparés par virgule)</label>
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
              />
            </div>

            {testMessage && (
              <div className="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-300">
                {testMessage}
              </div>
            )}

            <div className="flex items-center justify-between">
              {modalTab === 'single' ? (
                <button
                  onClick={runSandboxTest}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300"
                >
                  Tester maintenant
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <Sparkles className="h-4 w-4" />
                  Chaque ligne devient une question active
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300"
                >
                  Annuler
                </button>
                {modalTab === 'single' ? (
                  <button
                    onClick={() => addQuestion()}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
                  >
                    Ajouter au monitoring
                  </button>
                ) : (
                  <button
                    onClick={addBulkQuestions}
                    className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
                  >
                    Importer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
