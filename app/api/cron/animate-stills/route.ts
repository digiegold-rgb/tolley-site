/**
 * GET /api/cron/animate-stills
 *
 * Backfill permanent card stills for finished videos / listing reels that
 * already have an mp4 or a scene still. Copies existing files — no GPU.
 * Auth matches /api/cron/socials-collect (CRON_SECRET bearer).
 * No vercel.json `functions` entry — the 50-function cap is full.
 */
import { NextRequest, NextResponse } from "next/server";

import { secretEquals } from "@/lib/secret-compare";
import { backfillPermanentStills } from "@/lib/vater/permanent-still-persist";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !secretEquals(req.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await backfillPermanentStills({ limit: 24 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "still backfill failed" },
      { status: 500 },
    );
  }
}
