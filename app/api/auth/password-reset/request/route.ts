/**
 * POST /api/auth/password-reset/request  { email }
 *
 * Beta testers who lose their password had no way back in that didn't involve
 * Jared editing the database. This mails them a one-hour, single-use link.
 *
 * 🔴 ALWAYS ANSWERS 200. Not even for an unknown address, not for a
 * magic-link-only account, not when SMTP fails. Any of those distinctions
 * turns this endpoint into an account-existence oracle: POST an address, read
 * the status code, learn whether that person has an account here. The only
 * thing that changes the response is the rate limit.
 *
 * Rate limited 3/hour on the IP AND 3/hour on the email, independently:
 *   - per-IP stops one host enumerating many addresses,
 *   - per-email stops many hosts mail-bombing one victim's inbox.
 *
 * The mail bypasses the HQ_EMAIL_ALLOWED_DOMAINS allowlist by design — see
 * the header of lib/auth/password-reset.ts.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimited } from "@/lib/rate-limit";
import { createResetToken, sendResetEmail } from "@/lib/auth/password-reset";
import { queueVaterEvent } from "@/lib/vater/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same body for every outcome. Do not add detail to this. */
const GENERIC_OK = {
  ok: true,
  message:
    "If an account exists for that email, a reset link is on its way. Check your inbox (and spam).",
} as const;

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function clientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  return (
    (xff ? xff.split(",")[0].trim() : null) ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Final fallback when no origin env is set. Never the request. */
const RESET_LINK_ORIGIN = "https://www.tolley.io";

/**
 * trim() per feedback_vercel_env_no_echo — env set via `echo | vercel env add`
 * carries a trailing newline that silently breaks the host.
 */
function cleanEnvUrl(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().replace(/\/+$/, "");
  return cleaned || null;
}

/**
 * Absolute base for the emailed reset link.
 *
 * 🔴 NEVER DERIVED FROM THE REQUEST. Using `request.nextUrl.origin` (or Host /
 * X-Forwarded-Host) is Host-header reset poisoning: an attacker POSTs a reset
 * for a victim's address with a forged Host header, and the victim receives a
 * genuine, valid token pointed at the attacker's domain. Nothing about the
 * token is wrong — only where the link goes — which is precisely what makes
 * the attack work and why it survives every other check in this route.
 *
 * Env-only, production origin as the last resort.
 *
 * ⚠️ Ordering deliberately differs from publicSiteUrl() in
 * lib/vater/site-url.ts, which prefers NEXT_PUBLIC_SITE_URL and will fall back
 * to VERCEL_URL. AUTH_URL comes first here because it is NextAuth's canonical
 * origin — the one guaranteed to match where /reset-password actually serves
 * and where the session cookie is scoped. VERCEL_URL is excluded on purpose:
 * a preview deployment must never mint links on a preview domain into real
 * users' mailboxes. Do not "simplify" this to the shared helper.
 */
function resetUrl(token: string): string {
  const base =
    cleanEnvUrl(process.env.AUTH_URL) ||
    cleanEnvUrl(process.env.NEXTAUTH_URL) ||
    cleanEnvUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    RESET_LINK_ORIGIN;
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function POST(request: NextRequest) {
  let email = "";
  try {
    const body = (await request.json()) as { email?: unknown };
    email = normalizeEmail(body.email);
  } catch {
    // Malformed body is still a 200 — see the oracle note above.
    return NextResponse.json(GENERIC_OK);
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json(GENERIC_OK);
  }

  // Rate limit is the ONE thing allowed to return something other than 200:
  // a 429 leaks nothing about whether the account exists.
  const ip = clientIp(request);
  const byIp = await consumeRateLimit(`pwreset:ip:${ip}`, 3, 3600);
  if (!byIp.allowed) return rateLimited(byIp);
  const byEmail = await consumeRateLimit(`pwreset:email:${email}`, 3, 3600);
  if (!byEmail.allowed) return rateLimited(byEmail);

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, credentialAuth: { select: { userId: true } } },
    });

    /* No account, or an account with no password to reset (magic-link only).
     * Both stop here silently. Sending a "you have no password" email would
     * be the same oracle by another channel. */
    if (!user?.credentialAuth) {
      console.info("[password-reset] request for address with no credential account");
      return NextResponse.json(GENERIC_OK);
    }

    const token = await createResetToken(email);
    await sendResetEmail(email, resetUrl(token));

    queueVaterEvent({
      userId: user.id,
      kind: "password.reset.requested",
      message: "Password reset link requested.",
      data: { ip },
    });
  } catch (error) {
    // Log loudly, answer identically. A user who never gets the mail retries;
    // an attacker learns nothing from the response either way.
    console.error("[password-reset] request failed", error);
  }

  return NextResponse.json(GENERIC_OK);
}
