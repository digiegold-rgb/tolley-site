import { NextRequest, NextResponse } from "next/server";
import { put, list } from "@vercel/blob";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYNC_SECRET = process.env.SYNC_SECRET || "";
const LATEST_PATH = "housing/pulse-latest.json";
const STATCARD_PATH = "housing/statcard-latest.png";

/**
 * POST /api/housing/pulse — DGX pushes the daily pulse (x-sync-secret guarded).
 * Body: pulse JSON; optional `statcard` = base64 PNG stored alongside.
 */
export async function POST(request: NextRequest) {
  if (!SYNC_SECRET || request.headers.get("x-sync-secret") !== SYNC_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !body.date || !body.brief) {
    return NextResponse.json({ error: "invalid pulse payload" }, { status: 400 });
  }

  const { statcard, ...pulse } = body as Record<string, unknown> & { statcard?: string };
  const json = JSON.stringify(pulse);
  // allowOverwrite: with addRandomSuffix off, a second push to the same path
  // (every day after day one) otherwise throws "blob already exists" → 500
  await put(LATEST_PATH, json, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 300,
  });
  await put(`housing/pulse-${pulse.date}.json`, json, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });

  let statcardUrl: string | null = null;
  if (statcard && typeof statcard === "string") {
    const buf = Buffer.from(statcard, "base64");
    const blob = await put(STATCARD_PATH, buf, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "image/png",
      cacheControlMaxAge: 300,
    });
    statcardUrl = blob.url;
  }

  return NextResponse.json({ ok: true, date: pulse.date, statcardUrl });
}

/** GET /api/housing/pulse — public latest pulse (used by the /housing page + agents). */
export async function GET() {
  try {
    const { blobs } = await list({ prefix: LATEST_PATH, limit: 1 });
    if (!blobs.length) {
      return NextResponse.json(
        { ready: false, message: "First market pulse drops tomorrow morning." },
        { status: 200, headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } },
      );
    }
    const res = await fetch(blobs[0].url, { next: { revalidate: 300 } });
    const pulse = await res.json();
    const cards = await list({ prefix: STATCARD_PATH, limit: 1 });
    return NextResponse.json(
      { ready: true, pulse, statcardUrl: cards.blobs[0]?.url ?? null },
      { status: 200, headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (err) {
    return NextResponse.json(
      { ready: false, error: err instanceof Error ? err.message : "pulse fetch failed" },
      { status: 500 },
    );
  }
}
