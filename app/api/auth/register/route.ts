import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { rateLimitByIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

type RegisterPayload = {
  email?: string;
  password?: string;
  /** Click-wrap stamp from the Jelly Studio signup (lib/legal-animate TOS_VERSION). */
  termsVersion?: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Rate limited to 5/hr per IP: signup is a public write that also runs a
// (deliberately slow) password hash, so it is both a spam and a CPU target.
export async function POST(request: Request) {
  try {
    const limited = await rateLimitByIp(request, "auth:register", 5, 3600);
    if (limited) return limited;

    const payload = (await request.json()) as RegisterPayload;
    const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const termsVersion =
      typeof payload.termsVersion === "string" && payload.termsVersion.trim()
        ? payload.termsVersion.trim().slice(0, 32)
        : null;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);

    const outcome = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { email },
        include: {
          credentialAuth: true,
        },
      });

      // SECURITY (2026-08-15): never attach a password to a pre-existing User
      // row (magic-link / seeded / admin accounts with no credentials) — that
      // was an account-takeover vector. Existing email = 409, full stop.
      if (existingUser) {
        return { error: "ACCOUNT_EXISTS" as const };
      }

      const user = await tx.user.create({
        data: {
          email,
        },
      });

      await tx.credentialAuth.create({
        data: {
          userId: user.id,
          passwordHash,
        },
      });

      return {
        userId: user.id,
        email: user.email,
      };
    });

    if ("error" in outcome) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 },
      );
    }

    // Click-wrap stamp, recorded as a separate best-effort write. The columns
    // arrive with prisma/migrations/20260815_animate_terms; until that lands on
    // a given environment the UPDATE fails, and a failed acceptance stamp must
    // never cost the user their account — so it is raw SQL (the generated
    // client may not know the columns yet) inside its own try/catch.
    if (termsVersion) {
      try {
        await prisma.$executeRaw`
          UPDATE "User"
             SET "termsAcceptedAt" = NOW(),
                 "termsVersion" = ${termsVersion}
           WHERE "id" = ${outcome.userId}
        `;
      } catch (stampError) {
        console.error("register: terms acceptance stamp failed", stampError);
      }
    }

    return NextResponse.json({
      ok: true,
      userId: outcome.userId,
      email: outcome.email,
    });
  } catch (error) {
    console.error("register route error", error);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 },
    );
  }
}
