'use client';

import Link from 'next/link';
import { type ReactNode, useMemo, useState, useEffect } from 'react';
import {
  Bot,
  Layers3,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  CheckCircle2,
  CircleDashed,
  type LucideIcon,
} from 'lucide-react';

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

type TrackedOffer = {
  id: string;
  name: string;
  type: 'product_category' | 'service';
  is_active: boolean;
  business_priority?: string | null;
};

type AiProvider = {
  id: string;
  label: string;
  isConfigured: boolean;
};

const INTENTS = [
  { value: 'information', label: 'Information' },
  { value: 'comparison', label: 'Comparaison' },
  { value: 'recommendation', label: 'Recommandation' },
  { value: 'purchase', label: 'Achat' },
];

function formatIntentLabel(value: string | null | undefined) {
  return INTENTS.find((intent) => intent.value === value)?.label || 'Information';
}

export function MonitoringTopics({
  projectId,
  topics: initialTopics = [],
  questions: initialQuestions = [],
  templates = [],
  offers = [],
  aiProviders = [],
  frequencyLabel = 'Analyse quotidienne',
}: {
  projectId: string;
  topics: Topic[];
  questions: Question[];
  templates: PromptTemplate[];
  offers: TrackedOffer[];
  aiProviders: AiProvider[];
  frequencyLabel: string;
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

  const activeQuestions = questions.filter((q) => q.is_active);
  const activeOffers = offers.filter((offer) => offer.is_active);
  const activeProductOffers = activeOffers.filter((offer) => offer.type === 'product_category').length;
  const activeServiceOffers = activeOffers.filter((offer) => offer.type === 'service').length;
  const configuredProviders = aiProviders.filter((provider) => provider.isConfigured);
  const activeIntents = new Set(activeQuestions.map((question) => question.intent || 'information')).size;

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
      setMessage(data?.error || 'Impossible de créer la catégorie.');
      return;
    }
    const topic = { id: data.id, name, description: newTopicDesc || null, is_active: true };
    setTopics((prev) => [topic, ...prev]);
    setSelectedTopicId(topic.id);
    setNewTopicName('');
    setNewTopicDesc('');
  };

  const deleteTopic = async (topicId: string) => {
    if (!confirm('Supprimer cette catégorie ? Les questions restent disponibles sans catégorie.')) return;
    const res = await fetch(`/api/monitoring/topics/${topicId}`, { method: 'DELETE' });
    if (!res.ok) {
      setMessage('Impossible de supprimer la catégorie.');
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

  const radarReady = activeOffers.length > 0 && activeQuestions.length > 0 && configuredProviders.length > 0;
  const nextStep = activeOffers.length === 0
    ? {
        title: 'Ajoutez au moins une offre',
        description: 'Commencez par sélectionner les produits, services ou catégories que vos clients peuvent chercher dans une IA.',
        href: '/offers?create=offer',
        label: 'Ajouter une offre',
      }
    : activeQuestions.length === 0
      ? {
          title: 'Ajoutez vos questions d’achat',
          description: 'Créez les questions que vos prospects pourraient poser à ChatGPT, Claude, Gemini ou Perplexity.',
          label: 'Ajouter une question',
        }
      : configuredProviders.length === 0
        ? {
            title: 'Connectez au moins un moteur IA',
            description: 'Ajoutez une clé API pour lancer le radar sur les moteurs IA prioritaires.',
            href: '/settings',
            label: 'Configurer les moteurs',
          }
        : {
            title: 'Radar prêt',
            description: 'Votre radar peut alimenter les scores de visibilité dans la vue d’ensemble.',
            label: 'Ajouter une question',
          };
  const visibleQuestions = questions.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="quorum-panel-strong p-6 md:p-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
          <div>
            <p className="quorum-kicker">Radar IA</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] quorum-text-primary md:text-4xl">
              Configurez les tests que les IA doivent passer
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed quorum-text-muted">
              Le Radar IA simule les questions de vos futurs clients pour vérifier si vos produits ou services sont recommandés, oubliés ou remplacés par des concurrents.
            </p>
          </div>
          <div className="rounded-[26px] border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="quorum-soft-badge text-[11px]">
                {radarReady ? 'Prêt' : 'À compléter'}
              </span>
              <span className="text-sm font-semibold quorum-text-primary">{coverage}%</span>
            </div>
            <p className="mt-4 text-lg font-semibold quorum-text-primary">{nextStep.title}</p>
            <p className="mt-2 text-sm leading-relaxed quorum-text-muted">{nextStep.description}</p>
            {nextStep.href ? (
              <Link href={nextStep.href} className="quorum-btn-primary mt-5 w-full justify-center text-sm">
                {nextStep.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="quorum-btn-primary mt-5 w-full justify-center text-sm"
              >
                <Plus className="h-4 w-4" />
                {nextStep.label}
              </button>
            )}
          </div>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        <RadarStepCard
          index="1"
          icon={Layers3}
          title="Offres à tester"
          status={activeOffers.length > 0 ? 'Configuré' : 'À faire'}
          value={`${activeOffers.length} offre${activeOffers.length > 1 ? 's' : ''}`}
          description={`${activeProductOffers} produits · ${activeServiceOffers} services`}
          help="Ajoutez ici ce que vos clients peuvent réellement acheter : une catégorie produit, un service, une offre ou une prestation. Quorum reliera ensuite les réponses IA à ces offres concrètes."
          action={
            <Link href={activeOffers.length > 0 ? '/offers' : '/offers?create=offer'} className="quorum-btn-secondary text-sm">
              {activeOffers.length > 0 ? 'Gérer les offres' : 'Ajouter une offre'}
            </Link>
          }
        >
          {activeOffers.length > 0 ? (
            <div className="space-y-2">
              {activeOffers.slice(0, 3).map((offer) => (
                <div key={offer.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-panel)] px-3 py-2">
                  <span className="truncate text-sm font-medium quorum-text-primary">{offer.name}</span>
                  <span className="text-xs quorum-text-muted">{offer.type === 'service' ? 'Service' : 'Produit'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm quorum-text-muted">Aucune offre suivie. C’est la première chose à configurer.</p>
          )}
        </RadarStepCard>

        <RadarStepCard
          index="2"
          icon={Search}
          title="Questions d’achat"
          status={activeQuestions.length > 0 ? 'Configuré' : 'À faire'}
          value={`${activeQuestions.length} active${activeQuestions.length > 1 ? 's' : ''}`}
          description={`${questions.length} questions au total · ${activeIntents} intentions`}
          help="Écrivez les questions comme vos prospects les poseraient à une IA, sans citer votre marque. Exemple : “Quel est le meilleur fournisseur de matériel industriel pour PME ?”"
          action={<button type="button" onClick={() => setModalOpen(true)} className="quorum-btn-secondary text-sm">Ajouter</button>}
        >
          {activeQuestions.length > 0 ? (
            <div className="space-y-2">
              {activeQuestions.slice(0, 3).map((question) => (
                <div key={question.id} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-panel)] px-3 py-2">
                  <p className="line-clamp-1 text-sm font-medium quorum-text-primary">{question.prompt_text}</p>
                  <p className="mt-1 text-xs quorum-text-muted">{formatIntentLabel(question.intent)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm quorum-text-muted">Ajoutez des questions comme “meilleur fournisseur...” ou “quelle solution choisir...”.</p>
          )}
        </RadarStepCard>

        <RadarStepCard
          index="3"
          icon={Bot}
          title="Moteurs et cadence"
          status={configuredProviders.length > 0 ? 'Configuré' : 'À faire'}
          value={aiProviders.length > 0 ? `${configuredProviders.length}/${aiProviders.length} moteurs` : '—'}
          description={frequencyLabel}
          help="Sélectionnez les moteurs IA que vous voulez surveiller. Plus vous testez de moteurs, plus vous comprenez où vos offres sont visibles ou remplacées par des concurrents."
          action={<Link href="/settings" className="quorum-btn-secondary text-sm">Configurer</Link>}
        >
          <div className="flex flex-wrap gap-2">
            {aiProviders.map((provider) => (
              <span
                key={provider.id}
                className={`rounded-full border px-3 py-1 text-xs ${provider.isConfigured ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-[color:var(--quorum-border)] bg-[var(--quorum-panel)] quorum-text-muted'}`}
              >
                {provider.label}
              </span>
            ))}
          </div>
        </RadarStepCard>
      </section>

      {message && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {message}
        </div>
      )}

      <section className="quorum-panel-strong p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="quorum-kicker">Questions suivies</p>
            <h2 className="mt-2 text-xl font-semibold quorum-text-primary">Les demandes que Quorum pose aux IA</h2>
            <p className="mt-2 text-sm quorum-text-muted">Ces questions doivent ressembler aux recherches réelles de vos prospects.</p>
          </div>
          <button type="button" onClick={() => setModalOpen(true)} className="quorum-btn-primary text-sm">
            <Plus className="h-4 w-4" />
            Ajouter une question
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {visibleQuestions.length > 0 ? visibleQuestions.map((question) => (
            <div key={question.id} className="grid gap-3 rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3 lg:grid-cols-[minmax(0,1fr)_150px_120px] lg:items-center">
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium quorum-text-primary">{question.prompt_text}</p>
                <p className="mt-1 text-xs quorum-text-muted">{question.country || 'France'} · {question.language || 'Français'}</p>
              </div>
              <span className="text-xs font-medium quorum-text-muted">{formatIntentLabel(question.intent)}</span>
              <label className="inline-flex items-center gap-2 text-xs quorum-text-muted">
                <input
                  type="checkbox"
                  checked={question.is_active}
                  onChange={(event) => toggleQuestion(question.id, event.target.checked)}
                />
                {question.is_active ? 'Active' : 'Inactive'}
              </label>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-4 py-8 text-center">
              <p className="text-sm font-medium quorum-text-primary">Aucune question suivie.</p>
              <p className="mt-1 text-sm quorum-text-muted">Ajoutez une première question d’achat pour commencer à tester votre visibilité IA.</p>
              <button type="button" onClick={() => setModalOpen(true)} className="quorum-btn-primary mt-4 text-sm">
                Ajouter une question
              </button>
            </div>
          )}
        </div>
      </section>

      <details className="quorum-panel p-5">
        <summary className="cursor-pointer text-sm font-semibold quorum-text-primary">
          Réglages avancés : catégories et suggestions
        </summary>
        <div className="mt-5 grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-5">
            <div>
              <p className="quorum-kicker">Catégories</p>
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => setSelectedTopicId('unassigned')}
                  className={`w-full rounded-2xl px-3 py-3 text-left text-sm transition-all ${
                    selectedTopicId === 'unassigned' ? 'border quorum-border-strong quorum-surface-strong quorum-text-primary' : 'quorum-text-muted hover:quorum-surface hover:quorum-text-primary'
                  }`}
                >
                  Questions sans catégorie ({unassigned.length})
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
            </div>

            <div className="border-t quorum-border-default pt-4 space-y-3">
            <p className="quorum-kicker">Créer une catégorie</p>
            <input
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="Nom de la catégorie"
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
              Créer la catégorie
            </button>
          </div>
        </aside>

        <section className="quorum-panel-strong p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="quorum-kicker">Questions suivies</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] quorum-text-primary">
                {selectedTopicId === 'unassigned'
                  ? 'Questions sans catégorie'
                  : topics.find((t) => t.id === selectedTopicId)?.name || 'Catégorie'}
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
                Aucune question pour cette catégorie pour le moment.
              </div>
            )}
            {filterTab !== 'suggested' && filteredQuestions.map((q) => (
              <div key={q.id} className="quorum-panel-soft flex items-center justify-between p-4">
                <div>
                  <p className="text-sm quorum-text-primary">{q.prompt_text}</p>
                  <p className="text-xs quorum-text-muted">
                    {formatIntentLabel(q.intent)} · {q.language || 'Français'} · {q.country || 'France'}
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
                        Activer dans le radar
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
                Voir les questions sans catégorie
              </button>
            )}
          </div>
        </section>
        </div>
      </details>

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
                Import par lot
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
                <label className="quorum-label text-xs">Catégorie</label>
                <select
                  value={form.topicId}
                  onChange={(e) => setForm({ ...form, topicId: e.target.value })}
                  className="quorum-select"
                >
                  <option value="">Sans catégorie</option>
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
                    Ajouter au radar
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

function RadarStepCard({
  index,
  icon: Icon,
  title,
  status,
  value,
  description,
  help,
  action,
  children,
}: {
  index: string;
  icon: LucideIcon;
  title: string;
  status: string;
  value: string;
  description: string;
  help: string;
  action: ReactNode;
  children: ReactNode;
}) {
  const isDone = status === 'Configuré';

  return (
    <article className="quorum-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)]">
            <Icon className="h-4 w-4 quorum-text-primary" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] quorum-text-muted">Étape {index}</p>
            <h2 className="mt-1 text-lg font-semibold quorum-text-primary">{title}</h2>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs ${isDone ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>
          {status}
        </span>
      </div>

      <div className="mt-5">
        <p className="text-3xl font-semibold tracking-[-0.05em] quorum-text-primary">{value}</p>
        <p className="mt-1 text-sm quorum-text-muted">{description}</p>
      </div>

      <p className="mt-4 rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-3 py-3 text-sm leading-relaxed quorum-text-muted">
        {help}
      </p>

      <div className="mt-5 min-h-[96px]">
        {children}
      </div>

      <div className="mt-5">
        {action}
      </div>
    </article>
  );
}
