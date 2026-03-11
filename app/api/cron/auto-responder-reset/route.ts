import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/cron/auto-responder-reset
 *
 * Daily cron to reset all sentToday counters to 0.
 * Should run at midnight or early morning.
 *
 * Auth: x-sync-secret or Vercel cron auth
 */
export async function POST(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader =
    request.headers.get("x-sync-secret") ||
    request.headers.get("authorization")?.replace("Bearer ", "");
  if (!syncSecret || authHeader !== syncSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.autoResponder.updateMany({
    where: { sentToday: { gt: 0 } },
    data: { sentToday: 0 },
  });

  return NextResponse.json({
    ok: true,
    reset: result.count,
  });
}
