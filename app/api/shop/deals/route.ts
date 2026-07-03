/**
 * GET /api/shop/deals — list retail deal finds for the admin dashboard.
 * Auth: shop admin session.
 *
 * Query: ?status=new|sourced|dismissed|all  ?retailer=  ?minMargin=  ?limit=
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || "new";
  const retailer = sp.get("retailer")?.trim() || undefined;
  const minMargin = Number(sp.get("minMargin") || "0");
  const limit = Math.min(Number(sp.get("limit")) || 100, 500);

  const deals = await prisma.retailDeal.findMany({
    where: {
      ...(status && status !== "all" ? { status } : {}),
      ...(retailer ? { retailer } : {}),
      ...(minMargin > 0 ? { marginPct: { gte: minMargin } } : {}),
    },
    orderBy: [{ marginPct: "desc" }, { lastSeenAt: "desc" }],
    take: limit,
  });

  const counts = await prisma.retailDeal.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  return NextResponse.json({
    deals,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  });
}
