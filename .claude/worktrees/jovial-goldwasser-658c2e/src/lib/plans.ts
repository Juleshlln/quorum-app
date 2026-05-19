export type UserPlan = 'starter' | 'pro' | 'enterprise';

export function getRunsForPlan(plan?: UserPlan | string | null): number {
  const value = String(plan || 'starter').toLowerCase();
  if (value === 'pro') return 8;
  if (value === 'enterprise') return 12;
  return 5;
}
