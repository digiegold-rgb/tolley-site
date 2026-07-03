/**
 * lib/vater/billing/period.ts
 *
 * Period resolution + usage aggregation. Truth = sum(VaterUsage.costCents)
 * scoped to the current period. We keep VaterMonthlyLimit.usedCents as a
 * cache for fast page renders, but recompute from the ledger on every
 * mutation to avoid drift.
 */

import { prisma } from "@/lib/prisma";
import {
  VATER_DEFAULT_MONTHLY_LIMIT_CENTS,
  VATER_INCLUDED_USAGE_CENTS,
} from "@/lib/vater-subscription";

export interface VaterPeriodInfo {
  periodStart: Date;
  periodEnd: Date | null;
  /** Sum of every VaterUsage.costCents in the current period */
  usedCents: number;
  /** User-set monthly spending cap (cents). Default $500. */
  limitCents: number;
  /** $250 every period — informational only; Stripe Credit Grant handles the actual deduction */
  includedCents: number;
  /** Are we still inside a free trial (no paid subscription yet) */
  isTrial: boolean;
}

/**
 * Resolve the current period bounds for a user. Period start defaults to
 * the user's VaterSubscription.currentPeriodStart, falling back to the
 * VaterMonthlyLimit.periodStart, falling back to the first day of the
 * current calendar month for trial users.
 */
export async function getCurrentPeriod(userId: string): Promise<VaterPeriodInfo> {
  const sub = await prisma.vaterSubscription.findUnique({
    where: { userId },
  });

  let periodStart: Date;
  let periodEnd: Date | null = null;

  if (sub?.currentPeriodStart) {
    periodStart = sub.currentPeriodStart;
    periodEnd = sub.currentPeriodEnd ?? null;
  } else {
    const limit = await prisma.vaterMonthlyLimit.findUnique({
      where: { userId },
    });
    if (limit?.periodStart) {
      periodStart = limit.periodStart;
    } else {
      const now = new Date();
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }

  const limitRow = await prisma.vaterMonthlyLimit.findUnique({
    where: { userId },
  });
  const limitCents = limitRow?.limitCents ?? VATER_DEFAULT_MONTHLY_LIMIT_CENTS;

  const usage = await prisma.vaterUsage.aggregate({
    where: {
      userId,
      ts: { gte: periodStart },
      ...(periodEnd ? { ts: { lt: periodEnd } } : {}),
    },
    _sum: { costCents: true },
  });
  const usedCents = usage._sum.costCents ?? 0;

  return {
    periodStart,
    periodEnd,
    usedCents,
    limitCents,
    includedCents: VATER_INCLUDED_USAGE_CENTS,
    isTrial: !sub || sub.status === "trialing" || sub.status === "none",
  };
}

/**
 * Refresh the cached usedCents on VaterMonthlyLimit. Cheap; call after
 * recording usage so the cache is never more than one event stale.
 */
export async function refreshMonthlyLimitCache(userId: string): Promise<void> {
  const period = await getCurrentPeriod(userId);
  await prisma.vaterMonthlyLimit.upsert({
    where: { userId },
    create: {
      userId,
      limitCents: period.limitCents,
      periodStart: period.periodStart,
      usedCents: period.usedCents,
    },
    update: {
      usedCents: period.usedCents,
      periodStart: period.periodStart,
    },
  });
}
