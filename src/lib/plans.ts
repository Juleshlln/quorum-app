export type UserPlan = 'starter' | 'pro' | 'enterprise';

export function getRunsForPlan(plan?: UserPlan | string | null): number {
  const value = String(plan || 'starter').toLowerCase();
  if (value === 'pro') return 8;
  if (value === 'enterprise') return 12;
  return 5;
}

export type OfferVisibilityPlanLimits = {
  maxOffers: number | null;
  maxPromptsPerOffer: number | null;
  maxOfferRunsPerMonth: number | null;
  maxPromptsPerRun: number | null;
};

export type OfferVisibilityPlanConfig = {
  isDevelopmentUnlimited: boolean;
  label: string;
  limits: OfferVisibilityPlanLimits;
  plan: UserPlan | 'development';
};

export function areOfferVisibilityLimitsDisabled() {
  return process.env.NODE_ENV !== 'production' || process.env.OFFER_VISIBILITY_DISABLE_PLAN_LIMITS === 'true';
}

export function normalizeUserPlan(plan?: UserPlan | string | null): UserPlan {
  const value = String(plan || 'starter').toLowerCase();
  if (value === 'pro') return 'pro';
  if (value === 'enterprise') return 'enterprise';
  return 'starter';
}

export function getOfferVisibilityPlanConfig(plan?: UserPlan | string | null): OfferVisibilityPlanConfig {
  if (areOfferVisibilityLimitsDisabled()) {
    return {
      isDevelopmentUnlimited: true,
      label: 'Développement',
      plan: 'development',
      limits: {
        maxOffers: null,
        maxPromptsPerOffer: null,
        maxOfferRunsPerMonth: null,
        maxPromptsPerRun: null,
      },
    };
  }

  const normalizedPlan = normalizeUserPlan(plan);

  if (normalizedPlan === 'enterprise') {
    return {
      isDevelopmentUnlimited: false,
      label: 'Enterprise',
      plan: 'enterprise',
      limits: {
        maxOffers: null,
        maxPromptsPerOffer: null,
        maxOfferRunsPerMonth: null,
        maxPromptsPerRun: 25,
      },
    };
  }

  if (normalizedPlan === 'pro') {
    return {
      isDevelopmentUnlimited: false,
      label: 'Pro',
      plan: 'pro',
      limits: {
        maxOffers: 15,
        maxPromptsPerOffer: 30,
        maxOfferRunsPerMonth: 40,
        maxPromptsPerRun: 10,
      },
    };
  }

  return {
    isDevelopmentUnlimited: false,
    label: 'Starter',
    plan: 'starter',
    limits: {
      maxOffers: 3,
      maxPromptsPerOffer: 8,
      maxOfferRunsPerMonth: 5,
      maxPromptsPerRun: 5,
    },
  };
}
