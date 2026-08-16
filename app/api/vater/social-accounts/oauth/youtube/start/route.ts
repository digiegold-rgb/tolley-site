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
 *
 * Ungated for the beta (Phase 3, 2026-08-15). Publishing your finished video
 * to your own channel is the end of the golden path, and the studio-tier gate
 * here made it owner-and-Trey-only — a customer could render a video and then
 * had nowhere to send it. Any signed-in session may connect, which is safe
 * because the whole flow is per-user: Google consents to THEIR channel, the
 * refresh token lands in THEIR `SocialAccount` row keyed by `userId`, and the
 * publish route only ever loads the row belonging to the caller. Nothing here
 * touches a shared credential.
 */
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
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
