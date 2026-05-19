/**
 * Helpers de formatage pour le module Visibilité produit.
 *
 * - Normalisation de scores (gère 0-1, 0-100, null, NaN).
 * - Formatage français des libellés métier (intention d'achat, priorité, sentiment, etc.).
 * - Formatage de dates / pourcentages cohérents partout dans le module.
 *
 * Règle : si la valeur est inconnue ou non renseignée, on retourne un fallback
 * lisible ("—" ou "Non renseigné") plutôt qu'une chaîne vide ou "null".
 */

const DASH = '—';

/* -------------------------------------------------------------------------- */
/*  Scores                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Ramène une valeur entre 0 et 100.
 * - Si la valeur est entre 0 et 1, on multiplie par 100.
 * - Sinon on clamp dans [0, 100].
 * - Retourne null si la valeur est manquante / NaN.
 */
export function normalizeScore(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const scaled = n > 0 && n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, scaled));
}

/** Formatte un score 0-100 en pourcentage français : "62.4 %". */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  const normalized = normalizeScore(value);
  if (normalized === null) return DASH;
  return `${normalized.toFixed(digits).replace('.', ',')} %`;
}

/** Formatte un score 0-100 sans suffixe (ex: pour un badge "62"). */
export function formatScore(value: number | null | undefined, digits = 0): string {
  const normalized = normalizeScore(value);
  if (normalized === null) return DASH;
  return normalized.toFixed(digits).replace('.', ',');
}

/** Formatte un delta signé : "+4,1 pts" / "-1,8 pts" / "—". */
export function formatDelta(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return DASH;
  const n = Number(value);
  if (!Number.isFinite(n)) return DASH;
  const rounded = Number(n.toFixed(digits));
  if (rounded === 0) return '0 pts';
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toString().replace('.', ',')} pts`;
}

/** Formatte un nombre entier avec séparateur de milliers français. */
export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  const n = Number(value);
  if (!Number.isFinite(n)) return DASH;
  return Math.round(n).toLocaleString('fr-FR');
}

export function formatNumberFr(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return DASH;
  const n = Number(value);
  if (!Number.isFinite(n)) return DASH;
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export const formatPercentFr = formatPercent;

/** Formatte un delta entier signé : "+12" / "-3" / "0". */
export function formatIntegerDelta(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  const n = Number(value);
  if (!Number.isFinite(n)) return DASH;
  const rounded = Math.round(n);
  if (rounded === 0) return '0';
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toLocaleString('fr-FR')}`;
}

/** Formatte une position de classement : "#3" / "—". */
export function formatRanking(value: number | null | undefined): string {
  if (value === null || value === undefined) return DASH;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DASH;
  return `#${Math.round(n * 10) / 10}`.replace('.', ',');
}

/* -------------------------------------------------------------------------- */
/*  Libellés métier                                                            */
/* -------------------------------------------------------------------------- */

const BUYING_INTENT_LABELS: Record<string, string> = {
  discovery: 'Découverte',
  comparison: 'Comparaison',
  purchase: 'Achat',
  use_case: 'Cas d’usage',
  specification: 'Spécifications',
  brand: 'Marque',
  category: 'Catégorie',
  competitive: 'Concurrentiel',
  decision: 'Décision',
  'attribute-based': 'Recherche par attribut',
  attribute_based: 'Recherche par attribut',
  attribute: 'Recherche par attribut',
};

export function formatBuyingIntent(value: string | null | undefined): string {
  if (!value) return 'Non renseigné';
  const key = value.toString().toLowerCase().trim();
  return BUYING_INTENT_LABELS[key] || 'Non renseigné';
}

const PROVIDER_LABELS: Record<string, string> = {
  all: 'Tous les moteurs',
  openai: 'ChatGPT',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  google: 'Gemini',
  claude: 'Claude',
  anthropic: 'Claude',
  perplexity: 'Perplexity',
  llama: 'Llama',
  grok: 'Grok',
  xai: 'Grok',
  deepseek: 'DeepSeek',
};

export function formatProviderLabel(value: string | null | undefined): string {
  if (!value) return DASH;
  return PROVIDER_LABELS[value.toString().toLowerCase().trim()] || value;
}

export function formatProviderStatus(args: {
  status?: string | null;
  hasData?: boolean | null;
}): string {
  if (args.status === 'missing_api_key') return 'Clé API manquante';
  if (args.status === 'disabled') return 'Non configuré';
  if (args.status === 'error') return 'Erreur';
  if (args.status === 'configured' && args.hasData) return 'Données disponibles';
  if (args.status === 'configured') return 'Non analysé';
  return 'Non configuré';
}

export function formatScoreStatus(value: number | null | undefined): string {
  const normalized = normalizeScore(value);
  if (normalized === null) return 'Données insuffisantes';
  if (normalized >= 75) return 'Excellent';
  if (normalized >= 60) return 'Solide';
  if (normalized >= 40) return 'À surveiller';
  if (normalized >= 1) return 'Faible';
  return 'Données insuffisantes';
}

