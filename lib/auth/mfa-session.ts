import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { isVaterAdminEmail } from "@/lib/admin-auth";

import { MFA_COOKIE, MFA_MAX_AGE, enrollmentKey, verifyMfaProof } from "./mfa-proof";
export { MFA_COOKIE, MFA_MAX_AGE, enrollmentKey, signMfaProof, verifyMfaProof } from "./mfa-proof";
const secret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";

export async function requiresOwnerMfa(userId: string, email: string) {
  if (isVaterAdminEmail(email)) return true;
  const account = await prisma.vaterAccount.findUnique({ where: { userId }, select: { tier: true } });
  return account?.tier === "owner";
}

export const mfaRequirement = cache(async (userId: string, email: string, sessionId: string) => {
  const mfa = await prisma.userMfa.findUnique({ where: { userId } });
  if (!mfa?.verified) return (await requiresOwnerMfa(userId, email)) ? "setup" as const : null;
  const value = (await cookies()).get(MFA_COOKIE)?.value;
  return verifyMfaProof(value, userId, sessionId, enrollmentKey(mfa)) ? null : "verify" as const;
});

/** Primary identity only, never a workspace or impersonated customer. Used solely for MFA. */
export async function readMfaIdentity() {
  const h = await headers();
  const secureCookie = (h.get("cookie") || "").includes("__Secure-authjs.session-token");
  const cookieName = secureCookie ? "__Secure-authjs.session-token" : "authjs.session-token";
  const token = await getToken({ req: new Request("https://tolley.io", { headers: h }),
    secret: secret(), cookieName });
  if (!token?.sub || typeof token.authSessionId !== "string") return null;
  const user = await prisma.user.findUnique({ where: { id: token.sub },
    select: { id: true, email: true, sessionVersion: true } });
  if (!user || user.sessionVersion !== (token.sv ?? 0)) return null;
  return { userId: user.id, email: user.email || "", sessionId: token.authSessionId,
    fresh: typeof token.authAt === "number" && Date.now() / 1000 - token.authAt <= 20 * 60 };
}

export function mfaCookie(value: string) {
  return { name: MFA_COOKIE, value, httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const, path: "/", maxAge: MFA_MAX_AGE };
}

export function safeMfaDestination(value: string | undefined | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)
    || value.startsWith("/login") || value.startsWith("/api/")) return "/agent";
  return value;
}
