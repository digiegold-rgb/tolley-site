/**
 * GET /api/vater/drive/oauth/callback — Google bounces here with ?code&state.
 *
 * Validates state + that the session is the same user who started the link,
 * exchanges the code, records the Google email, upserts the ROOT user's
 * VaterDriveConnection and creates the "Jelly Scripts" folder. A folder
 * failure (typically Drive API not enabled on the GCP project) still saves
 * the connection — as status "error" + lastError — so the Drive card can
 * explain instead of looking un-linked.
 *
 * Always redirects back to /animate:
 *   ?drive=connected#<return>
 *   ?drive=error&reason=<denied|state|session|config|exchange|no_refresh|unknown>#<return>
 */
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { resolveTenantIdentity } from "@/lib/vater/tenant-identity";
import {
  driveClientEnv,
  driveRedirectUri,
  ensureFolder,
  fetchGoogleEmail,
  isDriveError,
} from "@/lib/vater/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "jelly_drive_oauth";

interface OauthCookie {
  state?: string;
  return?: string;
  uid?: string;
}

function readCookie(raw: string | undefined): OauthCookie {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" ? (v as OauthCookie) : {};
  } catch {
    return {};
  }
}

function sameString(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function GET(request: NextRequest) {
  const cookie = readCookie(request.cookies.get(COOKIE)?.value);
  const ret = (cookie.return ?? "").replace(/^#/, "");
  const base = new URL("/animate", driveRedirectUri(request)).toString();

  const done = (query: string) => {
    const res = NextResponse.redirect(`${base}?${query}${ret ? `#${ret}` : ""}`);
    res.cookies.set(COOKIE, "", { path: "/api/vater/drive/oauth", maxAge: 0 });
    return res;
  };
  const fail = (reason: string) => done(`drive=error&reason=${encodeURIComponent(reason)}`);

  const session = await auth();
  if (!session?.user?.id) return fail("session");

  const sp = request.nextUrl.searchParams;
  const googleError = sp.get("error");
  if (googleError) return fail(googleError === "access_denied" ? "denied" : "unknown");

  const code = sp.get("code");
  const state = sp.get("state") ?? undefined;
  if (!code || !sameString(state, cookie.state)) return fail("state");
  if (!sameString(cookie.uid, session.user.id)) return fail("session");

  const env = driveClientEnv();
  if (!env) return fail("config");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.clientId,
      client_secret: env.clientSecret,
      redirect_uri: driveRedirectUri(request),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    console.error(`[vater/drive/oauth] exchange failed ${tokenRes.status}: ${(await tokenRes.text()).slice(0, 300)}`);
    return fail("exchange");
  }
  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tokens.refresh_token) return fail("no_refresh");

  const accessToken = tokens.access_token ?? null;
  const accessTokenExpiresAt = accessToken
    ? new Date(Date.now() + Math.max(60, tokens.expires_in ?? 3600) * 1000)
    : null;
  const googleEmail = accessToken ? await fetchGoogleEmail(accessToken) : null;

  const { rootUserId } = await resolveTenantIdentity(session.user.id);
  const conn = await prisma.vaterDriveConnection.upsert({
    where: { userId: rootUserId },
    create: {
      userId: rootUserId,
      googleEmail,
      refreshToken: tokens.refresh_token,
      accessToken,
      accessTokenExpiresAt,
      status: "active",
      lastError: null,
    },
    update: {
      googleEmail,
      refreshToken: tokens.refresh_token,
      accessToken,
      accessTokenExpiresAt,
      status: "active",
      lastError: null,
    },
  });

  try {
    await ensureFolder(conn);
  } catch (err) {
    const code = isDriveError(err) ? err.code : "unknown";
    const persisted = isDriveError(err)
      ? err.persisted
      : `unknown: ${err instanceof Error ? err.message : String(err)}`;
    console.error(`[vater/drive/oauth] folder create failed for root=${rootUserId}: ${persisted}`);
    await prisma.vaterDriveConnection
      .update({ where: { id: conn.id }, data: { status: "error", lastError: persisted } })
      .catch(() => undefined);
    // Connection is saved; the card explains the folder problem. Only a
    // config-level failure (API off) is surfaced as an error redirect.
    if (code === "api_not_enabled") return fail("api_not_enabled");
  }

  console.log(`[vater/drive/oauth] linked root=${rootUserId} email=${googleEmail ?? "?"}`);
  return done("drive=connected");
}
