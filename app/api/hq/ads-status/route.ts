import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isMissingSchemaError } from "@/lib/vater/schema-probe";
import { validateWdAdmin } from "@/lib/wd-auth";
import { collectAdsSnapshot } from "@/lib/hq-ads-collect";
import {
  isAdsSnapshot,
  snapshotFromJson,
  snapshotIsFresh,
  type AdsSnapshot,
} from "@/lib/hq-ads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function readCached(): Promise<{ snapshot: AdsSnapshot | null; updatedAt: Date | null }> {
  try {
    const row = await prisma.hqAdsSnapshot.findUnique({ where: { id: 1 } });
    if (!row) return { snapshot: null, updatedAt: null };
    return { snapshot: snapshotFromJson(row.payload), updatedAt: row.updatedAt };
  } catch (err) {
    if (isMissingSchemaError(err)) return { snapshot: null, updatedAt: null };
    throw err;
  }
}

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

  const cached = await readCached();
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
