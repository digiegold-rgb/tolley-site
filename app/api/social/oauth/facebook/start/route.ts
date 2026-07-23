import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kick off the Facebook OAuth round trip that mints a page token WITH the
 * Instagram publishing scopes. The existing env page tokens are valid but were
 * issued without instagram_basic/instagram_content_publish, which is why IG
 * posting fails with Graph error (#10).
 */
export async function GET(request: Request) {
  // Admin session OR a one-time ?key=<SYNC_SECRET> magic link. The key path
  // lets a single link work in Ruthann's browser (where SHE is logged into
  // Facebook) without also needing a tolley.io admin PIN in that same browser.
  // Starting the flow isn't sensitive — the callback still validates state and
  // only stores tokens for whoever actually completes FB's own consent.
  const key = new URL(request.url).searchParams.get("key");
  const keyOk = !!key && !!process.env.SYNC_SECRET && secretEquals(key, process.env.SYNC_SECRET);
  if (!keyOk) {
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
    ].join(","),
    state,
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}
