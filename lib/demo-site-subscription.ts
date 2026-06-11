/**
 * lib/demo-site-subscription.ts
 *
 * Fulfillment for the Engine 1 self-serve "buy this website" close
 * (Stripe product "Tolley Local Website", $500 setup + $49/mo).
 *
 * Called from the existing Stripe webhook on checkout.session.completed and
 * customer.subscription.created when metadata carries our product tag +
 * leadId. Marks the GrowthLead a paying client, logs a "PAID" GrowthTouch
 * (idempotently — webhook replays won't double-post), and fires the Telegram
 * sale ping. Self-contained so it can't break the W/D / leads / food paths.
 */

import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/budget/notify";
import {
  DEMO_SITE_PRODUCT_METADATA,
  DEMO_SITE_SETUP_PRICE,
  DEMO_SITE_MONTHLY_PRICE,
} from "@/lib/demo-site";

type MetaCarrier = { metadata?: Stripe.Metadata | null };

/** True if this checkout session / subscription is one of our site sales. */
export function isDemoSiteEvent(obj: MetaCarrier): boolean {
  if (obj.metadata?.product === DEMO_SITE_PRODUCT_METADATA) return true;
  return false;
}

/** Secondary detector: subscription whose price is the $49/mo hosting line. */
export function isDemoSiteSubscription(sub: Stripe.Subscription): boolean {
  if (sub.metadata?.product === DEMO_SITE_PRODUCT_METADATA) return true;
  const priceId = sub.items?.data?.[0]?.price?.id;
  return priceId === DEMO_SITE_MONTHLY_PRICE || priceId === DEMO_SITE_SETUP_PRICE;
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
 * Mark the lead paid + notify. Idempotent: skips if a "PAID" touch already
 * exists for this lead, so checkout.session.completed AND
 * customer.subscription.created (both fire for one purchase) only record once.
 */
export async function fulfillDemoSiteSale(obj: MetaCarrier): Promise<boolean> {
  if (!isDemoSiteEvent(obj)) return false;

  const { leadId, slug, business } = readMeta(obj);
  if (!leadId) {
    console.warn("[demo-site] paid event missing leadId metadata");
    return false;
  }

  const lead = await prisma.growthLead.findUnique({
    where: { id: leadId },
    select: { id: true, name: true, stage: true },
  });
  if (!lead) {
    console.warn(`[demo-site] paid event for unknown lead ${leadId}`);
    return false;
  }

  // Already fulfilled? (webhook replay / second event for same purchase)
  const existing = await prisma.growthTouch.findFirst({
    where: { leadId: lead.id, channel: "note", body: { startsWith: "PAID:" } },
    select: { id: true },
  });
  if (existing) {
    console.log(`[demo-site] sale already fulfilled for lead ${lead.id}, skipping`);
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
        subject: `PAID site order — ${lead.name}`,
        body: "PAID: $500 setup + $49/mo site order",
        meta: { slug, product: DEMO_SITE_PRODUCT_METADATA },
      },
    }),
  ]);

  console.log(`[demo-site] 🎉 lead ${lead.id} (${lead.name}) marked client — site sale`);

  const biz = business || lead.name;
  const tg = await notifyTelegram(
    `🎉 *NEW SITE SALE*: ${biz} paid $500 + $49/mo — build queued${slug ? ` (/demo/${slug})` : ""}`
  );
  if (!tg.ok) {
    console.warn("[demo-site] telegram notify failed (non-fatal):", tg.error);
  }

  return true;
}
