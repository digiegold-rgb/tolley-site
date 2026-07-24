import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kick off Pinterest OAuth (v5). Requires PINTEREST_APP_ID + PINTEREST_APP_SECRET
 * (from developers.pinterest.com). Admin session OR ?key=<SYNC_SECRET> magic link
 * so it works in any browser where the Pinterest account is logged in.
 */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  const keyOk = !!key && !!process.env.SYNC_SECRET && secretEquals(key, process.env.SYNC_SECRET);
  if (!keyOk) {
    const auth = await requireAdminApiSession();
    if (!auth.ok) return auth.response;
  }

  const appId = process.env.PINTEREST_APP_ID?.trim();
  if (!appId) {
    return NextResponse.json(
      { error: "PINTEREST_APP_ID / PINTEREST_APP_SECRET not set in Vercel env" },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/social/oauth/pinterest/callback`;
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "boards:read,pins:read,pins:write",
    state,
  });

  const res = NextResponse.redirect(`https://www.pinterest.com/oauth/?${params.toString()}`);
  res.cookies.set("pin_oauth_state", state, {
    httpOnly: true, secure: true, sameSite: "lax",
    path: "/api/social/oauth/pinterest", maxAge: 600,
  });
  return res;
}
