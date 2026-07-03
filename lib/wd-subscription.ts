/**
 * lib/wd-subscription.ts
 *
 * Washer/Dryer rental ↔ Stripe sync. Turns the previously-manual /wd/admin
 * payment tracker into a live mirror of Stripe:
 *   - customer.subscription.*  → syncWdSubscription()  (status, period, cancel)
 *   - invoice.paid             → recordWdInvoice()      (creates a "paid" WdPayment)
 *   - invoice.payment_failed   → recordWdInvoice()      (marks failed + drafts dunning)
 *
 * A paid checkout for a brand-new customer auto-creates a WdClient with
 * pendingApproval=true so it surfaces in /wd/admin for 1-click approval.
 */

import Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { draftDunning } from "@/lib/wd/messaging";

// The W/D Stripe product and its known prices ($58 bundle, $42 washer-only).
const WD_PRODUCT_ID = "prod_StRrSxJ969g4hV";
const WD_PRICE_IDS = new Set(["price_1Rxey029zOZYc3GpfoFkUbmv"]);
const WD_AMOUNTS = new Set([5800, 4200]); // cents — fallback signal

type StripePriceish = {
  id?: string;
  unit_amount?: number | null;
  product?: string | Stripe.Product | Stripe.DeletedProduct | null;
};

function priceProductId(price?: StripePriceish | null): string | null {
  const p = price?.product;
  if (!p) return null;
  return typeof p === "string" ? p : p.id;
}

/** Is this Stripe price part of the W/D product? */
export function isWdPrice(price?: StripePriceish | null): boolean {
  if (!price) return false;
  if (price.id && WD_PRICE_IDS.has(price.id)) return true;
  if (priceProductId(price) === WD_PRODUCT_ID) return true;
  if (typeof price.unit_amount === "number" && WD_AMOUNTS.has(price.unit_amount)) return true;
  return false;
}

export function isWdSubscription(sub: Stripe.Subscription): boolean {
  return isWdPrice(sub.items?.data?.[0]?.price as StripePriceish);
}

export function isWdInvoice(invoice: Stripe.Invoice): boolean {
  const line = invoice.lines?.data?.[0] as unknown as { pricing?: { price_details?: { price?: string; product?: string } }; price?: StripePriceish } | undefined;
  const pd = line?.pricing?.price_details;
  if (pd?.product === WD_PRODUCT_ID) return true;
  if (pd?.price && WD_PRICE_IDS.has(pd.price)) return true;
  if (line?.price && isWdPrice(line.price)) return true;
  const amount = (invoice.lines?.data?.[0] as { amount?: number } | undefined)?.amount;
  return typeof amount === "number" && WD_AMOUNTS.has(amount);
}

function periodEndDate(sub: Stripe.Subscription): Date | null {
  const root = (sub as unknown as { current_period_end?: number }).current_period_end;
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  const unix = typeof root === "number" ? root : typeof fromItem === "number" ? fromItem : null;
  return unix ? new Date(unix * 1000) : null;
}

function customerId(sub: Stripe.Subscription | Stripe.Invoice): string | null {
  const c = sub.customer;
  if (!c) return null;
  return typeof c === "string" ? c : c.id;
}

/**
 * Find the WdClient for a Stripe customer, or create a pending one from the
 * customer record so a self-serve signup shows up in /wd/admin for approval.
 */
