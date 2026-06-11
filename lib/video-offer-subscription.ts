/**
 * lib/video-offer-subscription.ts
 *
 * Fulfillment for the B2B "I made you a video" self-serve close
 * (Stripe product "Tolley Promo Video", $250 one-time + $99/mo).
 *
 * Called from the existing Stripe webhook on checkout.session.completed and
 * customer.subscription.created when metadata carries our product tag +
 * leadId. Marks the GrowthLead a paying client, logs a "PAID: video"
 * GrowthTouch (idempotently — webhook replays won't double-post), and fires
 * the Telegram sale ping. Self-contained so it can't break the demo-site /
 * W/D / leads / food paths. Mirrors lib/demo-site-subscription.ts.
 */

import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/budget/notify";
import {
  VIDEO_OFFER_PRODUCT_METADATA,
  isVideoOfferPriceId,
} from "@/lib/video-offer";

type MetaCarrier = { metadata?: Stripe.Metadata | null };

/** True if this checkout session / subscription is one of our video sales. */
export function isVideoOfferEvent(obj: MetaCarrier): boolean {
  return obj.metadata?.product === VIDEO_OFFER_PRODUCT_METADATA;
}

/** Secondary detector: subscription whose price is the $99/mo (or $250) line. */
export function isVideoOfferSubscription(sub: Stripe.Subscription): boolean {
  if (sub.metadata?.product === VIDEO_OFFER_PRODUCT_METADATA) return true;
  const priceId = sub.items?.data?.[0]?.price?.id;
  return !!priceId && isVideoOfferPriceId(priceId);
}

function readMeta(obj: MetaCarrier): { leadId: string | null; slug: string | null; business: string | null } {
  const m = obj.metadata || {};
  return {
    leadId: typeof m.leadId === "string" && m.leadId ? m.leadId : null,
    slug: typeof m.slug === "string" && m.slug ? m.slug : null,
    business: typeof m.business === "string" && m.business ? m.business : null,
  };
}

/**
 * Mark the lead paid + notify. Idempotent: skips if a "PAID: video" touch
 * already exists for this lead, so checkout.session.completed AND
 * customer.subscription.created (both fire for one purchase) only record once.
 */
export async function fulfillVideoOfferSale(
  obj: MetaCarrier | Stripe.Subscription
): Promise<boolean> {
  // Accept events tagged by metadata OR subscriptions matched by price ID —
  // either way the leadId metadata (written by /api/v/checkout to both the
  // session and the subscription) is what lets us fulfill.
  const isOurs =
    isVideoOfferEvent(obj) ||
    ("items" in obj && isVideoOfferSubscription(obj as Stripe.Subscription));
  if (!isOurs) return false;

  const { leadId, slug, business } = readMeta(obj);
  if (!leadId) {
    console.warn("[video-offer] paid event missing leadId metadata");
    return false;
  }

  const lead = await prisma.growthLead.findUnique({
    where: { id: leadId },
    select: { id: true, name: true, stage: true },
  });
  if (!lead) {
    console.warn(`[video-offer] paid event for unknown lead ${leadId}`);
    return false;
  }

  // Already fulfilled? (webhook replay / second event for same purchase)
  const existing = await prisma.growthTouch.findFirst({
    where: { leadId: lead.id, channel: "note", subject: { startsWith: "PAID: video" } },
    select: { id: true },
  });
  if (existing) {
    console.log(`[video-offer] sale already fulfilled for lead ${lead.id}, skipping`);
    return true;
  }

  await prisma.$transaction([
    prisma.growthLead.update({
      where: { id: lead.id },
      data: { stage: "client" },
    }),
    prisma.growthTouch.create({
      data: {
        leadId: lead.id,
        channel: "note",
        direction: "in",
        status: "received",
        subject: `PAID: video order — ${lead.name}`,
        body: "PAID: $250 one-time + $99/mo promo video order",
        meta: { slug, product: VIDEO_OFFER_PRODUCT_METADATA },
      },
    }),
  ]);

  console.log(`[video-offer] 🎬 lead ${lead.id} (${lead.name}) marked client — video sale`);

  const biz = business || lead.name;
  const tg = await notifyTelegram(
    `🎬 NEW VIDEO SALE: ${biz} paid $250 + $99/mo${slug ? ` (/v/${slug})` : ""}`
  );
  if (!tg.ok) {
    console.warn("[video-offer] telegram notify failed (non-fatal):", tg.error);
  }

  return true;
}
