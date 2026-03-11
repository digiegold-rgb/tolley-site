export type PlanTier = "none" | "basic" | "premium";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);
const TERMINAL_STATUSES = new Set(["canceled", "incomplete_expired", "unpaid"]);

export function resolvePlanFromPriceId(priceId?: string | null): PlanTier {
  if (!priceId) {
    return "none";
  }

  if (
    (process.env.STRIPE_PRICE_PREMIUM_MONTHLY &&
      priceId === process.env.STRIPE_PRICE_PREMIUM_MONTHLY) ||
    (process.env.STRIPE_PRICE_PRO && priceId === process.env.STRIPE_PRICE_PRO)
  ) {
    return "premium";
  }

  if (
    (process.env.STRIPE_PRICE_BASIC_MONTHLY &&
      priceId === process.env.STRIPE_PRICE_BASIC_MONTHLY) ||
    (process.env.STRIPE_PRICE_BASIC && priceId === process.env.STRIPE_PRICE_BASIC)
  ) {
    return "basic";
  }

  return "none";
}

export function getPlanLimits(plan: PlanTier) {
  if (plan === "premium") {
    return 300;
  }

  if (plan === "basic") {
    return 30;
  }

  return 0;
}

export function isActiveSubscriptionStatus(status?: string | null) {
  if (!status) {
    return false;
  }
  return ACTIVE_STATUSES.has(status);
}

export function normalizePlanTier(value?: string | null): PlanTier {
  if (!value) {
    return "none";
  }

  if (value === "pro" || value === "team") {
    return "premium";
  }

  if (value === "starter") {
    return "basic";
  }

  if (value === "premium" || value === "basic") {
    return value;
  }

  return "none";
}

export function resolveTierForStatus(status?: string | null, tier?: PlanTier): PlanTier {
  const normalizedTier = tier || "none";
  if (!status) {
    return normalizedTier;
  }

  if (TERMINAL_STATUSES.has(status)) {
    return "none";
  }

  return normalizedTier;
}

export function hasPaidAccess(subscriptionTier?: string | null, status?: string | null) {
  const tier = normalizePlanTier(subscriptionTier);
  return tier !== "none" && isActiveSubscriptionStatus(status);
}

export function getResetAtIso(now = new Date()) {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

export function toBucketDate(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
