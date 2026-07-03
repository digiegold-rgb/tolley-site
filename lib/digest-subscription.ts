/**
 * lib/digest-subscription.ts
 *
 * Fulfillment for the self-serve KC Motivated Seller Digest subscription
 * (Stripe product "KC Motivated Seller Digest", $199/mo founding / $299/mo
 * standard).
 *
 * Called from the existing Stripe webhook on checkout.session.completed and
 * customer.subscription.{created,updated,deleted} when metadata carries our
 * product tag + subscriberId (written by /api/leads/digest/subscribe to both
 * the session and the subscription). Flips the DigestSubscriber row to
 * active/paused/canceled, stamps Stripe ids, and fires the Telegram new-sub
 * ping exactly once (idempotent — checks the previous status, so webhook
 * replays and the session+subscription double-fire don't double-ping).
 * Self-contained so it can't break the W/D / leads / food / video paths —
 * same narrow pattern as lib/video-offer-subscription.ts.
 */

import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/budget/notify";

export const DIGEST_PRODUCT_METADATA = "digest";

/** $199/mo founding price ID. Throws if STRIPE_PRICE_DIGEST_FOUNDING is unset. */
export function getDigestFoundingPrice(): string {
  const id = process.env.STRIPE_PRICE_DIGEST_FOUNDING;
  if (!id) {
    throw new Error(
      "STRIPE_PRICE_DIGEST_FOUNDING is not set — run scripts/setup-digest-product.mjs and add the printed price ID to env"
    );
  }
  return id;
}

/** $299/mo standard price ID. Throws if STRIPE_PRICE_DIGEST_STANDARD is unset. */
export function getDigestStandardPrice(): string {
  const id = process.env.STRIPE_PRICE_DIGEST_STANDARD;
  if (!id) {
    throw new Error(
      "STRIPE_PRICE_DIGEST_STANDARD is not set — run scripts/setup-digest-product.mjs and add the printed price ID to env"
    );
  }
  return id;
}

/**
 * True if the price ID belongs to the digest product. Deliberately never
 * throws when the env vars are unset (webhook detection must not crash the
 * shared Stripe webhook for unrelated products) — unset env means "not ours".
 */
export function isDigestPriceId(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  const founding = process.env.STRIPE_PRICE_DIGEST_FOUNDING;
  const standard = process.env.STRIPE_PRICE_DIGEST_STANDARD;
  return (!!founding && priceId === founding) || (!!standard && priceId === standard);
}

const ACTIVE_STATUSES = new Set(["active", "trial"]);

function asId(ref: string | { id: string } | null | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref.id;
}

/** Map a Stripe subscription status onto our DigestSubscriber.status enum. */
function mapSubscriptionStatus(status: Stripe.Subscription.Status): string | null {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trial";
    case "past_due":
    case "paused":
    case "unpaid":
      return "paused";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
      // First payment still settling — leave the row as-is (pending). The
      // checkout.session.completed event activates it when payment lands.
      return null;
    default:
      return null;
  }
}

/**
 * Sync a DigestSubscriber row from a checkout session or subscription event.
 * Resolves the row via metadata.subscriberId (written at checkout creation).
 * Returns true if the event was ours and a row was updated.
 */
export async function syncDigestSubscription(
  obj: Stripe.Checkout.Session | Stripe.Subscription
): Promise<boolean> {
  const subscriberId = obj.metadata?.subscriberId;
  if (!subscriberId) {
    console.warn("[digest] event missing subscriberId metadata — cannot fulfill");
    return false;
  }

  const existing = await prisma.digestSubscriber.findUnique({
    where: { id: subscriberId },
    select: { id: true, name: true, email: true, farmZips: true, status: true },
  });
  if (!existing) {
    console.warn(`[digest] event for unknown subscriber ${subscriberId}`);
    return false;
  }

  let newStatus: string | null;
  let stripeCustomerId: string | null;
  let stripeSubscriptionId: string | null;

  if (obj.object === "checkout.session") {
    const session = obj as Stripe.Checkout.Session;
    // checkout.session.completed only fires on successful checkout. Every new
    // subscription starts with a 3-day trial (trial_period_days on the
    // checkout), so the row starts as "trial"; the subscription.updated event
    // flips it to "active" when the trial converts. Both statuses receive the
    // Monday digest.
    newStatus = "trial";
    stripeCustomerId = asId(session.customer as string | { id: string } | null);
    stripeSubscriptionId = asId(
      session.subscription as string | { id: string } | null
    );
  } else {
    const sub = obj as Stripe.Subscription;
    newStatus = mapSubscriptionStatus(sub.status);
    stripeCustomerId = asId(sub.customer as string | { id: string });
    stripeSubscriptionId = sub.id;
  }

  await prisma.digestSubscriber.update({
    where: { id: existing.id },
    data: {
      ...(newStatus ? { status: newStatus } : {}),
      ...(stripeCustomerId ? { stripeCustomerId } : {}),
      ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
    },
  });

  console.log(
    `[digest] subscriber ${existing.id} (${existing.email}) ${existing.status} → ${newStatus ?? existing.status}`
  );

  // Telegram ping on FIRST activation only — previous status decides, so the
  // checkout event pings and the subscription.created replay does not.
  const becameActive =
    newStatus !== null &&
    ACTIVE_STATUSES.has(newStatus) &&
    !ACTIVE_STATUSES.has(existing.status);
  if (becameActive) {
    const tg = await notifyTelegram(
      `🧲 New digest subscriber: ${existing.name} — ${existing.farmZips.join(", ")}`
    );
    if (!tg.ok) {
      console.warn("[digest] telegram notify failed (non-fatal):", tg.error);
    }
  }

  return true;
}
