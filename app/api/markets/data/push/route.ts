import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/markets/data/push — Worker pushes analyzed results
 * Auth: SYNC_SECRET only (worker-to-API)
 * Body: { dataPoints?: [...], signals?: [...], snapshot?: {...} }
 */
export async function POST(request: NextRequest) {
  const syncOk =
    process.env.SYNC_SECRET &&
    request.headers.get("x-sync-secret") === process.env.SYNC_SECRET;

  if (!syncOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const results = { dataPoints: 0, signals: 0, snapshot: false };

  // Insert data points
  if (body.dataPoints && Array.isArray(body.dataPoints)) {
    for (const dp of body.dataPoints) {
      await prisma.marketDataPoint.create({
        data: {
          sourceId: dp.sourceId || null,
          type: dp.type,
          title: dp.title,
          url: dp.url || null,
          scope: dp.scope || "national",
          sentiment: dp.sentiment ?? null,
          signal: dp.signal || null,
          signalConfidence: dp.signalConfidence ?? null,
          rawContent: dp.rawContent || null,
          summary: dp.summary || null,
          analysis: dp.analysis || null,
          numericValue: dp.numericValue ?? null,
          previousValue: dp.previousValue ?? null,
          changePercent: dp.changePercent ?? null,
          publishedAt: dp.publishedAt ? new Date(dp.publishedAt) : null,
          tags: dp.tags || [],
          expiresAt: dp.rawContent
            ? new Date(Date.now() + 90 * 86400000) // 90 day retention for raw content
            : null,
        },
      });
      results.dataPoints++;
    }
  }

  // Insert signals
  if (body.signals && Array.isArray(body.signals)) {
    // Deactivate old signals in same categories
    const categories = [...new Set(body.signals.map((s: { category: string }) => s.category))] as string[];
    if (categories.length > 0) {
      await prisma.marketSignal.updateMany({
        where: { category: { in: categories }, active: true },
        data: { active: false },
      });
    }

    for (const sig of body.signals) {
      await prisma.marketSignal.create({
        data: {
          signal: sig.signal,
          confidence: sig.confidence,
          scope: sig.scope || "national",
          category: sig.category,
          title: sig.title,
          reasoning: sig.reasoning,
          supportingData: sig.supportingData || null,
          timeHorizon: sig.timeHorizon || null,
          active: true,
          expiresAt: new Date(Date.now() + 7 * 86400000), // 7 day TTL
        },
      });
      results.signals++;
    }
  }

  // Upsert daily snapshot
  if (body.snapshot) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snap = body.snapshot;
    await prisma.marketSnapshot.upsert({
      where: { date: today },
      create: {
        date: today,
        nationalHealth: snap.nationalHealth ?? null,
        localKcHealth: snap.localKcHealth ?? null,
        mortgage30yr: snap.mortgage30yr ?? null,
        mortgage15yr: snap.mortgage15yr ?? null,
        treasury10yr: snap.treasury10yr ?? null,
        treasury30yr: snap.treasury30yr ?? null,
        unemployment: snap.unemployment ?? null,
        cpi: snap.cpi ?? null,
        consumerSentiment: snap.consumerSentiment ?? null,
        housingStarts: snap.housingStarts ?? null,
        tickers: snap.tickers || null,
        topSignals: snap.topSignals || null,
        summary: snap.summary || null,
        dataPointCount: results.dataPoints,
        signalCount: results.signals,
      },
      update: {
        nationalHealth: snap.nationalHealth ?? undefined,
        localKcHealth: snap.localKcHealth ?? undefined,
        mortgage30yr: snap.mortgage30yr ?? undefined,
        mortgage15yr: snap.mortgage15yr ?? undefined,
        treasury10yr: snap.treasury10yr ?? undefined,
        treasury30yr: snap.treasury30yr ?? undefined,
        unemployment: snap.unemployment ?? undefined,
        cpi: snap.cpi ?? undefined,
        consumerSentiment: snap.consumerSentiment ?? undefined,
        housingStarts: snap.housingStarts ?? undefined,
        tickers: snap.tickers || undefined,
        topSignals: snap.topSignals || undefined,
        summary: snap.summary || undefined,
        dataPointCount: { increment: results.dataPoints },
        signalCount: { increment: results.signals },
      },
    });
    results.snapshot = true;
  }

  return NextResponse.json({ ok: true, ...results });
}
