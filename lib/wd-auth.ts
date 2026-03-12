import { cookies } from "next/headers";

const COOKIE_NAME = "wd_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type WdRole = "tolley" | "keegan";

export function verifyWdPin(pin: string): { valid: boolean; role: WdRole | null } {
  if (pin === process.env.WD_ADMIN_PIN_TOLLEY) return { valid: true, role: "tolley" };
  if (pin === process.env.WD_ADMIN_PIN_KEEGAN) return { valid: true, role: "keegan" };
  return { valid: false, role: null };
}

function buildToken(role: WdRole, pin: string): string {
  return Buffer.from(`wd:${role}:${pin}:admin`).toString("base64url");
}

export async function validateWdAdmin(): Promise<{ authed: boolean; role: WdRole | null }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME);
  if (!token?.value) return { authed: false, role: null };

  // Check against both PINs
  const tolleyPin = process.env.WD_ADMIN_PIN_TOLLEY;
  const keeganPin = process.env.WD_ADMIN_PIN_KEEGAN;

  if (tolleyPin && token.value === buildToken("tolley", tolleyPin)) {
    return { authed: true, role: "tolley" };
  }
  if (keeganPin && token.value === buildToken("keegan", keeganPin)) {
    return { authed: true, role: "keegan" };
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
  const pin = role === "tolley"
    ? process.env.WD_ADMIN_PIN_TOLLEY!
    : process.env.WD_ADMIN_PIN_KEEGAN!;

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
