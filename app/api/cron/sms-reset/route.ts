import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const syncHeader = req.headers.get("x-sync-secret");

  const cronOk =
    process.env.CRON_SECRET &&
    authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const syncOk =
    process.env.SYNC_SECRET && syncHeader === process.env.SYNC_SECRET;

  if (!cronOk && !syncOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.leadSubscriber.updateMany({
    where: { status: "active" },
    data: { smsUsed: 0 },
  });

  return NextResponse.json({ ok: true, reset: result.count });
}
