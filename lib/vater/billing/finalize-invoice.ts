/**
 * lib/vater/billing/finalize-invoice.ts
 *
 * Shared by the threshold finalize in record-usage.ts and the monthly sweep
 * cron. Creating a Stripe invoice with charge_automatically sweeps ALL of the
 * customer's pending InvoiceItems into it; auto_advance finalizes + attempts
 * payment on the default payment method. invoice.paid webhook then stamps
 * stripeInvoiceId onto the covered VaterUsage rows.
 */

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

/** Sum of usage posted to Stripe but not yet swept into a paid invoice. */
export async function getUnbilledCents(userId: string): Promise<number> {
  const agg = await prisma.vaterUsage.aggregate({
    where: {
      userId,
      stripeInvoiceItemId: { not: null },
      stripeInvoiceId: null,
    },
    _sum: { costCents: true },
  });
  return agg._sum.costCents ?? 0;
}

export interface FinalizeResult {
  invoiceId: string | null;
  amountCents: number;
}

/**
 * Create + finalize an invoice sweeping the customer's pending items.
 * Returns null invoiceId when Stripe had nothing pending (no-op).
 */
export async function finalizeVaterInvoice(opts: {
  userId: string;
  stripeCustomerId: string;
  reason: "batch_threshold" | "monthly_sweep";
}): Promise<FinalizeResult> {
  const stripe = getStripeClient();
  const invoice = await stripe.invoices.create({
    customer: opts.stripeCustomerId,
    collection_method: "charge_automatically",
    auto_advance: true,
    metadata: { product: "vater", userId: opts.userId, reason: opts.reason },
  });
  if (!invoice.id) return { invoiceId: null, amountCents: 0 };

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  return {
    invoiceId: finalized.id ?? invoice.id,
    amountCents: finalized.amount_due ?? 0,
  };
}
