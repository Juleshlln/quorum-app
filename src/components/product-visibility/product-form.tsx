'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';

type CategoryOption = {
  id: string;
  name: string;
};

export function ProductVisibilityProductForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isOwnedProduct, setIsOwnedProduct] = useState(true);

  function submit(formData: FormData) {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const categoryId = String(formData.get('categoryId') || '');
        const categoryName = String(formData.get('categoryName') || '');
        const response = await fetch('/api/product-visibility/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.get('name'),
            brand: formData.get('brand'),
            url: formData.get('url'),
            categoryId: categoryId || null,
            categoryName: categoryName || null,
            description: formData.get('description'),
            useCase: formData.get('useCase'),
            targetCustomer: formData.get('targetCustomer'),
            attributes: formData.get('attributes'),
            isOwnedProduct,
            competitorBrand: formData.get('competitorBrand'),
          }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error || 'Impossible d’ajouter le produit.');
        }

        setMessage('Produit ajouté avec succès.');
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Impossible d’ajouter le produit.');
      }
    });
  }

  return (
    <section className="quorum-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="quorum-kicker">Ajouter un produit</p>
          <h2 className="mt-2 text-lg font-semibold quorum-text-primary">Produit suivi</h2>
        </div>
        <Plus className="h-5 w-5 quorum-text-primary" />
      </div>

      <form action={submit} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="quorum-text-muted">Nom du produit</span>
          <input name="name" required className="w-full rounded-xl border quorum-border-default quorum-surface px-3 py-2 quorum-text-primary" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="quorum-text-muted">Marque</span>
          <input name="brand" className="w-full rounded-xl border quorum-border-default quorum-surface px-3 py-2 quorum-text-primary" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="quorum-text-muted">URL</span>
          <input name="url" type="url" className="w-full rounded-xl border quorum-border-default quorum-surface px-3 py-2 quorum-text-primary" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="quorum-text-muted">Catégorie existante</span>
          <select name="categoryId" className="w-full rounded-xl border quorum-border-default quorum-surface px-3 py-2 quorum-text-primary">
            <option value="">Créer ou choisir une catégorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="quorum-text-muted">Nouvelle catégorie</span>
          <input name="categoryName" className="w-full rounded-xl border quorum-border-default quorum-surface px-3 py-2 quorum-text-primary" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="quorum-text-muted">Attributs clés</span>
          <input name="attributes" placeholder="livraison rapide, garantie, conformité" className="w-full rounded-xl border quorum-border-default quorum-surface px-3 py-2 quorum-text-primary placeholder:quorum-text-muted" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="quorum-text-muted">Cas d’usage</span>
          <input name="useCase" placeholder="Déplacer des palettes en entrepôt" className="w-full rounded-xl border quorum-border-default quorum-surface px-3 py-2 quorum-text-primary placeholder:quorum-text-muted" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="quorum-text-muted">Cible client</span>
          <input name="targetCustomer" placeholder="PME industrielles, logisticiens" className="w-full rounded-xl border quorum-border-default quorum-surface px-3 py-2 quorum-text-primary placeholder:quorum-text-muted" />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="quorum-text-muted">Description courte</span>
          <textarea name="description" rows={3} className="w-full rounded-xl border quorum-border-default quorum-surface px-3 py-2 quorum-text-primary" />
        </label>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm quorum-text-primary">
            <input
              type="checkbox"
              checked={isOwnedProduct}
              onChange={(event) => setIsOwnedProduct(event.target.checked)}
              className="rounded border-[color:var(--quorum-border)]"
            />
            Produit de votre entreprise
          </label>
          {!isOwnedProduct ? (
            <label className="min-w-[240px] flex-1 space-y-1 text-sm">
              <span className="quorum-text-muted">Marque concurrente</span>
              <input name="competitorBrand" className="w-full rounded-xl border quorum-border-default quorum-surface px-3 py-2 quorum-text-primary" />
            </label>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <button type="submit" className="quorum-btn-primary inline-flex items-center gap-2" disabled={isPending}>
            <Plus className="h-4 w-4" />
            {isPending ? 'Ajout en cours...' : 'Ajouter le produit'}
          </button>
          {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </div>
      </form>
    </section>
  );
}
