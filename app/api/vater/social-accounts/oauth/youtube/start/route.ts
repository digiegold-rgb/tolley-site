/**
 * GET /api/vater/social-accounts/oauth/youtube/start
 *
 * Vater-scoped YouTube consent. Modelled on
 * `app/api/social/oauth/youtube/start` but deliberately separate:
 *   - the caller is the signed-in studio user, not an admin API session;
 *   - the scopes are upload + readonly ONLY (no analytics, no force-ssl —
 *     the studio never comments, edits playlists, or reads channel stats);
 *   - the token lands in the per-user `SocialAccount` row, never in the
 *     social suite's `PlatformConnection` store.
 */
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { isVaterStudioEmail } from "@/lib/admin-auth";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_COOKIE_PATH,
} from "@/lib/vater/youtube-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isVaterStudioEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "YOUTUBE_CLIENT_ID not set in the environment" },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/vater/social-accounts/oauth/youtube/callback`;
  const state = randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ].join(" "),
    access_type: "offline",
    prompt: "consent", // forces a refresh_token on every consent
    state,
  });

  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
  // CSRF guard: the callback rejects unless Google echoes this back verbatim.
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: OAUTH_COOKIE_PATH,
    maxAge: 600,
  });
  return res;
}
