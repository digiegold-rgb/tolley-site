/**
 * lib/vater/billing/record-usage.ts
 *
 * Record a chargeable Vater action (pay-per-video, card on file). Atomic:
 *   1. Insert immutable VaterUsage ledger row
 *   2. Bump VaterTrialUsage if action is capped (trial users)
 *   3. For card-on-file users: post a Stripe InvoiceItem (accrues on customer)
 *   4. Refresh the VaterMonthlyLimit usedCents cache
 *   5. If unbilled accrual crosses $25, auto-create + finalize an invoice
 *      (charge_automatically sweeps all pending items; webhook stamps
 *      stripeInvoiceId on paid rows)
 *
 * Idempotent: pass the same idempotencyKey on retries to avoid double-charging.
 * Call ONLY after the underlying work succeeded — failed renders never charge.
 */

import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import {
  VATER_BATCH_INVOICE_THRESHOLD_CENTS,
  describeAction,
  getActionPrice,
  type VaterAction,
  type VaterTier,
} from "@/lib/vater-subscription";
import { incrementTrialUsage } from "./check-trial-caps";

/**
 * Model A (charge-per-action on a card on file) is OFF for the beta.
 * Set VATER_LEGACY_ACTION_BILLING=1 to re-enable the Stripe legs; with it
 * off we still write the immutable VaterUsage row so analytics, trial caps
 * and the monthly-limit cache keep working — we just never touch Stripe.
 * TODO: replaced by the prepaid credit ledger (Model B) — when that lands,
 * this whole module bills against the ledger instead of InvoiceItems.
 */
const LEGACY_ACTION_BILLING = process.env.VATER_LEGACY_ACTION_BILLING === "1";
import { refreshMonthlyLimitCache } from "./period";
import { finalizeVaterInvoice, getUnbilledCents } from "./finalize-invoice";

export interface RecordUsageInput {
  userId: string;
  action: VaterAction;
  tier?: VaterTier | null;
  projectId?: string | null;
  idempotencyKey?: string;
  /** Override the default action price (e.g. for proration on partial completion) */
  overrideCostCents?: number;
}

export interface RecordUsageResult {
  usageId: string;
  costCents: number;
  stripeInvoiceItemId?: string | null;
  /** True when this record forced a mid-period invoice finalize (charge batching) */
  invoiceFinalized: boolean;
  isTrial: boolean;
  /**
   * True when the idempotency key already existed, so NOTHING new was billed
   * and `costCents` is the pre-existing row's amount.
   *
   * Callers that report money must distinguish these: a nightly sweeper that
   * re-checks the same finished batch would otherwise log "$3.75 booked" every
   * single night for a charge made once (2026-08-27 — it did exactly that on
   * its first run).
   */
  deduped: boolean;
}

export async function recordUsage(input: RecordUsageInput): Promise<RecordUsageResult> {
  const { userId, action, tier, projectId, idempotencyKey, overrideCostCents } = input;
  const price = getActionPrice(action, tier);
  const costCents = overrideCostCents ?? price.costCents;
  const description = describeAction(action, tier);

  // Idempotency: if we've recorded this key before, return the existing row
  if (idempotencyKey) {
    const existing = await prisma.vaterUsage.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return {
        usageId: existing.id,
        costCents: existing.costCents,
        stripeInvoiceItemId: existing.stripeInvoiceItemId,
        invoiceFinalized: false,
        isTrial: !existing.stripeInvoiceItemId,
        deduped: true,
      };
    }
  }

  const sub = await prisma.vaterSubscription.findUnique({ where: { userId } });
  const isTrial = !sub || sub.status === "trialing" || sub.status === "none";

  let stripeInvoiceItemId: string | null = null;

  if (LEGACY_ACTION_BILLING && !isTrial && sub?.stripeCustomerId) {
    // Post the InvoiceItem — it accrues on the customer until the threshold
    // finalize (below) or the monthly sweep cron invoices it.
    const stripe = getStripeClient();
    try {
      const invoiceItem = await stripe.invoiceItems.create(
        {
          customer: sub.stripeCustomerId,
          amount: costCents,
          currency: "usd",
          description,
          metadata: {
            product: "vater",
            userId,
            action,
            tier: tier ?? "",
            projectId: projectId ?? "",
          },
        },
        idempotencyKey ? { idempotencyKey: `vater_usage_${idempotencyKey}` } : undefined,
      );
      stripeInvoiceItemId = invoiceItem.id;
    } catch (err) {
      console.error("[vater-billing] InvoiceItem.create failed", { userId, action, err });
      // We still record the usage locally so analytics + caps work; reconciler can backfill.
    }
  }

  const usage = await prisma.vaterUsage.create({
    data: {
      userId,
      action,
      tier: tier ?? null,
      costCents,
      description,
      projectId: projectId ?? null,
      stripeInvoiceItemId,
      idempotencyKey: idempotencyKey ?? null,
    },
  });

  // Bump trial counter if applicable
  if (isTrial) {
    await incrementTrialUsage(userId, action);
  }

  // Refresh limit cache for live UI
  await refreshMonthlyLimitCache(userId);

  // Charge batching: invoice once unbilled accrual crosses the threshold
  // ($25) to keep Stripe's fixed fee negligible without floating too long.
  let invoiceFinalized = false;
  if (LEGACY_ACTION_BILLING && !isTrial && sub?.stripeCustomerId) {
    const unbilledCents = await getUnbilledCents(userId);
    if (unbilledCents >= VATER_BATCH_INVOICE_THRESHOLD_CENTS) {
      try {
        await finalizeVaterInvoice({
          userId,
          stripeCustomerId: sub.stripeCustomerId,
          reason: "batch_threshold",
        });
        invoiceFinalized = true;
      } catch (err) {
        console.error("[vater-billing] mid-period invoice finalize failed", err);
      }
    }
  }

  return {
    usageId: usage.id,
    costCents,
    stripeInvoiceItemId,
    invoiceFinalized,
    isTrial,
    deduped: false,
  };
}
