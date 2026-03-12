import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/markets/signals — Active buy/sell/hold signals (public)
 */
export async function GET() {
  const signals = await prisma.marketSignal.findMany({
    where: {
      active: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
    take: 20,
  });

  return NextResponse.json({ signals });
}
