import { createHash, createHmac, timingSafeEqual } from "node:crypto";
export const MFA_COOKIE = "tolley_mfa";
export const MFA_MAX_AGE = 12 * 60 * 60;
const secret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";

export function enrollmentKey(mfa: { id: string; totpSecret: string }): string {
  return createHash("sha256").update(`${mfa.id}:${mfa.totpSecret}`).digest("hex");
}

export function signMfaProof(userId: string, sessionId: string, enrollment: string, now = Date.now()): string {
  if (!secret()) throw new Error("AUTH_SECRET required");
  const payload = Buffer.from(JSON.stringify({ userId, sessionId, enrollment,
    exp: Math.floor(now / 1000) + MFA_MAX_AGE })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(`mfa:${payload}`).digest("base64url")}`;
}

export function verifyMfaProof(value: string | undefined, userId: string, sessionId: string,
  enrollment: string, now = Date.now()): boolean {
  if (!value || value.length > 2048 || !secret()) return false;
  try {
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra) return false;
    const expected = createHmac("sha256", secret()).update(`mfa:${payload}`).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    const nowSeconds = Math.floor(now / 1000);
    return data.userId === userId && data.sessionId === sessionId && data.enrollment === enrollment
      && Number.isInteger(data.exp) && data.exp > nowSeconds && data.exp <= nowSeconds + MFA_MAX_AGE;
  } catch { return false; }
}
