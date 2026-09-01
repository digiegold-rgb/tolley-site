/**
 * GET /api/vater/socials/overview
 *
 * Dashboard "all my active videos" — every workspace tab this login owns,
 * with that tab's library + performance. Never the house HQ ads / view-counter
 * totals (those are GET /api/vater/socials/house, owner dashboard only).
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { loadOverviewPayload } from "@/lib/vater/socials/studio-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }
  try {
    const payload = await loadOverviewPayload(session);
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "overview failed" },
      { status: 500, headers: NO_STORE },
    );
  }
}
