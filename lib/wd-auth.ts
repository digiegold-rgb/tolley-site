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

// HMAC token — capturing the cookie no longer reveals the PIN (see shop-auth).
function buildToken(role: WdRole, pin: string): string {
  const secret = process.env.AUTH_SECRET || "";
  return createHmac("sha256", secret).update(`wd-admin:${role}:${pin}`).digest("base64url");
}

export async function validateWdAdmin(): Promise<{ authed: boolean; role: WdRole | null }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME);
  if (!token?.value) return { authed: false, role: null };

  const tolleyPin = process.env.WD_ADMIN_PIN_TOLLEY;

  if (tolleyPin && secretEquals(token.value, buildToken("tolley", tolleyPin))) {
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
