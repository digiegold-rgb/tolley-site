import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { geolocation } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// ─── Hardening helpers ──────────────────────────────────────

const ALLOWED_ORIGINS = new Set([
  "https://tolley.io",
  "https://www.tolley.io",
  "https://cordport.io",
  "https://www.cordport.io",
]);

function isOriginAllowed(origin: string | null): boolean {
  // No Origin header: server-side fetch, curl without Origin, etc. Allow.
  // (The rate limiter and bot filter are the real defenses against abuse;
  // the origin check only blocks browsers from other sites.)
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    if (u.hostname.endsWith(".vercel.app")) return true; // preview deploys
  } catch {}
  return false;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && isOriginAllowed(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// Matches obvious bots, crawlers, and non-browser HTTP clients. Applied on
// the write path (don't store) and the read path (exclude historical rows).
const BOT_UA =
  /bot|crawl|spider|slurp|bingbot|googlebot|facebookexternalhit|meta-externalagent|twitterbot|linkedinbot|pinterest|whatsapp|telegram|discordbot|curl\/|wget\/|python-requests|java-http|go-http|okhttp|postman|insomnia|headlesschrome|phantomjs|axios/i;

function isBot(ua: string | null): boolean {
  if (!ua) return false;
  return BOT_UA.test(ua);
}

// Known cloud / datacenter cities. Hits geolocated here are almost always
// scrapers, headless probes, or proxy egress — they never trip BOT_UA
// because the UA strings are spoofed to look like real browsers. Excluded
// on the read path only; we still store them in case we want to audit.
const DATACENTER_CITIES = new Set<string>([
  // AWS
  "Ashburn", "Boardman", "Hilliard", "Manassas",
  // Google
  "Council Bluffs", "The Dalles", "Mayes", "Pryor",
  // Facebook / Meta
  "Prineville", "Forest City", "Luleå", "Lulea", "Altoona", "Henrico", "Eagle Mountain",
  // Microsoft / Azure
  "Clonee", "Quincy", "San Antonio", "Cheyenne",
  // Hetzner / OVH
  "Falkenstein", "Nuremberg", "Roubaix", "Strasbourg", "Gravelines",
  // DigitalOcean / Linode / Vultr
  "Secaucus", "Cedar Knolls", "Piscataway",
]);

function isDatacenterGeo(city: string | null, country: string | null): boolean {
  if (!city) return false;
  if (DATACENTER_CITIES.has(city)) return true;
  return false;
}

// Routes that are admin / dashboard / auth — these are "Cordless logged in
// using his own product," not marketing visits. Excluded from top-paths so
// the panel surfaces what matters for growth.
const ADMIN_PATH_RE =
  /^\/?(account|admin|dashboard|login|signup|sign-in|api\/|_next\/)|\/dashboard(\/|$)|\/admin(\/|$)/i;

function isAdminPath(path: string | null): boolean {
  if (!path) return false;
  return ADMIN_PATH_RE.test(path);
}

// Background-cron events that flood siteEvent but mean nothing to a human
// reading the dashboard. Filtered on read so buy_click / product_view /
// checkout_click aren't drowned in fb_insights_sync noise.
const SYSTEM_EVENT_RE = /(^|_)(sync|cron|heartbeat|health|debug)$/i;

function isSystemEvent(event: string | null): boolean {
  if (!event) return false;
  return SYSTEM_EVENT_RE.test(event);
}

// Hard cap: at most N views or events per IP per 60s. Backed by a single
// COUNT query — cheap on Neon pooled, caps runaway loops and curl spam.
const RATE_LIMIT_COUNT = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

async function isRateLimited(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const [viewCount, eventCount] = await Promise.all([
    prisma.siteView.count({ where: { ip, createdAt: { gte: since } } }),
    prisma.siteEvent.count({ where: { ip, createdAt: { gte: since } } }),
  ]);
  return viewCount + eventCount >= RATE_LIMIT_COUNT;
}

// Self-exclusion: comma-separated IPs in ANALYTICS_SKIP_IPS are filtered
// from the dashboard on the read path. Not blocked on write so the data
// is still there if we ever want to audit it. We also hash them to match
// against ipHash on new rows.
function getSkipIps(): Set<string> {
  return new Set(
    (process.env.ANALYTICS_SKIP_IPS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function getSkipHashes(skipIps: Set<string>): Set<string> {
  const salt = process.env.ANALYTICS_IP_SALT;
  if (!salt) return new Set();
  const hashes = new Set<string>();
  for (const ip of skipIps) hashes.add(hashIp(ip, salt));
  return hashes;
}

// IP hashing: HMAC-SHA256 with a stable secret salt from env. Stable per-IP
// (so dedup works), but the salt lives in env vars, so a DB leak alone
// doesn't reveal raw IPs. Old rows still have raw ip; new rows store only
// the hash (we null out raw ip on write once the backfill is complete).
function hashIp(ip: string, salt: string): string {
  return createHmac("sha256", salt).update(ip).digest("hex");
}

function maybeHashIp(ip: string | null): string | null {
  if (!ip) return null;
  const salt = process.env.ANALYTICS_IP_SALT;
  if (!salt) return null;
  return hashIp(ip, salt);
}

// ─── OPTIONS (CORS preflight) ───────────────────────────────

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!isOriginAllowed(origin)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

// ─── POST: track a view or event ────────────────────────────

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!isOriginAllowed(origin)) {
    return NextResponse.json({ error: "origin not allowed" }, { status: 403, headers: corsHeaders(origin) });
  }

  try {
    const body = await request.json();
    const { type, site, path, event, label, referrer, meta } = body;

    if (!site || !path) {
      return NextResponse.json(
        { error: "Missing site or path" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;
    const userAgent = request.headers.get("user-agent") || null;

    // Silently drop bots — respond 200 so they don't retry, but don't store.
    if (isBot(userAgent)) {
      return NextResponse.json({ ok: true, dropped: "bot" }, { headers: corsHeaders(origin) });
    }

    // Silently drop rate-limited — same reason.
    if (await isRateLimited(ip)) {
      return NextResponse.json({ ok: true, dropped: "rate" }, { headers: corsHeaders(origin) });
    }

    // Hash IP with stable secret salt. We store only the hash (not the raw
    // IP) so a DB leak alone can't be cross-referenced back to visitors.
    const ipHash = maybeHashIp(ip);

    // Geo from Vercel edge headers. In dev or if Vercel can't resolve it,
    // all fields will be undefined — that's fine, columns are nullable.
    const geo = geolocation(request);
    const country = geo.country || null;
    const region = geo.countryRegion || null;
    const city = geo.city ? decodeURIComponent(geo.city) : null;

    if (type === "event" && event) {
      await prisma.siteEvent.create({
        data: {
          site,
          path,
          event,
          label: label || null,
          referrer: referrer || null,
          userAgent,
          ip: null,
          ipHash,
          country,
          region,
          city,
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
          ip: null,
          ipHash,
          country,
          region,
          city,
        },
      });
    }

    return NextResponse.json({ ok: true }, { headers: corsHeaders(origin) });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500, headers: corsHeaders(origin) });
  }
}

// ─── GET: analytics data (auth required) ────────────────────

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

  const skipIps = getSkipIps();
  const skipHashes = getSkipHashes(skipIps);

  // Helper: get the dedup key for a row — prefer hash (new rows),
  // fall back to raw ip (historical rows). Same IP hashes to the same
  // value, so post-backfill both paths produce consistent counts.
  const dedupKey = (v: { ip: string | null; ipHash: string | null }) =>
    v.ipHash || v.ip || null;

  // Fetch both periods' views (with userAgent so we can bot-filter on read)
  // and events. We do NOT group in SQL — cleaner to filter in-memory and
  // aggregate once, so every derived number respects the bot/skip filter.
  const [rawCurrentViews, rawCurrentEvents, rawPrevViews, rawPrevEvents] =
    await Promise.all([
      prisma.siteView.findMany({
        where: { createdAt: { gte: periodStart } },
        select: {
          site: true,
          path: true,
          referrer: true,
          ip: true,
          ipHash: true,
          userAgent: true,
          country: true,
          region: true,
          city: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.siteEvent.findMany({
        where: { createdAt: { gte: periodStart } },
        select: {
          site: true,
          path: true,
          event: true,
          label: true,
          referrer: true,
          ip: true,
          ipHash: true,
          userAgent: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.siteView.findMany({
        where: { createdAt: { gte: prevStart, lt: periodStart } },
        select: { site: true, ip: true, ipHash: true, userAgent: true },
      }),
      prisma.siteEvent.findMany({
        where: { createdAt: { gte: prevStart, lt: periodStart } },
        select: { site: true, ip: true, ipHash: true, userAgent: true },
      }),
    ]);

  const keepRow = (v: {
    ip: string | null;
    ipHash: string | null;
    userAgent: string | null;
    city?: string | null;
    country?: string | null;
  }) => {
    if (v.ip && skipIps.has(v.ip)) return false;
    if (v.ipHash && skipHashes.has(v.ipHash)) return false;
    if (v.userAgent && BOT_UA.test(v.userAgent)) return false;
    if (isDatacenterGeo(v.city ?? null, v.country ?? null)) return false;
    return true;
  };

  // Events table doesn't carry city/country (only views do), so the
  // datacenter filter is a no-op there — that's fine, the system-event
  // filter below catches what we care about.
  const keepEvent = (e: {
    ip: string | null;
    ipHash: string | null;
    userAgent: string | null;
    event?: string;
  }) => {
    if (!keepRow(e)) return false;
    if (e.event && isSystemEvent(e.event)) return false;
    return true;
  };

  const currentViews = rawCurrentViews.filter(keepRow);
  const currentEvents = rawCurrentEvents.filter(keepEvent);
  const prevViews = rawPrevViews.filter(keepRow);
  const prevEvents = rawPrevEvents.filter(keepEvent);

  // Build daily aggregation
  const dailyMap: Record<string, Record<string, number>> = {};
  const dailyIpSets: Record<string, Set<string>> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    dailyMap[key] = {};
    dailyIpSets[key] = new Set();
  }

  for (const v of currentViews) {
    const day = v.createdAt.toISOString().split("T")[0];
    if (dailyMap[day]) {
      dailyMap[day][v.site] = (dailyMap[day][v.site] || 0) + 1;
      const key = dedupKey(v);
      if (key) dailyIpSets[day].add(key);
    }
  }

  const daily = Object.entries(dailyMap).map(([date, bySite]) => ({
    date,
    total: Object.values(bySite).reduce((a, b) => a + b, 0),
    uniqueIps: dailyIpSets[date]?.size || 0,
    bySite,
  }));

  // Per-site stats
  const siteMap: Record<
    string,
    {
      views: number;
      events: number;
      ips: Set<string>;
      referrers: Record<string, number>;
      dailyViews: Record<string, number>;
    }
  > = {};

  for (const v of currentViews) {
    if (!siteMap[v.site])
      siteMap[v.site] = { views: 0, events: 0, ips: new Set(), referrers: {}, dailyViews: {} };
    siteMap[v.site].views++;
    const siteKey = dedupKey(v);
    if (siteKey) siteMap[v.site].ips.add(siteKey);
    const ref = v.referrer || "direct";
    siteMap[v.site].referrers[ref] = (siteMap[v.site].referrers[ref] || 0) + 1;
    const day = v.createdAt.toISOString().split("T")[0];
    siteMap[v.site].dailyViews[day] = (siteMap[v.site].dailyViews[day] || 0) + 1;
  }

  for (const e of currentEvents) {
    if (!siteMap[e.site])
      siteMap[e.site] = { views: 0, events: 0, ips: new Set(), referrers: {}, dailyViews: {} };
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

  // Distinct IPs (30d) — the "unique visitors" number. This is just
  // deduped IPs (or their hashes), not real human counts. Labeled
  // accordingly on the UI.
  const allIps = new Set<string>();
  for (const v of currentViews) {
    const key = dedupKey(v);
    if (key) allIps.add(key);
  }
  const prevIps = new Set<string>();
  for (const v of prevViews) {
    const key = dedupKey(v);
    if (key) prevIps.add(key);
  }

  // Geo breakdown — only present on rows since the geo migration, so
  // the counts here are "last 30d where geo was captured."
  const countryCounts: Record<string, number> = {};
  const cityCounts: Record<string, number> = {};
  let geoResolvedCount = 0;
  for (const v of currentViews) {
    if (v.country) {
      countryCounts[v.country] = (countryCounts[v.country] || 0) + 1;
      geoResolvedCount++;
    }
    if (v.city && v.region) {
      const key = `${v.city}, ${v.region}`;
      cityCounts[key] = (cityCounts[key] || 0) + 1;
    }
  }
  const topCountries = Object.entries(countryCounts)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
  const topCities = Object.entries(cityCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Referrer breakdown (in-memory, filtered)
  const referrerCounts: Record<string, number> = {};
  for (const v of currentViews) {
    const ref = v.referrer || "direct";
    referrerCounts[ref] = (referrerCounts[ref] || 0) + 1;
  }
  const referrers = Object.entries(referrerCounts)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Top paths (in-memory, filtered) — admin/dashboard/login routes are
  // excluded so the panel surfaces marketing pages, not "Cordless logged
  // into his own product." Use a wider slice so 20 real marketing rows
  // survive even when there are lots of admin hits.
  const pathCounts: Record<string, { path: string; site: string; count: number }> = {};
  for (const v of currentViews) {
    if (isAdminPath(v.path)) continue;
    const key = `${v.site}::${v.path}`;
    if (!pathCounts[key]) pathCounts[key] = { path: v.path, site: v.site, count: 0 };
    pathCounts[key].count++;
  }
  const topPaths = Object.values(pathCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

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
        type: true,
        tokensApprox: true,
        promptTokens: true,
        completionTokens: true,
        latencyMs: true,
        provider: true,
        model: true,
        location: true,
        route: true,
        statusCode: true,
        errorMessage: true,
        createdAt: true,
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
  const avgLatency =
    usageEvents.length > 0
      ? Math.round(usageEvents.reduce((sum, e) => sum + (e.latencyMs || 0), 0) / usageEvents.length)
      : 0;
  const prevApiCalls = prevUsageEvents.length;
  const prevTokens = prevUsageEvents.reduce((sum, e) => sum + (e.tokensApprox || 0), 0);
  const errorCount = usageEvents.filter(
    (e) => e.errorMessage || (e.statusCode && e.statusCode >= 400),
  ).length;

  const apiByType: Record<string, number> = {};
  for (const e of usageEvents) {
    apiByType[e.type] = (apiByType[e.type] || 0) + 1;
  }

  const byProvider: Record<
    string,
    { calls: number; tokens: number; avgLatency: number; errors: number }
  > = {};
  for (const e of usageEvents) {
    const p = e.provider || "unknown";
    if (!byProvider[p]) byProvider[p] = { calls: 0, tokens: 0, avgLatency: 0, errors: 0 };
    byProvider[p].calls++;
    byProvider[p].tokens += e.tokensApprox || 0;
    byProvider[p].avgLatency += e.latencyMs || 0;
    if (e.errorMessage || (e.statusCode && e.statusCode >= 400)) byProvider[p].errors++;
  }
  for (const p of Object.keys(byProvider)) {
    byProvider[p].avgLatency =
      byProvider[p].calls > 0 ? Math.round(byProvider[p].avgLatency / byProvider[p].calls) : 0;
  }

  const byModel: Record<string, { calls: number; tokens: number; avgLatency: number }> = {};
  for (const e of usageEvents) {
    const m = e.model || "unknown";
    if (!byModel[m]) byModel[m] = { calls: 0, tokens: 0, avgLatency: 0 };
    byModel[m].calls++;
    byModel[m].tokens += e.tokensApprox || 0;
    byModel[m].avgLatency += e.latencyMs || 0;
  }
  for (const m of Object.keys(byModel)) {
    byModel[m].avgLatency =
      byModel[m].calls > 0 ? Math.round(byModel[m].avgLatency / byModel[m].calls) : 0;
  }

  const byLocation: Record<string, { calls: number; tokens: number }> = {};
  for (const e of usageEvents) {
    const l = e.location || "unknown";
    if (!byLocation[l]) byLocation[l] = { calls: 0, tokens: 0 };
    byLocation[l].calls++;
    byLocation[l].tokens += e.tokensApprox || 0;
  }

  const byRoute: Record<string, number> = {};
  for (const e of usageEvents) {
    const r = e.route || "unknown";
    byRoute[r] = (byRoute[r] || 0) + 1;
  }

  const dailyTokens: Record<string, number> = {};
  const dailyApiCalls: Record<string, number> = {};
  for (const e of usageEvents) {
    const day = e.createdAt.toISOString().split("T")[0];
    dailyTokens[day] = (dailyTokens[day] || 0) + (e.tokensApprox || 0);
    dailyApiCalls[day] = (dailyApiCalls[day] || 0) + 1;
  }

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
      // Visibility into what the hardening dropped. `bots` is the combined
      // drop count for everything keepRow rejects on views (bot UA + skip
      // IP + datacenter geo), broken out so the dashboard can show why
      // the number went down after we wired better filters.
      filteredOut: {
        bots: rawCurrentViews.length - currentViews.length,
        datacenter: rawCurrentViews.filter((v) =>
          isDatacenterGeo(v.city, v.country),
        ).length,
        systemEvents: rawCurrentEvents.filter((e) =>
          isSystemEvent(e.event),
        ).length,
        skippedIps: Array.from(skipIps),
      },
      geoResolved: geoResolvedCount,
    },
    geo: {
      topCountries,
      topCities,
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
    referrers,
    topPaths,
    recentActivity: [
      ...currentViews.slice(0, 30).map((v) => ({
        site: v.site,
        path: v.path,
        referrer: v.referrer,
        time: v.createdAt.toISOString(),
        type: "view" as const,
      })),
      ...currentEvents.slice(0, 30).map((e) => ({
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
      dailyTokens: dateKeys.map((d) => ({
        date: d,
        tokens: dailyTokens[d] || 0,
        calls: dailyApiCalls[d] || 0,
      })),
      recentLlmCalls,
    },
  };

  return NextResponse.json(result);
}
