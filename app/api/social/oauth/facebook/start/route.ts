import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { mintOauthLinkToken, verifyOauthLinkToken } from "@/lib/oauth-link-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kick off the Facebook OAuth round trip that mints a page token WITH the
 * Instagram publishing scopes. The existing env page tokens are valid but were
 * issued without instagram_basic/instagram_content_publish, which is why IG
 * posting fails with Graph error (#10).
 */
export async function GET(request: Request) {
  // Admin session OR a short-lived ?t=<link token> magic link (minted at
  // /api/social/oauth/link). The link path lets a single link work in
  // Ruthann's browser (where SHE is logged into Facebook) without also needing
  // a tolley.io admin PIN — and unlike the old ?key=<SYNC_SECRET> form, the
  // token expires instead of parking the permanent secret in access logs.
  const linkOk = verifyOauthLinkToken("facebook", new URL(request.url).searchParams.get("t"));
  if (!linkOk) {
    const auth = await requireAdminApiSession();
    if (!auth.ok) return auth.response;
  }

  const appId = process.env.FACEBOOK_APP_ID?.trim();
  if (!appId) {
    return NextResponse.json({ error: "FACEBOOK_APP_ID not set in Vercel env" }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/social/oauth/facebook/callback`;
  const state = crypto.randomUUID();

  const res = NextResponse.redirect(buildDialogUrl(appId, redirectUri, state));
  // CSRF guard: callback rejects unless FB echoes this exact state back.
  res.cookies.set("fb_oauth_state", state, {
    httpOnly: true, secure: true, sameSite: "lax",
    path: "/api/social/oauth/facebook", maxAge: 600,
  });
  // Proves to the callback that this flow started through this gated route —
  // lets a magic-link browser (no admin session) finish the round trip.
  res.cookies.set("fb_oauth_link", mintOauthLinkToken("facebook", 10 * 60 * 1000), {
    httpOnly: true, secure: true, sameSite: "lax",
    path: "/api/social/oauth/facebook", maxAge: 600,
  });
  return res;
}

function buildDialogUrl(appId: string, redirectUri: string, state: string) {
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "publish_video",
      "business_management",
      // ads_* are NOT optional: the callback overwrites FACEBOOK_USER_TOKEN, and
      // lib/facebook-ads.ts (adspend, fb-ads, markets routes) needs them. The
      // original ads token was minted by hand in Graph API Explorer, so omitting
      // these here meant any re-auth silently killed all ads reads/writes.
      "ads_management",
      "ads_read",
    ].join(","),
    state,
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}
