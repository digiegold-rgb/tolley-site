import { prisma } from "@/lib/prisma";
import { ClientPortal } from "@/components/client/ClientPortal";

export const revalidate = 300;

export default async function ClientPage() {
  interface SnapData {
    mortgage30yr: number | null;
    mortgage15yr: number | null;
    localKcHealth: number | null;
    nationalHealth: number | null;
    unemployment: number | null;
    cpi: number | null;
    consumerSentiment: number | null;
    tickers: Record<string, { price: number; change: number; changePercent: number }> | null;
    date: string;
  }
  let latestSnapshot: SnapData | null = null;
  let snapshotHistory: SnapData[] = [];
  let signals: { id: string; signal: string; confidence: number; title: string; reasoning: string; scope: string; category: string; timeHorizon: string | null }[] = [];
  let dataPoints: { id: string; type: string; title: string; url?: string; summary: string | null; sentiment: number | null; signal: string | null; tags: string[]; publishedAt: string | null; createdAt: string }[] = [];
  let listings: { id: string; mlsId: string; address: string; city: string | null; state: string | null; zip: string | null; listPrice: number | null; beds: number | null; baths: number | null; sqft: number | null; daysOnMarket: number | null; photoUrl: string | null; buyScore: number; propertyType: string | null }[] = [];
  let digest: { headline: string; keyChanges: unknown; riskFactors: unknown; opportunities: unknown; date: string } | null = null;
  let marketStats = { activeListings: 0, dataPoints: 0, activeSignals: 0, poiCount: 0, metroAreas: 12 };
  let listingsByCity: Record<string, number> = {};

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const [snap, snapHistory, rawSignals, rawDP, rawListings, rawDigest, listingCount, dpCount, poiCount, cityGroups] =
      await Promise.all([
        prisma.marketSnapshot.findFirst({
          orderBy: { date: "desc" },
        }),
        prisma.marketSnapshot.findMany({
          where: { date: { gte: thirtyDaysAgo } },
          orderBy: { date: "desc" },
          take: 30,
        }),
        prisma.marketSignal.findMany({
          where: {
            active: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
          take: 20,
        }),
        prisma.marketDataPoint.findMany({
          where: {
            type: { in: ["youtube", "article", "note", "rss_article"] },
          },
          select: {
            id: true,
            type: true,
            title: true,
            url: true,
            summary: true,
            sentiment: true,
            signal: true,
            tags: true,
            publishedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        prisma.listing.findMany({
          where: {
            status: "Active",
            state: "MO",
          },
          select: {
            id: true,
            mlsId: true,
            address: true,
            city: true,
            state: true,
            zip: true,
            listPrice: true,
            beds: true,
            baths: true,
            sqft: true,
            daysOnMarket: true,
            photoUrls: true,
            propertyType: true,
            enrichment: { select: { buyScore: true } },
          },
          orderBy: [{ daysOnMarket: "asc" }],
          take: 24,
        }),
        prisma.marketDailyDigest.findFirst({
          orderBy: { date: "desc" },
        }),
        prisma.listing.count({ where: { status: "Active" } }),
        prisma.marketDataPoint.count(),
        prisma.pointOfInterest.count(),
        prisma.listing.groupBy({
          by: ["city"],
          where: { status: "Active", city: { not: null } },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 30,
        }),
      ]);

    if (snap) {
      latestSnapshot = {
        mortgage30yr: snap.mortgage30yr,
        mortgage15yr: snap.mortgage15yr,
        localKcHealth: snap.localKcHealth,
        nationalHealth: snap.nationalHealth,
        unemployment: snap.unemployment,
        cpi: snap.cpi,
        consumerSentiment: snap.consumerSentiment,
        tickers: snap.tickers as SnapData["tickers"],
        date: snap.date.toISOString(),
      };
    }

    snapshotHistory = snapHistory.map((s) => ({
      mortgage30yr: s.mortgage30yr,
      mortgage15yr: s.mortgage15yr,
      localKcHealth: s.localKcHealth,
      nationalHealth: s.nationalHealth,
      unemployment: s.unemployment,
      cpi: s.cpi,
      consumerSentiment: s.consumerSentiment,
      tickers: s.tickers as SnapData["tickers"],
      date: s.date.toISOString(),
    }));

    signals = rawSignals.map((s) => ({
      id: s.id,
      signal: s.signal,
      confidence: s.confidence,
      title: s.title,
      reasoning: s.reasoning,
      scope: s.scope,
      category: s.category,
      timeHorizon: s.timeHorizon,
    }));

    dataPoints = rawDP.map((d) => ({
      id: d.id,
      type: d.type,
      title: d.title,
      url: d.url || undefined,
      summary: d.summary,
      sentiment: d.sentiment,
      signal: d.signal,
      tags: d.tags,
      publishedAt: d.publishedAt?.toISOString() || null,
      createdAt: d.createdAt.toISOString(),
    }));

    listings = rawListings.map((l) => ({
      id: l.id,
      mlsId: l.mlsId,
      address: l.address,
      city: l.city,
      state: l.state,
      zip: l.zip,
      listPrice: l.listPrice,
      beds: l.beds,
      baths: l.baths,
      sqft: l.sqft,
      daysOnMarket: l.daysOnMarket,
      photoUrl: l.photoUrls?.[0] || null,
      propertyType: l.propertyType,
      buyScore: l.enrichment?.buyScore ?? 0,
    }));

    if (rawDigest) {
      digest = {
        headline: rawDigest.headline,
        keyChanges: rawDigest.keyChanges,
        riskFactors: rawDigest.riskFactors,
        opportunities: rawDigest.opportunities,
        date: rawDigest.date.toISOString(),
      };
    }

    marketStats = {
      activeListings: listingCount,
      dataPoints: dpCount,
      activeSignals: signals.length,
      poiCount: poiCount,
      metroAreas: 12,
    };

    listingsByCity = {};
    for (const g of cityGroups) {
      if (g.city) {
        listingsByCity[g.city] = g._count.id;
        listingsByCity[g.city.toLowerCase()] = g._count.id;
      }
    }
  } catch (e) {
    console.error("[client] Failed to load data:", e);
  }

  return (
    <ClientPortal
      snapshot={latestSnapshot}
      snapshots={snapshotHistory}
      signals={signals}
      dataPoints={dataPoints}
      listings={listings}
      digest={digest}
      marketStats={marketStats}
      listingsByCity={listingsByCity}
    />
  );
}
