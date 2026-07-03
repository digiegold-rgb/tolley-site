import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/routines/data?source=<stripe|wd|shop|leads>
 *
 * Read-only JSON feeds for Claude Code cloud "/schedule" routines, which have
 * no DB/Stripe access of their own. Auth: x-sync-secret. Each source returns a
 * compact, bounded payload the routine can reason over and turn into a brief.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.SYNC_SECRET;
  if (!secret || request.headers.get("x-sync-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = request.nextUrl.searchParams.get("source");
  try {
    switch (source) {
      case "stripe":
        return NextResponse.json(await stripeSummary());
      case "wd":
        return NextResponse.json(await wdSummary());
      case "shop":
        return NextResponse.json(await shopSlowMovers());
      case "leads":
        return NextResponse.json(await staleLeads());
      default:
        return NextResponse.json(
          { error: "Unknown source. Use stripe|wd|shop|leads." },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error(`[routines/data] source=${source} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error", source },
      { status: 500 },
    );
  }
}

const DAY = 24 * 60 * 60 * 1000;

async function stripeSummary() {
  const stripe = getStripeClient();
  const now = Math.floor(Date.now() / 1000);
  const since = now - 2 * 24 * 60 * 60; // last 48h

  const [charges, balance] = await Promise.all([
    stripe.charges.list({ created: { gte: since }, limit: 100 }),
    stripe.balance.retrieve(),
  ]);

  const succeeded = charges.data.filter((c) => c.status === "succeeded" && c.paid);
  const failed = charges.data.filter((c) => c.status === "failed");
  const refunded = charges.data.filter((c) => c.refunded || (c.amount_refunded ?? 0) > 0);

  const grossCents = succeeded.reduce((s, c) => s + c.amount, 0);
  const refundCents = charges.data.reduce((s, c) => s + (c.amount_refunded ?? 0), 0);

  const fmt = (c: number) => +(c / 100).toFixed(2);

  return {
    source: "stripe",
    windowHours: 48,
    generatedAt: new Date().toISOString(),
    totals: {
      grossUsd: fmt(grossCents),
      refundedUsd: fmt(refundCents),
      netUsd: fmt(grossCents - refundCents),
      succeededCount: succeeded.length,
      failedCount: failed.length,
      refundedCount: refunded.length,
    },
    availableBalanceUsd: balance.available.map((b) => ({
      currency: b.currency,
      amount: fmt(b.amount),
    })),
    failedCharges: failed.slice(0, 15).map((c) => ({
      amountUsd: fmt(c.amount),
      created: new Date(c.created * 1000).toISOString(),
      description: c.description,
      failureMessage: c.failure_message,
      email: c.billing_details?.email ?? c.receipt_email,
    })),
    recentSucceeded: succeeded.slice(0, 25).map((c) => ({
      amountUsd: fmt(c.amount),
      created: new Date(c.created * 1000).toISOString(),
      description: c.description,
      email: c.billing_details?.email ?? c.receipt_email,
    })),
  };
}

async function wdSummary() {
  const now = Date.now();
  const soon = new Date(now + 7 * DAY);

  const clients = await prisma.wdClient.findMany({
    where: {
      active: true,
      OR: [
        { dunningStage: { gt: 0 } },
        { lastPaymentStatus: "failed" },
        { subscriptionStatus: { in: ["past_due", "unpaid"] } },
        { currentPeriodEnd: { lte: soon } },
      ],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      unitDescription: true,
      unitCost: true,
      subscriptionStatus: true,
      lastPaymentStatus: true,
      dunningStage: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      createdAt: true,
      payments: { select: { amount: true, status: true, paidAt: true }, orderBy: { createdAt: "desc" }, take: 6 },
    },
    take: 80,
  });

  const pastDue = clients.filter(
    (c) => c.dunningStage > 0 || c.lastPaymentStatus === "failed" || ["past_due", "unpaid"].includes(c.subscriptionStatus ?? ""),
  );
  const renewingSoon = clients.filter(
    (c) => c.currentPeriodEnd && c.currentPeriodEnd <= soon && !["past_due", "unpaid"].includes(c.subscriptionStatus ?? "") && c.dunningStage === 0,
  );

  const shape = (c: (typeof clients)[number]) => {
    const paidCount = c.payments.filter((p) => p.status === "paid").length;
    const lifetimePaid = c.payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      unit: c.unitDescription,
      monthlyCost: c.unitCost,
      subscriptionStatus: c.subscriptionStatus,
      dunningStage: c.dunningStage,
      currentPeriodEnd: c.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: c.cancelAtPeriodEnd,
      tenureDays: Math.round((now - c.createdAt.getTime()) / DAY),
      recentPaidCount: paidCount,
      recentPaidUsd: +lifetimePaid.toFixed(2),
    };
  };

  return {
    source: "wd",
    generatedAt: new Date().toISOString(),
    counts: { pastDue: pastDue.length, renewingSoon: renewingSoon.length },
    pastDue: pastDue.map(shape),
    renewingSoon: renewingSoon.map(shape),
  };
}

async function shopSlowMovers() {
  const cutoff = new Date(Date.now() - 30 * DAY);
  const products = await prisma.product.findMany({
    where: {
      soldAt: null,
      status: { in: ["listed", "active", "live"] },
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      title: true,
      category: true,
      brand: true,
      condition: true,
      targetPrice: true,
      minPrice: true,
      costBasis: true,
      aiSuggestedPrice: true,
      amazonClicks: true,
      amazonSearchClicks: true,
      soldPlatform: true,
      fbStatus: true,
      ebayStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
    take: 40,
  });

  return {
    source: "shop",
    generatedAt: new Date().toISOString(),
    cutoffDays: 30,
    count: products.length,
    products: products.map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      brand: p.brand,
      condition: p.condition,
      targetPrice: p.targetPrice,
      minPrice: p.minPrice,
      costBasis: p.costBasis,
      aiSuggestedPrice: p.aiSuggestedPrice,
      daysListed: Math.round((Date.now() - p.createdAt.getTime()) / DAY),
      interest: { amazonClicks: p.amazonClicks, amazonSearchClicks: p.amazonSearchClicks },
      platforms: { fb: p.fbStatus, ebay: p.ebayStatus },
    })),
  };
}

async function staleLeads() {
  const cutoff = new Date(Date.now() - 14 * DAY);
  const leads = await prisma.lead.findMany({
    where: {
      status: { in: ["new", "contacted", "working"] },
      OR: [{ contactedAt: null }, { contactedAt: { lt: cutoff } }],
      createdAt: { lt: cutoff },
    },
    select: {
      id: true,
      ownerName: true,
      ownerPhone: true,
      ownerEmail: true,
      score: true,
      status: true,
      contactedAt: true,
      createdAt: true,
      listing: { select: { address: true, city: true, listPrice: true, daysOnMarket: true } },
    },
    orderBy: { score: "desc" },
    take: 25,
  });

  return {
    source: "leads",
    generatedAt: new Date().toISOString(),
    staleAfterDays: 14,
    count: leads.length,
    leads: leads.map((l) => ({
      id: l.id,
      name: l.ownerName,
      phone: l.ownerPhone,
      email: l.ownerEmail,
      score: l.score,
      status: l.status,
      lastContact: l.contactedAt?.toISOString() ?? null,
      ageDays: Math.round((Date.now() - l.createdAt.getTime()) / DAY),
      property: l.listing
        ? { address: l.listing.address, city: l.listing.city, listPrice: l.listing.listPrice, dom: l.listing.daysOnMarket }
        : null,
    })),
  };
}
