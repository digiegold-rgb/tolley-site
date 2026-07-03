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

  try {
    const subs = await stripe.subscriptions.list({
      limit: 100,
      status: "all",
      expand: ["data.customer"],
    });

    const wdSubs = subs.data.filter((s) => isWdSubscription(s));

    for (const sub of wdSubs) {
      await syncWdSubscription(sub);
      subsSynced++;

      // Backfill invoice history for this subscription.
      const invoices = await stripe.invoices.list({
        subscription: sub.id,
        limit: 100,
      } as Stripe.InvoiceListParams);

      for (const inv of invoices.data) {
        if (inv.status === "paid") {
          await recordWdInvoice(inv, false);
          invoicesRecorded++;
        } else if (inv.status === "open" && (inv.attempt_count ?? 0) > 0) {
          // an open invoice that's been attempted = a failure in progress
          await recordWdInvoice(inv, true);
          invoicesRecorded++;
        }
      }
    }

    return NextResponse.json({ ok: true, subsSynced, invoicesRecorded });
  } catch (err) {
    console.error("[wd/sync]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sync failed", subsSynced, invoicesRecorded },
      { status: 500 }
    );
  }
}
