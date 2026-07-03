import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Final hop of the YouTube OAuth round trip.
 *
 * Google sends us back with `?code=...`. We exchange it for an access_token
 * + refresh_token. Since Vercel env vars can't be written from runtime,
 * we display the refresh_token to the admin in a small HTML page along with
 * the exact `vercel env add` command to paste it. One copy-paste re-auth.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession();
  if (!auth.ok) {
    return new NextResponse("Login required", { status: 401 });
  }

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return new NextResponse(`OAuth error: ${error}`, { status: 400 });
  }
  if (!code) {
    return new NextResponse("Missing code", { status: 400 });
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new NextResponse(
      "YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET missing in Vercel env",
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/social/oauth/youtube/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return new NextResponse(`Token exchange failed: ${tokenRes.status}\n\n${text}`, {
      status: 502,
    });
  }
  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!tokens.refresh_token) {
    return new NextResponse(
      "Google did not return a refresh_token. Revoke this app at https://myaccount.google.com/permissions and try again.",
      { status: 502 },
    );
  }

  // Pull channel snippet so the admin sees which account they connected.
  const chanRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  );
  let channelTitle = "(channel info unavailable)";
  if (chanRes.ok) {
    const json = (await chanRes.json()) as {
      items?: Array<{ snippet?: { title?: string } }>;
    };
    channelTitle = json.items?.[0]?.snippet?.title ?? channelTitle;
  }

  const refreshToken = tokens.refresh_token;
  const escaped = refreshToken.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>YouTube re-auth complete</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0a0a0f; color: #e5e5e5; padding: 32px; line-height: 1.5; }
  .card { max-width: 720px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; background: rgba(255,255,255,0.03); }
  h1 { margin: 0 0 8px; font-size: 22px; }
  .muted { color: rgba(255,255,255,0.5); font-size: 13px; }
  pre { background: #000; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px; overflow-x: auto; font-size: 12px; user-select: all; }
  .ok { color: #34d399; font-weight: 600; }
  a { color: #34d399; }
  .step { margin-top: 16px; }
  button { background: #34d399; color: #000; border: 0; border-radius: 8px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
</style>
</head>
<body>
  <div class="card">
    <h1>YouTube re-auth complete <span class="ok">✓</span></h1>
    <p class="muted">Connected channel: <strong>${channelTitle}</strong></p>

    <div class="step">
      <p><strong>Step 1 — copy this refresh token:</strong></p>
      <pre id="rt">${escaped}</pre>
      <button onclick="navigator.clipboard.writeText(document.getElementById('rt').innerText); this.innerText='Copied ✓'">Copy refresh token</button>
    </div>

    <div class="step">
      <p><strong>Step 2 — paste it into Vercel env:</strong> on your terminal, run:</p>
      <pre>printf '%s' "&lt;paste-refresh-token-here&gt;" | npx vercel env rm YOUTUBE_REFRESH_TOKEN production --yes 2&gt;/dev/null; printf '%s' "&lt;paste&gt;" | npx vercel env add YOUTUBE_REFRESH_TOKEN production</pre>
    </div>

    <div class="step">
      <p><strong>Step 3 — redeploy:</strong></p>
      <pre>cd ~/tolley-site &amp;&amp; npx vercel --prod --yes</pre>
    </div>

    <p class="muted" style="margin-top: 24px;"><a href="/social">← back to /social</a></p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
