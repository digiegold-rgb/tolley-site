import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin-auth";
import { createWeekdayDrop } from "@/lib/leads/weekday-drop";

export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const subscriberId = process.env.LEADS_DESK_SUBSCRIBER_ID;
  if (!subscriberId) return NextResponse.json({ error: "Owner desk is not configured" }, { status: 503 });
  try {
    const sub = await prisma.leadSubscriber.findUnique({ where: { id: subscriberId }, include: { user: { select: { email: true } } } });
    if (!sub || sub.status !== "active" || !isAdminEmail(sub.user.email)) return NextResponse.json({ error: "Active owner workspace required" }, { status: 403 });
    return NextResponse.json(await createWeekdayDrop(subscriberId));
  } catch {
    console.error("[weekday drop] Could not save owner desk drop");
    return NextResponse.json({ error: "Weekday drop failed; safe to retry" }, { status: 500 });
  }
}
