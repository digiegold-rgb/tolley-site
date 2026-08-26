/**
 * lib/vater/workspace-token.ts
 *
 * The PURE half of lib/vater/workspaces.ts — the signed `jelly_ws` cookie
 * that names which studio TAB a login is inside. No DB, no request scope,
 * so it is unit-testable and importable from proxy/edge code.
 *
 *   jelly_ws = "<wsUserId>.<hmac>"
 *   hmac     = HMAC-SHA256(AUTH_SECRET, "jelly-ws:<rootUserId>:<wsUserId>")
 *
 * The root is inside the signed payload but NOT in the cookie: a cookie is
 * only meaningful to the login that minted it.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Constant-time string compare (same contract as lib/secret-compare.ts,
 *  inlined so this module stays free of path aliases for `node --test`). */
function secretEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const WS_COOKIE = "jelly_ws";
/** One year — a preference, not a grant (the grant is the NextAuth session). */
export const WS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function sign(rootUserId: string, wsUserId: string): string {
  const secret = process.env.AUTH_SECRET || "";
  return createHmac("sha256", secret)
    .update(`jelly-ws:${rootUserId}:${wsUserId}`)
    .digest("base64url");
}

export function buildWsToken(rootUserId: string, wsUserId: string): string {
  return `${wsUserId}.${sign(rootUserId, wsUserId)}`;
}

/**
 * Verify a cookie value against the login presenting it. Returns the tab's
 * userId, or null for anything malformed, unsigned, or minted for a
 * different root. Pure — no DB, no request scope.
 */
export function parseWsToken(
  value: string | null | undefined,
  rootUserId: string | null | undefined,
): string | null {
  if (!value || !rootUserId) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [wsUserId, sig] = parts;
  if (!wsUserId || !sig) return null;
  if (!secretEquals(sig, sign(rootUserId, wsUserId))) return null;
  return wsUserId;
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

export function buildWsCookie(rootUserId: string, wsUserId: string): CookieShape {
  return {
    name: WS_COOKIE,
    value: buildWsToken(rootUserId, wsUserId),
    maxAge: WS_COOKIE_MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

export function clearWsCookie(): CookieShape {
  return {
    name: WS_COOKIE,
    value: "",
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

