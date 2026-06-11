/**
 * lib/vater-subscription.ts
 *
 * Config + helpers for Vater Studio pay-per-video billing (card on file).
 *
 * Architecture (2026-06-11, replaced the dead $288/mo + credit-grant model):
 *   - Card on file via Stripe Checkout mode:"setup" (no subscription object)
 *   - Per-action InvoiceItems accrue on the customer; auto-invoiced when
 *     unbilled accrual crosses VATER_BATCH_INVOICE_THRESHOLD_CENTS, plus a
 *     monthly sweep cron for residuals
 *   - Free tier = trial caps (VATER_TRIAL_CAPS), no card required
 *
 * Status semantics on VaterSubscription.status:
 *   trialing = no card on file (free tier) · active = card on file ·
 *   past_due = an invoice failed (delinquent — chargeable actions blocked)
 *
 * Pattern follows lib/food-subscription.ts. Each product owns its own state
 * via VaterSubscription Prisma model — does NOT touch User.subscriptionStatus.
 */

import type Stripe from "stripe";
import {
  ANIMATION_PRICES,
  FLAT_ACTION_PRICES,
  type FlatAction,
} from "@/lib/vater/pricing";

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

export const VATER_PRODUCT_METADATA = "vater";

/** No bundled usage in the pay-per-video model. */
export const VATER_INCLUDED_USAGE_CENTS = 0;

/** Default user-set monthly spending cap */
export const VATER_DEFAULT_MONTHLY_LIMIT_CENTS = 50000; // $500.00

/** Auto-invoice when unbilled accrual crosses this threshold (cents) */
export const VATER_BATCH_INVOICE_THRESHOLD_CENTS = 2500; // $25.00

/** Free-tier caps before paywall fires */
export const VATER_TRIAL_CAPS = {
  transcripts: 3,
  scenes: 1,
  animations: 1,
} as const;

/** Subscription statuses that grant access to /vater/youtube/v2 generation */
export const VATER_ACTIVE_STATUSES = new Set(["active", "trialing"] as const);

export type VaterSubscriptionStatus =
  | "trialing" // free-tier user (no Stripe sub yet, just trial caps)
  | "active"
  | "past_due"
  | "canceled"
  | "none";

export function isVaterAccessGranted(status: string | null | undefined): boolean {
  if (!status) return false;
  return VATER_ACTIVE_STATUSES.has(status as "active" | "trialing");
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-action pricing — delegates to lib/vater/pricing.ts (single source of
// truth shared with the client UI). `tier` for animations is the real
// AnimationQuality name (e.g. "modal-wan22"), stored as-is in VaterUsage.tier.
// ─────────────────────────────────────────────────────────────────────────────

export type VaterAction =
  | "script"
  | "voiceover"
  | "scene"
  | "animation"
  | "render"
  | "thumbnail"
  | "description"
  | "transcription";

/** Animation tier = AnimationQuality name. Other actions take no tier. */
export type VaterTier = string;

interface PriceSpec {
  costCents: number;
  unit: string;
}

export function getActionPrice(
  action: VaterAction,
  tier?: VaterTier | null,
): PriceSpec {
  if (action === "animation") {
    const spec = tier ? ANIMATION_PRICES[tier as keyof typeof ANIMATION_PRICES] : null;
    if (!spec) {
      throw new Error(
        `getActionPrice("animation") requires a valid quality tier, got: ${tier}`,
      );
    }
    return { costCents: spec.priceCents, unit: "/clip" };
  }
  const flat = FLAT_ACTION_PRICES[action as FlatAction];
  if (!flat) throw new Error(`Unknown vater action: ${action}`);
  return { costCents: flat.priceCents, unit: flat.unit };
}

export function describeAction(
  action: VaterAction,
  tier?: VaterTier | null,
): string {
  const human: Record<VaterAction, string> = {
    script: "Script generation",
    voiceover: "Voiceover",
    scene: "Scene image",
    animation: "Animation",
    render: "Video render",
    thumbnail: "Thumbnail",
    description: "Description",
    transcription: "Transcription",
  };
  if (action === "animation" && tier) {
    const spec = ANIMATION_PRICES[tier as keyof typeof ANIMATION_PRICES];
    return `Animation — ${spec ? spec.label : tier}`;
  }
  return human[action];
}

// ─────────────────────────────────────────────────────────────────────────────
// Price ID resolution
// ─────────────────────────────────────────────────────────────────────────────

export function getVaterStudioPriceId(): string {
  const priceId =
    process.env.STRIPE_PRICE_VATER_STUDIO_MONTHLY_TEST ||
    process.env.STRIPE_PRICE_VATER_STUDIO_MONTHLY ||
    "";
  if (!priceId) {
    throw new Error(
      "Missing STRIPE_PRICE_VATER_STUDIO_MONTHLY — configure the Vater Studio $288/mo price in Stripe and set the env var",
    );
  }
  return priceId;
}

export function isVaterPriceId(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  const known = [
    process.env.STRIPE_PRICE_VATER_STUDIO_MONTHLY,
    process.env.STRIPE_PRICE_VATER_STUDIO_MONTHLY_TEST,
  ].filter(Boolean);
  return known.includes(priceId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription parsing (mirrors food-subscription helpers)
// ─────────────────────────────────────────────────────────────────────────────

export function getSubscriptionPeriodEnd(
  subscription: Stripe.Subscription,
): Date | null {
  const fromRoot = (subscription as unknown as { current_period_end?: number })
    .current_period_end;
  if (typeof fromRoot === "number") return new Date(fromRoot * 1000);

  const fromItems = subscription.items?.data?.[0]?.current_period_end;
  if (typeof fromItems === "number") return new Date(fromItems * 1000);

  return null;
}

export function getSubscriptionPeriodStart(
  subscription: Stripe.Subscription,
): Date | null {
  const fromRoot = (subscription as unknown as { current_period_start?: number })
    .current_period_start;
  if (typeof fromRoot === "number") return new Date(fromRoot * 1000);

  const fromItems = subscription.items?.data?.[0]?.current_period_start;
  if (typeof fromItems === "number") return new Date(fromItems * 1000);

  return null;
}

export function mapStripeStatusToVater(
  status: Stripe.Subscription.Status,
): VaterSubscriptionStatus {
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
