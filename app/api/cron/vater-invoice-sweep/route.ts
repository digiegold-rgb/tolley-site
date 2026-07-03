import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  finalizeVaterInvoice,
  getUnbilledCents,
} from "@/lib/vater/billing/finalize-invoice";
import { reconcileUnbilledRenders } from "@/lib/vater/billing/reconcile-renders";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * GET /api/cron/vater-invoice-sweep — monthly (1st + retry on the 2nd).
 *
 * Two steps, in order:
 *   1. RECONCILE — backfill charges for compose renders whose DGX job finished
 *      but whose client never polled to completion (audit M1). Recorded with
 *      the same `render_<jobId>` idempotency key the poll path uses, so this
 *      can never double-bill. Runs FIRST so freshly-backfilled accrual gets
 *      swept into an invoice in the same pass.
 *   2. SWEEP — the threshold finalize in record-usage.ts invoices users once
 *      unbilled accrual crosses $25; this sweeps everyone's residual balance
 *      below the threshold so nothing floats longer than a month. Skips
 *      balances under $1 (Stripe fees would eat them — they roll to next month).
 *
 * (This cron is extended rather than adding a new cron slot: vercel.json's
 * crons array is at the practical limit and functions{} is near the 50-cap.)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Step 1: reconcile abandoned-but-done compose renders ──────────────────
  // Conservative: never aborts the sweep on failure — errors are collected and
  // returned. Idempotent, so a partial run is safe to re-invoke.
  let reconcile: Awaited<ReturnType<typeof reconcileUnbilledRenders>> | null =
    null;
  try {
    reconcile = await reconcileUnbilledRenders();
  } catch (err) {
    console.error("[vater-invoice-sweep] reconcile step failed", err);
  }

  const subs = await prisma.vaterSubscription.findMany({
    where: { status: "active", stripeCustomerId: { not: null } },
    select: { userId: true, stripeCustomerId: true },
  });

  const swept: Array<{ userId: string; amountCents: number; invoiceId: string | null }> = [];
  const errors: Array<{ userId: string; error: string }> = [];

  for (const sub of subs) {
    const unbilled = await getUnbilledCents(sub.userId);
    if (unbilled < 100) continue;
    try {
      const res = await finalizeVaterInvoice({
        userId: sub.userId,
        stripeCustomerId: sub.stripeCustomerId!,
        reason: "monthly_sweep",
      });
      swept.push({ userId: sub.userId, amountCents: unbilled, invoiceId: res.invoiceId });
    } catch (err) {
      errors.push({
        userId: sub.userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: errors.length === 0 && (reconcile?.errors.length ?? 0) === 0,
    reconcile: reconcile
      ? {
          scanned: reconcile.scanned,
          backfilled: reconcile.hits.filter((h) => h.billed).length,
          backfilledRenders: reconcile.hits.filter(
            (h) => h.billed && h.action === "render",
          ).length,
          backfilledAnimations: reconcile.hits.filter(
            (h) => h.billed && h.action === "animation",
          ).length,
          backfilledCents: reconcile.hits
            .filter((h) => h.billed)
            .reduce((s, h) => s + h.costCents, 0),
          errors: reconcile.errors,
        }
      : { error: "reconcile step threw — see logs" },
    checked: subs.length,
    swept,
    errors,
  });
}
