'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Play, Plus, RefreshCw, X } from 'lucide-react';
import type { OfferCategory, OfferIntent, OfferPriority, OfferPrompt, OfferType } from '@/lib/offer-visibility/types';
import type { OfferVisibilityPlanConfig } from '@/lib/plans';
import { cn } from '@/lib/utils';

export function OfferHeaderActions({
  offer,
  plan,
  runsThisMonth,
}: {
  offer: OfferCategory;
  plan: OfferVisibilityPlanConfig;
  runsThisMonth: number;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isEditOpen, setIsEditOpen] = useState(false);

  const runAction = (path: string, success: string, body?: Record<string, unknown>, consumesRun = false) => {
    if (consumesRun && plan.limits.maxOfferRunsPerMonth !== null && runsThisMonth >= plan.limits.maxOfferRunsPerMonth) {
      setMessage(`Limite atteinte : ${runsThisMonth}/${plan.limits.maxOfferRunsPerMonth} analyses ce mois-ci sur le plan ${plan.label}.`);
      return;
    }

    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body || {}),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || 'Action impossible.');
        setMessage(success);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Action impossible.');
      }
    });
  };

  return (
    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        className="quorum-btn-primary inline-flex items-center gap-2 text-sm"
        disabled={isPending}
        onClick={() => runAction(`/api/offers/${offer.id}/run`, 'Analyse terminée.', {}, true)}
      >
        <Play className="h-4 w-4" />
        Lancer l’analyse
      </button>
      <button
        type="button"
        className="quorum-btn-secondary inline-flex items-center gap-2 text-sm"
        disabled={isPending}
        onClick={() => runAction(`/api/offers/${offer.id}/generate-prompts`, 'Questions générées.')}
      >
        <RefreshCw className="h-4 w-4" />
        Générer des questions
      </button>
      <button
        type="button"
        className="quorum-btn-secondary inline-flex items-center gap-2 text-sm"
        onClick={() => setIsEditOpen(true)}
      >
        <Pencil className="h-4 w-4" />
        Modifier
      </button>
      {message ? <p className="text-xs quorum-text-muted sm:max-w-[220px]">{message}</p> : null}
      <p className="text-[11px] quorum-text-muted sm:max-w-[220px]">
        Plan {plan.label} : {plan.limits.maxOfferRunsPerMonth === null ? 'analyses illimitées' : `${runsThisMonth}/${plan.limits.maxOfferRunsPerMonth} analyses ce mois-ci`}.
      </p>
      {isEditOpen ? <EditOfferModal offer={offer} onClose={() => setIsEditOpen(false)} /> : null}
    </div>
  );
}

