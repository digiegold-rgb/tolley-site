import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { AlertChip, AlertsResponse } from "@/components/analytics/shared/types";

export const dynamic = "force-dynamic";

const SERPAPI_DAILY_CAP = 33; // Starter $25/mo: 1000/mo ≈ 33/day

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alerts: AlertChip[] = [];
  const now = new Date();
  const day = 86_400_000;
  const sevenDaysOut = new Date(now.getTime() + 7 * day);
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // FB / social token <7 days
  try {
    const expiring = await prisma.platformConnection.findMany({
      where: {
        status: "active",
        tokenExpiresAt: { lte: sevenDaysOut, gt: now },
      },
      select: { platform: true, pageName: true, platformUsername: true, tokenExpiresAt: true },
      take: 10,
    });
    for (const c of expiring) {
      const days = Math.max(0, Math.round(((c.tokenExpiresAt?.getTime() ?? 0) - now.getTime()) / day));
      alerts.push({
        id: `tok-${c.platform}-${c.pageName ?? c.platformUsername ?? "?"}`,
        severity: days <= 2 ? "red" : "amber",
        title: `${c.platform} token expiring`,
        detail: `${c.pageName ?? c.platformUsername ?? "account"} · ${days}d left`,
        category: "auth",
      });
    }
    const expired = await prisma.platformConnection.count({
      where: { status: "active", tokenExpiresAt: { lt: now } },
    });
    if (expired > 0) {
      alerts.push({
        id: "tok-expired",
        severity: "red",
        title: `${expired} platform token${expired === 1 ? "" : "s"} expired`,
        detail: "Re-auth required",
        category: "auth",
      });
    }
  } catch { /* ignore — model may be empty in dev */ }

  // SerpAPI quota burn today
  try {
    const today = await prisma.serpapiQuery.count({
      where: { createdAt: { gte: startOfToday } },
    });
    if (today >= SERPAPI_DAILY_CAP) {
      alerts.push({
        id: "serpapi-over",
        severity: "red",
        title: "SerpAPI daily cap exceeded",
        detail: `${today} / ${SERPAPI_DAILY_CAP} today`,
        category: "quota",
      });
    } else if (today >= Math.floor(SERPAPI_DAILY_CAP * 0.8)) {
      alerts.push({
        id: "serpapi-warn",
        severity: "amber",
        title: "SerpAPI quota >80%",
        detail: `${today} / ${SERPAPI_DAILY_CAP} today`,
        category: "quota",
      });
    }
  } catch { /* ignore */ }

  // Stripe past-due subs (across User-attached Subscription model)
  try {
    const pastDue = await prisma.subscription.count({ where: { status: "past_due" } });
    if (pastDue > 0) {
      alerts.push({
        id: "subs-past-due",
        severity: "amber",
        title: `${pastDue} subscription${pastDue === 1 ? "" : "s"} past due`,
        category: "billing",
      });
    }
  } catch { /* ignore */ }

  // Food trials ending in 24h, no Stripe subscription attached yet
  try {
    const tomorrow = new Date(now.getTime() + day);
    const foodTrialEnding = await prisma.foodHousehold.count({
      where: {
        subscriptionStatus: "trialing",
        trialEndsAt: { gte: now, lte: tomorrow },
      },
    });
    if (foodTrialEnding > 0) {
      alerts.push({
        id: "food-trials-ending",
        severity: "amber",
        title: `${foodTrialEnding} Food trial${foodTrialEnding === 1 ? "" : "s"} ending soon`,
        detail: "Add payment method or convert",
        category: "billing",
      });
    }
  } catch { /* ignore */ }

  // Dossier queue depth
  try {
    const queued = await prisma.dossierJob.count({ where: { status: "queued" } });
    const stale = await prisma.dossierJob.count({
      where: {
        status: { in: ["queued", "running"] },
        createdAt: { lt: new Date(now.getTime() - 30 * 60_000) },
      },
    });
    if (stale > 0) {
      alerts.push({
        id: "dossier-stale",
        severity: "amber",
        title: `${stale} dossier job${stale === 1 ? "" : "s"} stale (>30m)`,
        category: "queue",
      });
    } else if (queued > 10) {
      alerts.push({
        id: "dossier-deep",
        severity: "amber",
        title: `Dossier queue depth ${queued}`,
        category: "queue",
      });
    }
  } catch { /* ignore */ }

  // MLS sync staleness (>6h)
  try {
    const last = await prisma.syncLog.findFirst({
      where: { source: { contains: "mls" } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, error: true },
    });
    if (last) {
      const ageH = (now.getTime() - last.createdAt.getTime()) / 3_600_000;
      if (ageH > 12) {
        alerts.push({
          id: "mls-stale",
          severity: "red",
          title: "MLS sync stale",
          detail: `${Math.round(ageH)}h since last run`,
          category: "sync",
        });
      } else if (ageH > 6) {
        alerts.push({
          id: "mls-stale-warn",
          severity: "amber",
          title: "MLS sync slowing",
          detail: `${Math.round(ageH)}h since last run`,
          category: "sync",
        });
      }
      if (last.error) {
        alerts.push({
          id: "mls-error",
          severity: "amber",
          title: "Last MLS sync errored",
          detail: last.error.slice(0, 60),
          category: "sync",
        });
      }
    }
  } catch { /* ignore */ }

  // Failed social share jobs in last 24h
  try {
    const failed = await prisma.socialShareJob.count({
      where: {
        status: "failed",
        queuedAt: { gte: new Date(now.getTime() - day) },
      },
    });
    if (failed > 0) {
      alerts.push({
        id: "social-failed",
        severity: "amber",
        title: `${failed} social post${failed === 1 ? "" : "s"} failed (24h)`,
        category: "queue",
      });
    }
  } catch { /* ignore */ }

  const body: AlertsResponse = {
    generatedAt: now.toISOString(),
    alerts: alerts.sort((a, b) => (a.severity === "red" ? -1 : 1) - (b.severity === "red" ? -1 : 1)),
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
  });
}
