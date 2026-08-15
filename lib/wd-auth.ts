import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { secretEquals } from "@/lib/secret-compare";

const COOKIE_NAME = "wd_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type WdRole = "tolley";

export function verifyWdPin(pin: string): { valid: boolean; role: WdRole | null } {
  if (secretEquals(pin, process.env.WD_ADMIN_PIN_TOLLEY)) {
    return { valid: true, role: "tolley" };
  }
  return { valid: false, role: null };
}

/**
 * HMAC token — capturing the cookie no longer reveals the PIN (see shop-auth).
 *
 * The issued-at second is INSIDE the signed payload and repeated in the clear
 * as `<iat>.<sig>`, which buys two things the old pin-only token didn't have:
 *   1. Server-side expiry. maxAge is only a browser hint; a copied cookie used
 *      to be valid forever. Now anything older than COOKIE_MAX_AGE is rejected
 *      even if the client keeps presenting it.
 *   2. Real revocation. Rotating WD_ADMIN_PIN_TOLLEY or AUTH_SECRET changes the
 *      signature for every iat, so all outstanding cookies die at once.
 */
function signToken(role: WdRole, pin: string, iat: number): string {
  const secret = process.env.AUTH_SECRET || "";
  return createHmac("sha256", secret)
    .update(`wd-admin:${role}:${pin}:${iat}`)
    .digest("base64url");
}

function buildToken(role: WdRole, pin: string, iat = Math.floor(Date.now() / 1000)): string {
  return `${iat}.${signToken(role, pin, iat)}`;
}

export async function validateWdAdmin(): Promise<{ authed: boolean; role: WdRole | null }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME);
  if (!token?.value) return { authed: false, role: null };

  const tolleyPin = process.env.WD_ADMIN_PIN_TOLLEY;
  if (!tolleyPin) return { authed: false, role: null };

  const dot = token.value.indexOf(".");
  if (dot < 1) return { authed: false, role: null };

  const iat = Number(token.value.slice(0, dot));
  const sig = token.value.slice(dot + 1);
  if (!Number.isInteger(iat) || iat <= 0 || !sig) return { authed: false, role: null };

  // Expired (or clock-skewed into the future by more than a minute) → reject
  // before spending an HMAC.
  const ageSeconds = Math.floor(Date.now() / 1000) - iat;
  if (ageSeconds > COOKIE_MAX_AGE || ageSeconds < -60) {
    return { authed: false, role: null };
  }

  if (secretEquals(sig, signToken("tolley", tolleyPin, iat))) {
    return { authed: true, role: "tolley" };
  }

  return { authed: false, role: null };
}

export function buildWdAdminCookie(role: WdRole): {
  name: string;
  value: string;
  maxAge: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
} {
  const pin = process.env.WD_ADMIN_PIN_TOLLEY!;

  return {
    name: COOKIE_NAME,
    value: buildToken(role, pin),
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

/** Cookie shape that clears the admin session (same name/path, zero maxAge). */
export function clearWdAdminCookie(): {
  name: string;
  value: string;
  maxAge: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
} {
  return {
    name: COOKIE_NAME,
    value: "",
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}
