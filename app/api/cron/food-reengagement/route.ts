/**
 * GET /api/cron/food-reengagement
 *
 * Daily cron. Finds Ruthann's Kitchen households that look stuck — trialing,
 * 3+ days quiet, and have never logged a single cook — and sends one nudge
 * email. Idempotent via reengagementEmailSentAt: each household receives at
 * most one re-engagement email per 30-day cycle.
 *
 * Vercel cron auth: Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  sendReengagementEmail,
  type ReengagementSuggestion,
} from "@/lib/food/email";

export const runtime = "nodejs";

const STALE_DAYS = 3;
const RESEND_GUARD_DAYS = 30;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const staleThreshold = new Date(now.getTime() - STALE_DAYS * 86_400_000);
  const resendThreshold = new Date(
    now.getTime() - RESEND_GUARD_DAYS * 86_400_000,
  );

  const households = await prisma.foodHousehold.findMany({
    where: {
      subscriptionStatus: { in: ["trialing", "active"] },
      OR: [
        { lastActiveAt: null, createdAt: { lt: staleThreshold } },
        { lastActiveAt: { lt: staleThreshold } },
      ],
      AND: [
        {
          OR: [
            { reengagementEmailSentAt: null },
            { reengagementEmailSentAt: { lt: resendThreshold } },
          ],
        },
      ],
    },
    select: {
      id: true,
      userId: true,
      lastActiveAt: true,
      createdAt: true,
    },
    take: 200,
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const household of households) {
    try {
      const hasCookLog = await prisma.foodCookLog.findFirst({
        where: { recipe: { householdId: household.id } },
        select: { id: true },
      });
      if (hasCookLog) {
        skipped += 1;
        continue;
      }

      const user = await prisma.user.findUnique({
        where: { id: household.userId },
        select: { email: true },
      });
      if (!user?.email) {
        skipped += 1;
        continue;
      }

      const recipes = await prisma.foodRecipe.findMany({
        where: { householdId: household.id },
        orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
        take: 3,
        select: {
          title: true,
          slug: true,
          prepTime: true,
          cookTime: true,
        },
      });

      const suggestions: ReengagementSuggestion[] = recipes.map((r) => ({
        title: r.title,
        slug: r.slug,
        totalMinutes:
          r.prepTime || r.cookTime
            ? (r.prepTime ?? 0) + (r.cookTime ?? 0)
            : null,
      }));

      await sendReengagementEmail(user.email, suggestions);
      await prisma.foodHousehold.update({
        where: { id: household.id },
        data: { reengagementEmailSentAt: now },
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.warn(
        `[cron food-reengagement] failed for household ${household.id}`,
        err,
      );
    }
  }

  return NextResponse.json({
    checked: households.length,
    sent,
    skipped,
    failed,
  });
}
