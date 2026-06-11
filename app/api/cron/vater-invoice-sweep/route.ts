import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  finalizeVaterInvoice,
  getUnbilledCents,
} from "@/lib/vater/billing/finalize-invoice";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * GET /api/cron/vater-invoice-sweep — monthly (1st + retry on the 2nd).
 *
 * The threshold finalize in record-usage.ts invoices users once unbilled
 * accrual crosses $25; this cron sweeps everyone's residual balance below
 * the threshold so nothing floats longer than a month. Skips balances
 * under $1 (Stripe fees would eat them — they roll into next month).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    ok: errors.length === 0,
    checked: subs.length,
    swept,
    errors,
  });
}
