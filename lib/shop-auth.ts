import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { secretEquals } from "@/lib/secret-compare";

const COOKIE_NAME = "shop_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function validateShopAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME);
  if (!token?.value) return false;
  return secretEquals(token.value, getExpectedToken());
}

/**
 * Cookie token = HMAC-SHA256(AUTH_SECRET, "shop-admin:<PIN>"). Unlike the old
 * reversible base64, capturing the cookie does NOT reveal the PIN, and the
 * token rotates automatically if AUTH_SECRET is rotated. (Changing the scheme
 * invalidates existing cookies — admins re-enter the PIN once.)
 */
export function getExpectedToken(): string {
  const pin = process.env.SHOP_ADMIN_PIN;
  if (!pin) throw new Error("SHOP_ADMIN_PIN not set");
  const secret = process.env.AUTH_SECRET || "";
  return createHmac("sha256", secret).update(`shop-admin:${pin}`).digest("base64url");
}

export function verifyPin(pin: string): boolean {
  const expected = process.env.SHOP_ADMIN_PIN;
  if (!expected) return false;
  return secretEquals(pin, expected);
}

export function buildAdminCookie(): {
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
    value: getExpectedToken(),
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}
