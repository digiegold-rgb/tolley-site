import { NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kick off the Facebook OAuth round trip that mints a page token WITH the
 * Instagram publishing scopes. The existing env page tokens are valid but were
 * issued without instagram_basic/instagram_content_publish, which is why IG
 * posting fails with Graph error (#10).
 */
export async function GET(request: Request) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return auth.response;

  const appId = process.env.FACEBOOK_APP_ID?.trim();
  if (!appId) {
    return NextResponse.json({ error: "FACEBOOK_APP_ID not set in Vercel env" }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/social/oauth/facebook/callback`;
  const state = crypto.randomUUID();

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

  return NextResponse.redirect(`https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`);
}
