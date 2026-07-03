import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const isAdmin = await validateShopAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessFilter = req.nextUrl.searchParams.get("business") || undefined;

  const entries = await prisma.revenueEntry.findMany({
    where: businessFilter ? { business: businessFilter } : undefined,
    select: {
      business: true,
      channel: true,
      itemDesc: true,
      date: true,
      gross: true,
      cost: true,
      fees: true,
      profit: true,
      inventoryRem: true,
    },
  });

  const totalCount = entries.length;
  const totals = {
    gross: 0,
    cost: 0,
    fees: 0,
    profit: 0,
    inventory: 0,
  };
  for (const e of entries) {
    totals.gross += e.gross ?? 0;
    totals.cost += e.cost ?? 0;
    totals.fees += e.fees ?? 0;
    totals.profit += e.profit ?? 0;
    totals.inventory += e.inventoryRem ?? 0;
  }

  // Per-business
  const byBusiness: Record<
    string,
    {
      business: string;
      rows: number;
      gross: number;
      cost: number;
      profit: number;
      inventory: number;
      sold: number;
      unsold: number;
    }
  > = {};
  for (const e of entries) {
    if (!byBusiness[e.business]) {
      byBusiness[e.business] = {
        business: e.business,
        rows: 0,
        gross: 0,
        cost: 0,
        profit: 0,
        inventory: 0,
        sold: 0,
        unsold: 0,
      };
    }
    const b = byBusiness[e.business];
    b.rows++;
    b.gross += e.gross ?? 0;
    b.cost += e.cost ?? 0;
    b.profit += e.profit ?? 0;
    b.inventory += e.inventoryRem ?? 0;
    if ((e.gross ?? 0) > 0) b.sold++;
    else b.unsold++;
  }

  // Per-channel (within business)
  const byChannel: Record<
    string,
    {
      business: string;
      channel: string;
      rows: number;
      gross: number;
      cost: number;
      profit: number;
    }
  > = {};
  for (const e of entries) {
    const ch = e.channel ?? "(none)";
    const key = `${e.business} :: ${ch}`;
    if (!byChannel[key]) {
      byChannel[key] = {
        business: e.business,
        channel: ch,
        rows: 0,
        gross: 0,
        cost: 0,
        profit: 0,
      };
    }
    const c = byChannel[key];
    c.rows++;
    c.gross += e.gross ?? 0;
    c.cost += e.cost ?? 0;
    c.profit += e.profit ?? 0;
  }

  // Top winners + losers (per item)
  const winners = [...entries]
    .filter((e) => (e.profit ?? 0) > 0)
    .sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0))
    .slice(0, 10)
    .map((e) => ({
      business: e.business,
      channel: e.channel,
      item: e.itemDesc,
      profit: e.profit,
      gross: e.gross,
      cost: e.cost,
    }));
  // Only count items that actually SOLD (gross > 0) at a loss. Without the
  // gross>0 guard, unsold inventory floods the list because its row profit is
  // just -cost (the Flips sheet models unsold stock as -$13.19, a couch as
  // -$720, etc.) — that's stock not yet sold, not a realized loss.
  const losers = [...entries]
    .filter((e) => (e.gross ?? 0) > 0 && (e.profit ?? 0) < 0)
    .sort((a, b) => (a.profit ?? 0) - (b.profit ?? 0))
    .slice(0, 10)
    .map((e) => ({
      business: e.business,
      channel: e.channel,
      item: e.itemDesc,
      profit: e.profit,
      cost: e.cost,
    }));

  // Daily series (only entries with dates)
  const daily: Record<string, { gross: number; cost: number; profit: number }> = {};
  for (const e of entries) {
    if (!e.date) continue;
    const day = e.date.toISOString().slice(0, 10);
    if (!daily[day]) daily[day] = { gross: 0, cost: 0, profit: 0 };
    daily[day].gross += e.gross ?? 0;
    daily[day].cost += e.cost ?? 0;
    daily[day].profit += e.profit ?? 0;
  }
  const dailySeries = Object.entries(daily)
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const businessNames = Object.keys(byBusiness).sort();
  const lastImport = await prisma.revenueImportBatch.findFirst({
    orderBy: { createdAt: "desc" },
  });

  // Authoritative totals from the source's own Totals tabs.
  const officialRows = await prisma.revenueBusinessTotals.findMany({
    where: businessFilter ? { business: businessFilter } : undefined,
    orderBy: { business: "asc" },
  });
  const official: Record<
    string,
    {
      business: string;
      gross: number | null;
      cost: number | null;
      profit: number | null;
      profitOptimistic: number | null;
      inventoryRem: number | null;
      sourceSheet: string;
    }
  > = {};
  for (const r of officialRows) {
    if (!official[r.business]) {
      official[r.business] = {
        business: r.business,
        gross: r.gross,
        cost: r.cost,
        profit: r.profit,
        profitOptimistic: r.profitOptimistic,
        inventoryRem: r.inventoryRem,
        sourceSheet: r.sourceSheet,
      };
    }
  }

  // Reconciled topline: prefer official Totals, fall back to row-sum.
  const officialTotals = {
    gross: 0,
    cost: 0,
    profit: 0,
    inventory: 0,
    sourcesUsed: 0,
  };
  for (const o of Object.values(official)) {
    officialTotals.gross += o.gross ?? 0;
    officialTotals.cost += o.cost ?? 0;
    officialTotals.profit += o.profit ?? 0;
    officialTotals.inventory += o.inventoryRem ?? 0;
    if (
      o.gross !== null ||
      o.cost !== null ||
      o.profit !== null ||
      o.inventoryRem !== null
    ) {
      officialTotals.sourcesUsed++;
    }
  }

  return NextResponse.json({
    totalCount,
    totals,
    officialTotals,
    official: Object.values(official),
    byBusiness: Object.values(byBusiness).sort((a, b) => b.profit - a.profit),
    byChannel: Object.values(byChannel).sort((a, b) => b.profit - a.profit),
    winners,
    losers,
    dailySeries,
    businessNames,
    lastImport,
  });
}
