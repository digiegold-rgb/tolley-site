import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * GET /api/markets/digest/latest — Returns latest daily digest
 * POST /api/markets/digest — Create/update daily digest (worker only)
 */
export async function GET() {
  const digest = await prisma.marketDailyDigest.findFirst({
    orderBy: { date: "desc" },
  });

  if (!digest) {
    return NextResponse.json({ digest: null });
  }

  return NextResponse.json({
    digest: {
      ...digest,
      date: digest.date.toISOString(),
      createdAt: digest.createdAt.toISOString(),
    },
  });
}

export async function POST(request: NextRequest) {
  const syncOk =
    process.env.SYNC_SECRET &&
    request.headers.get("x-sync-secret") === process.env.SYNC_SECRET;

  if (!syncOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const digest = await prisma.marketDailyDigest.upsert({
    where: { date: today },
    create: {
      date: today,
      headline: body.headline,
      keyChanges: body.keyChanges || [],
      topArticles: body.topArticles || [],
      riskFactors: body.riskFactors || [],
      opportunities: body.opportunities || [],
    },
    update: {
      headline: body.headline,
      keyChanges: body.keyChanges || [],
      topArticles: body.topArticles || [],
      riskFactors: body.riskFactors || [],
      opportunities: body.opportunities || [],
    },
  });

  return NextResponse.json({ ok: true, id: digest.id });
}
