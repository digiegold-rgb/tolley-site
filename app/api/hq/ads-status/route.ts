import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isMissingSchemaError } from "@/lib/vater/schema-probe";
import { validateWdAdmin } from "@/lib/wd-auth";
import { collectAdsSnapshot } from "@/lib/hq-ads-collect";
import { isAdsSnapshot, snapshotIsFresh, type AdsSnapshot } from "@/lib/hq-ads";
import { readCachedAdsSnapshot } from "@/lib/hq-posts-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function writeCached(snapshot: AdsSnapshot): Promise<void> {
  try {
    await prisma.hqAdsSnapshot.upsert({
      where: { id: 1 },
      create: { id: 1, payload: snapshot as object },
      update: { payload: snapshot as object, updatedAt: new Date() },
    });
  } catch (err) {
    if (isMissingSchemaError(err)) return;
    throw err;
  }
}

export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cached = await readCachedAdsSnapshot();
  if (cached.snapshot && isAdsSnapshot(cached.snapshot) && snapshotIsFresh(cached.snapshot)) {
    return NextResponse.json(cached.snapshot);
  }

  const snapshot = await collectAdsSnapshot();
  if (snapshot.source === "live" || !cached.snapshot) {
    await writeCached(snapshot);
    return NextResponse.json(snapshot);
  }
  return NextResponse.json(cached.snapshot);
}
