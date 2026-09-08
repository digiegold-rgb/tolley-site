import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MarketPortal from "@/components/leads/markets/MarketPortal";

export const dynamic = "force-dynamic";
export const revalidate = 600;

/**
 * /leads/markets — Market Intelligence inside the T-Agent shell (Phase 7).
 *
 * MarketPortal already exists under /markets with its own chrome. This route
 * mounts the same component inside the T-Agent sidebar+topbar layout so
 * Cordless can jump to market intel without losing context.
 */
export default async function LeadsMarketsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/leads/markets");
  }

  let snapshotRow = null;
  let signals: Awaited<ReturnType<typeof prisma.marketSignal.findMany>> = [];
  let dataPoints: {
    id: string;
    type: string;
    title: string;
    url: string | null;
    summary: string | null;
    signal: string | null;
    signalConfidence: number | null;
    sentiment: number | null;
    numericValue: number | null;
    changePercent: number | null;
    tags: string[];
    publishedAt: Date | null;
    createdAt: Date;
  }[] = [];

  try {
    [snapshotRow, signals, dataPoints] = await Promise.all([
      prisma.marketSnapshot.findFirst({ orderBy: { date: "desc" } }),
      prisma.marketSignal.findMany({
        where: {
          active: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
        take: 20,
      }),
      prisma.marketDataPoint.findMany({
        select: {
          id: true,
          type: true,
          title: true,
          url: true,
          summary: true,
          signal: true,
          signalConfidence: true,
          sentiment: true,
          numericValue: true,
          changePercent: true,
          tags: true,
          publishedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
  } catch (e) {
    console.error("[leads/markets] Failed to load data:", e);
  }

  const snapshot = snapshotRow
    ? {
        nationalHealth: snapshotRow.nationalHealth,
        localKcHealth: snapshotRow.localKcHealth,
        mortgage30yr: snapshotRow.mortgage30yr,
        mortgage15yr: snapshotRow.mortgage15yr,
        treasury10yr: snapshotRow.treasury10yr,
        treasury30yr: snapshotRow.treasury30yr,
        unemployment: snapshotRow.unemployment,
        cpi: snapshotRow.cpi,
        consumerSentiment: snapshotRow.consumerSentiment,
        housingStarts: snapshotRow.housingStarts,
        tickers: snapshotRow.tickers as Record<
          string,
          { price: number; change: number; changePercent: number }
        > | null,
        summary: snapshotRow.summary,
        updatedAt: snapshotRow.updatedAt.toISOString(),
        momentum: snapshotRow.momentum,
        healthDelta: snapshotRow.healthDelta,
        kcHealthDelta: snapshotRow.kcHealthDelta,
        sentimentBullPct: snapshotRow.sentimentBullPct,
        sentimentBearPct: snapshotRow.sentimentBearPct,
        articleCount: snapshotRow.articleCount,
      }
    : null;

  const serializedSignals = signals.map((s) => ({
    id: s.id,
    signal: s.signal,
    confidence: s.confidence,
    scope: s.scope,
    category: s.category,
    title: s.title,
    reasoning: s.reasoning,
    timeHorizon: s.timeHorizon || undefined,
  }));

  const serializedDP = dataPoints.map((d) => ({
    ...d,
    url: d.url || undefined,
    summary: d.summary || undefined,
    signal: d.signal || undefined,
    signalConfidence: d.signalConfidence || undefined,
    sentiment: d.sentiment || undefined,
    numericValue: d.numericValue || undefined,
    changePercent: d.changePercent || undefined,
    publishedAt: d.publishedAt?.toISOString(),
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white">Market Intelligence</h1>
        <p className="text-xs text-white/40">
          AI-analyzed housing market data — YouTube, FRED, RSS, and stock tickers. Updated every 4 hours.
        </p>
      </div>
      <MarketPortal
        initialSnapshot={snapshot}
        initialSignals={serializedSignals}
        initialDataPoints={serializedDP}
      />
    </div>
  );
}
