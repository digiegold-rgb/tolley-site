/**
 * GET /api/cron/food-trial-ending
 *
 * Daily cron. Finds Ruthann's Kitchen households whose trial ends in ~2 days
 * and sends them a reminder email. Idempotent within a 24h window because the
 * "2 days from now" window only matches each household once per trial.
 *
 * Vercel cron auth: Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendTrialEndingEmail } from "@/lib/food/email";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Window: trials ending between 36 and 60 hours from now (centered on 2 days).
  // Wide enough that a cron delay or clock skew doesn't miss the window,
  // narrow enough that the same household isn't hit on consecutive days.
  const now = new Date();
  const windowStart = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 60 * 60 * 60 * 1000);

  const households = await prisma.foodHousehold.findMany({
    where: {
      subscriptionStatus: "trialing",
      trialEndsAt: { gte: windowStart, lt: windowEnd },
    },
    select: {
      id: true,
      userId: true,
      trialEndsAt: true,
    },
  });

  let sent = 0;
  let failed = 0;

  for (const household of households) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: household.userId },
        select: { email: true },
      });
      if (!user?.email || !household.trialEndsAt) {
        continue;
      }
      const daysLeft = Math.ceil(
        (household.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      await sendTrialEndingEmail(user.email, Math.max(1, daysLeft));
      sent += 1;
    } catch (err) {
      failed += 1;
      console.warn(
        `[cron food-trial-ending] failed for household ${household.id}`,
        err
      );
    }
  }

  return NextResponse.json({
    checked: households.length,
    sent,
    failed,
  });
}
