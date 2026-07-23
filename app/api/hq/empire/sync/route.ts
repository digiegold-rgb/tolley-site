import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 512 * 1024;
const RETENTION_DAYS = 30;

/**
 * POST /api/hq/empire/sync — the DGX empire-collector pushes its twice-daily
 * health snapshot here (x-sync-secret auth, same pattern as /api/hq/stats/videos).
 * Body: DgxSnapshot v1 (see ~/dgx-services/empire-collector/collect.mjs).
 */
export async function POST(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader = request.headers.get("x-sync-secret");
  if (!syncSecret || authHeader !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Snapshot too large" }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || body.version !== 1) {
    return NextResponse.json({ error: "Expected snapshot with version: 1" }, { status: 400 });
  }
  if (typeof body.generatedAt !== "string" || Number.isNaN(Date.parse(body.generatedAt))) {
    return NextResponse.json({ error: "generatedAt must be a parseable date" }, { status: 400 });
  }

  const row = await prisma.empireSnapshot.create({
    data: { source: "dgx", payload: body as Prisma.InputJsonValue },
    select: { id: true },
  });
  await prisma.empireSnapshot.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86400_000) } },
  });

  revalidateTag("empire", "max");

  const units = body.units && typeof body.units === "object" ? Object.keys(body.units).length : 0;
  return NextResponse.json({ ok: true, id: row.id, units });
}
