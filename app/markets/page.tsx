import { prisma } from "@/lib/prisma";
import MarketPortal from "@/components/leads/markets/MarketPortal";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const metadata = {
  title: "Market Intelligence | T-Agent by Tolley.io",
  description: "Real-time housing market intelligence — AI-analyzed YouTube transcripts, stock data, economic indicators, and news. Powered by T-Agent.",
};

export default async function MarketsPage() {
  let snapshotRow = null;
  let signals: Awaited<ReturnType<typeof prisma.marketSignal.findMany>> = [];
  let dataPoints: { id: string; type: string; title: string; url: string | null; summary: string | null; signal: string | null; signalConfidence: number | null; sentiment: number | null; numericValue: number | null; changePercent: number | null; publishedAt: Date | null; createdAt: Date }[] = [];

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
          publishedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);
  } catch (e) {
    console.error("[markets] Failed to load data:", e);
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
        tickers: snapshotRow.tickers as Record<string, { price: number; change: number; changePercent: number }> | null,
        summary: snapshotRow.summary,
        updatedAt: snapshotRow.updatedAt.toISOString(),
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
    <div className="min-h-screen bg-[#06050a]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Top nav */}
        <nav className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <a href="/" className="text-xs text-white/30 hover:text-white/50">tolley.io</a>
            <span className="text-white/10">/</span>
            <span className="text-sm font-medium text-cyan-300">Markets</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/leads/dashboard"
              className="text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Dashboard
            </a>
            <a
              href="/leads/pricing"
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-medium hover:bg-cyan-500/30 transition-colors"
            >
              Sign Up
            </a>
          </div>
        </nav>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Market Intelligence</h1>
          <p className="text-sm text-white/40">
            AI-analyzed housing market data from YouTube, economic indicators, RSS feeds, and stock data.
            Updated every 4 hours.
          </p>
        </div>

        {/* Portal */}
        <MarketPortal
          initialSnapshot={snapshot}
          initialSignals={serializedSignals}
          initialDataPoints={serializedDP}
        />

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-white/5 text-center">
          <p className="text-xs text-white/20">
            Powered by T-Agent AI — Data for informational purposes only, not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}
