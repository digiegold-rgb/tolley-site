import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CRONS } from "@/lib/cron-config";
import type { CronRow, IntegrationRow, SystemsResponse } from "@/components/analytics/shared/types";

export const dynamic = "force-dynamic";

const SERPAPI_DAILY_CAP = 33;
const SERPAPI_MONTHLY_CAP = 1000;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const errors: string[] = [];
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // ─── Cron heartbeats ───
  const cronResults = await Promise.allSettled(
    CRONS.map(async (c): Promise<CronRow> => {
      let lastRun: Date | null = null;
      if (c.heartbeat) {
        try {
          lastRun = await c.heartbeat();
        } catch (e) {
          errors.push(`heartbeat ${c.path}: ${e}`);
        }
      }
      const ageMin = lastRun ? (now.getTime() - lastRun.getTime()) / 60_000 : null;
      const expectedRuns24h = Math.max(1, Math.floor(1440 / c.cadenceMin));
      const healthy =
        c.heartbeat == null
          ? true // no heartbeat configured → assume green (we trust Vercel cron)
          : ageMin !== null && ageMin <= c.cadenceMin * 1.5;
      return {
        path: c.path,
        schedule: c.schedule,
        lastRun: lastRun?.toISOString() ?? null,
        expectedRuns24h,
        actualRuns24h: healthy ? expectedRuns24h : 0,
        ageMinutes: ageMin,
        healthy,
      };
    }),
  );
  const crons: CronRow[] = cronResults
    .filter((r): r is PromiseFulfilledResult<CronRow> => r.status === "fulfilled")
    .map((r) => r.value);

  // ─── Queues ───
  const [
    dossierPending,
    dossierRunning,
    dossierStale,
    dossierFinishedRecent,
    socialQueued,
    socialFailed7d,
    smsActive,
    reviewQueued,
  ] = await Promise.all([
    prisma.dossierJob.count({ where: { status: "queued" } }).catch(() => 0),
    prisma.dossierJob.count({ where: { status: "running" } }).catch(() => 0),
    prisma.dossierJob
      .count({
        where: {
          status: { in: ["queued", "running"] },
          createdAt: { lt: new Date(now.getTime() - 30 * 60_000) },
        },
      })
      .catch(() => 0),
    prisma.dossierJob
      .findMany({
        where: { status: "complete", completedAt: { gte: dayAgo, not: null }, startedAt: { not: null } },
        select: { startedAt: true, completedAt: true },
        take: 200,
      })
      .catch(() => [] as { startedAt: Date | null; completedAt: Date | null }[]),
    prisma.socialShareJob.count({ where: { status: "queued" } }).catch(() => 0),
    prisma.socialShareJob
      .count({ where: { status: "failed", queuedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } } })
      .catch(() => 0),
    prisma.smsEnrollment.count({ where: { status: "active" } }).catch(() => 0),
    prisma.reviewRequest.count({ where: { status: "queued" } }).catch(() => 0),
  ]);

  // Median dossier latency (ms)
  let medianLatencyMs: number | null = null;
  if (dossierFinishedRecent.length > 0) {
    const lats = dossierFinishedRecent
      .filter((j) => j.startedAt && j.completedAt)
      .map((j) => j.completedAt!.getTime() - j.startedAt!.getTime())
      .sort((a, b) => a - b);
    if (lats.length > 0) medianLatencyMs = lats[Math.floor(lats.length / 2)];
  }

  // ─── SerpAPI burn ───
  const [serpToday, serpMonth, serpRows] = await Promise.all([
    prisma.serpapiQuery.count({ where: { createdAt: { gte: startOfToday } } }).catch(() => 0),
    prisma.serpapiQuery.count({ where: { createdAt: { gte: startOfMonth } } }).catch(() => 0),
    prisma.serpapiQuery
      .findMany({
        where: { createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
        select: { createdAt: true },
      })
      .catch(() => [] as { createdAt: Date }[]),
  ]);
  const last7Days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const ds = new Date(startOfToday.getTime() - i * 86_400_000);
    const de = new Date(ds.getTime() + 86_400_000);
    last7Days.push({
      date: ds.toISOString().slice(0, 10),
      count: serpRows.filter((r) => r.createdAt >= ds && r.createdAt < de).length,
    });
  }

  // ─── Integration health ───
  const [activeFbTokens, expiringFbTokens, expiredTokens, mlsLast, plaidConn] = await Promise.all([
    prisma.platformConnection.count({ where: { platform: { in: ["facebook", "instagram"] }, status: "active" } }).catch(() => 0),
    prisma.platformConnection
      .count({
        where: {
          platform: { in: ["facebook", "instagram"] },
          status: "active",
          tokenExpiresAt: { lt: new Date(now.getTime() + 7 * 86_400_000), gt: now },
        },
      })
      .catch(() => 0),
    prisma.platformConnection.count({ where: { tokenExpiresAt: { lt: now } } }).catch(() => 0),
    prisma.syncLog.findFirst({ where: { source: { contains: "mls" } }, orderBy: { createdAt: "desc" }, select: { createdAt: true, error: true } }).catch(() => null),
    prisma.platformConnection.count({ where: { platform: "plaid", status: "active" } }).catch(() => 0),
  ]);

  const integrations: IntegrationRow[] = [
    {
      name: "Facebook / Instagram",
      status: expiredTokens > 0 ? "fail" : expiringFbTokens > 0 ? "warn" : activeFbTokens > 0 ? "ok" : "unknown",
      detail:
        activeFbTokens === 0
          ? "no connections"
          : `${activeFbTokens} active${expiringFbTokens > 0 ? `, ${expiringFbTokens} expiring <7d` : ""}${expiredTokens > 0 ? `, ${expiredTokens} expired` : ""}`,
      lastChecked: now.toISOString(),
    },
    {
      name: "MLS Grid",
      status: !mlsLast
        ? "unknown"
        : mlsLast.error
        ? "warn"
        : (now.getTime() - mlsLast.createdAt.getTime()) / 3_600_000 > 12
        ? "fail"
        : "ok",
      detail: mlsLast
        ? `last ${Math.round((now.getTime() - mlsLast.createdAt.getTime()) / 60_000)}m ago${mlsLast.error ? ` · err: ${mlsLast.error.slice(0, 30)}` : ""}`
        : "no sync log yet",
      lastChecked: mlsLast?.createdAt.toISOString() ?? null,
    },
    {
      name: "Plaid",
      status: plaidConn > 0 ? "ok" : "unknown",
      detail: plaidConn > 0 ? `${plaidConn} active connection${plaidConn === 1 ? "" : "s"}` : "no connections",
      lastChecked: now.toISOString(),
    },
    {
      name: "SerpAPI",
      status: serpToday >= SERPAPI_DAILY_CAP ? "fail" : serpToday >= SERPAPI_DAILY_CAP * 0.8 ? "warn" : "ok",
      detail: `${serpToday}/${SERPAPI_DAILY_CAP} today · ${serpMonth}/${SERPAPI_MONTHLY_CAP} this month`,
      lastChecked: now.toISOString(),
    },
    {
      name: "GA4",
      status: process.env.GA4_PROPERTY_ID && process.env.GA4_SERVICE_ACCOUNT_KEY ? "ok" : "warn",
      detail: process.env.GA4_PROPERTY_ID ? "service-account configured" : "missing GA4_PROPERTY_ID",
      lastChecked: now.toISOString(),
    },
    {
      name: "Search Console",
      status: process.env.GA4_SERVICE_ACCOUNT_KEY ? "ok" : "warn",
      detail: process.env.GA4_SERVICE_ACCOUNT_KEY ? "shares GA4 service account" : "needs service-account JSON",
      lastChecked: now.toISOString(),
    },
  ];

  const body: SystemsResponse = {
    generatedAt: now.toISOString(),
    crons,
    integrations,
    queues: {
      dossierJobsPending: dossierPending,
      dossierJobsRunning: dossierRunning,
      dossierJobsStale: dossierStale,
      dossierMedianLatencyMs: medianLatencyMs,
      socialJobsQueued: socialQueued,
      socialJobsFailed7d: socialFailed7d,
      smsEnrollmentsActive: smsActive,
      reviewRequestsQueued: reviewQueued,
    },
    serpapi: {
      today: serpToday,
      monthlyCap: SERPAPI_MONTHLY_CAP,
      monthlyUsed: serpMonth,
      last7Days,
    },
    errors,
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
