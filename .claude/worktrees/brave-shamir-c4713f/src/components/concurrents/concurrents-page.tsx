"use client";

import { useEffect, useState } from 'react';
import {
  Plus,
  Lock,
  Unlock,
  Trash2,
  Eye,
  RefreshCw,
  X,
  Save,
} from 'lucide-react';

type ConcurrentRow = {
  id: string;
  project_id: string;
  nom: string;
  domaine: string | null;
  alias: string[] | null;
  type_concurrence?: string | null;
  type_detection: 'auto' | 'manuel';
  score_proximite: number;
  justification: { raison?: string; niveau_confiance?: string } | null;
  verrouille: boolean;
  created_at: string;
};

type Props = {
  projectId: string;
  projectName: string;
  initialConcurrents: ConcurrentRow[];
};

type DetailForm = {
  nom: string;
  domaine: string;
  alias: string;
  type_concurrence: string;
};

type CreateForm = {
  nom: string;
  domaine: string;
  alias: string;
  type_concurrence: string;
};

export function ConcurrentsPage({ projectId, projectName, initialConcurrents }: Props) {
  const [concurrents, setConcurrents] = useState<ConcurrentRow[]>(initialConcurrents);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [active, setActive] = useState<ConcurrentRow | null>(null);
  const [detailForm, setDetailForm] = useState<DetailForm>({
    nom: '',
    domaine: '',
    alias: '',
    type_concurrence: '',
  });

  const [createForm, setCreateForm] = useState<CreateForm>({
    nom: '',
    domaine: '',
    alias: '',
    type_concurrence: '',
  });

  const resetCreateForm = () => {
    setCreateForm({ nom: '', domaine: '', alias: '', type_concurrence: '' });
  };

  const openDetails = (item: ConcurrentRow) => {
    setActive(item);
    setDetailForm({
      nom: item.nom,
      domaine: item.domaine || '',
      alias: (item.alias || []).join(', '),
      type_concurrence: item.type_concurrence || '',
    });
    setDetailOpen(true);
  };

  const fetchConcurrents = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/concurrents`, { method: 'GET' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur de chargement');
      setConcurrents(Array.isArray(data?.concurrents) ? data.concurrents : []);
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setIsBusy(false);
    }
  };

  const triggerDetection = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/concurrents/detect`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur de détection');
      await fetchConcurrents();
    } catch (err: any) {
      setError(err.message || 'Erreur de détection');
      setIsBusy(false);
    }
  };

  const addConcurrent = async () => {
    if (!createForm.nom.trim()) {
      setError('Le nom du concurrent est requis.');
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const payload = {
        nom: createForm.nom,
        domaine: createForm.domaine || null,
        alias: createForm.alias
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        type_concurrence: createForm.type_concurrence || null,
        type_detection: 'manuel' as const,
      };
      const res = await fetch(`/api/projects/${projectId}/concurrents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur lors de la création');
      setConcurrents((prev) => [data.concurrent, ...prev]);
      setModalOpen(false);
      resetCreateForm();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création');
    } finally {
      setIsBusy(false);
    }
  };

  const updateConcurrent = async (id: string, updates: Partial<ConcurrentRow>) => {
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/concurrents`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur lors de la mise à jour');
      setConcurrents((prev) => prev.map((c) => (c.id === id ? data.concurrent : c)));
      if (active?.id === id) {
        setActive(data.concurrent);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsBusy(false);
    }
  };

  const deleteConcurrent = async (item: ConcurrentRow) => {
    if (item.verrouille) return;
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/concurrents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Suppression refusée');
      setConcurrents((prev) => prev.filter((c) => c.id !== item.id));
      if (active?.id === item.id) {
        setActive(null);
        setDetailOpen(false);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    } finally {
      setIsBusy(false);
    }
  };

  const normalizeDomain = (input?: string | null) => {
    if (!input) return '';
    try {
      const url = new URL(input.startsWith('http') ? input : `https://${input}`);
      return url.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return input.replace(/^www\./, '').toLowerCase();
    }
  };

  const getLogoCandidates = (input?: string | null) => {
    const domain = normalizeDomain(input);
    if (!domain) return [];
    return [
      `https://logo.clearbit.com/${domain}`,
      `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    ];
  };

  const LogoAvatar = ({
    name,
    domain,
    className,
    textClassName,
  }: {
    name: string;
    domain?: string | null;
    className?: string;
    textClassName?: string;
  }) => {
    const candidates = getLogoCandidates(domain);
    const [index, setIndex] = useState(0);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      setIndex(0);
      setFailed(false);
    }, [name, domain]);

    const src = candidates[index] || '';

    return (
      <div
        className={`flex items-center justify-center overflow-hidden rounded-2xl border quorum-border-default quorum-surface ${className || ''}`}
      >
        {!failed && src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => {
              if (index < candidates.length - 1) {
                setIndex((prev) => prev + 1);
              } else {
                setFailed(true);
              }
            }}
          />
        ) : (
          <span className={textClassName || 'text-xs font-semibold quorum-text-primary'}>
            {getInitials(name)}
          </span>
        )}
      </div>
    );
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();


  const emptyState = concurrents.length === 0;

  return (
    <div className="space-y-6">
      <div className="quorum-panel-strong flex flex-col gap-4 p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="quorum-kicker">Concurrents</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.05em] quorum-text-primary">Cartographiez votre paysage concurrentiel</h1>
          <p className="mt-2 quorum-text-muted">
            Analysez les marques proches de {projectName}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={triggerDetection}
            className="quorum-btn-secondary"
          >
            <RefreshCw className="h-4 w-4" />
            Relancer la détection
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="quorum-btn-primary"
          >
            <Plus className="h-4 w-4" />
            Ajouter un concurrent
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {isBusy && (
        <div className="rounded-2xl border quorum-border-default bg-white/5 px-4 py-3 text-sm quorum-text-muted">
          Chargement en cours...
        </div>
      )}

      {emptyState ? (
        <div className="quorum-panel p-10 text-center quorum-text-muted">
          Aucun concurrent détecté pour le moment.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {concurrents.map((item) => (
            <div
              key={item.id}
              className="quorum-panel p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <LogoAvatar
                      name={item.nom}
                      domain={item.domaine}
                      className="h-10 w-10"
                      textClassName="text-xs font-semibold quorum-text-primary"
                    />
                    <h3 className="text-lg font-semibold quorum-text-primary">{item.nom}</h3>
                    {item.verrouille && (
                      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                        Verrouillé
                      </span>
                    )}
                    {item.type_concurrence && (
                      <span className="rounded-full border quorum-border-default bg-white/5 px-2 py-0.5 text-xs quorum-text-muted">
                        {item.type_concurrence}
                      </span>
                    )}
                  </div>
                  <p className="text-sm quorum-text-muted">
                    {item.domaine || 'Domaine non renseigné'}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    item.type_detection === 'auto'
                      ? 'quorum-border-strong quorum-surface-strong quorum-text-primary'
                      : 'quorum-border-default quorum-surface quorum-text-muted'
                  }`}
                >
                  {item.type_detection === 'auto' ? 'Auto' : 'Manuel'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => updateConcurrent(item.id, { verrouille: !item.verrouille })}
                  className="quorum-btn-secondary px-3 py-2 text-xs"
                >
                  {item.verrouille ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {item.verrouille ? 'Déverrouiller' : 'Verrouiller'}
                </button>
                <button
                  onClick={() => openDetails(item)}
                  className="quorum-btn-secondary px-3 py-2 text-xs"
                >
                  <Eye className="h-4 w-4" />
                  Voir le détail
                </button>
                <button
                  onClick={() => deleteConcurrent(item)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                    item.verrouille
                      ? 'cursor-not-allowed quorum-border-default quorum-text-subtle'
                      : 'border-red-500/30 text-red-300 hover:text-red-200'
                  }`}
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center quorum-backdrop px-4">
          <div className="quorum-panel-strong w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold quorum-text-primary">Ajouter un concurrent</h3>
              <button onClick={() => setModalOpen(false)} className="quorum-text-muted hover:quorum-text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3">
              <div>
                <label className="quorum-label text-xs">Nom</label>
                <input
                  value={createForm.nom}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, nom: e.target.value }))}
                  className="quorum-input"
                  placeholder="Nom du concurrent"
                />
              </div>
              <div>
                <label className="quorum-label text-xs">Domaine (optionnel)</label>
                <input
                  value={createForm.domaine}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, domaine: e.target.value }))}
                  className="quorum-input"
                  placeholder="exemple.com"
                />
              </div>
              <div>
                <label className="quorum-label text-xs">Alias (séparés par virgule)</label>
                <input
                  value={createForm.alias}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, alias: e.target.value }))}
                  className="quorum-input"
                  placeholder="Nom alternatif, Acronyme"
                />
              </div>
              <div>
                <label className="quorum-label text-xs">Type de concurrence</label>
                <select
                  value={createForm.type_concurrence}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, type_concurrence: e.target.value }))}
                  className="quorum-select"
                >
                  <option value="">Sélectionner</option>
                  <option value="Direct">Direct</option>
                  <option value="Indirect">Indirect</option>
                  <option value="Alternatif">Alternatif</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="quorum-btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={addConcurrent}
                className="quorum-btn-primary"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {detailOpen && active && (
        <div className="fixed inset-0 z-50 flex justify-end quorum-backdrop">
          <div className="h-full w-full max-w-xl border-l quorum-border-default quorum-surface-strong p-6 space-y-6 backdrop-blur-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold quorum-text-primary">Profil concurrent</h3>
                <p className="text-sm quorum-text-muted">Informations clés et édition manuelle.</p>
              </div>
              <button onClick={() => setDetailOpen(false)} className="quorum-text-muted hover:quorum-text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="overflow-hidden rounded-3xl border quorum-border-default bg-white/5">
                <div className="h-24 bg-gradient-to-r from-white/[0.12] via-white/[0.04] to-transparent" />
                <div className="p-5 flex items-center gap-4 -mt-10">
                  <LogoAvatar
                    name={active.nom}
                    domain={active.domaine}
                    className="h-16 w-16 rounded-2xl"
                    textClassName="text-lg font-semibold quorum-text-primary"
                  />
                  <div>
                    <h4 className="text-xl font-semibold quorum-text-primary">{active.nom}</h4>
                    <p className="text-sm quorum-text-muted">
                      {active.domaine || 'Domaine non renseigné'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {active.type_concurrence && (
                        <span className="rounded-full border quorum-border-default bg-white/5 px-2 py-0.5 quorum-text-muted">
                          {active.type_concurrence}
                        </span>
                      )}
                      <span className="rounded-full border quorum-border-default bg-white/5 px-2 py-0.5 quorum-text-muted">
                        {active.type_detection === 'auto' ? 'Détection auto' : 'Ajout manuel'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div>
                  <label className="quorum-label text-xs">Nom</label>
                  <input
                    value={detailForm.nom}
                    onChange={(e) => setDetailForm((prev) => ({ ...prev, nom: e.target.value }))}
                    className="quorum-input"
                  />
                </div>
                <div>
                  <label className="quorum-label text-xs">Domaine</label>
                  <input
                    value={detailForm.domaine}
                    onChange={(e) => setDetailForm((prev) => ({ ...prev, domaine: e.target.value }))}
                    className="quorum-input"
                  />
                </div>
                <div>
                  <label className="quorum-label text-xs">Alias</label>
                  <input
                    value={detailForm.alias}
                    onChange={(e) => setDetailForm((prev) => ({ ...prev, alias: e.target.value }))}
                    className="quorum-input"
                  />
                </div>
                <div>
                  <label className="quorum-label text-xs">Type de concurrence</label>
                  <select
                    value={detailForm.type_concurrence}
                    onChange={(e) => setDetailForm((prev) => ({ ...prev, type_concurrence: e.target.value }))}
                    className="quorum-select"
                  >
                    <option value="">Sélectionner</option>
                    <option value="Direct">Direct</option>
                    <option value="Indirect">Indirect</option>
                    <option value="Alternatif">Alternatif</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!detailForm.nom.trim()) {
                    setError('Le nom du concurrent est requis.');
                    return;
                  }
                  updateConcurrent(active.id, {
                    nom: detailForm.nom,
                    domaine: detailForm.domaine || null,
                    alias: detailForm.alias
                      .split(',')
                      .map((a) => a.trim())
                      .filter(Boolean),
                    type_concurrence: detailForm.type_concurrence || null,
                  });
                }}
                className="quorum-btn-primary"
              >
                <Save className="h-4 w-4" />
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
