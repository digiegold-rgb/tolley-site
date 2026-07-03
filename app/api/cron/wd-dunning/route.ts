import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { draftDunning } from "@/lib/wd/messaging";

export const runtime = "nodejs";

/**
 * GET /api/cron/wd-dunning — daily. Walks the failed-payment ladder for any
 * W/D client whose last payment failed and drafts the next escalation step
 * (stage 2 follow-up, stage 3 past-due) if one isn't already queued. Stage 1
 * is drafted immediately by the webhook on first failure. Draft only.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const failing = await prisma.wdClient.findMany({
    where: {
      active: true,
      lastPaymentStatus: "failed",
      subscriptionStatus: { in: ["past_due", "unpaid"] },
    },
  });

  let drafted = 0;
  for (const c of failing) {
    const stage = Math.min(Math.max(c.dunningStage, 1), 3);

    // Don't duplicate a draft for the same stage.
    const existing = await prisma.wdMessage.count({
      where: {
        clientId: c.id,
        kind: "dunning",
        status: { not: "skipped" },
        meta: { path: ["stage"], equals: stage },
      },
    });
    if (existing > 0) continue;

    const ids = await draftDunning(c, stage);
    if (ids.length) drafted += ids.length;
  }

  return NextResponse.json({ ok: true, drafted, failing: failing.length });
}
