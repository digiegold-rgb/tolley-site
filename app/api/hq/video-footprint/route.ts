import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Stored on EmpireSnapshot under its own `source` rather than in a new table:
// this is an append-only daily snapshot of a JSON blob, which is exactly what
// that table already is, and reusing it means no Prisma migration (schema
// changes here trip the prisma/migrations/manual P3015 on every deploy).
const SOURCE = "video-footprint";
const MAX_BODY_BYTES = 256 * 1024;
const RETENTION_DAYS = 120;

/**
 * POST /api/hq/video-footprint — the DGX pushes its nightly disk scan here
 * (video-disk-footprint.py --push, x-sync-secret auth).
 *
 * Answers what the cost ledger structurally cannot: how much disk the video
 * pipelines are actually holding, and how many finished renders never got a
 * VideoCost row at all.
 */
export async function POST(request: NextRequest) {
  const header = request.headers.get("x-sync-secret");
  if (!header || !secretEquals(header, process.env.SYNC_SECRET)) {
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
  if (!body.totals || typeof body.totals !== "object") {
    return NextResponse.json({ error: "Missing totals" }, { status: 400 });
  }

  const row = await prisma.empireSnapshot.create({
    data: { source: SOURCE, payload: body as Prisma.InputJsonValue },
    select: { id: true },
  });
  await prisma.empireSnapshot.deleteMany({
    where: { source: SOURCE, createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86400_000) } },
  });

  return NextResponse.json({ ok: true, id: row.id });
}

/**
 * GET /api/hq/video-footprint — latest snapshot plus a 30-day-ago comparison
 * so the panel can show whether the footprint is growing (PIN auth).
 */
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [latest, prior] = await Promise.all([
    prisma.empireSnapshot.findFirst({
      where: { source: SOURCE },
      orderBy: { createdAt: "desc" },
      select: { payload: true, createdAt: true },
    }),
    prisma.empireSnapshot.findFirst({
      where: { source: SOURCE, createdAt: { lt: new Date(Date.now() - 30 * 86400_000) } },
      orderBy: { createdAt: "desc" },
      select: { payload: true, createdAt: true },
    }),
  ]);

  if (!latest) {
    // Distinct from an error: the nightly cron simply has not run yet.
    return NextResponse.json({ pending: true });
  }

  const payload = latest.payload as Record<string, unknown> | null;
  const priorTotals =
    (prior?.payload as { totals?: Record<string, number> } | null)?.totals ?? null;

  return NextResponse.json({
    ...(payload ?? {}),
    collectedAt: latest.createdAt,
    priorTotals,
    priorCollectedAt: prior?.createdAt ?? null,
  });
}
