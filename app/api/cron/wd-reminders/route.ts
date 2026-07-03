import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { draftReminder } from "@/lib/wd/messaging";

export const runtime = "nodejs";

/**
 * GET /api/cron/wd-reminders — daily. Drafts a friendly "renews in ~3 days"
 * SMS for active W/D subscriptions, once per billing period. Draft only;
 * Tolley taps Send in /wd/admin (approve-send mode).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

  const candidates = await prisma.wdClient.findMany({
    where: {
      active: true,
      subscriptionStatus: { in: ["active", "trialing"] },
      cancelAtPeriodEnd: false,
      currentPeriodEnd: { gte: windowStart, lte: windowEnd },
      phone: { not: null },
    },
  });

  let drafted = 0;
  for (const c of candidates) {
    // Once per period: skip if we already drafted for this currentPeriodEnd.
    if (
      c.reminderSentForPeriod &&
      c.currentPeriodEnd &&
      c.reminderSentForPeriod.getTime() === c.currentPeriodEnd.getTime()
    ) {
      continue;
    }
    const id = await draftReminder(c);
    if (id) {
      drafted++;
      await prisma.wdClient.update({
        where: { id: c.id },
        data: { reminderSentForPeriod: c.currentPeriodEnd },
      });
    }
  }

  return NextResponse.json({ ok: true, drafted, checked: candidates.length });
}
