export function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function toPercent(count: number, total: number) {
  if (total <= 0) return 0;
  return round((count / total) * 100, 1);
}
