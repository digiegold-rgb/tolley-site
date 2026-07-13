import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { saveStoredToken } from "@/lib/social/token-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH = "https://graph.facebook.com/v18.0";

/**
 * Final hop of the Facebook/Instagram OAuth round trip.
 *
 * code → user token → long-lived user token → page tokens (which inherit the
 * new instagram scopes). The page linked to the IG business account gets
 * stored as the "instagram" admin token — lib/social/instagram.ts reads it
 * first, so IG posting works immediately with no env paste and no redeploy.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) return new NextResponse("Login required", { status: 401 });

  const code = request.nextUrl.searchParams.get("code");
  const fbError = request.nextUrl.searchParams.get("error_description")
    || request.nextUrl.searchParams.get("error");
  if (fbError) return new NextResponse(`OAuth error: ${fbError}`, { status: 400 });
  if (!code) return new NextResponse("Missing code", { status: 400 });

  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  const igBusinessId = process.env.INSTAGRAM_BUSINESS_ID?.trim();
  if (!appId || !appSecret) {
    return new NextResponse("FACEBOOK_APP_ID / FACEBOOK_APP_SECRET missing in Vercel env", { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/social/oauth/facebook/callback`;

  // 1. code → short-lived user token
  const tokRes = await fetch(`${GRAPH}/oauth/access_token?${new URLSearchParams({
    client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code,
  })}`);
  if (!tokRes.ok) {
    return new NextResponse(`Token exchange failed: ${tokRes.status}\n\n${await tokRes.text()}`, { status: 502 });
  }
  const { access_token: shortToken } = (await tokRes.json()) as { access_token: string };

  // 2. short-lived → long-lived user token (~60 days)
  const llRes = await fetch(`${GRAPH}/oauth/access_token?${new URLSearchParams({
    grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret,
    fb_exchange_token: shortToken,
  })}`);
  if (!llRes.ok) {
    return new NextResponse(`Long-lived exchange failed: ${llRes.status}\n\n${await llRes.text()}`, { status: 502 });
  }
  const { access_token: userToken } = (await llRes.json()) as { access_token: string };

  // 3. page tokens (page tokens from a long-lived user token don't expire)
  const pagesRes = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(userToken)}`,
  );
  if (!pagesRes.ok) {
    return new NextResponse(`Page list failed: ${pagesRes.status}\n\n${await pagesRes.text()}`, { status: 502 });
  }
  const pages = ((await pagesRes.json()) as {
    data?: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }>;
  }).data ?? [];

  // Prefer the page linked to OUR IG business account; else any page with an IG account.
  const igPage =
    pages.find((p) => p.instagram_business_account?.id === igBusinessId) ||
    pages.find((p) => !!p.instagram_business_account);

  const rows: string[] = [];
  let headline = "";
  if (igPage) {
    await saveStoredToken("instagram", {
      accessToken: igPage.access_token,
      accountId: igPage.instagram_business_account?.id ?? igPage.id,
      username: igPage.name,
      scopes: ["instagram_basic", "instagram_content_publish", "pages_manage_posts", "publish_video"],
      pageId: igPage.id,
      pageName: igPage.name,
    });
    headline = `<p><span class="ok">Token saved automatically</span> — Instagram Reels posting works right now via page <strong>${igPage.name}</strong> → IG account <strong>${igPage.instagram_business_account?.id ?? "?"}</strong>. Nothing to paste, no redeploy.</p>`;
  } else {
    headline = `<p><span class="warn">⚠ No page in this login has a linked Instagram business account.</span> Link the IG account to a Facebook page (IG app → Settings → Sharing to other apps) and run this again.</p>`;
  }
  for (const p of pages) {
    rows.push(`<tr><td>${p.name}</td><td>${p.id}</td><td>${p.instagram_business_account?.id ?? "—"}</td></tr>`);
  }

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Facebook / Instagram re-auth complete</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0a0a0f; color: #e5e5e5; padding: 32px; line-height: 1.5; }
  .card { max-width: 720px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; background: rgba(255,255,255,0.03); }
  h1 { margin: 0 0 8px; font-size: 22px; }
  .muted { color: rgba(255,255,255,0.5); font-size: 13px; }
  .ok { color: #34d399; font-weight: 600; }
  .warn { color: #fbbf24; }
  a { color: #34d399; }
  table { border-collapse: collapse; margin-top: 12px; font-size: 13px; }
  td, th { border: 1px solid rgba(255,255,255,0.12); padding: 6px 10px; text-align: left; }
</style>
</head>
<body>
  <div class="card">
    <h1>Facebook / Instagram re-auth <span class="ok">✓</span></h1>
    ${headline}
    <table><tr><th>Page</th><th>Page ID</th><th>IG business account</th></tr>${rows.join("")}</table>
    <p class="muted" style="margin-top: 24px;"><a href="/social">← back to /social</a></p>
  </div>
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
