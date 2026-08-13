import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { fetchSearchConsoleSummary } from "@/lib/search-console";
import {
  dedupKey,
  getSkipHashes,
  getSkipIps,
  keepVisitRow,
} from "@/lib/visit-filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Site Visits tab: first-party visit data across all of tolley.io — daily
// bars, unique external visitors, per-URL counts, sources, geography — plus
// the Google Search Console numbers (the "15 clicks" Google celebrated).
//
// Same read-path exclusions as /api/analytics (lib/visit-filters): bots,
// datacenter geo, ANALYTICS_SKIP_IPS. On top of that this endpoint drops
// admin/tool paths (/hq, /login, /admin, /account, /api) — Jared checking
// his own dashboards is not a site visit.

const INTERNAL_PATH_RE =
  /^\/(hq|login|admin|account|signup|api|_next)(\/|$)|\/(admin|dashboard)(\/|$)/i;

// Day key in Central time so "today" matches how Jared reads the dashboard.
function dayKeyCT(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export async function GET(req: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const days = Math.min(
    Math.max(parseInt(req.nextUrl.searchParams.get("days") ?? "28", 10) || 28, 1),
    90,
  );

  const now = Date.now();
  const periodStart = new Date(now - days * 86400_000);
  const prevStart = new Date(now - 2 * days * 86400_000);

  const skipIps = getSkipIps();
  const skipHashes = getSkipHashes(skipIps);

  const select = {
    path: true,
    referrer: true,
    ip: true,
    ipHash: true,
    userAgent: true,
    country: true,
    city: true,
    createdAt: true,
  } as const;

  const [rawCurrent, rawPrev, gsc] = await Promise.all([
    prisma.siteView.findMany({
      where: { createdAt: { gte: periodStart } },
      select,
    }),
    prisma.siteView.findMany({
      where: { createdAt: { gte: prevStart, lt: periodStart } },
      select: { path: true, ip: true, ipHash: true, userAgent: true, city: true },
    }),
    fetchSearchConsoleSummary(days).catch(() => null),
  ]);

  const keep = (v: {
    path: string;
    ip: string | null;
    ipHash: string | null;
    userAgent: string | null;
    city?: string | null;
  }) =>
    keepVisitRow(v, skipIps, skipHashes) && !INTERNAL_PATH_RE.test(v.path);

  const current = rawCurrent.filter(keep);
  const prev = rawPrev.filter(keep);

  // ── Totals ──
  const uniq = (rows: { ip: string | null; ipHash: string | null }[]) => {
    const s = new Set<string>();
    for (const r of rows) {
      const k = dedupKey(r);
      if (k) s.add(k);
    }
    return s.size;
  };

  // ── Daily series (zero-filled, oldest → newest, Central time) ──
  const dayViews = new Map<string, { views: number; visitors: Set<string> }>();
  for (let i = days - 1; i >= 0; i--) {
    dayViews.set(dayKeyCT(new Date(now - i * 86400_000)), { views: 0, visitors: new Set() });
  }
  for (const v of current) {
    const bucket = dayViews.get(dayKeyCT(v.createdAt));
    if (!bucket) continue;
    bucket.views++;
    const k = dedupKey(v);
    if (k) bucket.visitors.add(k);
  }
  const daily = [...dayViews.entries()].map(([date, b]) => ({
    date,
    views: b.views,
    visitors: b.visitors.size,
  }));

  // ── Per-URL ──
  const pathAgg = new Map<string, { views: number; visitors: Set<string> }>();
  for (const v of current) {
    const b = pathAgg.get(v.path) ?? { views: 0, visitors: new Set<string>() };
    b.views++;
    const k = dedupKey(v);
    if (k) b.visitors.add(k);
    pathAgg.set(v.path, b);
  }
  const topPaths = [...pathAgg.entries()]
    .map(([path, b]) => ({ path, views: b.views, visitors: b.visitors.size }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 25);

  // ── Sources ──
  const refAgg = new Map<string, number>();
  for (const v of current) {
    const r = (v.referrer || "direct").toLowerCase();
    refAgg.set(r, (refAgg.get(r) ?? 0) + 1);
  }
  const sources = [...refAgg.entries()]
    .map(([source, views]) => ({ source, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 12);

  // ── Geography ──
  const geoAgg = new Map<string, number>();
  for (const v of current) {
    if (!v.country) continue;
    geoAgg.set(v.country, (geoAgg.get(v.country) ?? 0) + 1);
  }
  const countries = [...geoAgg.entries()]
    .map(([country, views]) => ({ country, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  return NextResponse.json({
    days,
    totals: {
      views: current.length,
      visitors: uniq(current),
      prevViews: prev.length,
      prevVisitors: uniq(prev),
    },
    daily,
    topPaths,
    sources,
    countries,
    gsc:
      gsc && gsc.configured
        ? {
            clicks: gsc.totals.clicks,
            impressions: gsc.totals.impressions,
            ctr: gsc.totals.ctr,
            position: gsc.totals.position,
            topQueries: gsc.topQueries.slice(0, 10),
            topPages: gsc.topPages.slice(0, 10),
          }
        : null,
  });
}
