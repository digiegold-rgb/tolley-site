import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApiSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  await requireAdminApiSession();

  const url = new URL(request.url);
  const ticker = url.searchParams.get("ticker");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

  const decisions = await prisma.tradingAgentDecision.findMany({
    where: ticker ? { ticker: ticker.toUpperCase() } : undefined,
    orderBy: [{ createdAt: "desc" }],
    take: limit,
  });

  return NextResponse.json({ decisions });
}
