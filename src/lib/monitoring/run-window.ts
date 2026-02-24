import crypto from 'crypto';

export type RunWindow = {
  windowStart: string;
  windowEnd: string;
  windowDays: number;
};

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function buildRunWindow(windowDays: number, now = new Date()): RunWindow {
  const safeDays = [7, 30, 90].includes(windowDays) ? windowDays : 30;
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (safeDays - 1));
  return {
    windowStart: toDateString(start),
    windowEnd: toDateString(end),
    windowDays: safeDays,
  };
}

export function normalizeWindowParam(value: string | null | undefined): number {
  if (!value) return 30;
  const lowered = value.toLowerCase();
  if (lowered.endsWith('d')) {
    const raw = Number(lowered.slice(0, -1));
    if (!Number.isNaN(raw)) return raw;
  }
  const raw = Number(lowered);
  return Number.isNaN(raw) ? 30 : raw;
}

export function hashModels(models: string[]) {
  const sorted = [...models].map((m) => m.trim()).filter(Boolean).sort();
  const payload = JSON.stringify(sorted);
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function buildWindowFromEnd(windowDays: number, windowEnd: string): RunWindow {
  const safeDays = [7, 30, 90].includes(windowDays) ? windowDays : 30;
  const end = new Date(`${windowEnd}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (safeDays - 1));
  return {
    windowStart: start.toISOString().slice(0, 10),
    windowEnd,
    windowDays: safeDays,
  };
}
