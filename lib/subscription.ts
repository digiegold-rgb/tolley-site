export type PlanTier = "none" | "basic" | "pro";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function resolvePlanFromPriceId(priceId?: string | null): PlanTier {
  if (!priceId) {
    return "none";
  }

  if (process.env.STRIPE_PRICE_PRO && priceId === process.env.STRIPE_PRICE_PRO) {
    return "pro";
  }

  if (process.env.STRIPE_PRICE_BASIC && priceId === process.env.STRIPE_PRICE_BASIC) {
    return "basic";
  }

  return "none";
}

export function getPlanLimits(plan: PlanTier) {
  if (plan === "pro") {
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

export function getResetAtIso(now = new Date()) {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

export function toBucketDate(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
