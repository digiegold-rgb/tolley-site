/**
 * GET /api/vater/socials/house?days=7
 *
 * House HQ Posts metrics for the owner Animate login (isVaterOwnerUser /
 * isVaterAdminEmail). Reads the same tables /hq?tab=posts already collects.
 * Never calls /api/hq/* (those 401 without the HQ cookie). Never writes
 * ChannelViewStat, ChannelVideoStat, HqAdsSnapshot, or PostLogEntry.
 *
 * Studio / beta / public sessions get 403 — they must not see house ads or
 * the view counter.
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { isVaterOwnerUser } from "@/lib/admin-auth";
import { loadHousePosts } from "@/lib/hq-posts-read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }

  // Session email stays the real login even inside a workspace tab.
  // isVaterOwnerUser unions env allowlists + VaterAccount tier "owner".
  if (!(await isVaterOwnerUser(session.user.id, session.user.email))) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: NO_STORE });
  }

  const days = Number(req.nextUrl.searchParams.get("days")) || 7;
  const payload = await loadHousePosts(days);
  return NextResponse.json(payload, { headers: NO_STORE });
}
