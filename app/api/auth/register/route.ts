import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RegisterPayload = {
  email?: string;
  password?: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RegisterPayload;
    const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
    const password = typeof payload.password === "string" ? payload.password : "";

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

      if (existingUser?.credentialAuth) {
        return { error: "ACCOUNT_EXISTS" as const };
      }

      const user =
        existingUser ||
        (await tx.user.create({
          data: {
            email,
          },
        }));

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
