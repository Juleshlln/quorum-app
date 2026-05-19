'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { formatDateTimeFr, formatLastRun, formatStatus } from '@/lib/product-visibility/format';
import type { CatalogSourceKind, CatalogSourcePublic } from '@/lib/product-catalog/types';

type CategoryOption = { id: string; name: string };

type ImportRecord = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'partial' | 'failed';
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  errors: Array<{ message: string; stage?: string; product_name?: string | null }>;
  summary: { collected?: number; duration_ms?: number; kind?: string };
};

type ManagerProps = {
  initialSources: CatalogSourcePublic[];
  categories: CategoryOption[];
};

type Banner = { tone: 'success' | 'error'; message: string } | null;

const KIND_META: Record<CatalogSourceKind, { label: string; icon: typeof Globe; description: string }> = {
  sitemap: {
    label: 'Crawl du site (sitemap)',
    icon: Globe,
    description: 'Récupère les fiches produits depuis votre sitemap.xml et le balisage JSON-LD / OpenGraph.',
  },
  csv: {
    label: 'Import CSV',
    icon: FileSpreadsheet,
    description: 'Importez un export catalogue (CSV / Google Shopping). Mise à jour à la demande.',
  },
  shopify: {
    label: 'Shopify',
    icon: ShoppingBag,
    description: 'Connecteur direct via l’API Admin Shopify (token d’app personnalisée).',
  },
  woocommerce: {
    label: 'WooCommerce',
    icon: Layers,
    description: 'Connecteur direct via l’API REST v3 WooCommerce (clés consumer key / secret).',
  },
};

