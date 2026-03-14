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
  const results = { dataPoints: 0, signals: 0, snapshot: false, duplicatesSkipped: 0, signalsArchived: 0 };

  // Source weights for impact scoring
  const SOURCE_WEIGHTS: Record<string, number> = {
    fred_indicator: 1.0,
    economic_indicator: 1.0,
    stock_reading: 0.95,
    video_analysis: 0.6,
    article_summary: 0.5,
    manual_note: 0.3,
  };

  // Insert data points
  if (body.dataPoints && Array.isArray(body.dataPoints)) {
    for (const dp of body.dataPoints) {
      // De-duplicate articles by normalized title (first 50 chars)
      if (dp.type === "article_summary" && dp.title) {
        const normalizedTitle = dp.title.toLowerCase().replace(/[^\w\s]/g, "").trim().slice(0, 50);
        if (normalizedTitle.length > 10) {
          const existing = await prisma.marketDataPoint.findFirst({
            where: {
              type: "article_summary",
              title: { startsWith: normalizedTitle.slice(0, 30), mode: "insensitive" },
              createdAt: { gte: new Date(Date.now() - 48 * 3600000) }, // Last 48h
            },
            select: { id: true },
          });
          if (existing) {
            results.duplicatesSkipped++;
            continue;
          }
        }
      }

      // Calculate impact score
      const sourceWeight = SOURCE_WEIGHTS[dp.type] || 0.5;
      const changeMag = Math.min(Math.abs(dp.changePercent || 0) / 10, 1);
      const impactScore = sourceWeight * changeMag;

      // Calculate quality score
      const qualityScore = sourceWeight; // Fresh data = full source weight

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
          qualityScore,
          impactScore: impactScore > 0 ? impactScore : null,
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
    // Get categories we're about to update
    const categories = [...new Set(body.signals.map((s: { category: string }) => s.category))] as string[];

    if (categories.length > 0) {
      // Archive old signals before deactivating
      const oldSignals = await prisma.marketSignal.findMany({
        where: { category: { in: categories }, active: true },
      });

      if (oldSignals.length > 0) {
        await prisma.marketSignalArchive.createMany({
          data: oldSignals.map((s) => ({
            originalSignalId: s.id,
            signal: s.signal,
            confidence: s.confidence,
            scope: s.scope,
            category: s.category,
            title: s.title,
            reasoning: s.reasoning,
            timeHorizon: s.timeHorizon,
            createdAt: s.createdAt,
          })),
        });
        results.signalsArchived = oldSignals.length;
      }

      // Deactivate old signals
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

    // Calculate health deltas from yesterday's snapshot
    let healthDelta: number | null = null;
    let kcHealthDelta: number | null = null;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const prevSnapshot = await prisma.marketSnapshot.findUnique({
      where: { date: yesterday },
      select: { nationalHealth: true, localKcHealth: true },
    });
    if (prevSnapshot) {
      if (snap.nationalHealth != null && prevSnapshot.nationalHealth != null) {
        healthDelta = snap.nationalHealth - prevSnapshot.nationalHealth;
      }
      if (snap.localKcHealth != null && prevSnapshot.localKcHealth != null) {
        kcHealthDelta = snap.localKcHealth - prevSnapshot.localKcHealth;
      }
    }

    // Calculate sentiment percentages from today's articles
    const todayArticles = await prisma.marketDataPoint.findMany({
      where: {
        type: { in: ["article_summary", "video_analysis"] },
        createdAt: { gte: today },
        sentiment: { not: null },
      },
      select: { sentiment: true },
    });
    const articleCount = todayArticles.length;
    let sentimentBullPct: number | null = null;
    let sentimentBearPct: number | null = null;
    if (articleCount > 0) {
      const bullish = todayArticles.filter((a) => (a.sentiment ?? 0) > 0.2).length;
      const bearish = todayArticles.filter((a) => (a.sentiment ?? 0) < -0.2).length;
      sentimentBullPct = (bullish / articleCount) * 100;
      sentimentBearPct = (bearish / articleCount) * 100;
    }

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
        momentum: snap.momentum ?? null,
        healthDelta,
        kcHealthDelta,
        sentimentBullPct,
        sentimentBearPct,
        articleCount,
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
        momentum: snap.momentum ?? undefined,
        healthDelta: healthDelta ?? undefined,
        kcHealthDelta: kcHealthDelta ?? undefined,
        sentimentBullPct: sentimentBullPct ?? undefined,
        sentimentBearPct: sentimentBearPct ?? undefined,
        articleCount,
        dataPointCount: { increment: results.dataPoints },
        signalCount: { increment: results.signals },
      },
    });
    results.snapshot = true;
  }

  return NextResponse.json({ ok: true, ...results });
}
