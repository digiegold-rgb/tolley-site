import { NextResponse } from "next/server";
import { getCircleStats } from "@/lib/circle-stats";

export const runtime = "nodejs";

/**
 * GET /api/circle/stats
 *
 * Public, aggregate-only feed behind the /circle flywheel: 30-day visits and
 * lead captures per directory group plus network totals and top referrer
 * classes. No PII — counts only. Cached 15 min via getCircleStats.
 */
export async function GET() {
  try {
    const stats = await getCircleStats();
    return NextResponse.json(stats, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
    });
  } catch (error) {
    console.error("circle-stats error", error);
    return NextResponse.json({ error: "Stats unavailable" }, { status: 500 });
  }
}