async function resolveOrCreateClient(
  custId: string,
  subId: string | null,
): Promise<{ id: string } | null> {
  // 1) by subscription id, 2) by customer id
  if (subId) {
    const bySub = await prisma.wdClient.findFirst({ where: { stripeSubscriptionId: subId }, select: { id: true } });
    if (bySub) return bySub;
  }
  const byCust = await prisma.wdClient.findFirst({ where: { stripeCustomerId: custId }, select: { id: true } });
  if (byCust) return byCust;

  // 3) pull the Stripe customer to match on email/phone or seed a new record
  const stripe = getStripeClient();
  const customer = await stripe.customers.retrieve(custId);
  if ("deleted" in customer) return null;

  const email = customer.email || undefined;
  const phone = customer.phone || undefined;

  if (email) {
    const byEmail = await prisma.wdClient.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
    if (byEmail) return byEmail;
  }
  if (phone) {
    const last10 = phone.replace(/\D/g, "").slice(-10);
    if (last10.length === 10) {
      const byPhone = await prisma.wdClient.findFirst({ where: { phone: { contains: last10.slice(-7) } }, select: { id: true } });
      if (byPhone) return byPhone;
    }
  }

  // 4) auto-create a pending-approval client from the Stripe customer
  const addr = customer.address;
  const created = await prisma.wdClient.create({
    data: {
      name: customer.name || email || "New rental signup",
      email: email || null,
      phone: phone || null,
      address: addr ? [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ") : null,
      unitDescription: "Washer & Dryer (self-serve signup)",
      source: "stripe",
      paidBy: "tolley",
      stripeCustomerId: custId,
      pendingApproval: true,
      needsReview: true,
    },
    select: { id: true },
  });
  console.log(`[wd] auto-created pending client ${created.id} from Stripe customer ${custId}`);
  return created;
}

/** Sync a W/D subscription's status/period into its WdClient. */
export async function syncWdSubscription(sub: Stripe.Subscription): Promise<void> {
  const custId = customerId(sub);
  if (!custId) {
    console.warn("[wd] subscription sync skipped: no customer", sub.id);
    return;
  }

  const client = await resolveOrCreateClient(custId, sub.id);
  if (!client) {
    console.warn("[wd] subscription sync skipped: unresolved client", sub.id);
    return;
  }

  const status = sub.status; // active | trialing | past_due | canceled | unpaid | incomplete*
  await prisma.wdClient.update({
    where: { id: client.id },
    data: {
      stripeCustomerId: custId,
      stripeSubscriptionId: sub.id,
      subscriptionStatus: status,
      currentPeriodEnd: periodEndDate(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      // recovering: a healthy status clears the dunning ladder
      ...(status === "active" || status === "trialing"
        ? { dunningStage: 0, lastPaymentStatus: "paid" }
        : {}),
    },
  });

  console.log(`[wd] synced subscription ${sub.id} → client ${client.id} (${status})`);
}

/**
 * Record an invoice against the WdClient. On payment_failed, advance the
 * dunning ladder and draft a stage-1 outreach (draft only — approve-send).
 */
export async function recordWdInvoice(
  invoice: Stripe.Invoice,
  failed: boolean,
): Promise<void> {
  const custId = customerId(invoice);
  if (!custId) return;

  const invWithSub = invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
  const subId =
    typeof invWithSub.subscription === "string"
      ? invWithSub.subscription
      : invWithSub.subscription?.id ?? null;

  const client = await resolveOrCreateClient(custId, subId);
  if (!client) return;

  // Derive the billing month (YYYY-MM) from the line period or invoice date.
  const periodStart =
    (invoice.lines?.data?.[0] as { period?: { start?: number } } | undefined)?.period?.start ||
    invoice.created;
  const month = new Date(periodStart * 1000).toISOString().slice(0, 7);
  const amount = (failed ? invoice.amount_due : invoice.amount_paid) / 100;

  // Upsert by stripeInvoiceId so retries/webhook replays don't duplicate.
  const existing = invoice.id
    ? await prisma.wdPayment.findUnique({ where: { stripeInvoiceId: invoice.id } })
    : null;

  if (existing) {
    await prisma.wdPayment.update({
      where: { id: existing.id },
      data: {
        status: failed ? "missed" : "paid",
        amount,
        paidAt: failed ? null : new Date(),
      },
    });
  } else {
    await prisma.wdPayment.create({
      data: {
        clientId: client.id,
        amount,
        month,
        status: failed ? "missed" : "paid",
        source: "stripe",
        stripeInvoiceId: invoice.id || null,
        paidAt: failed ? null : new Date(),
        note: failed ? "Stripe payment failed" : "Auto-recorded from Stripe",
      },
    });
  }

  if (failed) {
    const updated = await prisma.wdClient.update({
      where: { id: client.id },
      data: {
        lastPaymentStatus: "failed",
        subscriptionStatus: "past_due",
        dunningStage: { increment: 1 },
      },
    });
    // Only draft on the first failure of this cycle (stage 1) — cron handles escalation.
    if (updated.dunningStage <= 1) {
      try {
        await draftDunning(updated, 1);
      } catch (err) {
        console.warn("[wd] dunning draft failed (non-fatal)", err);
      }
    }
    console.log(`[wd] invoice FAILED for client ${client.id} → dunning stage ${updated.dunningStage}`);
  } else {
    await prisma.wdClient.update({
      where: { id: client.id },
      data: { lastPaymentStatus: "paid", dunningStage: 0 },
    });
    console.log(`[wd] invoice PAID for client ${client.id} ($${amount})`);
  }
}
