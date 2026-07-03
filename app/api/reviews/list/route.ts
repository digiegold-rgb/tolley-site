import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateShopAdmin } from "@/lib/shop-auth";
import { GBP_REGISTRY } from "@/lib/reviews/gbps";

export async function GET(_req: NextRequest) {
  if (!(await validateShopAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recent = await prisma.reviewRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const counts = await prisma.reviewRequest.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  return NextResponse.json({
    requests: recent,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    gbps: GBP_REGISTRY.map((g) => ({
      key: g.key,
      label: g.label,
      configured: g.reviewUrl !== null,
    })),
  });
}
