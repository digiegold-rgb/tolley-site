import { NextRequest, NextResponse } from "next/server";

import { runSellerSeed } from "@/lib/leads/seller-seed";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/hq/seller-seed — manually trigger the motivated-seller → listing
 * seeder (same routine the Monday digest cron runs).
 *
 * Auth: x-sync-secret header. Optional JSON body: { limit, minScore, windowDays }.
 * Not in vercel.json — Cordless fires it via curl when he wants an off-cycle run.
 */
export async function POST(request: NextRequest) {
  // Constant-time compare — `!==` short-circuits on the first differing byte,
  // which leaks the secret one character at a time to a patient caller.
  if (!secretEquals(request.headers.get("x-sync-secret"), process.env.SYNC_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let opts: { limit?: number; minScore?: number; windowDays?: number } = {};
  const raw = await request.text();
  if (raw.trim()) {
    try {
      const body = JSON.parse(raw) as Record<string, unknown>;
      const num = (v: unknown): number | undefined =>
        typeof v === "number" && Number.isFinite(v) ? v : undefined;
      opts = {
        limit: num(body.limit),
        minScore: num(body.minScore),
        windowDays: num(body.windowDays),
      };
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  try {
    const result = await runSellerSeed(opts);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[hq/seller-seed] failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "seed failed" },
      { status: 500 },
    );
  }
}
