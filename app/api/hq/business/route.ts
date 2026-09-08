import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { getStripeClient } from "@/lib/stripe";
import { isWdSubscription } from "@/lib/wd-subscription";
import { monthlySubscriptionAmount } from "@/lib/wd-payment-facts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET() {
  if (!(await validateWdAdmin()).authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const since = new Date(Date.now() - 30 * 86400000);
  try {
    const [actions, drafts, recentSends, notifications, unknownPayments, usage, payments, recordedCosts, blockers, stages, emails, portals] = await Promise.all([
      prisma.leadAction.groupBy({ by: ["subsite", "status"], _count: { _all: true } }),
      prisma.growthTouch.count({ where: { status: "draft" } }),
      prisma.growthTouch.count({ where: { status: "sent", sentAt: { gte: since } } }),
      prisma.leadNotification.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.wdPayment.count({ where: { status: "paid", paidAtSource: null } }),
      prisma.vaterUsage.aggregate({ where: { ts: { gte: since } }, _sum: { costCents: true } }),
      prisma.vaterPayment.aggregate({ where: { createdAt: { gte: since } }, _sum: { amountUsd: true } }),
      prisma.hqSpendEntry.aggregate({ where: { createdAt: { gte: since } }, _sum: { amountCents: true } }),
      prisma.mustCompleteItem.findMany({ where: { status: "open" }, orderBy: { sortOrder: "asc" }, take: 8, select: { id: true, title: true, priority: true } }),
      prisma.growthLead.groupBy({ by: ["stage"], _count: { _all: true } }),
      prisma.emailLead.groupBy({ by: ["source", "status"], _count: { _all: true } }),
      prisma.clientPortalSignup.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    const totals = new Map<string, { subsite: string; status: string; _count: { _all: number } }>();
    for (const row of [...actions, ...emails.map(e => ({ ...e, subsite: e.source })), ...portals.map(p => ({ ...p, subsite: "client" }))]) {
      const key = `${row.subsite}:${row.status}`;
      const total = totals.get(key) ?? { subsite: row.subsite, status: row.status, _count: { _all: 0 } };
      total._count._all += row._count._all;
      totals.set(key, total);
    }
    const inbound = [...totals.values()];
    let stripe: { asOf: string; subscriptions: Record<string, { count: number; monthlyAmount: number; unknownRates: number }> } | null = null;
    let stripeError: string | null = null;
    try {
      const subs = await getStripeClient().subscriptions.list({ status: "all", limit: 100 }).autoPagingToArray({ limit: 10000 });
      const groups: Record<string, { count: number; monthlyAmount: number; unknownRates: number }> = {};
      for (const sub of subs.filter(isWdSubscription)) {
        const g = groups[sub.status] ??= { count: 0, monthlyAmount: 0, unknownRates: 0 };
        const monthly = monthlySubscriptionAmount(sub.items.data);
        g.count++;
        if (monthly == null) g.unknownRates++; else g.monthlyAmount += monthly;
      }
      stripe = { asOf: new Date().toISOString(), subscriptions: groups };
    } catch { stripeError = "Stripe unavailable. Rental totals are unknown; no cached balance is presented as current."; }
    return NextResponse.json({ since, stripe, stripeError, inbound, pipeline: { drafts, recentSends, stages },
      notifications, unknownPayments, blockers,
      studio: { recordedPayments: payments._sum.amountUsd ?? 0, accruedUsage: (usage._sum.costCents ?? 0) / 100 },
      recordedCosts: (recordedCosts._sum.amountCents ?? 0) / 100,
      margin: null, marginNote: "Contribution margin is unavailable until direct costs and offline payments are reconciled by business. Usage accrual is not collected revenue.",
    });
  } catch { return NextResponse.json({ error: "Business summary unavailable. Check database migration and connectivity." }, { status: 503 }); }
}
