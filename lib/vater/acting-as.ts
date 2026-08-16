/**
 * lib/vater/acting-as.ts
 *
 * "View as user" — admin support impersonation for Jelly Studio.
 *
 * Jared needs to see exactly what a beta tester sees when they report that a
 * screen is broken. Asking for their password is not an option, and reading
 * the DB doesn't reproduce a UI bug.
 *
 * SHAPE (mirrors lib/wd-auth.ts):
 *   cookie jelly_view_as = "<targetUserId>.<iat>.<hmac>"
 *   hmac  = HMAC-SHA256(AUTH_SECRET, "jelly-view-as:<targetUserId>:<iat>")
 *
 * The issued-at second is inside the signed payload and repeated in the clear,
 * which buys server-side expiry (2h) and real revocation (rotating AUTH_SECRET
 * kills every outstanding impersonation at once). User ids are cuids — no
 * dots — so splitting on "." is unambiguous.
 *
 * 🔴 THREE INDEPENDENT LOCKS, none of which is the cookie itself:
 *   1. MINTING requires an admin NextAuth session (requireAdminApiSession).
 *   2. HONOURING it in auth.ts requires the REAL token email to still be an
 *      admin email. A stolen cookie presented by a non-admin session does
 *      nothing at all — this is the important one.
 *   3. WRITES ARE BLOCKED while it is set: proxy.ts 403s every non-GET to
 *      /api/vater and /api/stripe. Support looks; support does not spend the
 *      customer's credits, rename their project, or publish to their channel.
 */

import { createHmac } from "node:crypto";
import { cookies } from "next/headers";

import type { Session } from "next-auth";

import { secretEquals } from "@/lib/secret-compare";

export const VIEW_AS_COOKIE = "jelly_view_as";
/** 2 hours. Long enough for a support session, short enough to forget about. */
export const VIEW_AS_MAX_AGE = 60 * 60 * 2;

function sign(targetUserId: string, iat: number): string {
  const secret = process.env.AUTH_SECRET || "";
  return createHmac("sha256", secret)
    .update(`jelly-view-as:${targetUserId}:${iat}`)
    .digest("base64url");
}

export function buildViewAsToken(
  targetUserId: string,
  iat = Math.floor(Date.now() / 1000),
): string {
  return `${targetUserId}.${iat}.${sign(targetUserId, iat)}`;
}

/** Verify signature + expiry. Returns the impersonated user id, or null. */
export function parseViewAsToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [targetUserId, iatRaw, sig] = parts;
  if (!targetUserId || !sig) return null;

  const iat = Number(iatRaw);
  if (!Number.isInteger(iat) || iat <= 0) return null;

  // Expired (or clock-skewed into the future by more than a minute) → reject
  // before spending an HMAC.
  const ageSeconds = Math.floor(Date.now() / 1000) - iat;
  if (ageSeconds > VIEW_AS_MAX_AGE || ageSeconds < -60) return null;

  if (!secretEquals(sig, sign(targetUserId, iat))) return null;
  return targetUserId;
}

type CookieShape = {
  name: string;
  value: string;
  maxAge: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
};

export function buildViewAsCookie(targetUserId: string): CookieShape {
  return {
    name: VIEW_AS_COOKIE,
    value: buildViewAsToken(targetUserId),
    maxAge: VIEW_AS_MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

export function clearViewAsCookie(): CookieShape {
  return {
    name: VIEW_AS_COOKIE,
    value: "",
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

/**
 * Read + verify the cookie from the ambient request.
 *
 * Returns null outside a request scope (e.g. a build-time render) rather than
 * throwing — `cookies()` is only legal inside one.
 */
export async function readViewAsUserId(): Promise<string | null> {
  try {
    const store = await cookies();
    return parseViewAsToken(store.get(VIEW_AS_COOKIE)?.value ?? null);
  } catch {
    return null;
  }
}

export interface VaterActor {
  /** Whose data this request should read. Already swapped when impersonating. */
  userId: string;
  email: string | null;
  isImpersonating: boolean;
  /** The real admin behind the session, when impersonating. */
  adminEmail: string | null;
}

/**
 * Who this request acts as.
 *
 * The swap itself already happened in the auth.ts session callback (which is
 * the only place that can check the REAL token email against the admin
 * allowlist), so this is a thin, allocation-free read of the session it
 * produced. Route handlers call this instead of reaching for session.user.id
 * directly, so "acting as" is honoured consistently and shows up in one grep.
 */
export function resolveActor(session: Session | null | undefined): VaterActor | null {
  const userId = session?.user?.id;
  if (!userId) return null;
  const impersonatedBy = session?.impersonatedBy ?? null;
  return {
    userId,
    email: session?.user?.email ?? null,
    isImpersonating: Boolean(impersonatedBy),
    adminEmail: impersonatedBy,
  };
}
