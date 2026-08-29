/**
 * GET /api/vater/drive/oauth/start?return=<hash-without-#>
 *
 * First hop of the per-user Google Drive link (2026-08-28). Any signed-in
 * /animate account may link (NOT admin-gated — unlike the YouTube posting
 * OAuth this copies its mechanics from). Sets the `jelly_drive_oauth` cookie
 * {state, return, uid} and bounces to Google with the non-sensitive
 * drive.file scope. `return` is the /animate hash to land back on.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { driveClientEnv, driveRedirectUri, DRIVE_SCOPES } from "@/lib/vater/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DRIVE_OAUTH_COOKIE = "jelly_drive_oauth";
const RETURN_MAX = 200;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const env = driveClientEnv();
  if (!env) {
    return NextResponse.json(
      { error: "Google Drive link is not configured (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET)" },
      { status: 503 },
    );
  }

  const rawReturn = request.nextUrl.searchParams.get("return") ?? "";
  const ret = rawReturn.replace(/^#/, "").slice(0, RETURN_MAX);
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: env.clientId,
    redirect_uri: driveRedirectUri(request),
    response_type: "code",
    scope: DRIVE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent", // guarantees a refresh_token on every link
    include_granted_scopes: "true",
    state,
  });

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  res.cookies.set(DRIVE_OAUTH_COOKIE, JSON.stringify({ state, return: ret, uid: session.user.id }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/vater/drive/oauth",
    maxAge: 600,
  });
  return res;
}
