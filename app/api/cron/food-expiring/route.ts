/**
 * GET /api/cron/food-expiring
 *
 * Daily cron. For every active/trialing household with pantry items expiring
 * in the next 3 days, send a digest email with the list and a CTA to the
 * "tonight" recipe-suggestions page.
 *
 * Vercel cron auth: Authorization: Bearer CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  sendExpiringItemsEmail,
  type ExpiringItemSummary,
} from "@/lib/food/email";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Only notify paying/trialing households. Past-due and canceled get nothing.
  const households = await prisma.foodHousehold.findMany({
    where: {
      subscriptionStatus: { in: ["active", "trialing"] },
    },
    select: {
      id: true,
      userId: true,
      pantryItems: {
        where: {
          status: { not: "out_of_stock" },
          expiresAt: { lte: cutoff, gte: now },
        },
        orderBy: { expiresAt: "asc" },
        take: 25,
      },
    },
  });

  let notified = 0;
  let skipped = 0;
  let failed = 0;

  for (const household of households) {
    if (household.pantryItems.length === 0) {
      skipped += 1;
      continue;
    }
    try {
      const user = await prisma.user.findUnique({
        where: { id: household.userId },
        select: { email: true },
      });
      if (!user?.email) {
        skipped += 1;
        continue;
      }
      const items: ExpiringItemSummary[] = household.pantryItems.map((p) => ({
        name: p.name,
        daysLeft: p.expiresAt
          ? Math.max(
              0,
              Math.ceil(
                (p.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              )
            )
          : 0,
        location: p.location,
      }));
      await sendExpiringItemsEmail(user.email, items);
      notified += 1;
    } catch (err) {
      failed += 1;
      console.warn(
        `[cron food-expiring] failed for household ${household.id}`,
        err
      );
    }
  }

  return NextResponse.json({
    households: households.length,
    notified,
    skipped,
    failed,
  });
}
