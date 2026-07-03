import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";

export async function GET(req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const where = status && status !== "all" ? { status } : {};

  const signals = await prisma.probateSignal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const counts = await prisma.probateSignal.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  return NextResponse.json({
    signals,
    counts: Object.fromEntries(
      counts.map((c) => [c.status, c._count._all])
    ),
  });
}
