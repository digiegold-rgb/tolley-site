import { NextResponse } from "next/server";
import { validateWdAdmin } from "@/lib/wd-auth";
import { buildHqStatsPayload } from "@/lib/hq-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hq/stats — Stats tab payload: per-video YouTube snapshots with
// 7d/28d deltas, per-pipeline rollups, first-party site/circle/shop numbers.
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await buildHqStatsPayload());
  } catch (err) {
    console.error("[hq/stats GET]", err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
