'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, X } from 'lucide-react';
import type { OfferListItem, OfferPriority, OfferType } from '@/lib/offer-visibility/types';
import type { OfferVisibilityPlanConfig } from '@/lib/plans';
import { formatDateTime, formatPercent, formatPosition, formatScore, offerTypeLabel, priorityLabel } from '@/components/offers/offer-format';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'product_category' | 'service' | 'active' | 'high';

const filters: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Tous' },
  { id: 'product_category', label: 'Catégories produits' },
  { id: 'service', label: 'Services' },
  { id: 'active', label: 'Actifs' },
  { id: 'high', label: 'Priorité élevée' },
];

function typeBadge(type: OfferType) {
  return type === 'service' ? 'Service' : 'Catégorie produit';
}

export function OffersListClient({
  initialOffers,
  plan,
}: {
  initialOffers: OfferListItem[];
  plan: OfferVisibilityPlanConfig;
}) {
  const router = useRouter();
  const [offers] = useState(initialOffers);
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === 'offer') {
      setIsCreateOpen(true);
    }
  }, []);

  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      if (activeFilter === 'product_category' && offer.type !== 'product_category') return false;
      if (activeFilter === 'service' && offer.type !== 'service') return false;
      if (activeFilter === 'active' && !offer.is_active) return false;
      if (activeFilter === 'high' && offer.business_priority !== 'high') return false;
      if (query.trim()) {
        const haystack = `${offer.name} ${offer.description || ''} ${offer.target_market || ''}`.toLowerCase();
        if (!haystack.includes(query.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [activeFilter, offers, query]);

  return (
    <div className="space-y-6">
      <section className="quorum-panel-strong p-6 md:p-7">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="quorum-kicker">Offer Visibility</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] quorum-text-primary md:text-4xl">
              Offres suivies
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed quorum-text-muted">
              Suivez la visibilité de vos catégories produits et services dans les réponses des IA.
            </p>
            <p className="mt-2 text-xs quorum-text-muted">
              Plan {plan.label} : {plan.limits.maxOffers === null ? 'offres illimitées' : `${initialOffers.filter((offer) => offer.is_active).length}/${plan.limits.maxOffers} offres actives`}.
              {plan.isDevelopmentUnlimited ? ' Limites désactivées en développement.' : ''}
            </p>
          </div>
          <button
            type="button"
            className="quorum-btn-primary inline-flex items-center gap-2 text-sm"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Ajouter une offre
          </button>
        </div>
      </section>

      <section className="quorum-panel p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  'rounded-full border px-3 py-2 text-xs font-medium transition',
                  activeFilter === filter.id
                    ? 'border-[color:var(--quorum-border-strong)] bg-[var(--quorum-surface-strong)] quorum-text-primary'
                    : 'border-[color:var(--quorum-border)] quorum-text-muted hover:bg-[var(--quorum-surface)]'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-0 xl:w-[320px]">
            <Search className="quorum-input-icon pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="quorum-input-with-icon w-full"
              placeholder="Rechercher une offre"
            />
          </div>
        </div>
      </section>

      {offers.length === 0 ? (
        <section className="quorum-panel p-10 text-center">
          <p className="text-lg font-semibold quorum-text-primary">Vous ne suivez encore aucune offre.</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed quorum-text-muted">
            Ajoutez une catégorie produit ou un service pour mesurer si les IA vous recommandent lorsque vos clients cherchent une solution.
          </p>
          <button
            type="button"
            className="quorum-btn-primary mt-5 inline-flex items-center gap-2 text-sm"
            onClick={() => setIsCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Ajouter une première offre
          </button>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {filteredOffers.map((offer) => {
            const topCompetitor = offer.metrics.top_competitors[0]?.name || 'Données insuffisantes';
            return (
              <Link key={offer.id} href={`/offers/${offer.id}`} className="quorum-panel p-5 transition hover:border-[color:var(--quorum-border-strong)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold quorum-text-primary">{offer.name}</h2>
                      <span className="quorum-soft-badge text-[11px]">{typeBadge(offer.type)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm quorum-text-muted">
                      {offer.description || offer.target_market || 'Aucune description renseignée.'}
                    </p>
                  </div>
                  <span className={cn('quorum-soft-badge text-[11px]', offer.is_active ? '' : 'opacity-60')}>
                    {offer.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Metric label="Visibilité IA" value={formatScore(offer.metrics.visibility_score)} />
                  <Metric label="Apparition IA" value={formatPercent(offer.metrics.appearance_rate)} />
                  <Metric label="Recommandation" value={formatPercent(offer.metrics.recommendation_rate)} />
                  <Metric label="Position moyenne" value={formatPosition(offer.metrics.average_position)} />
                  <Metric label="Top concurrent" value={topCompetitor} />
                  <Metric label="Questions suivies" value={String(offer.metrics.prompts_tracked)} />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs quorum-text-muted">
                  <span>{priorityLabel(offer.business_priority)}</span>
                  <span>Dernière analyse : {formatDateTime(offer.metrics.last_run_at)}</span>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      {filteredOffers.length === 0 && offers.length > 0 ? (
        <section className="quorum-panel p-8 text-center text-sm quorum-text-muted">
          Aucune offre ne correspond aux filtres sélectionnés.
        </section>
      ) : null}

      {isCreateOpen ? (
        <CreateOfferModal
          plan={plan}
          activeOfferCount={initialOffers.filter((offer) => offer.is_active).length}
          onClose={() => setIsCreateOpen(false)}
          onCreated={(id) => {
            setIsCreateOpen(false);
            router.push(`/offers/${id}`);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] quorum-text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold quorum-text-primary">{value}</p>
    </div>
  );
}

function CreateOfferModal({
  activeOfferCount,
  onClose,
  onCreated,
  plan,
}: {
  activeOfferCount: number;
  onClose: () => void;
  onCreated: (id: string) => void;
  plan: OfferVisibilityPlanConfig;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'product_category' as OfferType,
    description: '',
    target_market: 'B2B',
    country: 'France',
    business_priority: 'medium' as OfferPriority,
    language: 'fr',
    generate_prompts: true,
  });

  const submit = () => {
    if (plan.limits.maxOffers !== null && activeOfferCount >= plan.limits.maxOffers) {
      setError(`Votre plan ${plan.label} permet ${plan.limits.maxOffers} offres suivies actives.`);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch('/api/offers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || 'Création impossible.');
        onCreated(payload.offer.id);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Création impossible.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--quorum-modal-backdrop)] p-4">
      <div className="quorum-panel-strong w-full max-w-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="quorum-kicker">Nouvelle offre</p>
            <h2 className="mt-2 text-xl font-semibold quorum-text-primary">Ajouter une offre suivie</h2>
          </div>
          <button type="button" className="quorum-btn-secondary p-2" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-4 py-3 text-xs quorum-text-muted">
          Plan {plan.label} : {plan.limits.maxOffers === null ? 'création illimitée' : `${activeOfferCount}/${plan.limits.maxOffers} offres actives utilisées`}.
          {plan.isDevelopmentUnlimited ? ' Les restrictions sont désactivées en développement.' : ''}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Field label="Nom de l’offre">
            <input className="quorum-input w-full" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Type d’offre">
            <select className="quorum-select w-full" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as OfferType })}>
              <option value="product_category">Catégorie produit</option>
              <option value="service">Service</option>
            </select>
          </Field>
          <Field label="Marché cible">
            <input className="quorum-input w-full" value={form.target_market} onChange={(event) => setForm({ ...form, target_market: event.target.value })} />
          </Field>
          <Field label="Pays">
            <input className="quorum-input w-full" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
          </Field>
          <Field label="Priorité business">
            <select className="quorum-select w-full" value={form.business_priority} onChange={(event) => setForm({ ...form, business_priority: event.target.value as OfferPriority })}>
              <option value="high">Élevée</option>
              <option value="medium">Moyenne</option>
              <option value="low">Faible</option>
            </select>
          </Field>
          <Field label="Langue">
            <select className="quorum-select w-full" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })}>
              <option value="fr">Français</option>
            </select>
          </Field>
          <Field label="Description" wide>
            <textarea className="quorum-textarea min-h-24 w-full" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-3 text-sm quorum-text-muted">
          <input
            type="checkbox"
            checked={form.generate_prompts}
            onChange={(event) => setForm({ ...form, generate_prompts: event.target.checked })}
          />
          Générer automatiquement les questions suivies
        </label>

        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="quorum-btn-secondary" onClick={onClose}>Annuler</button>
          <button type="button" className="quorum-btn-primary" disabled={isPending} onClick={submit}>
            {isPending ? 'Création…' : 'Créer l’offre'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={cn('space-y-2 text-sm quorum-text-muted', wide && 'md:col-span-2')}>
      <span>{label}</span>
      {children}
    </label>
  );
}
