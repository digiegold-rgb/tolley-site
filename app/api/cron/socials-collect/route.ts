import { NextRequest, NextResponse } from "next/server";
import { secretEquals } from "@/lib/secret-compare";
import { collectSocialStats } from "@/lib/vater/socials/collector";
import { jsonSafe } from "@/lib/vater/socials/json";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Periodic Zernio analytics pull → SocialChannelStat / SocialPostStat.
 * Auth matches /api/cron/youtube-stats (CRON_SECRET bearer).
 * No vercel.json `functions` maxDuration entry — the 50-function cap is full.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !secretEquals(req.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await collectSocialStats({ limit: 25 });
    return NextResponse.json(jsonSafe({ ok: true, ...result }));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "collect failed" },
      { status: 500 },
    );
  }
}
