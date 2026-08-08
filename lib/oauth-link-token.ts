import { createHmac } from "node:crypto";
import { secretEquals } from "@/lib/secret-compare";

/**
 * Short-lived signed tokens for the social OAuth "magic links". Replaces the
 * old ?key=<SYNC_SECRET> pattern, which put the permanent secret into access
 * logs, browser history, and Referer headers. A link token is `<expiry>.<hmac>`
 * — useless after expiry and never grants anything beyond starting one OAuth
 * flow. Mint via GET /api/social/oauth/link (admin session or x-sync-secret).
 */

const secret = () => process.env.AUTH_SECRET || process.env.SYNC_SECRET || "";

const sign = (provider: string, exp: number) =>
  createHmac("sha256", secret()).update(`oauth-link:${provider}:${exp}`).digest("hex");

// 24h default: links get sent over Telegram and may not be clicked same-hour.
export function mintOauthLinkToken(provider: string, ttlMs = 24 * 60 * 60 * 1000): string {
  if (!secret()) throw new Error("AUTH_SECRET/SYNC_SECRET not set — cannot mint oauth link token");
  const exp = Date.now() + ttlMs;
  return `${exp}.${sign(provider, exp)}`;
}

export function verifyOauthLinkToken(
  provider: string,
  token: string | null | undefined,
): boolean {
  if (!token || !secret()) return false;
  const [expStr, mac] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return secretEquals(mac, sign(provider, exp));
}
