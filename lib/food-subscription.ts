/**
 * lib/food-subscription.ts
 *
 * Config + helpers for the Ruthann's Kitchen subscription product.
 * Product: $39/year, 30-day trial, single annual price.
 *
 * Stripe price IDs come from env:
 *   STRIPE_FOOD_PRICE_ID         — live annual price
 *   STRIPE_FOOD_PRICE_ID_TEST    — test-mode price (optional, falls back to prod)
 */

import type Stripe from "stripe";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

export const FOOD_PRODUCT_METADATA = "food";
export const FOOD_TRIAL_DAYS = 30;

/** Subscription statuses that grant access to /food/** */
export const FOOD_ACTIVE_STATUSES = new Set([
  "active",
  "trialing",
] as const);

export type FoodSubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export function isFoodAccessGranted(status: string | null | undefined): boolean {
  if (!status) return false;
  return FOOD_ACTIVE_STATUSES.has(status as "active" | "trialing");
}

// ─────────────────────────────────────────────────────────────────────────────
// Price ID resolution
// ─────────────────────────────────────────────────────────────────────────────

export function getFoodPriceId(): string {
  const priceId =
    process.env.STRIPE_FOOD_PRICE_ID_TEST ||
    process.env.STRIPE_FOOD_PRICE_ID ||
    "";
  if (!priceId) {
    throw new Error(
      "Missing STRIPE_FOOD_PRICE_ID — configure the Ruthann's Kitchen $39/yr price in Stripe and set the env var"
    );
  }
  return priceId;
}

export function isFoodPriceId(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  const known = [
    process.env.STRIPE_FOOD_PRICE_ID,
    process.env.STRIPE_FOOD_PRICE_ID_TEST,
  ].filter(Boolean);
  return known.includes(priceId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription object parsing
// ─────────────────────────────────────────────────────────────────────────────

/** Subscription currentPeriodEnd moved from root to items in newer Stripe API versions. */
export function getSubscriptionPeriodEnd(
  subscription: Stripe.Subscription
): Date | null {
  const fromRoot = (subscription as unknown as { current_period_end?: number })
    .current_period_end;
  if (typeof fromRoot === "number") return new Date(fromRoot * 1000);

  const fromItems = subscription.items?.data?.[0]?.current_period_end;
  if (typeof fromItems === "number") return new Date(fromItems * 1000);

  return null;
}

export function getSubscriptionTrialEnd(
  subscription: Stripe.Subscription
): Date | null {
  if (typeof subscription.trial_end === "number") {
    return new Date(subscription.trial_end * 1000);
  }
  return null;
}

export function mapStripeStatusToFood(
  status: Stripe.Subscription.Status
): FoodSubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
    case "paused":
      return "none";
    default:
      return "none";
  }
}
