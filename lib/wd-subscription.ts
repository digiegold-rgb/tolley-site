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
import { invoicePaymentFacts, monthlySubscriptionAmount } from "./wd-payment-facts";

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { draftDunning } from "@/lib/wd/messaging";

// The W/D Stripe product and its known prices ($58 bundle, $42 washer-only).
const WD_PRODUCT_ID = "prod_StRrSxJ969g4hV";
const WD_PRICE_IDS = new Set(["price_1Rxey029zOZYc3GpfoFkUbmv"]);

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
  return false;
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
  if (!subId) return null; // An invoice without a subscription is not a rental match.
  const stripe = getStripeClient();
  const customer = await stripe.customers.retrieve(custId);
  if ("deleted" in customer) return null;
  const email = customer.email?.trim() || null;
  const phone = customer.phone || null;
  const last10 = phone?.replace(/\D/g, "").slice(-10);
  return prisma.$transaction(async tx => {
    // Serialize linking and creation for a customer; replayed webhooks cannot
    // create two pending customers or claim the same unlinked record together.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${custId}))`;
    const exact = await tx.wdClient.findMany({ where: { stripeSubscriptionId: subId }, select: { id: true, stripeCustomerId: true }, take: 2 });
    if (exact.length === 1 && (!exact[0].stripeCustomerId || exact[0].stripeCustomerId === custId)) return exact[0];
    if (exact.length) return null; // Existing duplicate/conflicting links require review.
    const byCustomer = await tx.wdClient.findMany({ where: { stripeCustomerId: custId }, select: { id: true, stripeSubscriptionId: true } });
    const available = byCustomer.filter(c => !c.stripeSubscriptionId);
    if (byCustomer.length && available.length !== 1) {
      console.warn("[wd] unmatched subscription requires account review", subId);
      return null; // Never overwrite a different (possibly newer) subscription.
    }
    let client = available[0];
    if (!client) {
      const candidates = await tx.wdClient.findMany({ where: {
        stripeSubscriptionId: null,
        AND: [{ OR: [{ stripeCustomerId: null }, { stripeCustomerId: custId }] },
          { OR: [...(email ? [{ email: { equals: email, mode: "insensitive" as const } }] : []),
            ...(last10?.length === 10 ? [{ phone: { not: null } }] : [])] }],
      }, select: { id: true, email: true, phone: true, stripeSubscriptionId: true } });
      const matches = candidates.filter(c => email && c.email?.toLowerCase() === email.toLowerCase() || last10?.length === 10 && c.phone?.replace(/\D/g, "").slice(-10) === last10);
      if (matches.length > 1) return null;
      client = matches[0];
    }
    if (client) {
      const claimed = await tx.wdClient.updateMany({ where: {
        id: client.id, stripeSubscriptionId: null,
        OR: [{ stripeCustomerId: null }, { stripeCustomerId: custId }],
      }, data: { stripeCustomerId: custId, stripeSubscriptionId: subId } });
      return claimed.count === 1 ? { id: client.id } : null;
    }
    const addr = customer.address;
    return tx.wdClient.create({ data: {
      name: customer.name || email || "New rental signup", email, phone,
      address: addr ? [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ") : null,
      unitDescription: "Rental equipment — verify configuration",
      source: "stripe", paidBy: "tolley", stripeCustomerId: custId, stripeSubscriptionId: subId,
      pendingApproval: true, needsReview: true,
    }, select: { id: true } });
  });
}

async function queueSubscriptionReview(subId: string, custId: string) {
  await prisma.mustCompleteItem.createMany({ skipDuplicates: true, data: {
    id: `wd-link:${subId}`, sortOrder: 0, priority: "red", category: "billing", source: "wd-subscription-sync",
    title: "Review an unmatched Stripe rental subscription",
    detail: `Subscription ${subId}, customer ${custId}. The automatic match was ambiguous or would replace another subscription. Verify the rental in Stripe and link it to the correct equipment/customer record; no existing subscription was reassigned.`,
    links: [{ label: "Rental accounts", url: "/wd/admin" }],
  } });
}

