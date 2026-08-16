/**
 * POST /api/auth/password-reset/confirm  { token, password }
 *
 * Burns the reset token, replaces the password hash, and — the part that
 * makes this an actual security control rather than a convenience — bumps
 * User.sessionVersion so every JWT minted before now stops validating.
 *
 * Without that bump, resetting a password logged nobody out: sessions are
 * 30-day JWTs with nothing server-side behind them, so an attacker holding a
 * stolen cookie kept it for a month after the victim did the one thing
 * everyone assumes fixes exactly that. See lib/auth/session-version.ts.
 *
 * Rate limited on the IP so the token space can't be walked.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { rateLimitByIp } from "@/lib/rate-limit";
import { consumeResetToken } from "@/lib/auth/password-reset";
import { bumpSessionVersion } from "@/lib/auth/session-version";
import { queueVaterEvent } from "@/lib/vater/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INVALID = {
  error:
    "That reset link is invalid or has expired. Request a new one — links last one hour and work once.",
} as const;

export async function POST(request: NextRequest) {
  const limited = await rateLimitByIp(request, "auth:password-reset-confirm", 10, 3600);
  if (limited) return limited;

  let token = "";
  let password = "";
  try {
    const body = (await request.json()) as { token?: unknown; password?: unknown };
    token = typeof body.token === "string" ? body.token.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json(INVALID, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    // Single-use: the token is deleted here, before anything else happens, so
    // a double-submit can't run the reset twice.
    const consumed = await consumeResetToken(token);
    if (!consumed) {
      return NextResponse.json(INVALID, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: consumed.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(INVALID, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    // upsert, not update: an account that had no CredentialAuth row (e.g.
    // magic-link only) can't reach here — the request route refuses to mail
    // it a link — but if that ever changes, upsert is the correct behaviour.
    await prisma.credentialAuth.upsert({
      where: { userId: user.id },
      create: { userId: user.id, passwordHash },
      update: { passwordHash },
    });

    const revoked = await bumpSessionVersion(user.id);
    if (!revoked) {
      console.warn(
        "[password-reset] sessionVersion NOT bumped for",
        user.id,
        "— existing sessions stay valid until migration 20260815_beta_invites is applied",
      );
    }

    queueVaterEvent({
      userId: user.id,
      kind: "password.reset.completed",
      message: revoked
        ? "Password changed. All other sessions were signed out."
        : "Password changed.",
      level: "warn",
      data: { sessionsRevoked: revoked },
    });

    return NextResponse.json({
      ok: true,
      /* The UI tells the truth about the blast radius rather than promising a
       * revocation that didn't happen. */
      sessionsRevoked: revoked,
      message: revoked
        ? "Password updated. Every other device has been signed out."
        : "Password updated.",
    });
  } catch (error) {
    console.error("[password-reset] confirm failed", error);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 },
    );
  }
}
