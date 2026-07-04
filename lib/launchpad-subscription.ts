/**
 * lib/launchpad-subscription.ts
 *
 * Fulfillment for a sale through an operator's Launchpad storefront (/biz/<slug>).
 * Fires from the Stripe webhook on checkout.session.completed when
 * metadata.product === "launchpad". Records a LaunchpadSale row (idempotent on
 * the unique stripeSessionId — webhook replays won't double-insert) and pings
 * Telegram. Self-contained so it can't affect the demo-site / video / W/D paths.
 *
 * Only checkout.session.completed is handled (fires for both one-time payment
 * and subscription checkouts), so both offering kinds land here once.
 */

import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/budget/notify";
import { LAUNCHPAD_PRODUCT_METADATA, formatOfferingPrice } from "@/lib/launchpad";

type MetaCarrier = { metadata?: Stripe.Metadata | null };

/** True if this checkout session is a Launchpad storefront sale. */
export function isLaunchpadEvent(obj: MetaCarrier): boolean {
  return obj.metadata?.product === LAUNCHPAD_PRODUCT_METADATA;
}

/**
 * Record the sale + notify. Idempotent via LaunchpadSale.stripeSessionId.
 * Returns true if this was (or already was) a handled Launchpad sale.
 */
export async function fulfillLaunchpadSale(
  session: Stripe.Checkout.Session,
): Promise<boolean> {
  if (!isLaunchpadEvent(session)) return false;

  const m = session.metadata || {};
  const storefrontSlug = typeof m.operator === "string" ? m.operator : "";
  const offeringName = typeof m.offering === "string" && m.offering ? m.offering : "Offering";
  const kind = m.kind === "monthly" ? "monthly" : "one_time";

  if (!storefrontSlug) {
    console.warn("[launchpad] sale event missing operator slug metadata");
    return true; // it's ours, but unroutable — don't fall through to other handlers
  }

  const storefront = await prisma.storefront.findUnique({
    where: { slug: storefrontSlug },
    select: { id: true, businessName: true, operator: { select: { name: true, phone: true } } },
  });
  if (!storefront) {
    console.warn(`[launchpad] sale for unknown storefront ${storefrontSlug}`);
    return true;
  }

  // Idempotency: same checkout session already recorded?
  const existing = await prisma.launchpadSale.findUnique({
    where: { stripeSessionId: session.id },
    select: { id: true },
  });
  if (existing) {
    console.log(`[launchpad] sale ${session.id} already recorded, skipping`);
    return true;
  }

  const metaAmount =
    typeof m.amountCents === "string" ? parseInt(m.amountCents, 10) : NaN;
  const amountCents = Number.isFinite(session.amount_total ?? NaN)
    ? (session.amount_total as number)
    : Number.isFinite(metaAmount)
      ? metaAmount
      : 0;

  const buyerEmail =
    session.customer_details?.email || session.customer_email || null;
  const buyerName = session.customer_details?.name || null;
  const buyerPhone = session.customer_details?.phone || null;

  await prisma.launchpadSale.create({
    data: {
      storefrontId: storefront.id,
      offeringName,
      amountCents,
      kind,
      stripeSessionId: session.id,
      buyerEmail,
      buyerName,
      buyerPhone,
    },
  });

  const priceLabel = formatOfferingPrice({ name: offeringName, priceCents: amountCents, kind });
  console.log(
    `[launchpad] 🎉 sale for ${storefront.businessName} — ${offeringName} ${priceLabel}`,
  );

  const tg = await notifyTelegram(
    `🎉 *LAUNCHPAD SALE*: ${storefront.businessName}\n` +
      `${offeringName} — ${priceLabel}\n` +
      `${buyerName ? `Buyer: ${buyerName}` : ""}${buyerEmail ? ` · ${buyerEmail}` : ""}\n` +
      `Operator: ${storefront.operator.name}${storefront.operator.phone ? ` (${storefront.operator.phone})` : ""}\n` +
      `→ tolley.io/biz/${storefrontSlug}`,
  );
  if (!tg.ok) {
    console.warn("[launchpad] telegram notify failed (non-fatal):", tg.error);
  }

  return true;
}
