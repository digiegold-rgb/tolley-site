/**
 * lib/vater/billing/sync.ts
 *
 * Webhook-side handlers for the pay-per-video billing model:
 *   - setup-mode Checkout completed → attach card, status "active"
 *   - invoice.paid (product=vater)  → stamp stripeInvoiceId on usage rows,
 *     clear delinquency
 *   - invoice.payment_failed        → status "past_due" + Telegram ping
 *
 * Every vater invoice is created by us (threshold finalize in record-usage,
 * or the monthly sweep cron) with metadata { product: "vater", userId }.
 */

import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { notifyTelegram } from "@/lib/budget/notify";

export function isVaterSetupSession(
  session: Stripe.Checkout.Session,
): boolean {
  return (
    session.mode === "setup" && session.metadata?.product === "vater"
  );
}

export function isVaterInvoice(invoice: Stripe.Invoice): boolean {
  return invoice.metadata?.product === "vater";
}

/** Card added via setup-mode Checkout: make it the customer default + persist. */
export async function handleVaterSetupCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("[vater] setup session missing userId metadata", session.id);
    return;
  }

  const stripe = getStripeClient();
  const setupIntentId =
    typeof session.setup_intent === "string"
      ? session.setup_intent
      : session.setup_intent?.id;
  if (!setupIntentId) {
    console.error("[vater] setup session has no setup_intent", session.id);
    return;
  }

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
    expand: ["payment_method"],
  });
  const pm = setupIntent.payment_method;
  if (!pm || typeof pm === "string") {
    console.error("[vater] setup intent has no expanded payment method", setupIntentId);
    return;
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (customerId) {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: pm.id },
    });
  }

  await prisma.vaterSubscription.update({
    where: { userId },
    data: {
      status: "active",
      defaultPaymentMethodId: pm.id,
      cardBrand: pm.card?.brand ?? null,
      cardLast4: pm.card?.last4 ?? null,
      cardExpMonth: pm.card?.exp_month ?? null,
      cardExpYear: pm.card?.exp_year ?? null,
      delinquentAt: null,
      trialConvertedAt: new Date(),
    },
  });

  console.log(`[vater] Card on file for user ${userId} (${pm.card?.brand} •••• ${pm.card?.last4})`);
}

/** Extract invoice-item IDs from an invoice's lines, across SDK API shapes. */
function extractInvoiceItemIds(invoice: Stripe.Invoice): string[] {
  const ids: string[] = [];
  for (const line of invoice.lines?.data ?? []) {
    const l = line as unknown as {
      invoice_item?: string | { id?: string };
      parent?: { invoice_item_details?: { invoice_item?: string } };
    };
    const direct =
      typeof l.invoice_item === "string" ? l.invoice_item : l.invoice_item?.id;
    const nested = l.parent?.invoice_item_details?.invoice_item;
    const id = direct || nested;
    if (id) ids.push(id);
  }
  return ids;
}

/** Invoice paid: stamp stripeInvoiceId on the usage rows it covered. */
export async function handleVaterInvoicePaid(
  invoice: Stripe.Invoice,
): Promise<void> {
  const userId = invoice.metadata?.userId;
  if (!userId || !invoice.id) return;

  const itemIds = extractInvoiceItemIds(invoice);
  if (itemIds.length > 0) {
    await prisma.vaterUsage.updateMany({
      where: { userId, stripeInvoiceItemId: { in: itemIds } },
      data: { stripeInvoiceId: invoice.id },
    });
  } else {
    // Stripe swept all pending items into this invoice — stamp everything
    // unbilled for the user (line shapes vary across API versions).
    await prisma.vaterUsage.updateMany({
      where: {
        userId,
        stripeInvoiceItemId: { not: null },
        stripeInvoiceId: null,
      },
      data: { stripeInvoiceId: invoice.id },
    });
  }

  await prisma.vaterSubscription.updateMany({
    where: { userId, status: "past_due" },
    data: { status: "active", delinquentAt: null },
  });

  console.log(
    `[vater] Invoice ${invoice.id} paid for user ${userId} ($${((invoice.amount_paid ?? 0) / 100).toFixed(2)})`,
  );
}

/** Invoice failed: delinquent — chargeable actions block until resolved. */
export async function handleVaterInvoiceFailed(
  invoice: Stripe.Invoice,
): Promise<void> {
  const userId = invoice.metadata?.userId;
  if (!userId) return;

  await prisma.vaterSubscription.updateMany({
    where: { userId },
    data: { status: "past_due", delinquentAt: new Date() },
  });

  await notifyTelegram(
    `⚠️ Vater invoice payment FAILED — user ${userId}, $${((invoice.amount_due ?? 0) / 100).toFixed(2)} (${invoice.id}). Renders blocked until card updated.`,
  );
}