export function formatOpportunityLevel(value: string | number | null | undefined): string {
  if (typeof value === 'string') {
    const key = value.toLowerCase().trim();
    if (key === 'high') return 'Forte';
    if (key === 'medium') return 'Moyenne';
    if (key === 'low') return 'Faible';
  }

  const normalized = normalizeScore(typeof value === 'number' ? value : null);
  if (normalized === null) return DASH;
  if (normalized >= 70) return 'Forte';
  if (normalized >= 40) return 'Moyenne';
  return 'Faible';
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Quotidien',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  hourly: 'Toutes les heures',
};

export function formatFrequency(value: string | null | undefined): string {
  if (!value) return DASH;
  return FREQUENCY_LABELS[value.toString().toLowerCase().trim()] || DASH;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  paused: 'En pause',
  draft: 'Brouillon',
  validated: 'Validé',
  archived: 'Archivé',
  open: 'À traiter',
  in_progress: 'En cours',
  completed: 'Terminé',
  done: 'Terminé',
  dismissed: 'Ignoré',
  pending: 'En attente',
  failed: 'Échec',
  succeeded: 'Réussi',
  running: 'En cours',
};

export function formatStatus(value: string | null | undefined): string {
  if (!value) return DASH;
  return STATUS_LABELS[value.toString().toLowerCase().trim()] || DASH;
}

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Faible',
  critical: 'Critique',
};

export function formatPriority(value: string | null | undefined): string {
  if (!value) return DASH;
  return PRIORITY_LABELS[value.toString().toLowerCase().trim()] || DASH;
}

const EFFORT_LABELS: Record<string, string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
};

export function formatEffort(value: string | null | undefined): string {
  if (!value) return DASH;
  return EFFORT_LABELS[value.toString().toLowerCase().trim()] || DASH;
}

/**
 * Formatte un score de sentiment.
 * Le score peut être stocké entre -1 et 1 (parser) ou entre 0 et 100.
 */
export function formatSentiment(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'Non mesuré';
  const n = Number(score);
  if (!Number.isFinite(n)) return 'Non mesuré';

  // Cas -1 .. 1 (parser)
  if (n >= -1 && n <= 1) {
    if (n >= 0.25) return 'Positif';
    if (n <= -0.25) return 'Négatif';
    return 'Neutre';
  }

  // Cas 0 .. 100
  const normalized = Math.max(0, Math.min(100, n));
  if (normalized >= 65) return 'Positif';
  if (normalized <= 35) return 'Négatif';
  return 'Neutre';
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  owned: 'Vos sources',
  competitor: 'Source concurrente',
  third_party: 'Source tierce',
};

export function formatSourceType(value: string | null | undefined): string {
  if (!value) return DASH;
  return SOURCE_TYPE_LABELS[value.toString().toLowerCase().trim()] || value;
}

/** Type d'élément produit : vos produits / concurrent. */
export function formatOwnership(isOwned: boolean | null | undefined): string {
  if (isOwned === true) return 'Vos produits';
  if (isOwned === false) return 'Concurrent';
  return DASH;
}

/* -------------------------------------------------------------------------- */
/*  Dates                                                                      */
/* -------------------------------------------------------------------------- */

/** Formatte une date ISO en court français : "12 avr.". */
export function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) return DASH;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/** Formatte une date ISO en long français : "12 avril 2026". */
export function formatDateFrLong(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(date.getTime())) return DASH;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Formatte un timestamp en "12/04 14:32". */
export function formatDateTimeFr(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return DASH;
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "Dernière analyse : il y a 2 jours" / "Aucune analyse". */
export function formatLastRun(iso: string | null | undefined): string {
  if (!iso) return 'Aucune analyse';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Aucune analyse';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return formatDateTimeFr(iso);
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return minutes <= 1 ? "à l'instant" : `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'il y a 1 h' : `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days <= 30) return days === 1 ? 'hier' : `il y a ${days} jours`;
  return formatDateFrLong(iso);
}

/* -------------------------------------------------------------------------- */
/*  Plages temporelles (range)                                                 */
/* -------------------------------------------------------------------------- */

export type ProductVisibilityRange = '7d' | '30d' | '90d';

export const RANGE_LABELS: Record<ProductVisibilityRange, string> = {
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
  '90d': '90 derniers jours',
};

export function rangeToDays(range: ProductVisibilityRange): number {
  switch (range) {
    case '7d':
      return 7;
    case '90d':
      return 90;
    case '30d':
    default:
      return 30;
  }
}

export function parseRange(value: string | null | undefined, fallback: ProductVisibilityRange = '30d'): ProductVisibilityRange {
  if (value === '7d' || value === '30d' || value === '90d') return value;
  return fallback;
}