export function ProductCatalogSourcesManager({ initialSources, categories }: ManagerProps) {
  const [sources, setSources] = useState<CatalogSourcePublic[]>(initialSources);
  const [banner, setBanner] = useState<Banner>(null);
  const [openForm, setOpenForm] = useState<CatalogSourceKind | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importsBySource, setImportsBySource] = useState<Record<string, ImportRecord[]>>({});
  const [, startTransition] = useTransition();

  const refreshSources = async () => {
    try {
      const res = await fetch('/api/product-visibility/catalog-sources', { cache: 'no-store' });
      const json = await res.json();
      if (json.ok && Array.isArray(json.sources)) {
        setSources(json.sources);
      }
    } catch {
      // silencieux : on garde l'état précédent
    }
  };

  const loadImports = async (sourceId: string) => {
    try {
      const res = await fetch(
        `/api/product-visibility/catalog-sources/${sourceId}/imports?limit=5`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (json.ok && Array.isArray(json.imports)) {
        setImportsBySource((prev) => ({ ...prev, [sourceId]: json.imports }));
      }
    } catch {
      // silencieux
    }
  };

  const handleSync = async (source: CatalogSourcePublic, csvFile?: File | null) => {
    setBusyId(source.id);
    setBanner(null);
    try {
      let res: Response;
      if (source.kind === 'csv') {
        if (!csvFile) {
          setBanner({ tone: 'error', message: 'Veuillez sélectionner un fichier CSV à importer.' });
          setBusyId(null);
          return;
        }
        const form = new FormData();
        form.append('file', csvFile);
        res = await fetch(`/api/product-visibility/catalog-sources/${source.id}/sync`, {
          method: 'POST',
          body: form,
        });
      } else {
        res = await fetch(`/api/product-visibility/catalog-sources/${source.id}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
      }
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setBanner({ tone: 'error', message: json.error || 'Échec de la synchronisation.' });
      } else {
        const s = json.summary;
        setBanner({
          tone: s.status === 'failed' ? 'error' : 'success',
          message: `Import terminé — ${s.inserted} ajouts, ${s.updated} mises à jour, ${s.error_count ?? s.errors?.length ?? 0} erreurs.`,
        });
      }
      await Promise.all([refreshSources(), loadImports(source.id)]);
    } catch (err) {
      setBanner({
        tone: 'error',
        message: err instanceof Error ? err.message : 'Erreur réseau lors de la synchronisation.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (source: CatalogSourcePublic) => {
    if (!window.confirm(`Supprimer la source "${source.name}" ? Cette action est irréversible.`)) return;
    setBusyId(source.id);
    setBanner(null);
    try {
      const res = await fetch(`/api/product-visibility/catalog-sources/${source.id}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setBanner({ tone: 'error', message: json.error || 'Suppression impossible.' });
      } else {
        setBanner({ tone: 'success', message: 'Source supprimée.' });
        startTransition(() => {
          setSources((prev) => prev.filter((s) => s.id !== source.id));
        });
      }
    } catch (err) {
      setBanner({ tone: 'error', message: err instanceof Error ? err.message : 'Erreur réseau.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleSourceCreated = async (created: CatalogSourcePublic) => {
    setSources((prev) => [created, ...prev]);
    setOpenForm(null);
    setBanner({
      tone: 'success',
      message: `Source "${created.name}" créée. Lancez une synchronisation pour récupérer les produits.`,
    });
  };

  return (
    <div className="space-y-6">
      <header className="quorum-panel-strong p-6 md:p-7">
        <p className="quorum-kicker">Sources de catalogue</p>
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] quorum-text-primary md:text-3xl">
          Connectez vos produits à Quorum
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed quorum-text-muted">
          Choisissez un connecteur pour importer votre catalogue et alimenter le module Visibilité produit.
          Vous pouvez combiner plusieurs sources (par exemple, votre site principal en sitemap et un fichier
          CSV pour les produits hors-site).
        </p>
      </header>

      {banner ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            banner.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
          }`}
        >
          {banner.message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(['sitemap', 'csv', 'shopify', 'woocommerce'] as CatalogSourceKind[]).map((kind) => {
          const meta = KIND_META[kind];
          const Icon = meta.icon;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setOpenForm(kind)}
              className="quorum-panel flex h-full flex-col gap-3 p-5 text-left transition hover:border-[color:var(--quorum-border-strong)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border quorum-border-default quorum-surface">
                  <Icon className="h-5 w-5 quorum-text-primary" />
                </div>
                <Plus className="h-4 w-4 quorum-text-muted" />
              </div>
              <p className="text-sm font-semibold quorum-text-primary">{meta.label}</p>
              <p className="text-xs leading-relaxed quorum-text-muted">{meta.description}</p>
            </button>
          );
        })}
      </section>

      <section className="quorum-panel p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="quorum-kicker">Sources actives</p>
            <h3 className="mt-2 text-lg font-semibold quorum-text-primary">
              {sources.length} source{sources.length > 1 ? 's' : ''} configurée
              {sources.length > 1 ? 's' : ''}
            </h3>
          </div>
          <button
            type="button"
            onClick={refreshSources}
            className="quorum-btn-secondary inline-flex items-center gap-2 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Rafraîchir
          </button>
        </div>

        {sources.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-[color:var(--quorum-border)] px-4 py-8 text-center text-sm quorum-text-muted">
            Aucune source configurée. Choisissez un connecteur ci-dessus pour démarrer.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {sources.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                busy={busyId === source.id}
                imports={importsBySource[source.id]}
                onLoadImports={() => loadImports(source.id)}
                onSync={(csvFile) => handleSync(source, csvFile)}
                onDelete={() => handleDelete(source)}
              />
            ))}
          </div>
        )}
      </section>

      {openForm ? (
        <SourceFormModal
          kind={openForm}
          categories={categories}
          onClose={() => setOpenForm(null)}
          onCreated={handleSourceCreated}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Ligne de source                                                            */
/* -------------------------------------------------------------------------- */

function SourceRow({
  source,
  busy,
  imports,
  onLoadImports,
  onSync,
  onDelete,
}: {
  source: CatalogSourcePublic;
  busy: boolean;
  imports: ImportRecord[] | undefined;
  onLoadImports: () => void;
  onSync: (csvFile?: File | null) => void;
  onDelete: () => void;
}) {
  const meta = KIND_META[source.kind];
  const Icon = meta.icon;
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [showImports, setShowImports] = useState(false);

  useEffect(() => {
    if (showImports && !imports) onLoadImports();
  }, [showImports, imports, onLoadImports]);

  return (
    <div className="rounded-2xl border quorum-border-default quorum-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border quorum-border-default quorum-surface">
            <Icon className="h-5 w-5 quorum-text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold quorum-text-primary">{source.name}</p>
            <p className="mt-1 text-xs quorum-text-muted">
              {meta.label} · {summarizeConfig(source)}
            </p>
            <p className="mt-1 text-[11px] quorum-text-muted">
              {source.last_synced_at
                ? `Dernière sync : ${formatLastRun(source.last_synced_at)} · ${source.last_item_count} produits`
                : 'Jamais synchronisée'}
            </p>
            {source.last_error ? (
              <p className="mt-1 text-[11px] text-rose-300">Dernière erreur : {source.last_error}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`quorum-soft-badge text-[11px] ${
              source.status === 'error'
                ? 'border-rose-500/40 text-rose-200'
                : source.status === 'paused'
                  ? 'text-amber-200'
                  : ''
            }`}
          >
            {formatStatus(source.status)}
          </span>
          {source.kind === 'csv' ? (
            <>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv,.tsv,text/tab-separated-values"
                className="hidden"
                onChange={(e) => setCsvFileName(e.target.files?.[0]?.name || null)}
              />
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="quorum-btn-secondary inline-flex items-center gap-1 text-xs"
                disabled={busy}
              >
                <Upload className="h-3.5 w-3.5" />
                {csvFileName ? csvFileName.slice(0, 24) : 'Choisir un fichier'}
              </button>
              <button
                type="button"
                onClick={() => onSync(csvInputRef.current?.files?.[0] || null)}
                disabled={busy}
                className="quorum-btn-primary inline-flex items-center gap-1 text-xs"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Importer
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSync()}
              disabled={busy}
              className="quorum-btn-primary inline-flex items-center gap-1 text-xs"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Synchroniser
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowImports((v) => !v)}
            className="quorum-btn-secondary inline-flex items-center gap-1 text-xs"
          >
            Historique
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="quorum-btn-secondary inline-flex items-center gap-1 text-xs text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </button>
        </div>
      </div>

      {showImports ? <ImportsTable imports={imports} /> : null}
    </div>
  );
}

function summarizeConfig(source: CatalogSourcePublic): string {
  const cfg = source.config_summary;
  switch (source.kind) {
    case 'sitemap':
      return cfg.homepage_url || cfg.sitemap_url || '—';
    case 'csv':
      return cfg.brand_default ? `Marque par défaut : ${cfg.brand_default}` : 'Fichier CSV';
    case 'shopify':
      return cfg.shop_domain ? `${cfg.shop_domain}` : '—';
    case 'woocommerce':
      return cfg.site_url || '—';
    default:
      return '—';
  }
}

function ImportsTable({ imports }: { imports: ImportRecord[] | undefined }) {
  if (!imports) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs quorum-text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement de l’historique…
      </div>
    );
  }
  if (imports.length === 0) {
    return <p className="mt-3 text-xs quorum-text-muted">Aucun import enregistré.</p>;
  }
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-[color:var(--quorum-border)]">
      <table className="min-w-full text-left text-xs">
        <thead className="quorum-text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Démarré</th>
            <th className="px-3 py-2 font-medium">Statut</th>
            <th className="px-3 py-2 font-medium">Ajoutés</th>
            <th className="px-3 py-2 font-medium">Mis à jour</th>
            <th className="px-3 py-2 font-medium">Ignorés</th>
            <th className="px-3 py-2 font-medium">Erreurs</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((row) => {
            const StatusIcon = row.status === 'success' ? CheckCircle2 : XCircle;
            const colorClass =
              row.status === 'success'
                ? 'text-emerald-300'
                : row.status === 'partial'
                  ? 'text-amber-300'
                  : row.status === 'running'
                    ? 'quorum-text-muted'
                    : 'text-rose-300';
            return (
              <tr key={row.id} className="border-t border-[color:var(--quorum-border)]">
                <td className="px-3 py-2 quorum-text-muted">{formatDateTimeFr(row.started_at)}</td>
                <td className={`px-3 py-2 ${colorClass}`}>
                  <span className="inline-flex items-center gap-1">
                    <StatusIcon className="h-3.5 w-3.5" />
                    {formatStatus(row.status)}
                  </span>
                </td>
                <td className="px-3 py-2 quorum-text-primary">{row.inserted_count}</td>
                <td className="px-3 py-2 quorum-text-primary">{row.updated_count}</td>
                <td className="px-3 py-2 quorum-text-muted">{row.skipped_count}</td>
                <td className="px-3 py-2 quorum-text-muted">{row.error_count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Modale de création                                                         */
/* -------------------------------------------------------------------------- */

function SourceFormModal({
  kind,
  categories,
  onClose,
  onCreated,
}: {
  kind: CatalogSourceKind;
  categories: CategoryOption[];
  onClose: () => void;
  onCreated: (source: CatalogSourcePublic) => void;
}) {
  const meta = KIND_META[kind];
  const [name, setName] = useState(meta.label);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('');
  const [isOwned, setIsOwned] = useState(true);
  const [brandDefault, setBrandDefault] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [maxPages, setMaxPages] = useState<string>('1500');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (key: string, value: string) => setConfig((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async () => {
    setError(null);

    if (kind === 'csv') {
      if (!csvFile) {
        setError('Veuillez sélectionner un fichier CSV.');
        return;
      }
      setSubmitting(true);
      try {
        const form = new FormData();
        form.append('file', csvFile);
        form.append('name', name || `CSV — ${csvFile.name}`);
        form.append('is_owned', isOwned ? 'true' : 'false');
        if (brandDefault) form.append('brand_default', brandDefault);
        if (defaultCategoryId) form.append('default_category_id', defaultCategoryId);
        const res = await fetch('/api/product-visibility/catalog-sources/csv-upload', {
          method: 'POST',
          body: form,
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          setError(json.error || 'Échec de l’import.');
          return;
        }
        if (json.source) onCreated(json.source);
        else onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur réseau.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        kind,
        name,
        default_category_id: defaultCategoryId || null,
        config: {
          ...config,
          is_owned: isOwned,
          brand_default: brandDefault || null,
          max_pages: kind === 'sitemap' && maxPages ? Number(maxPages) : undefined,
        },
      };
      const res = await fetch('/api/product-visibility/catalog-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'Création impossible.');
        return;
      }
      onCreated(json.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="quorum-panel-strong relative w-full max-w-xl overflow-hidden rounded-3xl border quorum-border-default p-6 md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="quorum-kicker">{meta.label}</p>
            <h3 className="mt-2 text-xl font-semibold quorum-text-primary">Nouvelle source</h3>
            <p className="mt-1 text-xs quorum-text-muted">{meta.description}</p>
          </div>
          <button type="button" onClick={onClose} className="quorum-btn-secondary text-xs">
            Fermer
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Nom interne">
            <input
              type="text"
              className="quorum-input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Catalogue principal"
            />
          </Field>

          {kind === 'sitemap' ? <SitemapFields config={config} setField={setField} maxPages={maxPages} setMaxPages={setMaxPages} /> : null}
          {kind === 'shopify' ? <ShopifyFields config={config} setField={setField} /> : null}
          {kind === 'woocommerce' ? <WooFields config={config} setField={setField} /> : null}
          {kind === 'csv' ? (
            <CsvFields csvFile={csvFile} setCsvFile={setCsvFile} />
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Catégorie par défaut (facultatif)">
              <select
                className="quorum-input w-full"
                value={defaultCategoryId}
                onChange={(e) => setDefaultCategoryId(e.target.value)}
              >
                <option value="">Aucune</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Marque par défaut (facultatif)">
              <input
                type="text"
                className="quorum-input w-full"
                value={brandDefault}
                onChange={(e) => setBrandDefault(e.target.value)}
                placeholder="ex. Manutan"
              />
            </Field>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border quorum-border-default quorum-surface px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={isOwned}
              onChange={(e) => setIsOwned(e.target.checked)}
              className="h-4 w-4"
            />
            <span>
              <span className="block quorum-text-primary">Ce sont vos produits</span>
              <span className="block text-xs quorum-text-muted">
                Décochez si vous suivez le catalogue d’un concurrent.
              </span>
            </span>
          </label>

          {error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="quorum-btn-secondary text-sm">
              Annuler
            </button>
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="quorum-btn-primary inline-flex items-center gap-2 text-sm"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {kind === 'csv' ? 'Importer le CSV' : 'Créer la source'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="quorum-kicker text-[11px]">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint ? <p className="mt-1 text-[11px] quorum-text-muted">{hint}</p> : null}
    </div>
  );
}

function SitemapFields({
  config,
  setField,
  maxPages,
  setMaxPages,
}: {
  config: Record<string, string>;
  setField: (k: string, v: string) => void;
  maxPages: string;
  setMaxPages: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="URL du site" hint="On découvre automatiquement le sitemap depuis le robots.txt.">
        <input
          type="url"
          className="quorum-input w-full"
          value={config.homepage_url || ''}
          onChange={(e) => setField('homepage_url', e.target.value)}
          placeholder="https://www.manutan.fr"
        />
      </Field>
      <Field label="URL du sitemap (facultatif)" hint="Si la découverte automatique échoue, indiquez l’URL exacte.">
        <input
          type="url"
          className="quorum-input w-full"
          value={config.sitemap_url || ''}
          onChange={(e) => setField('sitemap_url', e.target.value)}
          placeholder="https://www.exemple.com/sitemap-products.xml"
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Max. URLs">
          <input
            type="number"
            min={10}
            max={5000}
            className="quorum-input w-full"
            value={maxPages}
            onChange={(e) => setMaxPages(e.target.value)}
          />
        </Field>
        <Field label="URLs à inclure (motifs)" hint="Séparés par virgule. Ex : /produit/, /p/">
          <input
            type="text"
            className="quorum-input w-full"
            value={config.url_include || ''}
            onChange={(e) => setField('url_include', e.target.value)}
            placeholder="/produit/, /p/"
          />
        </Field>
        <Field label="URLs à exclure" hint="Ex : /blog/, /aide">
          <input
            type="text"
            className="quorum-input w-full"
            value={config.url_exclude || ''}
            onChange={(e) => setField('url_exclude', e.target.value)}
            placeholder="/blog/, /aide"
          />
        </Field>
      </div>
    </div>
  );
}

function ShopifyFields({
  config,
  setField,
}: {
  config: Record<string, string>;
  setField: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="Domaine Shopify" hint="Format attendu : votre-boutique.myshopify.com (sans https://).">
        <input
          type="text"
          className="quorum-input w-full"
          value={config.shop_domain || ''}
          onChange={(e) => setField('shop_domain', e.target.value)}
          placeholder="votre-boutique.myshopify.com"
        />
      </Field>
      <Field
        label="Token d’API Admin"
        hint="Dans Shopify, créez une « Custom App » avec les permissions read_products / read_product_listings."
      >
        <input
          type="password"
          className="quorum-input w-full"
          value={config.shopify_access_token || ''}
          onChange={(e) => setField('shopify_access_token', e.target.value)}
          placeholder="shpat_..."
        />
      </Field>
      <a
        href="https://help.shopify.com/manual/apps/app-types/custom-apps"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs quorum-text-muted underline"
      >
        Guide Shopify : créer une custom app <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function WooFields({
  config,
  setField,
}: {
  config: Record<string, string>;
  setField: (k: string, v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Field label="URL du site" hint="La racine du site WordPress, ex. https://mon-site.fr">
        <input
          type="url"
          className="quorum-input w-full"
          value={config.site_url || ''}
          onChange={(e) => setField('site_url', e.target.value)}
          placeholder="https://mon-site.fr"
        />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Consumer key">
          <input
            type="text"
            className="quorum-input w-full"
            value={config.consumer_key || ''}
            onChange={(e) => setField('consumer_key', e.target.value)}
            placeholder="ck_..."
          />
        </Field>
        <Field label="Consumer secret">
          <input
            type="password"
            className="quorum-input w-full"
            value={config.consumer_secret || ''}
            onChange={(e) => setField('consumer_secret', e.target.value)}
            placeholder="cs_..."
          />
        </Field>
      </div>
      <a
        href="https://woocommerce.com/document/woocommerce-rest-api/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs quorum-text-muted underline"
      >
        Guide WooCommerce : générer une clé API <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function CsvFields({ csvFile, setCsvFile }: { csvFile: File | null; setCsvFile: (f: File | null) => void }) {
  return (
    <Field
      label="Fichier CSV"
      hint="Colonnes reconnues : id/sku, title/nom, brand/marque, link/url, image_link, category, price, availability, description."
    >
      <input
        type="file"
        accept=".csv,text/csv,.tsv,text/tab-separated-values"
        onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
        className="block w-full text-xs quorum-text-muted file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--quorum-surface)] file:px-4 file:py-2 file:text-xs file:font-medium file:quorum-text-primary"
      />
      {csvFile ? (
        <p className="mt-1 text-[11px] quorum-text-muted">
          {csvFile.name} · {(csvFile.size / 1024).toFixed(0)} Ko
        </p>
      ) : null}
    </Field>
  );
}