export function OfferPromptActions({
  offerId,
  prompts,
  intents,
  activePromptCount,
  plan,
}: {
  activePromptCount: number;
  offerId: string;
  prompts: OfferPrompt[];
  intents: OfferIntent[];
  plan: OfferVisibilityPlanConfig;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newPrompt, setNewPrompt] = useState('');
  const [intentId, setIntentId] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);

  const addPrompt = () => {
    if (plan.limits.maxPromptsPerOffer !== null && activePromptCount >= plan.limits.maxPromptsPerOffer) {
      setMessage(`Votre plan ${plan.label} permet ${plan.limits.maxPromptsPerOffer} questions suivies actives par offre.`);
      return;
    }

    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/offers/${offerId}/prompts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: newPrompt, intent_id: intentId || null }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || 'Ajout impossible.');
        setNewPrompt('');
        setIntentId('');
        setMessage('Question ajoutée.');
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Ajout impossible.');
      }
    });
  };

  const setActive = (promptId: string, isActive: boolean) => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/offers/${offerId}/prompts/${promptId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: isActive }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || 'Mise à jour impossible.');
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Mise à jour impossible.');
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
        <input
          value={newPrompt}
          onChange={(event) => setNewPrompt(event.target.value)}
          className="quorum-input w-full"
          placeholder="Ajouter une question suivie manuelle"
        />
        <select className="quorum-select w-full" value={intentId} onChange={(event) => setIntentId(event.target.value)}>
          <option value="">Intention d’achat</option>
          {intents.map((intent) => (
            <option key={intent.id} value={intent.id}>{intent.label}</option>
          ))}
        </select>
        <button type="button" className="quorum-btn-secondary inline-flex items-center gap-2" disabled={isPending} onClick={addPrompt}>
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>
      <p className="text-xs quorum-text-muted">
        Plan {plan.label} : {plan.limits.maxPromptsPerOffer === null ? 'questions illimitées' : `${activePromptCount}/${plan.limits.maxPromptsPerOffer} questions actives`}.
        {plan.isDevelopmentUnlimited ? ' Restrictions désactivées en développement.' : ''}
      </p>
      {message ? <p className="text-sm quorum-text-muted">{message}</p> : null}
      <div className="space-y-2">
        {prompts.map((prompt) => (
          <div key={prompt.id} className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-medium quorum-text-primary">{prompt.prompt}</p>
                <p className="mt-1 text-xs quorum-text-muted">
                  {prompt.intent?.label || 'Intention non renseignée'} · {prompt.source === 'manual' ? 'Manuelle' : 'Générée'} · {prompt.is_active ? 'Active' : 'Inactive'}
                </p>
              </div>
              <button
                type="button"
                className={cn('quorum-btn-secondary px-3 py-2 text-xs', !prompt.is_active && 'opacity-75')}
                disabled={isPending}
                onClick={() => setActive(prompt.id, !prompt.is_active)}
              >
                {prompt.is_active ? 'Désactiver' : 'Réactiver'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditOfferModal({ offer, onClose }: { offer: OfferCategory; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: offer.name,
    type: offer.type,
    description: offer.description || '',
    target_market: offer.target_market || '',
    country: offer.country || 'France',
    business_priority: offer.business_priority || 'medium',
    language: offer.language || 'fr',
    is_active: offer.is_active,
  });

  const submit = () => {
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/offers/${offer.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || 'Mise à jour impossible.');
        onClose();
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Mise à jour impossible.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--quorum-modal-backdrop)] p-4">
      <div className="quorum-panel-strong w-full max-w-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="quorum-kicker">Modifier</p>
            <h2 className="mt-2 text-xl font-semibold quorum-text-primary">Paramètres de l’offre</h2>
          </div>
          <button type="button" className="quorum-btn-secondary p-2" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm quorum-text-muted">
            <span>Nom</span>
            <input className="quorum-input w-full" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="space-y-2 text-sm quorum-text-muted">
            <span>Type</span>
            <select className="quorum-select w-full" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as OfferType })}>
              <option value="product_category">Catégorie produit</option>
              <option value="service">Service</option>
            </select>
          </label>
          <label className="space-y-2 text-sm quorum-text-muted">
            <span>Marché cible</span>
            <input className="quorum-input w-full" value={form.target_market} onChange={(event) => setForm({ ...form, target_market: event.target.value })} />
          </label>
          <label className="space-y-2 text-sm quorum-text-muted">
            <span>Priorité</span>
            <select className="quorum-select w-full" value={form.business_priority} onChange={(event) => setForm({ ...form, business_priority: event.target.value as OfferPriority })}>
              <option value="high">Élevée</option>
              <option value="medium">Moyenne</option>
              <option value="low">Faible</option>
            </select>
          </label>
          <label className="space-y-2 text-sm quorum-text-muted md:col-span-2">
            <span>Description</span>
            <textarea className="quorum-textarea min-h-24 w-full" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
        </div>
        <label className="mt-4 flex items-center gap-3 text-sm quorum-text-muted">
          <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
          Offre active
        </label>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="quorum-btn-secondary" onClick={onClose}>Annuler</button>
          <button type="button" className="quorum-btn-primary" disabled={isPending} onClick={submit}>
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
