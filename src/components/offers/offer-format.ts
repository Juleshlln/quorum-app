import type { OfferPriority, OfferType } from '@/lib/offer-visibility/types';

export function formatPercent(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return 'Données insuffisantes';
  }
  return `${Math.round(Number(value) * 100 * 10 ** digits) / 10 ** digits} %`;
}

export function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return 'Données insuffisantes';
  }
  return `${Math.round(Number(value))}/100`;
}

export function formatPosition(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Données insuffisantes';
  return `#${Number(value).toFixed(1).replace('.0', '')}`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Jamais';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function offerTypeLabel(type: OfferType) {
  return type === 'service' ? 'Service' : 'Catégorie produit';
}

export function priorityLabel(priority: OfferPriority | null | undefined) {
  if (priority === 'high') return 'Priorité élevée';
  if (priority === 'low') return 'Priorité faible';
  return 'Priorité moyenne';
}
