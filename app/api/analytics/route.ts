import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// POST — track a view or event (public, no auth)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, site, path, event, label, referrer, meta } = body;

    if (!site || !path) {
      return NextResponse.json({ error: "Missing site or path" }, { status: 400 });
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const userAgent = request.headers.get("user-agent") || null;

    if (type === "event" && event) {
      await prisma.siteEvent.create({
        data: {
          site,
          path,
          event,
          label: label || null,
          referrer: referrer || null,
          userAgent,
          ip,
          meta: meta || undefined,
        },
      });
    } else {
      await prisma.siteView.create({
        data: {
          site,
          path,
          referrer: referrer || null,
          userAgent,
          ip,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// GET — analytics data (auth required)
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30", 10);
  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);

  const [
    currentViews,
    currentEvents,
    prevViews,
    prevEvents,
    referrerBreakdown,
    pathBreakdown,
    recentViews,
    recentEvents,
  ] = await Promise.all([
    prisma.siteView.findMany({
      where: { createdAt: { gte: periodStart } },
      select: { site: true, path: true, referrer: true, ip: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.siteEvent.findMany({
      where: { createdAt: { gte: periodStart } },
      select: { site: true, path: true, event: true, label: true, referrer: true, ip: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.siteView.findMany({
      where: { createdAt: { gte: prevStart, lt: periodStart } },
      select: { site: true, ip: true },
    }),
    prisma.siteEvent.findMany({
      where: { createdAt: { gte: prevStart, lt: periodStart } },
      select: { site: true },
    }),
    prisma.siteView.groupBy({
      by: ["referrer"],
      _count: { id: true },
      where: { createdAt: { gte: periodStart } },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    }),
    prisma.siteView.groupBy({
      by: ["path", "site"],
      _count: { id: true },
      where: { createdAt: { gte: periodStart } },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    }),
    prisma.siteView.findMany({
      where: { createdAt: { gte: periodStart } },
      select: { site: true, path: true, referrer: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.siteEvent.findMany({
      where: { createdAt: { gte: periodStart } },
      select: { site: true, path: true, event: true, referrer: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  // Build daily aggregation
  const dailyMap: Record<string, Record<string, number>> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dailyMap[key] = {};
  }

  for (const v of currentViews) {
    const day = v.createdAt.toISOString().split("T")[0];
    if (dailyMap[day]) {
      dailyMap[day][v.site] = (dailyMap[day][v.site] || 0) + 1;
    }
  }

  const daily = Object.entries(dailyMap).map(([date, bySite]) => ({
    date,
    total: Object.values(bySite).reduce((a, b) => a + b, 0),
    bySite,
  }));

  // Per-site stats
  const siteMap: Record<string, { views: number; events: number; ips: Set<string>; referrers: Record<string, number>; dailyViews: Record<string, number> }> = {};

  for (const v of currentViews) {
    if (!siteMap[v.site]) siteMap[v.site] = { views: 0, events: 0, ips: new Set(), referrers: {}, dailyViews: {} };
    siteMap[v.site].views++;
    if (v.ip) siteMap[v.site].ips.add(v.ip);
    const ref = v.referrer || "direct";
    siteMap[v.site].referrers[ref] = (siteMap[v.site].referrers[ref] || 0) + 1;
    const day = v.createdAt.toISOString().split("T")[0];
    siteMap[v.site].dailyViews[day] = (siteMap[v.site].dailyViews[day] || 0) + 1;
  }

  for (const e of currentEvents) {
    if (!siteMap[e.site]) siteMap[e.site] = { views: 0, events: 0, ips: new Set(), referrers: {}, dailyViews: {} };
    siteMap[e.site].events++;
  }

  // Previous period per-site views for growth calc
  const prevSiteViews: Record<string, number> = {};
  for (const v of prevViews) {
    prevSiteViews[v.site] = (prevSiteViews[v.site] || 0) + 1;
  }

  // Build dates array for sparklines
  const dateKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dateKeys.push(d.toISOString().split("T")[0]);
  }

  // Unique visitors
  const allIps = new Set<string>();
  for (const v of currentViews) { if (v.ip) allIps.add(v.ip); }
  const prevIps = new Set<string>();
  for (const v of prevViews) { if (v.ip) prevIps.add(v.ip); }

  // Hourly heatmap
  const hourlyHeatmap: Record<string, number> = {};
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (const v of currentViews) {
    const d = v.createdAt;
    const key = `${dayNames[d.getDay()]}-${d.getHours()}`;
    hourlyHeatmap[key] = (hourlyHeatmap[key] || 0) + 1;
  }

  // Active sites
  const activeSites = new Set(currentViews.map((v) => v.site));

  // ─── Token & API usage (T-Agent) ───
  const [usageEvents, prevUsageEvents] = await Promise.all([
    prisma.usageEvent.findMany({
      where: { createdAt: { gte: periodStart } },
      select: {
        type: true, tokensApprox: true, promptTokens: true, completionTokens: true,
        latencyMs: true, provider: true, model: true, location: true,
        route: true, statusCode: true, errorMessage: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.usageEvent.findMany({
      where: { createdAt: { gte: prevStart, lt: periodStart } },
      select: { type: true, tokensApprox: true },
    }),
  ]);

  const totalApiCalls = usageEvents.length;
  const totalTokens = usageEvents.reduce((sum, e) => sum + (e.tokensApprox || 0), 0);
  const totalPromptTokens = usageEvents.reduce((sum, e) => sum + (e.promptTokens || 0), 0);
  const totalCompletionTokens = usageEvents.reduce((sum, e) => sum + (e.completionTokens || 0), 0);
  const avgLatency = usageEvents.length > 0
    ? Math.round(usageEvents.reduce((sum, e) => sum + (e.latencyMs || 0), 0) / usageEvents.length)
    : 0;
  const prevApiCalls = prevUsageEvents.length;
  const prevTokens = prevUsageEvents.reduce((sum, e) => sum + (e.tokensApprox || 0), 0);
  const errorCount = usageEvents.filter((e) => e.errorMessage || (e.statusCode && e.statusCode >= 400)).length;

  // API calls by type
  const apiByType: Record<string, number> = {};
  for (const e of usageEvents) {
    apiByType[e.type] = (apiByType[e.type] || 0) + 1;
  }

  // Breakdown by provider
  const byProvider: Record<string, { calls: number; tokens: number; avgLatency: number; errors: number }> = {};
  for (const e of usageEvents) {
    const p = e.provider || "unknown";
    if (!byProvider[p]) byProvider[p] = { calls: 0, tokens: 0, avgLatency: 0, errors: 0 };
    byProvider[p].calls++;
    byProvider[p].tokens += e.tokensApprox || 0;
    byProvider[p].avgLatency += e.latencyMs || 0;
    if (e.errorMessage || (e.statusCode && e.statusCode >= 400)) byProvider[p].errors++;
  }
  for (const p of Object.keys(byProvider)) {
    byProvider[p].avgLatency = byProvider[p].calls > 0 ? Math.round(byProvider[p].avgLatency / byProvider[p].calls) : 0;
  }

  // Breakdown by model
  const byModel: Record<string, { calls: number; tokens: number; avgLatency: number }> = {};
  for (const e of usageEvents) {
    const m = e.model || "unknown";
    if (!byModel[m]) byModel[m] = { calls: 0, tokens: 0, avgLatency: 0 };
    byModel[m].calls++;
    byModel[m].tokens += e.tokensApprox || 0;
    byModel[m].avgLatency += e.latencyMs || 0;
  }
  for (const m of Object.keys(byModel)) {
    byModel[m].avgLatency = byModel[m].calls > 0 ? Math.round(byModel[m].avgLatency / byModel[m].calls) : 0;
  }

  // Breakdown by location
  const byLocation: Record<string, { calls: number; tokens: number }> = {};
  for (const e of usageEvents) {
    const l = e.location || "unknown";
    if (!byLocation[l]) byLocation[l] = { calls: 0, tokens: 0 };
    byLocation[l].calls++;
    byLocation[l].tokens += e.tokensApprox || 0;
  }

  // Breakdown by route
  const byRoute: Record<string, number> = {};
  for (const e of usageEvents) {
    const r = e.route || "unknown";
    byRoute[r] = (byRoute[r] || 0) + 1;
  }

  // Daily token usage
  const dailyTokens: Record<string, number> = {};
  const dailyApiCalls: Record<string, number> = {};
  for (const e of usageEvents) {
    const day = e.createdAt.toISOString().split("T")[0];
    dailyTokens[day] = (dailyTokens[day] || 0) + (e.tokensApprox || 0);
    dailyApiCalls[day] = (dailyApiCalls[day] || 0) + 1;
  }

  // Recent LLM calls
  const recentLlmCalls = usageEvents.slice(0, 20).map((e) => ({
    type: e.type,
    provider: e.provider,
    model: e.model,
    location: e.location,
    route: e.route,
    tokens: e.tokensApprox,
    promptTokens: e.promptTokens,
    completionTokens: e.completionTokens,
    latencyMs: e.latencyMs,
    statusCode: e.statusCode,
    error: e.errorMessage,
    time: e.createdAt.toISOString(),
  }));

  const result = {
    period: days,
    overview: {
      totalViews: currentViews.length,
      totalEvents: currentEvents.length,
      uniqueVisitors: allIps.size,
      activeSites: activeSites.size,
      prevViews: prevViews.length,
      prevEvents: prevEvents.length,
      prevVisitors: prevIps.size,
    },
    daily,
    sites: Object.entries(siteMap)
      .map(([id, data]) => {
        const topRef = Object.entries(data.referrers).sort((a, b) => b[1] - a[1])[0];
        return {
          id,
          label: id,
          color: "",
          views: data.views,
          events: data.events,
          uniqueVisitors: data.ips.size,
          topReferrer: topRef ? topRef[0] : "none",
          prevViews: prevSiteViews[id] || 0,
          dailyViews: dateKeys.map((d) => data.dailyViews[d] || 0),
        };
      })
      .sort((a, b) => b.views - a.views),
    referrers: referrerBreakdown.map((r) => ({
      source: r.referrer || "direct",
      count: r._count.id,
    })),
    topPaths: pathBreakdown.map((p) => ({
      path: p.path,
      count: p._count.id,
      site: p.site,
    })),
    recentActivity: [
      ...recentViews.map((v) => ({
        site: v.site,
        path: v.path,
        referrer: v.referrer,
        time: v.createdAt.toISOString(),
        type: "view" as const,
      })),
      ...recentEvents.map((e) => ({
        site: e.site,
        path: e.path,
        referrer: e.referrer,
        time: e.createdAt.toISOString(),
        type: e.event,
      })),
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 40),
    hourlyHeatmap,
    usage: {
      totalApiCalls,
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      avgLatency,
      prevApiCalls,
      prevTokens,
      errorCount,
      apiByType: Object.entries(apiByType)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      byProvider: Object.entries(byProvider)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.calls - a.calls),
      byModel: Object.entries(byModel)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.calls - a.calls),
      byLocation: Object.entries(byLocation)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.calls - a.calls),
      byRoute: Object.entries(byRoute)
        .map(([route, count]) => ({ route, count }))
        .sort((a, b) => b.count - a.count),
      dailyTokens: dateKeys.map((d) => ({ date: d, tokens: dailyTokens[d] || 0, calls: dailyApiCalls[d] || 0 })),
      recentLlmCalls,
    },
  };

  return NextResponse.json(result);
}
