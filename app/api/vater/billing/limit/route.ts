/**
 * POST /api/vater/billing/limit
 *
 * Update the user's monthly spending cap (cents). Enforced app-side by
 * checkBudget(). Stripe doesn't enforce — this is purely a user safeguard.
 *
 * Body: { limitCents: number }
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { VATER_DEFAULT_MONTHLY_LIMIT_CENTS } from "@/lib/vater-subscription";

export const runtime = "nodejs";

const MIN_LIMIT_CENTS = 5000; //   $50.00 — sanity floor
const MAX_LIMIT_CENTS = 5000000; // $50,000.00 — sanity ceiling

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { limitCents?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const raw = body.limitCents;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return NextResponse.json(
      { error: "limitCents must be a number" },
      { status: 400 },
    );
  }
  const limitCents = Math.round(raw);
  if (limitCents < MIN_LIMIT_CENTS || limitCents > MAX_LIMIT_CENTS) {
    return NextResponse.json(
      {
        error: `limitCents must be between ${MIN_LIMIT_CENTS} and ${MAX_LIMIT_CENTS}`,
      },
      { status: 400 },
    );
  }

  const result = await prisma.vaterMonthlyLimit.upsert({
    where: { userId },
    create: {
      userId,
      limitCents,
      periodStart: new Date(),
    },
    update: {
      limitCents,
      raisedAt: new Date(),
    },
  });

  return NextResponse.json({
    limitCents: result.limitCents,
    defaultLimitCents: VATER_DEFAULT_MONTHLY_LIMIT_CENTS,
  });
}
