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
      <div className="quorum-panel-strong p-6">
        <p className="quorum-kicker">Monitoring</p>
        <h1 className="mt-2 text-4xl font-bold tracking-[-0.05em] quorum-text-primary">Cadrez vos enjeux et vos prompts</h1>
        <p className="mt-2 text-sm quorum-text-muted">
          Surveillez des enjeux business via des questions analysées quotidiennement.
        </p>
        <p className="text-xs quorum-text-subtle mt-4">
          {topics.length} enjeux • {questions.filter((q) => q.is_active).length} questions actives • Analyse quotidienne
        </p>
      </div>

      <div className="quorum-panel flex items-center justify-between p-4 text-sm quorum-text-muted">
        <span>Couverture du monitoring</span>
        <span className="text-2xl font-bold tracking-[-0.04em] quorum-text-primary">{coverage}%</span>
      </div>

      {message && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="quorum-panel p-4 space-y-5">
          <div className="space-y-2">
            <p className="quorum-kicker">Enjeux</p>
            <button
              onClick={() => setSelectedTopicId('unassigned')}
              className={`w-full rounded-2xl px-3 py-3 text-left text-sm transition-all ${
                selectedTopicId === 'unassigned' ? 'border quorum-border-strong quorum-surface-strong quorum-text-primary' : 'quorum-text-muted hover:quorum-surface hover:quorum-text-primary'
              }`}
            >
              Questions sans enjeu ({unassigned.length})
            </button>
            {topicsWithCounts.map((topic) => (
              <button
                key={topic.id}
                onClick={() => setSelectedTopicId(topic.id)}
                className={`w-full rounded-2xl px-3 py-3 text-left text-sm transition-all ${
                  selectedTopicId === topic.id ? 'border quorum-border-strong quorum-surface-strong quorum-text-primary' : 'quorum-text-muted hover:quorum-surface hover:quorum-text-primary'
                }`}
              >
                {topic.name} <span className="text-xs quorum-text-subtle">({topic.count})</span>
              </button>
            ))}
          </div>

          <div className="border-t quorum-border-default pt-4 space-y-3">
            <p className="quorum-kicker">Créer un enjeu</p>
            <input
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="Nom de l’enjeu"
              className="quorum-input"
            />
            <input
              value={newTopicDesc}
              onChange={(e) => setNewTopicDesc(e.target.value)}
              placeholder="Description (optionnel)"
              className="quorum-input"
            />
            <button
              onClick={addTopic}
              className="quorum-btn-primary w-full"
            >
              <Plus className="h-4 w-4" />
              Créer l’enjeu
            </button>
          </div>
        </aside>

        <section className="quorum-panel-strong p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="quorum-kicker">Détail de l’enjeu</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] quorum-text-primary">
                {selectedTopicId === 'unassigned'
                  ? 'Questions sans enjeu'
                  : topics.find((t) => t.id === selectedTopicId)?.name || 'Enjeu'}
              </h2>
            </div>
            {selectedTopicId && selectedTopicId !== 'unassigned' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleTopic(selectedTopicId, !(topics.find((t) => t.id === selectedTopicId)?.is_active))}
                  className="quorum-chip"
                >
                  {(topics.find((t) => t.id === selectedTopicId)?.is_active)
                    ? <CheckCircle2 className="h-3 w-3 text-emerald-300" />
                    : <CircleDashed className="h-3 w-3 text-amber-300" />}
                  {(topics.find((t) => t.id === selectedTopicId)?.is_active) ? 'Actif' : 'Inactif'}
                </button>
                <button
                  onClick={() => deleteTopic(selectedTopicId)}
                  className="quorum-chip"
                >
                  <Trash2 className="h-3 w-3" />
                  Supprimer
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border quorum-border-default quorum-surface-strong px-3 py-1.5 text-xs quorum-text-muted">
              <Search className="h-3 w-3" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une question"
                className="w-48 bg-transparent text-xs quorum-text-primary outline-none placeholder:quorum-text-subtle"
              />
            </div>
            <button
              onClick={() => setFilterTab('active')}
              className={`quorum-chip ${filterTab === 'active' ? 'quorum-chip-active' : ''}`}
            >
              Actives
            </button>
            <button
              onClick={() => setFilterTab('inactive')}
              className={`quorum-chip ${filterTab === 'inactive' ? 'quorum-chip-active' : ''}`}
            >
              Inactives
            </button>
            <button
              onClick={() => setFilterTab('suggested')}
              className={`quorum-chip ${filterTab === 'suggested' ? 'quorum-chip-active' : ''}`}
            >
              Suggérées
            </button>
          </div>

          <div className="space-y-3">
            {filterTab !== 'suggested' && filteredQuestions.length === 0 && (
              <div className="quorum-panel-soft p-6 text-sm quorum-text-muted">
                Aucune question pour cet enjeu pour le moment.
              </div>
            )}
            {filterTab !== 'suggested' && filteredQuestions.map((q) => (
              <div key={q.id} className="quorum-panel-soft flex items-center justify-between p-4">
                <div>
                  <p className="text-sm quorum-text-primary">{q.prompt_text}</p>
                  <p className="text-xs quorum-text-muted">
                    {q.intent || 'Information'} · {q.language || 'Français'} · {q.country || 'France'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-xs quorum-text-muted">
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
                      className="text-xs quorum-text-primary underline underline-offset-2"
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
                  <div className="quorum-panel-soft p-6 text-sm quorum-text-muted">
                    Aucune recommandation supplémentaire.
                  </div>
                )}
                {suggestedForSelected.map((template) => (
                  <div key={template.id} className="quorum-panel-soft p-4 space-y-3">
                    <p className="text-sm quorum-text-primary">{template.prompt_text}</p>
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
                        className="quorum-chip"
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
                        className="quorum-btn-primary px-3 py-1.5 text-xs"
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
              className="quorum-btn-primary"
            >
              Ajouter une question
            </button>
            {selectedTopicId && selectedTopicId !== 'unassigned' && (
              <button
                onClick={() => setSelectedTopicId('unassigned')}
                className="quorum-btn-secondary"
              >
                Voir les questions sans enjeu
              </button>
            )}
          </div>
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center quorum-backdrop px-4">
          <div className="quorum-panel-strong w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold quorum-text-primary">Ajouter une question</h3>
              <button onClick={() => setModalOpen(false)} className="quorum-text-muted hover:quorum-text-primary">Fermer</button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setModalTab('single')}
                className={`quorum-chip ${modalTab === 'single' ? 'quorum-chip-active' : ''}`}
              >
                Ajout unique
              </button>
              <button
                onClick={() => setModalTab('bulk')}
                className={`quorum-chip ${modalTab === 'bulk' ? 'quorum-chip-active' : ''}`}
              >
                Bulk upload
              </button>
            </div>
            {modalTab === 'single' ? (
              <textarea
                value={form.text}
                onChange={(e) => setForm({ ...form, text: e.target.value })}
                placeholder="Ex : Quel est le meilleur CRM pour PME ?"
                className="quorum-textarea min-h-[100px]"
              />
            ) : (
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Une question par ligne"
                className="quorum-textarea min-h-[140px]"
              />
            )}
            <p className="text-xs quorum-text-subtle">
              Les questions ne doivent pas citer votre marque.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="quorum-label text-xs">Enjeu</label>
                <select
                  value={form.topicId}
                  onChange={(e) => setForm({ ...form, topicId: e.target.value })}
                  className="quorum-select"
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="quorum-label text-xs">Intention</label>
                <select
                  value={form.intent}
                  onChange={(e) => setForm({ ...form, intent: e.target.value })}
                  className="quorum-select"
                >
                  {INTENTS.map((intent) => (
                    <option key={intent.value} value={intent.value}>
                      {intent.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="quorum-label text-xs">Pays</label>
                <input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="quorum-input"
                />
              </div>
              <div>
                <label className="quorum-label text-xs">Langue</label>
                <input
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="quorum-input"
                />
              </div>
            </div>
            <div>
              <label className="quorum-label text-xs">Tags (optionnel, séparés par virgule)</label>
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className="quorum-input"
              />
            </div>

            {testMessage && (
              <div className="quorum-panel-soft px-3 py-2 text-xs quorum-text-muted">
                {testMessage}
              </div>
            )}

            <div className="flex items-center justify-between">
              {modalTab === 'single' ? (
                <button
                  onClick={runSandboxTest}
                  className="quorum-btn-secondary"
                >
                  Tester maintenant
                </button>
              ) : (
                <div className="flex items-center gap-2 text-xs quorum-text-muted">
                  <Sparkles className="h-4 w-4" />
                  Chaque ligne devient une question active
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="quorum-btn-secondary"
                >
                  Annuler
                </button>
                {modalTab === 'single' ? (
                  <button
                    onClick={() => addQuestion()}
                    className="quorum-btn-primary"
                  >
                    Ajouter au monitoring
                  </button>
                ) : (
                  <button
                    onClick={addBulkQuestions}
                    className="quorum-btn-primary"
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