/** Sync a W/D subscription's status/period into its WdClient. */
export async function syncWdSubscription(sub: Stripe.Subscription): Promise<boolean> {
  const custId = customerId(sub);
  if (!custId) {
    console.warn("[wd] subscription sync skipped: no customer", sub.id);
    return false;
  }

  const client = await resolveOrCreateClient(custId, sub.id);
  if (!client) {
    console.warn("[wd] subscription sync skipped: unresolved client", sub.id);
    await queueSubscriptionReview(sub.id, custId);
    return false;
  }

  const status = sub.status; // active | trialing | past_due | canceled | unpaid | incomplete*
  await prisma.wdClient.update({
    where: { id: client.id },
    data: {
      stripeCustomerId: custId,
      stripeSubscriptionId: sub.id,
      subscriptionStatus: status,
      monthlyAmount: monthlySubscriptionAmount(sub.items.data),
      stripeSyncedAt: new Date(),
      currentPeriodEnd: periodEndDate(sub),
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      // recovering: a healthy status clears the dunning ladder
      ...(status === "active" || status === "trialing"
        ? { dunningStage: 0, lastPaymentStatus: "paid" }
        : {}),
    },
  });

  console.log(`[wd] synced subscription ${sub.id} → client ${client.id} (${status})`);
  return true;
}

/**
 * Record an invoice against the WdClient. On payment_failed, advance the
 * dunning ladder and draft a stage-1 outreach (draft only — approve-send).
 */
export async function recordWdInvoice(
  eventInvoice: Stripe.Invoice, _failed: boolean, options: { reconcile?: boolean } = {},
): Promise<void> {
  if (!eventInvoice.id) return;
  const stripe = getStripeClient();
  // A delayed failed webhook must never overwrite a subsequently paid invoice.
  const invoice = options.reconcile ? eventInvoice : await stripe.invoices.retrieve(eventInvoice.id);
  if (invoice.status !== "paid" && !(invoice.status === "open" && invoice.attempt_count > 0)) return;
  const custId = customerId(invoice);
  if (!custId) return;
  const legacy = invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
  const parent = invoice.parent?.subscription_details?.subscription;
  const rawSub = parent ?? legacy.subscription;
  const subId = typeof rawSub === "string" ? rawSub : rawSub?.id ?? null;
  const client = await resolveOrCreateClient(custId, subId);
  if (!client) {
    if (subId) await queueSubscriptionReview(subId, custId);
    return;
  }
  const facts = invoicePaymentFacts(invoice);
  const month = new Date((invoice.lines.data[0]?.period.start ?? invoice.created) * 1000).toISOString().slice(0, 7);
  const shouldDraft = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${invoice.id}))`;
    const existing = await tx.wdPayment.findUnique({ where: { stripeInvoiceId: invoice.id } });
    if (existing?.status === "paid" && facts.status !== "paid") return false;
    await tx.wdPayment.upsert({ where: { stripeInvoiceId: invoice.id },
      create: { clientId: client.id, month, source: "stripe", stripeInvoiceId: invoice.id, ...facts },
      update: { ...facts, month },
    });
    if (options.reconcile) return false;
    const freshFailure = facts.status === "missed" && facts.failureAttempts > (existing?.failureAttempts ?? 0);
    if (freshFailure) {
      await tx.wdClient.update({ where: { id: client.id }, data: {
        lastPaymentStatus: "failed", dunningStage: { increment: existing && existing.failureAttempts === 0 ? 0 : facts.failureAttempts - (existing?.failureAttempts ?? 0) },
      } });
    }
    return freshFailure && !existing && facts.failureAttempts === 1;
  });
  // Subscription status comes from the current subscription, not an old invoice.
  if (!options.reconcile && subId) await syncWdSubscription(await stripe.subscriptions.retrieve(subId));
  if (shouldDraft) {
    const current = await prisma.wdClient.findUnique({ where: { id: client.id } });
    if (current?.subscriptionStatus === "past_due" && current.dunningStage === 1) {
      await draftDunning(current, 1).catch(() => console.warn("[wd] dunning draft failed"));
    }
  }
}
