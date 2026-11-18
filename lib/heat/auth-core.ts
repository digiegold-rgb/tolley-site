import { createHmac } from "node:crypto";
import { secretEquals } from "../secret-compare";

export const HEAT_COOKIE = "heat_access";
/** Same 7-day httpOnly lifetime as the /tv shop_admin cookie. */
export const HEAT_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/**
 * Cookie token = HMAC-SHA256(AUTH_SECRET, "heat:<PIN>"). The cookie does not
 * contain the PIN. Rotating AUTH_SECRET or HEAT_PIN invalidates sessions.
 */
export function heatCookieValue(): string {
  const pin = process.env.HEAT_PIN;
  const secret = process.env.AUTH_SECRET;
  if (!pin) throw new Error("HEAT_PIN not set");
  if (!secret) throw new Error("AUTH_SECRET not set");
  return createHmac("sha256", secret).update(`heat:${pin}`).digest("base64url");
}

export function heatPinMatches(pin: string): boolean {
  const expected = process.env.HEAT_PIN;
  if (!pin || !expected) return false;
  return secretEquals(pin, expected);
}

export function heatCookieOptions(): {
  name: string;
  value: string;
  maxAge: number;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
} {
  return {
    name: HEAT_COOKIE,
    value: heatCookieValue(),
    maxAge: HEAT_COOKIE_MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

export function heatIngestAuthorized(header: string | null): boolean {
  const expected = process.env.HEAT_INGEST_TOKEN;
  if (!expected || !header) return false;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return false;
  return secretEquals(match[1], expected);
}
