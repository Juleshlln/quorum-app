'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Link2, Trash2, RefreshCw } from 'lucide-react';

type ConnectionRow = {
  id: string;
  provider: string;
  property_id: string | null;
  site_url: string | null;
  status: string;
  last_synced_at: string | null;
  last_error: string | null;
  metadata: Record<string, unknown> | null;
};

type AnalyticsConnectionsProps = {
  projectId: string;
  projectWebsite: string | null;
  initialConnections: ConnectionRow[];
};

function providerLabel(provider: string) {
  if (provider === 'ga4') return 'Google Analytics 4';
  if (provider === 'gsc') return 'Google Search Console';
  if (provider === 'matomo') return 'Matomo';
  return provider;
}

function statusBadge(status: string) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-emerald-200">
        <CheckCircle2 className="h-3 w-3" />
        Actif
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-rose-200">
        <XCircle className="h-3 w-3" />
        Erreur
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-zinc-400/20 bg-zinc-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300">
      {status}
    </span>
  );
}

export function AnalyticsConnections({
  projectId,
  projectWebsite,
  initialConnections,
}: AnalyticsConnectionsProps) {
  const [connections, setConnections] = useState<ConnectionRow[]>(initialConnections);
  const [showForm, setShowForm] = useState<'ga4' | 'gsc' | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const ga4 = connections.find((c) => c.provider === 'ga4');
  const gsc = connections.find((c) => c.provider === 'gsc');

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch('/api/business-impact/attribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Sync failed');
      const rows = data.attribution?.rows ?? 0;
      const traffic = data.ingestion?.trafficRows ?? 0;
      setSyncResult(`Sync terminé : ${traffic} lignes trafic, ${rows} événements d'attribution.`);
    } catch (error) {
      setSyncResult(error instanceof Error ? error.message : 'Erreur de synchronisation');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Existing connections */}
      {connections.length > 0 && (
        <div className="space-y-3">
          {connections.map((connection) => (
            <div
              key={connection.id}
              className="rounded-[22px] border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-5 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium quorum-text-primary">{providerLabel(connection.provider)}</p>
                  <p className="mt-1 text-xs quorum-text-muted">
                    {connection.site_url || connection.property_id || 'Configuré'}
                  </p>
                </div>
                {statusBadge(connection.status)}
              </div>
              {connection.last_synced_at && (
                <p className="mt-2 text-xs quorum-text-muted">
                  Dernière sync : {new Date(connection.last_synced_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              {connection.last_error && (
                <p className="mt-1 text-xs text-rose-300">{connection.last_error}</p>
              )}
            </div>
          ))}

          {/* Sync button */}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="quorum-btn-secondary w-full justify-center gap-2"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? 'Synchronisation en cours…' : 'Lancer une synchronisation'}
          </button>
          {syncResult && (
            <p className="text-xs quorum-text-muted text-center">{syncResult}</p>
          )}
        </div>
      )}

      {/* Add connector buttons */}
      <div className="grid gap-3 sm:grid-cols-2">
        {!ga4 && (
          <button
            onClick={() => setShowForm(showForm === 'ga4' ? null : 'ga4')}
            className="quorum-btn-secondary justify-center gap-2"
          >
            <Link2 className="h-4 w-4" />
            Connecter GA4
          </button>
        )}
        {!gsc && (
          <button
            onClick={() => setShowForm(showForm === 'gsc' ? null : 'gsc')}
            className="quorum-btn-secondary justify-center gap-2"
          >
            <Link2 className="h-4 w-4" />
            Connecter Search Console
          </button>
        )}
      </div>

      {/* GA4 Form */}
      {showForm === 'ga4' && (
        <GA4Form
          projectWebsite={projectWebsite}
          onSuccess={(connection) => {
            setConnections((prev) => [...prev.filter((c) => c.provider !== 'ga4'), connection]);
            setShowForm(null);
          }}
          onCancel={() => setShowForm(null)}
        />
      )}

      {/* GSC Form */}
      {showForm === 'gsc' && (
        <GSCForm
          projectWebsite={projectWebsite}
          onSuccess={(connection) => {
            setConnections((prev) => [...prev.filter((c) => c.provider !== 'gsc'), connection]);
            setShowForm(null);
          }}
          onCancel={() => setShowForm(null)}
        />
      )}

      {connections.length === 0 && !showForm && (
        <div className="rounded-[22px] border border-dashed border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] px-5 py-6 text-center">
          <p className="text-sm quorum-text-muted">
            Aucun connecteur analytics configuré. Connectez GA4 ou Google Search Console pour activer le Business Impact.
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  GA4 Connection Form                                                       */
/* -------------------------------------------------------------------------- */

function GA4Form({
  projectWebsite,
  onSuccess,
  onCancel,
}: {
  projectWebsite: string | null;
  onSuccess: (connection: ConnectionRow) => void;
  onCancel: () => void;
}) {
  const [propertyId, setPropertyId] = useState('');
  const [siteUrl, setSiteUrl] = useState(projectWebsite || '');
  const [credentials, setCredentials] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let parsedCredentials: unknown;
      try {
        parsedCredentials = JSON.parse(credentials);
      } catch {
        throw new Error('Le JSON des credentials est invalide. Collez le contenu du fichier service account JSON.');
      }

      const response = await fetch('/api/integrations/ga4/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: propertyId.trim(),
          siteUrl: siteUrl.trim() || null,
          credentials: parsedCredentials,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Connexion GA4 échouée');
      onSuccess(data.connection);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[22px] border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold quorum-text-primary">Connecter Google Analytics 4</p>
        <p className="mt-1 text-xs quorum-text-muted">
          Renseignez le Property ID GA4 et collez le JSON du service account Google.
        </p>
      </div>

      <div className="space-y-2">
        <label className="quorum-label mb-0">Property ID</label>
        <input
          type="text"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          placeholder="123456789"
          required
          className="quorum-input"
        />
        <p className="text-xs quorum-text-subtle">
          Trouvable dans GA4 → Admin → Property Settings. Format numérique uniquement.
        </p>
      </div>

      <div className="space-y-2">
        <label className="quorum-label mb-0">URL du site (optionnel)</label>
        <input
          type="text"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="https://www.example.com"
          className="quorum-input"
        />
        <p className="text-xs quorum-text-subtle">
          Utilisé pour construire les URLs absolues des pages. Par défaut le site du projet.
        </p>
      </div>

      <div className="space-y-2">
        <label className="quorum-label mb-0">Service Account JSON</label>
        <textarea
          value={credentials}
          onChange={(e) => setCredentials(e.target.value)}
          placeholder={'{\n  "type": "service_account",\n  "client_email": "...",\n  "private_key": "..."\n}'}
          required
          rows={6}
          className="quorum-input resize-y font-mono text-xs"
        />
        <p className="text-xs quorum-text-subtle">
          Créez un service account dans la Google Cloud Console, puis ajoutez-le en viewer sur votre propriété GA4.
        </p>
      </div>

      {error && (
        <p className="text-sm text-rose-300">{error}</p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="quorum-btn-primary gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Validation…' : 'Connecter GA4'}
        </button>
        <button type="button" onClick={onCancel} className="quorum-btn-secondary">
          Annuler
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  GSC Connection Form                                                       */
/* -------------------------------------------------------------------------- */

function GSCForm({
  projectWebsite,
  onSuccess,
  onCancel,
}: {
  projectWebsite: string | null;
  onSuccess: (connection: ConnectionRow) => void;
  onCancel: () => void;
}) {
  const [siteUrl, setSiteUrl] = useState(projectWebsite || '');
  const [credentials, setCredentials] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let parsedCredentials: unknown;
      try {
        parsedCredentials = JSON.parse(credentials);
      } catch {
        throw new Error('Le JSON des credentials est invalide. Collez le contenu du fichier service account JSON.');
      }

      const response = await fetch('/api/integrations/gsc/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: siteUrl.trim(),
          credentials: parsedCredentials,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Connexion Search Console échouée');
      onSuccess(data.connection);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[22px] border border-[color:var(--quorum-border)] bg-[var(--quorum-surface)] p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold quorum-text-primary">Connecter Google Search Console</p>
        <p className="mt-1 text-xs quorum-text-muted">
          Renseignez l'URL du site GSC et collez le JSON du service account Google.
        </p>
      </div>

      <div className="space-y-2">
        <label className="quorum-label mb-0">URL du site</label>
        <input
          type="text"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="https://www.example.com ou sc-domain:example.com"
          required
          className="quorum-input"
        />
        <p className="text-xs quorum-text-subtle">
          Doit correspondre exactement à une propriété dans Search Console (URL complète ou domaine sc-domain:).
        </p>
      </div>

      <div className="space-y-2">
        <label className="quorum-label mb-0">Service Account JSON</label>
        <textarea
          value={credentials}
          onChange={(e) => setCredentials(e.target.value)}
          placeholder={'{\n  "type": "service_account",\n  "client_email": "...",\n  "private_key": "..."\n}'}
          required
          rows={6}
          className="quorum-input resize-y font-mono text-xs"
        />
        <p className="text-xs quorum-text-subtle">
          Le service account doit avoir accès en lecture à la propriété Search Console.
        </p>
      </div>

      {error && (
        <p className="text-sm text-rose-300">{error}</p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="quorum-btn-primary gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Validation…' : 'Connecter Search Console'}
        </button>
        <button type="button" onClick={onCancel} className="quorum-btn-secondary">
          Annuler
        </button>
      </div>
    </form>
  );
}
