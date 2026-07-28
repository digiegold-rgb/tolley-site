import { NextRequest, NextResponse } from "next/server";
import { getStoredToken } from "@/lib/social/token-store";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/social/ig-token — returns the working Instagram Graph token (and
// account id) from the self-healing PlatformConnection store. x-sync-secret
// only (DGX-internal). Used by the shorts pipeline's instagram_publisher.py,
// whose legacy socialite config token died without instagram_content_publish.
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-sync-secret");
  if (!secret || !secretEquals(secret, process.env.SYNC_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tok = await getStoredToken("instagram");
  if (!tok) return NextResponse.json({ error: "No instagram token stored yet" }, { status: 404 });
  return NextResponse.json({
    accountId: process.env.INSTAGRAM_BUSINESS_ID?.trim() || tok.accountId,
    accessToken: tok.accessToken,
  });
}
