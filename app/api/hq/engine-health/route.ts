import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

// GET /api/hq/engine-health — read-only health of the lead engine that feeds
// the Monday digest. This is the SINGLE signal that answers "is the product
// actually delivering fresh leads, or is it silently dry?"
//
// It is deliberately downstream-only: it measures the DATA the customer gets,
// not just whether a process is up. If the research-worker dies, listings go
// stale and this turns red on its own — no separate heartbeat plumbing needed.
//
// Status logic (most-pessimistic wins):
//   red    = no fresh listings in 48h  OR  0 leads qualifying for this week's digest
//   yellow = listings 24-48h old, or dossier scoring >10 days stale
//   green  = listings <24h old AND dossier scoring fresh AND digest has leads
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600_000);
  const daysAgo = (d: number) => new Date(now - d * 86_400_000);

  try {
    const [
      newestListing,
      listings7d,
      newestDossier,
      qualifyingThisWeek,
      activeSubs,
    ] = await Promise.all([
      // Freshness = real MLS inventory only. Synthetic listings (signal bridge,
      // parcel scan, snap, manual) carry lastSynced=now() and would mask a dead
      // MLS feed, so exclude them from both freshness gauges.
      prisma.listing.findFirst({
        where: { source: { notIn: ["signal", "scan", "snap", "manual"] } },
        orderBy: { lastSynced: "desc" },
        select: { lastSynced: true },
      }),
      prisma.listing.count({
        where: {
          lastSynced: { gte: daysAgo(7) },
          source: { notIn: ["signal", "scan", "snap", "manual"] },
        },
      }),
      prisma.dossierResult.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
      // Mirror the Monday cron's source: scored dossier jobs from the last 7
      // days. Writers emit complete|partial|failed ("done" is legacy); require
      // a non-null result so a "partial" only counts once it has a scored lead.
      prisma.dossierJob.count({
        where: {
          status: { in: ["complete", "done", "partial"] },
          createdAt: { gte: daysAgo(7) },
          result: { isNot: null },
        },
      }),
      prisma.digestSubscriber.count({ where: { status: { in: ["active", "trial"] } } }),
    ]);

    const listingAgeH = newestListing
      ? Math.round((now - newestListing.lastSynced.getTime()) / 3600_000)
      : null;
    const dossierAgeD = newestDossier
      ? Math.round((now - newestDossier.createdAt.getTime()) / 86_400_000)
      : null;

    let status: "green" | "yellow" | "red" = "green";
    const reasons: string[] = [];

    if (listingAgeH === null || listingAgeH > 48) {
      status = "red";
      reasons.push(listingAgeH === null ? "no listings ever synced" : `listings ${listingAgeH}h stale`);
    } else if (listingAgeH > 24) {
      status = "yellow";
      reasons.push(`listings ${listingAgeH}h old`);
    }

    if (qualifyingThisWeek === 0) {
      status = "red";
      reasons.push("0 leads qualify for this week's digest");
    }

    if (dossierAgeD !== null && dossierAgeD > 10 && status !== "red") {
      status = "yellow";
      reasons.push(`seller scoring ${dossierAgeD}d stale`);
    }

    if (reasons.length === 0) reasons.push("fresh");

    return NextResponse.json({
      status,
      reasons,
      metrics: {
        listingAgeHours: listingAgeH,
        listings7d,
        dossierAgeDays: dossierAgeD,
        qualifyingThisWeek,
        activeSubscribers: activeSubs,
      },
      checkedAt: new Date(now).toISOString(),
    });
  } catch (err) {
    // Surface the failure — a health check that silently 500s is worse than none.
    return NextResponse.json(
      { status: "red", reasons: ["health query failed"], error: String(err) },
      { status: 500 },
    );
  }
}
