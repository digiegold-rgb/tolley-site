import { NextRequest, NextResponse } from "next/server";
import { getStoredToken } from "@/lib/social/token-store";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/social/fb-page-token?pageId=... — returns the stored page access
// token for one Facebook page. x-sync-secret only (DGX-internal). Used by the
// estate poster to pick up the token minted when Ruthann re-auths.
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-sync-secret");
  if (!secret || !secretEquals(secret, process.env.SYNC_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pageId = request.nextUrl.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

  const tok = await getStoredToken(`facebook_page:${pageId}`);
  if (!tok) return NextResponse.json({ error: "No token stored for that page yet" }, { status: 404 });
  return NextResponse.json({ pageId, accessToken: tok.accessToken });
}
