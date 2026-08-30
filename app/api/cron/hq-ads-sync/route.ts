import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { secretEquals } from "@/lib/secret-compare";
import { isMissingSchemaError } from "@/lib/vater/schema-probe";
import { collectAdsSnapshot } from "@/lib/hq-ads-collect";
import type { AdsSnapshot } from "@/lib/hq-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/hq-ads-sync — refresh the /hq Posts-tab ads card.
 *
 * Schedule: 4×/day via vercel.json. Read-only Zernio GET. Same CRON_SECRET
 * (or existing SYNC_SECRET) as the rest of HQ — no extra ops surface.
 */
function authorized(req: NextRequest): boolean {
  return (
    secretEquals(req.headers.get("authorization"), `Bearer ${process.env.CRON_SECRET}`) ||
    secretEquals(req.headers.get("x-sync-secret"), process.env.SYNC_SECRET)
  );
}

async function persist(snapshot: AdsSnapshot): Promise<"ok" | "skipped"> {
  try {
    await prisma.hqAdsSnapshot.upsert({
      where: { id: 1 },
      create: { id: 1, payload: snapshot as object },
      update: { payload: snapshot as object, updatedAt: new Date() },
    });
    return "ok";
  } catch (err) {
    if (isMissingSchemaError(err)) return "skipped";
    throw err;
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await collectAdsSnapshot();
  const persisted = await persist(snapshot);
  return NextResponse.json({
    ok: true,
    persisted,
    source: snapshot.source,
    day: snapshot.day,
    accounts: snapshot.accounts.map((a) => ({
      key: a.key,
      window: a.window,
      source: a.source,
      spend: a.spend,
      campaigns: a.campaigns.length,
    })),
  });
}
