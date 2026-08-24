// try-five only, delete with branch, do not merge.
// Preview-only Auth.js session mint so Jared can land in /animate Shell.

import { timingSafeEqual } from "node:crypto";

import { encode, type JWT } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

import { readSessionVersion } from "@/lib/auth/session-version";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_EMAIL = "digiegold@gmail.com";
const TRY_FIVE_EMAILS = new Set([
  "digiegold@gmail.com",
  "jared@yourkchomes.com",
]);
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function notFound() {
  return new NextResponse(null, { status: 404 });
}

function secretsEqual(provided: string, expected: string) {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || left.length === 0) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function sessionCookieNames(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-proto");
  const secure =
    process.env.VERCEL === "1" ||
    forwarded === "https" ||
    request.nextUrl.protocol === "https:";
  // Auth.js picks the cookie name from useSecureCookies. Preview AUTH_URL is
  // stripped, so mint both salts — decode only succeeds for the matching name.
  return secure
    ? ["__Secure-authjs.session-token", "authjs.session-token"]
    : ["authjs.session-token"];
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview") {
    return notFound();
  }

  const bypassSecret = process.env.TRY_FIVE_BYPASS_SECRET;
  if (!bypassSecret) {
    return notFound();
  }

  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!secretsEqual(token, bypassSecret)) {
    return notFound();
  }

  const userId = request.nextUrl.searchParams.get("userId")?.trim() ?? "";
  const emailParam =
    request.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  const email = emailParam || (userId ? "" : DEFAULT_EMAIL);

  if (email && !TRY_FIVE_EMAILS.has(email) && !userId) {
    return notFound();
  }

  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, image: true },
      })
    : await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true, image: true },
      });

  if (!user?.id) {
    return notFound();
  }

  const authSecret =
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV !== "production"
      ? "dev-only-secret-change-before-production"
      : undefined);
  if (!authSecret) {
    return notFound();
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: JWT = {
    sub: user.id,
    id: user.id,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    picture: user.image ?? undefined,
    sv: (await readSessionVersion(user.id)) ?? 0,
    svAt: nowSeconds,
  };

  const dest = NextResponse.redirect(new URL("/animate", request.url), 302);
  for (const cookieName of sessionCookieNames(request)) {
    const jwt = await encode({
      token: payload,
      secret: authSecret,
      salt: cookieName,
      maxAge: SESSION_MAX_AGE,
    });
    dest.cookies.set({
      name: cookieName,
      value: jwt,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: cookieName.startsWith("__Secure-") || process.env.VERCEL === "1",
      maxAge: SESSION_MAX_AGE,
    });
  }

  return dest;
}
