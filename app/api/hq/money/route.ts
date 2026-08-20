import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hq/money — Engine 5 "Money" tab: everything that needs a click or
// a collection action, in one read-only payload.
//
// - W/D: past_due clients (+ amount behind via missed WdPayments),
//   pendingApproval signups, and draft-message count. All actions live in
//   /wd/admin — this endpoint only surfaces counts/links.
// - Invoices: open Invoice rows (not PAID/VOID, amountDue > 0).
// - Week: revenue collected in the last 7 days. WdPayment is filtered to the
//   current month because the 2026-06-08 Stripe backfill stamped historical
//   payments (month "2025-08" etc.) with a fresh paidAt — without the month
//   filter "this week" would count a year of backfill as new cash.
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const currentMonth = now.toISOString().slice(0, 7); // "YYYY-MM"

  try {
    const [
      pastDueClients,
      pendingApprovalClients,
      wdDraftCount,
      openInvoices,
      wdWeekAgg,
      invoiceWeekAgg,
      newLeadsThisWeek,
    ] = await Promise.all([
      // Past-due subscriptions + their missed payments (amount behind).
      prisma.wdClient.findMany({
        where: { subscriptionStatus: "past_due" },
        select: {
          id: true,
          name: true,
          phone: true,
          unitCost: true,
          dunningStage: true,
          currentPeriodEnd: true,
          payments: {
            where: { status: "missed" },
            select: { amount: true, month: true },
          },
        },
        orderBy: { name: "asc" },
      }),
      // Self-serve signups awaiting 1-click approve in /wd/admin.
      prisma.wdClient.findMany({
        where: { pendingApproval: true },
        select: { id: true, name: true, unitCost: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      // Drafts pending — same semantics as the /wd/admin inbox
      // (GET /api/wd/messages?status=draft → status in [draft, failed]).
      prisma.wdMessage.count({
        where: { status: { in: ["draft", "failed"] } },
      }),
      // Open invoices: not paid, not voided, balance remaining. Read-only.
      prisma.invoice.findMany({
        where: {
          status: { notIn: ["PAID", "VOID", "VOIDED"] },
          amountDue: { gt: 0 },
        },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          amountDue: true,
          dueDate: true,
          issueDate: true,
          contact: { select: { name: true } },
        },
        orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }],
      }),
      // W/D cash collected this week (current-month payments only — see note).
      prisma.wdPayment.aggregate({
        where: {
          status: "paid",
          month: { gte: currentMonth },
          OR: [
            { paidAt: { gte: weekAgo } },
            { paidAt: null, createdAt: { gte: weekAgo } },
          ],
        },
        _sum: { amount: true },
        _count: true,
      }),
      // Invoice payments recorded this week (Buckeye/Wayne/etc.).
      prisma.invoicePayment.aggregate({
        where: { paidAt: { gte: weekAgo } },
        _sum: { amount: true },
        _count: true,
      }),
      // Pipeline pulse — same stat the weekly P&L digest uses
      // (scripts/pnl-pipeline-stats.mjs leadsAdded7d).
      prisma.growthLead.count({ where: { createdAt: { gte: weekAgo } } }),
    ]);

    // Animate Studio (pay-per-video) — this month's metered usage + video-offer
    // sales. Separate await: keeps the destructured tuple above untouched.
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [animateMonthAgg, videoOfferClients, spendEntries, spendMonthAgg] =
      await Promise.all([
        prisma.vaterUsage.aggregate({
          where: { ts: { gte: monthStart } },
          _sum: { costCents: true },
          _count: true,
        }),
        prisma.growthLead.count({
          where: { offer: "video", stage: "client" },
        }),
        // Manual spend log (the "+" button on the Money tab).
        prisma.hqSpendEntry.findMany({
          orderBy: { createdAt: "desc" },
          take: 25,
        }),
        prisma.hqSpendEntry.aggregate({
          where: { createdAt: { gte: monthStart } },
          _sum: { amountCents: true },
        }),
      ]);

    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const pastDue = pastDueClients.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      unitCost: c.unitCost,
      dunningStage: c.dunningStage,
      currentPeriodEnd: c.currentPeriodEnd,
      missedCount: c.payments.length,
      amountBehind: c.payments.reduce((sum, p) => sum + p.amount, 0),
    }));

    const invoices = openInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      contactName: inv.contact?.name ?? null,
      amountDue: inv.amountDue,
      dueDate: inv.dueDate,
      issueDate: inv.issueDate,
      isOverdue:
        inv.status === "OVERDUE" ||
        (inv.dueDate ? new Date(inv.dueDate) < todayMidnight : false),
    }));

    const wdRevenue = wdWeekAgg._sum.amount || 0;
    const invoiceRevenue = invoiceWeekAgg._sum.amount || 0;

    return NextResponse.json({
      wd: {
        pastDue,
        pastDueTotal: pastDue.reduce((sum, c) => sum + c.amountBehind, 0),
        pendingApproval: pendingApprovalClients,
        draftCount: wdDraftCount,
      },
      invoices: {
        open: invoices,
        totalDue: invoices.reduce((sum, i) => sum + i.amountDue, 0),
        overdueDue: invoices
          .filter((i) => i.isOverdue)
          .reduce((sum, i) => sum + i.amountDue, 0),
      },
      week: {
        since: weekAgo.toISOString(),
        wdRevenue,
        wdPayments: wdWeekAgg._count,
        invoiceRevenue,
        invoicePayments: invoiceWeekAgg._count,
        totalRevenue: wdRevenue + invoiceRevenue,
        newLeads: newLeadsThisWeek,
      },
      animate: {
        monthRevenue: (animateMonthAgg._sum.costCents ?? 0) / 100,
        monthActions: animateMonthAgg._count,
        videoOfferClients,
      },
      spend: {
        entries: spendEntries.map((e) => ({
          id: e.id,
          label: e.label,
          amount: e.amountCents / 100,
          createdAt: e.createdAt,
        })),
        monthTotal: (spendMonthAgg._sum.amountCents ?? 0) / 100,
      },
    });
  } catch (err) {
    console.error("[hq/money GET]", err);
    return NextResponse.json({ error: "Failed to load money data" }, { status: 500 });
  }
}

// POST /api/hq/money — add a manual spend-log entry: { label, amount }.
// amount is dollars ("200", "12.50"); stored as positive cents = money out.
export async function POST(req: Request) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const amount = Number(body.amount);
    if (!label || label.length > 200) {
      return NextResponse.json({ error: "Label required (max 200 chars)" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return NextResponse.json({ error: "Amount must be a positive dollar value" }, { status: 400 });
    }

    const entry = await prisma.hqSpendEntry.create({
      data: { label, amountCents: Math.round(amount * 100) },
    });
    return NextResponse.json({
      ok: true,
      entry: { id: entry.id, label: entry.label, amount: entry.amountCents / 100, createdAt: entry.createdAt },
    });
  } catch (err) {
    console.error("[hq/money POST]", err);
    return NextResponse.json({ error: "Failed to add spend entry" }, { status: 500 });
  }
}

// DELETE /api/hq/money?id=… — remove a spend-log entry (typo fix).
export async function DELETE(req: Request) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  try {
    await prisma.hqSpendEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[hq/money DELETE]", err);
    return NextResponse.json({ error: "Failed to delete spend entry" }, { status: 500 });
  }
}
