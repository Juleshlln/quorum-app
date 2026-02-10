'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, Bolt, CheckCircle2, CircleDashed, Plus, ShieldCheck, Target, Trash2 } from 'lucide-react';

type Topic = {
  id: string;
  name: string;
  is_active: boolean;
};

type MonitoringQuestion = {
  id: string;
  prompt_text: string;
  is_active: boolean;
  source: string;
  topic_id: string | null;
  template_id?: string | null;
};

type PromptTemplate = {
  id: string;
  title?: string | null;
  prompt_text: string;
  primary_objective?: string | null;
  secondary_objectives?: string[];
  topic_slug?: string | null;
  is_default_monitoring?: boolean | null;
};

type TopicDelta = {
  topic_id: string;
  delta: number | null;
};

const ICONS = [Target, ShieldCheck, Bolt];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

export function MonitoringDashboard({
  projectId,
  topics: initialTopics,
  questions: initialQuestions,
  templates,
  topicDeltas,
}: {
  projectId: string;
  topics: Topic[];
  questions: MonitoringQuestion[];
  templates: PromptTemplate[];
  topicDeltas: TopicDelta[];
}) {
  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [questions, setQuestions] = useState<MonitoringQuestion[]>(initialQuestions);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [newTopicName, setNewTopicName] = useState('');
  const [customQuestionByTopic, setCustomQuestionByTopic] = useState<Record<string, string>>({});
  const [monitoringStatus, setMonitoringStatus] = useState<'idle' | 'running' | 'skipped' | 'error'>('idle');
  const [monitoringMessage, setMonitoringMessage] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, 'idle' | 'running' | 'done' | 'error'>>({});
  const [testMessage, setTestMessage] = useState<Record<string, string | null>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const activeTopicsCount = topics.filter((t) => t.is_active).length;
  const activeQuestionsCount = questions.filter((q) => q.is_active).length;

  const questionsByTopic = useMemo(() => {
    const map = new Map<string, MonitoringQuestion[]>();
    topics.forEach((t) => map.set(t.id, []));
    questions.forEach((q) => {
      if (!q.topic_id) return;
      const list = map.get(q.topic_id) || [];
      list.push(q);
      map.set(q.topic_id, list);
    });
    return map;
  }, [topics, questions]);

  const unassignedQuestions = useMemo(
    () => questions.filter((q) => !q.topic_id),
    [questions]
  );

  const deltasByTopic = useMemo(() => {
    const map = new Map<string, number | null>();
    topicDeltas.forEach((d) => map.set(d.topic_id, d.delta));
    return map;
  }, [topicDeltas]);

  const templatesByTopic = useMemo(() => {
    const map = new Map<string, PromptTemplate[]>();
    topics.forEach((topic) => {
      const slug = slugify(topic.name);
      const matches = templates.filter((t) => t.topic_slug === slug);
      map.set(topic.id, matches);
    });
    return map;
  }, [templates, topics]);


  const addTopic = async () => {
    const value = newTopicName.trim();
    if (!value) return;
    setLocalError(null);
    const res = await fetch('/api/monitoring/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name: value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLocalError(data?.error || 'Impossible de créer l’enjeu.');
      return;
    }
    const newTopic = { id: data.id, name: value, is_active: true };
    setTopics((prev) => [newTopic, ...prev]);
    setNewTopicName('');
    setExpandedTopics((prev) => new Set(prev).add(newTopic.id));
  };

  const toggleTopic = async (id: string, is_active: boolean) => {
    await fetch(`/api/monitoring/topics/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    });
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, is_active } : t)));
  };

  const addQuestion = async (text: string, topicId: string | null, source: string, templateId?: string | null) => {
    const value = text.trim();
    if (!value) return;
    setLocalError(null);
    const res = await fetch('/api/monitoring/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        prompt_text: value,
        source,
        topic_id: topicId,
        template_id: templateId || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLocalError(data?.error || 'Impossible d’ajouter la question.');
      return;
    }
    setQuestions((prev) => [
      { id: data.id, prompt_text: value, is_active: true, source, topic_id: topicId, template_id: templateId || null },
      ...prev,
    ]);
    if (source === 'custom' && topicId) {
      setCustomQuestionByTopic((prev) => ({ ...prev, [topicId]: '' }));
    }
  };

  const toggleQuestion = async (id: string, is_active: boolean) => {
    await fetch(`/api/monitoring/prompts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    });
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, is_active } : q)));
  };

  const assignQuestionToTopic = async (questionId: string, topicId: string) => {
    await fetch(`/api/monitoring/prompts/${questionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_id: topicId }),
    });
    setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, topic_id: topicId } : q)));
  };

  const deleteTopic = async (topicId: string) => {
    if (!confirm('Supprimer cet enjeu ? Les questions seront conservées sans enjeu.')) return;
    const res = await fetch(`/api/monitoring/topics/${topicId}`, { method: 'DELETE' });
    if (!res.ok) {
      setLocalError('Impossible de supprimer l’enjeu.');
      return;
    }
    setTopics((prev) => prev.filter((t) => t.id !== topicId));
    setQuestions((prev) => prev.map((q) => (q.topic_id === topicId ? { ...q, topic_id: null } : q)));
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      next.delete(topicId);
      return next;
    });
  };

  const saveQuestionEdit = async () => {
    if (!editingId) return;
    const value = editingValue.trim();
    if (!value) return;
    const current = questions.find((q) => q.id === editingId);
    if (current && current.prompt_text.trim() !== value) {
      const confirmed = confirm(
        'Modifier le texte crée une nouvelle version et démarre une nouvelle série de monitoring. Continuer ?'
      );
      if (!confirmed) return;
    }
    const res = await fetch(`/api/monitoring/prompts/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_text: value }),
    });
    if (!res.ok) return;
    setQuestions((prev) => prev.map((q) => (q.id === editingId ? { ...q, prompt_text: value } : q)));
    setEditingId(null);
    setEditingValue('');
  };

  const runSandboxTest = async (text: string) => {
    const value = text.trim();
    if (!value) return;
    setTestStatus((prev) => ({ ...prev, [value]: 'running' }));
    setTestMessage((prev) => ({ ...prev, [value]: null }));
    try {
      const res = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          objectives: ['visibility'],
          objective: 'visibility',
          analysis_mode: 'simulation',
          run_count: 1,
          prompts: [{ text: value, category: 'visibility', type: 'custom' }],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestStatus((prev) => ({ ...prev, [value]: 'error' }));
        setTestMessage((prev) => ({ ...prev, [value]: data?.error || 'Erreur test.' }));
      } else {
        setTestStatus((prev) => ({ ...prev, [value]: 'done' }));
        setTestMessage((prev) => ({ ...prev, [value]: 'Résultat de test disponible.' }));
      }
    } catch {
      setTestStatus((prev) => ({ ...prev, [value]: 'error' }));
      setTestMessage((prev) => ({ ...prev, [value]: 'Erreur réseau.' }));
    }
  };

  const renderDelta = (delta: number | null) => {
    if (delta === null || Number.isNaN(delta)) {
      return '—';
    }
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta}% (7 jours)`;
  };

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-white">Monitoring automatique</h1>
          <p className="text-zinc-400">
            {activeTopicsCount} enjeux surveillés • {activeQuestionsCount} questions actives • Analyse quotidienne
          </p>
        </div>
      </div>

      {monitoringStatus !== 'idle' && (
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 px-4 py-3 text-sm text-zinc-300">
          {monitoringMessage ||
            (monitoringStatus === 'error'
              ? 'Impossible de lancer le monitoring. Réessaie dans un instant.'
              : 'Monitoring en cours...')}
        </div>
      )}

      {localError && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {localError}
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          value={newTopicName}
          onChange={(e) => setNewTopicName(e.target.value)}
          placeholder="Créer un nouvel enjeu"
          className="flex-1 rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-sm text-white"
        />
        <button
          onClick={addTopic}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Créer un enjeu
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {topics.map((topic, index) => {
          const Icon = ICONS[index % ICONS.length];
          const topicQuestions = questionsByTopic.get(topic.id) || [];
          const activeCount = topicQuestions.filter((q) => q.is_active).length;
          const delta = deltasByTopic.get(topic.id) ?? null;
          const isExpanded = expandedTopics.has(topic.id);

          return (
            <div key={topic.id} className="rounded-3xl border border-white/[0.08] bg-zinc-900/40 p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-violet-500/20 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">{topic.name}</p>
                    <p className="text-sm text-zinc-400">
                      {activeCount} questions analysées quotidiennement
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleTopic(topic.id, !topic.is_active)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                      topic.is_active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-orange-500/15 text-orange-200'
                    }`}
                  >
                    {topic.is_active ? <CheckCircle2 className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
                    {topic.is_active ? 'Actif' : 'Inactif'}
                  </button>
                  <button
                    onClick={() => deleteTopic(topic.id)}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium border border-white/10 text-zinc-300"
                  >
                    <Trash2 className="h-3 w-3" />
                    Supprimer
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Dernière évolution</span>
                <span className="text-zinc-200">{renderDelta(delta)}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    setExpandedTopics((prev) => {
                      const next = new Set(prev);
                      if (next.has(topic.id)) next.delete(topic.id);
                      else next.add(topic.id);
                      return next;
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5"
                >
                  Voir les questions
                </button>
                <a
                  href="/overview"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-medium text-black hover:opacity-90"
                >
                  Voir les résultats
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>

              {isExpanded && (
                <div className="mt-4 space-y-6 border-t border-white/5 pt-4">
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-white">Questions actives</p>
                    {topicQuestions.length === 0 && (
                      <p className="text-xs text-zinc-500">Aucune question active.</p>
                    )}
                    {topicQuestions.map((q) => (
                      <div key={q.id} className="rounded-2xl border border-white/10 bg-zinc-900/60 p-3">
                        {editingId === q.id ? (
                          <div className="flex flex-col gap-2">
                            <input
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={saveQuestionEdit}
                                className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-black"
                              >
                                Enregistrer
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <p className="text-sm text-zinc-100">{q.prompt_text}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="inline-flex items-center gap-2 text-xs text-zinc-400">
                                <input
                                  type="checkbox"
                                  checked={q.is_active}
                                  onChange={(e) => toggleQuestion(q.id, e.target.checked)}
                                />
                                {q.is_active ? 'Actif' : 'Inactif'}
                              </label>
                              <button
                                onClick={() => {
                                  setEditingId(q.id);
                                  setEditingValue(q.prompt_text);
                                }}
                                className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
                              >
                                Modifier
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {unassignedQuestions.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-white">Questions sans enjeu</p>
                      {unassignedQuestions.map((q) => (
                        <div key={q.id} className="rounded-2xl border border-white/10 bg-zinc-900/60 p-3 space-y-2">
                          <p className="text-sm text-zinc-100">{q.prompt_text}</p>
                          <button
                            onClick={() => assignQuestionToTopic(q.id, topic.id)}
                            className="rounded-full bg-white px-3 py-1 text-xs font-medium text-black"
                          >
                            Ajouter à cet enjeu
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-white">Questions recommandées</p>
                    {((templatesByTopic.get(topic.id) || []).length === 0) && (
                      <p className="text-xs text-zinc-500">Aucune recommandation disponible.</p>
                    )}
                    {(templatesByTopic.get(topic.id) || []).map((template) => (
                      <div key={template.id} className="rounded-2xl border border-white/10 bg-zinc-900/60 p-3 space-y-3">
                        <p className="text-sm text-zinc-100">{template.prompt_text}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => runSandboxTest(template.prompt_text)}
                            className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
                          >
                            Tester maintenant
                          </button>
                          <button
                            onClick={() => addQuestion(template.prompt_text, topic.id, 'template', template.id)}
                            className="rounded-full bg-white px-3 py-1 text-xs font-medium text-black"
                          >
                            Activer dans le monitoring
                          </button>
                        </div>
                        {testStatus[template.prompt_text] === 'done' && (
                          <div className="flex items-center justify-between text-xs text-emerald-300">
                            <span>{testMessage[template.prompt_text]}</span>
                            <button
                              onClick={() => addQuestion(template.prompt_text, topic.id, 'template', template.id)}
                              className="text-emerald-200 underline"
                            >
                              Ajouter au monitoring
                            </button>
                          </div>
                        )}
                        {testStatus[template.prompt_text] === 'error' && (
                          <div className="text-xs text-rose-300">{testMessage[template.prompt_text]}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-white">Ajouter une question personnalisée</p>
                    <input
                      value={customQuestionByTopic[topic.id] || ''}
                      onChange={(e) =>
                        setCustomQuestionByTopic((prev) => ({ ...prev, [topic.id]: e.target.value }))
                      }
                      placeholder="Que voulez-vous analyser ?"
                      className="w-full rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-sm text-white"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => runSandboxTest(customQuestionByTopic[topic.id] || '')}
                        className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300"
                      >
                        Tester avant d’activer
                      </button>
                      <button
                        onClick={() => addQuestion(customQuestionByTopic[topic.id] || '', topic.id, 'custom')}
                        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-black"
                      >
                        Activer dans le monitoring
                      </button>
                    </div>
                    {testStatus[customQuestionByTopic[topic.id] || ''] === 'done' && (
                      <div className="flex items-center justify-between text-xs text-emerald-300">
                        <span>{testMessage[customQuestionByTopic[topic.id] || '']}</span>
                        <button
                          onClick={() => addQuestion(customQuestionByTopic[topic.id] || '', topic.id, 'custom')}
                          className="text-emerald-200 underline"
                        >
                          Ajouter au monitoring
                        </button>
                      </div>
                    )}
                    {testStatus[customQuestionByTopic[topic.id] || ''] === 'error' && (
                      <div className="text-xs text-rose-300">{testMessage[customQuestionByTopic[topic.id] || '']}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
