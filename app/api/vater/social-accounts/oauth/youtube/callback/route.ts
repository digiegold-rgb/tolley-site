/**
 * GET /api/vater/social-accounts/oauth/youtube/callback
 *
 * Final hop of the studio's YouTube consent. Exchanges the code, reads the
 * channel title so the publish panel can name what got connected, and upserts
 * the tokens into the signed-in user's `SocialAccount` row.
 *
 * Unlike the social-suite callback this never shows the refresh token: there
 * is no env var to paste, the DB row IS the store. The page just reports the
 * result and bounces back to the Script Review screen.
 */
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isVaterStudioEmail } from "@/lib/admin-auth";
import type { YouTubeCredentials } from "@/lib/vater/youtube-upload";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_RETURN_TO as RETURN_TO,
} from "@/lib/vater/youtube-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esc(value: string): string {
  return value.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Small terminal page: says what happened, then returns to the studio. */
function page(opts: {
  ok: boolean;
  heading: string;
  detail: string;
}): NextResponse {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${opts.ok ? "YouTube connected" : "YouTube connection failed"}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; background: #0A0A10; color: #F1F0F5; padding: 32px; line-height: 1.6; }
  .card { max-width: 560px; margin: 48px auto; border: 1px solid rgba(139,92,246,0.24); border-radius: 16px; padding: 28px; background: #16141F; }
  h1 { margin: 0 0 8px; font-size: 20px; }
  p { color: #9794A8; font-size: 14px; }
  a { color: #A78BFA; font-weight: 600; }
  .ok { color: #16A34A; }
  .err { color: #DC2626; }
</style>
</head>
<body>
  <div class="card">
    <h1>${esc(opts.heading)} <span class="${opts.ok ? "ok" : "err"}">${opts.ok ? "✓" : "✗"}</span></h1>
    <p>${esc(opts.detail)}</p>
    <p><a href="${RETURN_TO}">← back to Script Review</a></p>
  </div>
  <script>setTimeout(function () { window.location.replace(${JSON.stringify(RETURN_TO)}); }, ${opts.ok ? 2500 : 8000});</script>
</body>
</html>`;
  return new NextResponse(html, {
    status: opts.ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !isVaterStudioEmail(session.user.email)) {
    return page({
      ok: false,
      heading: "Sign in first",
      detail: "This consent has to finish in the same browser session that started it.",
    });
  }

  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return page({
      ok: false,
      heading: "Google declined the connection",
      detail: error,
    });
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return page({
      ok: false,
      heading: "Missing authorization code",
      detail: "Google returned without a code. Start the connection again.",
    });
  }

  // CSRF guard — constant-time compare against the cookie set by /start.
  const state = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (
    !state ||
    !stateCookie ||
    state.length !== stateCookie.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(stateCookie))
  ) {
    return page({
      ok: false,
      heading: "State mismatch",
      detail: "The consent request could not be verified. Start the connection again.",
    });
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return page({
      ok: false,
      heading: "YouTube app not configured",
      detail: "YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET are missing in the environment.",
    });
  }

  const origin = new URL(request.url).origin;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${origin}/api/vater/social-accounts/oauth/youtube/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text().catch(() => "");
    return page({
      ok: false,
      heading: "Token exchange failed",
      detail: `${tokenRes.status}: ${text.slice(0, 300)}`,
    });
  }

  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tokens.refresh_token) {
    return page({
      ok: false,
      heading: "No refresh token returned",
      detail:
        "Revoke this app at myaccount.google.com/permissions and connect again so Google issues a fresh refresh token.",
    });
  }

  // Name the channel so the publish panel shows what it will upload to.
  let channelTitle = "YouTube channel";
  const chanRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${tokens.access_token ?? ""}` } },
  );
  if (chanRes.ok) {
    const json = (await chanRes.json()) as {
      items?: Array<{ snippet?: { title?: string; thumbnails?: { default?: { url?: string } } } }>;
    };
    channelTitle = json.items?.[0]?.snippet?.title ?? channelTitle;
  }

  const credentials: YouTubeCredentials = {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    channelTitle,
  };

  await prisma.socialAccount.upsert({
    where: {
      userId_platform: { userId: session.user.id, platform: "youtube" },
    },
    create: {
      userId: session.user.id,
      platform: "youtube",
      displayName: channelTitle,
      credentials: credentials as unknown as Prisma.InputJsonValue,
      status: "active",
    },
    update: {
      displayName: channelTitle,
      credentials: credentials as unknown as Prisma.InputJsonValue,
      status: "active",
      lastError: null,
    },
  });

  console.log(
    `[vater/yt-oauth] user=${session.user.id} connected channel="${channelTitle}"`,
  );

  const res = page({
    ok: true,
    heading: `Connected ${channelTitle}`,
    detail: "Uploads from the publish panel will go to this channel.",
  });
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}
