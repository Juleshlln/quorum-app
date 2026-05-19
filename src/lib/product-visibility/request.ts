import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveProjectForUser } from '@/lib/projects/get-active-project';
import {
  buildWindowFromDays,
  buildPreviousWindow,
  type ProductVisibilityDateWindow,
} from '@/lib/product-visibility/service';
import { parseRange, rangeToDays, type ProductVisibilityRange } from '@/lib/product-visibility/format';

export async function requireActiveProjectForProductVisibility() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'Session expirée. Reconnectez-vous.' }, { status: 401 }) };
  }

  const project = await getActiveProjectForUser(user.id);
  if (!project) {
    return { error: NextResponse.json({ error: 'Aucune marque active.' }, { status: 400 }) };
  }

  return { user, project };
}

/**
 * Compatibilité héritée : retourne uniquement la fenêtre courante,
 * en supportant `?days=` (legacy) et `?range=7d|30d|90d`.
 */
export function resolveProductVisibilityWindow(url: string, fallbackDays = 30): ProductVisibilityDateWindow {
  const { searchParams } = new URL(url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (startDate && endDate) {
    return { startDate, endDate };
  }

  const rangeParam = searchParams.get('range');
  if (rangeParam) {
    return buildWindowFromDays(rangeToDays(parseRange(rangeParam)));
  }

  const daysRaw = Number(searchParams.get('days') || fallbackDays);
  const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.round(daysRaw) : fallbackDays;
  return buildWindowFromDays(days);
}

export type ResolvedProductVisibilityRange = {
  range: ProductVisibilityRange;
  window: ProductVisibilityDateWindow;
  previousWindow: ProductVisibilityDateWindow;
};

/**
 * Résout la plage temporelle standardisée du module Visibilité produit.
 *
 * Supporte :
 * - `?range=7d|30d|90d` (forme officielle)
 * - `?days=N` (compatibilité)
 * - `?startDate=&endDate=` (override explicite)
 *
 * Retourne aussi la fenêtre précédente équivalente pour calculer les deltas.
 */
export function resolveProductVisibilityRange(
  url: string,
  fallback: ProductVisibilityRange = '30d',
): ResolvedProductVisibilityRange {
  const { searchParams } = new URL(url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  let window: ProductVisibilityDateWindow;
  let range: ProductVisibilityRange = fallback;

  if (startDate && endDate) {
    window = { startDate, endDate };
    // On essaie d'inférer un range standard à partir du nombre de jours.
    const start = new Date(`${startDate}T00:00:00Z`).getTime();
    const end = new Date(`${endDate}T00:00:00Z`).getTime();
    const days = Math.max(1, Math.round((end - start) / 86_400_000) + 1);
    if (days <= 7) range = '7d';
    else if (days <= 30) range = '30d';
    else range = '90d';
  } else {
    const rangeParam = searchParams.get('range');
    const daysParam = searchParams.get('days');
    if (rangeParam) {
      range = parseRange(rangeParam, fallback);
      window = buildWindowFromDays(rangeToDays(range));
    } else if (daysParam) {
      const daysRaw = Number(daysParam);
      const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.round(daysRaw) : rangeToDays(fallback);
      if (days <= 7) range = '7d';
      else if (days <= 30) range = '30d';
      else range = '90d';
      window = buildWindowFromDays(days);
    } else {
      window = buildWindowFromDays(rangeToDays(fallback));
    }
  }

  const previousWindow = buildPreviousWindow(window);
  return { range, window, previousWindow };
}
