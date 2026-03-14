import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const predictions = await prisma.cryptoPrediction.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    predictions: predictions.map((p) => ({
      id: p.id,
      asset: p.asset,
      direction: p.direction,
      targetPrice: p.targetPrice,
      confidence: p.confidence,
      rationale: p.rationale,
      currentPrice: p.currentPrice,
      actualPrice: p.actualPrice,
      accuracy: p.accuracy,
      status: p.status,
      targetDate: p.targetDate.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
