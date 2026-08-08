import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { mintOauthLinkToken, verifyOauthLinkToken } from "@/lib/oauth-link-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kick off Pinterest OAuth (v5). Requires PINTEREST_APP_ID + PINTEREST_APP_SECRET
 * (from developers.pinterest.com). Admin session OR ?t=<short-lived link token>
 * (minted at /api/social/oauth/link) so a magic link works in any browser where
 * the Pinterest account is logged in — without putting a permanent secret in URLs.
 */
export async function GET(request: Request) {
  const linkOk = verifyOauthLinkToken("pinterest", new URL(request.url).searchParams.get("t"));
  if (!linkOk) {
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
  // Proves to the callback that this flow started through this gated route —
  // lets a magic-link browser (no admin session) finish the round trip.
  res.cookies.set("pin_oauth_link", mintOauthLinkToken("pinterest", 10 * 60 * 1000), {
    httpOnly: true, secure: true, sameSite: "lax",
    path: "/api/social/oauth/pinterest", maxAge: 600,
  });
  return res;
}
