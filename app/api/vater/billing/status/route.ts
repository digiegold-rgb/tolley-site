/**
 * GET /api/vater/billing/status
 *
 * Returns the v2 Header pill + Settings/Pricing page state for the user:
 *   {
 *     subscription: { status, currentPeriodEnd, cancelAtPeriodEnd } | null,
 *     usage: { usedCents, includedCents, limitCents, periodStart, periodEnd },
 *     trial: { transcripts, scenes, animations, caps, capHitAt },
 *     isTrial: boolean,
 *     card: { brand, last4, expMonth, expYear } | null,   // card on file
 *     unbilledCents: number,   // accrued InvoiceItems not yet invoiced
 *     delinquent: boolean,     // past_due / failed invoice — actions blocked
 *     defaultLimitCents: number
 *   }
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  VATER_DEFAULT_MONTHLY_LIMIT_CENTS,
  VATER_INCLUDED_USAGE_CENTS,
  VATER_TRIAL_CAPS,
} from "@/lib/vater-subscription";
import { getUnbilledCents } from "@/lib/vater/billing/finalize-invoice";
import { getCurrentPeriod } from "@/lib/vater/billing/period";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [sub, trial, period, unbilledCents] = await Promise.all([
    prisma.vaterSubscription.findUnique({ where: { userId } }),
    prisma.vaterTrialUsage.findUnique({ where: { userId } }),
    getCurrentPeriod(userId),
    getUnbilledCents(userId),
  ]);

  const isTrial = !sub || sub.status === "trialing" || sub.status === "none";
  const delinquent = sub?.status === "past_due" || Boolean(sub?.delinquentAt);

  return NextResponse.json({
    subscription: sub
      ? {
          status: sub.status,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        }
      : null,
    card:
      sub?.cardLast4
        ? {
            brand: sub.cardBrand,
            last4: sub.cardLast4,
            expMonth: sub.cardExpMonth,
            expYear: sub.cardExpYear,
          }
        : null,
    unbilledCents,
    delinquent,
    usage: {
      usedCents: period.usedCents,
      includedCents: VATER_INCLUDED_USAGE_CENTS,
      limitCents: period.limitCents,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    },
    trial: {
      transcripts: trial?.transcripts ?? 0,
      scenes: trial?.scenes ?? 0,
      animations: trial?.animations ?? 0,
      caps: VATER_TRIAL_CAPS,
      capHitAt: trial?.capHitAt ?? null,
    },
    isTrial,
    defaultLimitCents: VATER_DEFAULT_MONTHLY_LIMIT_CENTS,
  });
}
