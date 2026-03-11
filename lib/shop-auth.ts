import { cookies } from "next/headers";

const COOKIE_NAME = "shop_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function validateShopAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME);
  if (!token?.value) return false;
  return token.value === getExpectedToken();
}

export function getExpectedToken(): string {
  const pin = process.env.SHOP_ADMIN_PIN;
  if (!pin) throw new Error("SHOP_ADMIN_PIN not set");
  // Simple hash-like token derived from PIN — not cryptographic, just prevents raw PIN in cookie
  return Buffer.from(`shop:${pin}:admin`).toString("base64url");
}

export function verifyPin(pin: string): boolean {
  const expected = process.env.SHOP_ADMIN_PIN;
  if (!expected) return false;
  return pin === expected;
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
