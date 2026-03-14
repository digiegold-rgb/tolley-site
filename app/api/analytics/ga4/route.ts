import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

const PROPERTY_ID = process.env.GA4_PROPERTY_ID; // numeric, e.g. "123456789"

function getClient(): BetaAnalyticsDataClient | null {
  const keyJson = process.env.GA4_SERVICE_ACCOUNT_KEY;
  if (!keyJson || !PROPERTY_ID) return null;
  try {
    const credentials = JSON.parse(keyJson);
    return new BetaAnalyticsDataClient({ credentials });
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = getClient();
  if (!client) {
    return NextResponse.json({ error: "GA4 not configured", configured: false }, { status: 200 });
  }

  const property = `properties/${PROPERTY_ID}`;

  try {
    // Run realtime and 30-day reporting in parallel
    const [realtimeRes, reportRes] = await Promise.all([
      // Realtime: active users by page, city, device
      client.runRealtimeReport({
        property,
        dimensions: [
          { name: "unifiedScreenName" },
        ],
        metrics: [
          { name: "activeUsers" },
        ],
      }),

      // 30-day report: sessions, users, bounce rate, cities, devices, browsers
      client.runReport({
        property,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [
          { name: "city" },
        ],
        metrics: [
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "bounceRate" },
          { name: "averageSessionDuration" },
        ],
        orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
        limit: 20,
      }),
    ]);

    // Also fetch device and browser breakdown
    const [deviceRes, browserRes, sourceRes, realtimeCityRes] = await Promise.all([
      client.runReport({
        property,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "browser" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
      client.runReport({
        property,
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "activeUsers" }, { name: "sessions" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: 10,
      }),
      client.runRealtimeReport({
        property,
        dimensions: [{ name: "city" }],
        metrics: [{ name: "activeUsers" }],
      }),
    ]);

    // Parse realtime
    const realtimePages = (realtimeRes[0]?.rows || []).map((row) => ({
      page: row.dimensionValues?.[0]?.value || "unknown",
      activeUsers: parseInt(row.metricValues?.[0]?.value || "0"),
    })).filter((r) => r.activeUsers > 0);

    const totalRealtimeUsers = realtimePages.reduce((sum, r) => sum + r.activeUsers, 0);

    const realtimeCities = (realtimeCityRes[0]?.rows || []).map((row) => ({
      city: row.dimensionValues?.[0]?.value || "unknown",
      activeUsers: parseInt(row.metricValues?.[0]?.value || "0"),
    })).filter((r) => r.activeUsers > 0 && r.city !== "(not set)");

    // Parse 30-day geo
    const cities = (reportRes[0]?.rows || []).map((row) => ({
      city: row.dimensionValues?.[0]?.value || "unknown",
      users: parseInt(row.metricValues?.[0]?.value || "0"),
      sessions: parseInt(row.metricValues?.[1]?.value || "0"),
      bounceRate: parseFloat(row.metricValues?.[2]?.value || "0"),
      avgSessionDuration: parseFloat(row.metricValues?.[3]?.value || "0"),
    })).filter((c) => c.city !== "(not set)");

    // Parse devices
    const devices = (deviceRes[0]?.rows || []).map((row) => ({
      device: row.dimensionValues?.[0]?.value || "unknown",
      users: parseInt(row.metricValues?.[0]?.value || "0"),
      sessions: parseInt(row.metricValues?.[1]?.value || "0"),
    }));

    // Parse browsers
    const browsers = (browserRes[0]?.rows || []).map((row) => ({
      browser: row.dimensionValues?.[0]?.value || "unknown",
      users: parseInt(row.metricValues?.[0]?.value || "0"),
      sessions: parseInt(row.metricValues?.[1]?.value || "0"),
    }));

    // Parse traffic sources
    const sources = (sourceRes[0]?.rows || []).map((row) => ({
      channel: row.dimensionValues?.[0]?.value || "unknown",
      users: parseInt(row.metricValues?.[0]?.value || "0"),
      sessions: parseInt(row.metricValues?.[1]?.value || "0"),
    }));

    // Aggregate totals from report
    const totalSessions = cities.reduce((sum, c) => sum + c.sessions, 0);
    const totalUsers = cities.reduce((sum, c) => sum + c.users, 0);
    const avgBounceRate = cities.length > 0
      ? cities.reduce((sum, c) => sum + c.bounceRate * c.sessions, 0) / Math.max(totalSessions, 1)
      : 0;
    const avgSessionDuration = cities.length > 0
      ? cities.reduce((sum, c) => sum + c.avgSessionDuration * c.sessions, 0) / Math.max(totalSessions, 1)
      : 0;

    return NextResponse.json({
      configured: true,
      realtime: {
        activeUsers: totalRealtimeUsers,
        pages: realtimePages.slice(0, 10),
        cities: realtimeCities.slice(0, 10),
      },
      report: {
        totalSessions,
        totalUsers,
        avgBounceRate: Math.round(avgBounceRate * 1000) / 10,
        avgSessionDuration: Math.round(avgSessionDuration),
        cities: cities.slice(0, 15),
        devices,
        browsers: browsers.slice(0, 8),
        sources,
      },
    });
  } catch (err) {
    console.error("GA4 API error:", err);
    return NextResponse.json(
      { error: "GA4 API error", message: String(err), configured: true },
      { status: 500 },
    );
  }
}
