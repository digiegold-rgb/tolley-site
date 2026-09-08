import { NextResponse } from "next/server";
import Stripe from "stripe";

import { validateWdAdmin } from "@/lib/wd-auth";
import { getStripeClient } from "@/lib/stripe";
import { isWdSubscription, syncWdSubscription, recordWdInvoice } from "@/lib/wd-subscription";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/wd/sync — Tolley-only. One-shot backfill: pull every W/D
 * subscription from Stripe, sync status into WdClient, and record each
 * subscription invoice as a WdPayment. Idempotent (upserts by invoice id).
 */
export async function POST() {
  const { authed, role } = await validateWdAdmin();
  if (!authed || role !== "tolley") {
    return NextResponse.json({ error: "Tolley only" }, { status: 403 });
  }

  const stripe = getStripeClient();
  let subsSynced = 0;
  let invoicesRecorded = 0;
  let subscriptionsNeedingReview = 0;

  try {
    const allSubs = await stripe.subscriptions.list({ limit: 100, status: "all" }).autoPagingToArray({ limit: 10000 });
    const wdSubs = allSubs.filter(isWdSubscription).sort((a, b) => a.created - b.created);

    for (const sub of wdSubs) {
      if (!await syncWdSubscription(sub)) { subscriptionsNeedingReview++; continue; }
      subsSynced++;

      // Backfill invoice history for this subscription.
      const invoices = await stripe.invoices.list({
        subscription: sub.id,
        limit: 100,
      } as Stripe.InvoiceListParams).autoPagingToArray({ limit: 10000 });

      for (const inv of invoices) {
        if (inv.status === "paid") {
          await recordWdInvoice(inv, false, { reconcile: true });
          invoicesRecorded++;
        } else if (inv.status === "open" && (inv.attempt_count ?? 0) > 0) {
          // an open invoice that's been attempted = a failure in progress
          await recordWdInvoice(inv, true, { reconcile: true });
          invoicesRecorded++;
        }
      }
    }

    return NextResponse.json({ ok: true, subsSynced, invoicesRecorded, subscriptionsNeedingReview });
  } catch (err) {
    console.error("[wd/sync]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sync failed", subsSynced, invoicesRecorded },
      { status: 500 }
    );
  }
}
