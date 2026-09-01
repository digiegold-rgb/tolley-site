/**
 * GET /api/vater/socials/studio?window=7|28|90
 *
 * Per-current-studio Socials payload: the active workspace userId, that
 * tab's YouTubeProject library, optional SocialChannelStat / SocialPostStat
 * for this userId only, and optional per-video HQ matches (owner).
 *
 * Empty Zernio still returns the library grid. Does not include house-wide
 * ads or channel totals — those stay on GET /api/vater/socials/house.
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { loadStudioPayload } from "@/lib/vater/socials/studio-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;
const WINDOWS = new Set([7, 28, 90]);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const raw = Number(req.nextUrl.searchParams.get("window") ?? 28);
  const windowDays = WINDOWS.has(raw) ? raw : 28;
  const lite = req.nextUrl.searchParams.get("lite") === "1";
  try {
    const payload = await loadStudioPayload(session, windowDays, { lite });
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "studio socials failed" },
      { status: 500, headers: NO_STORE },
    );
  }
}
