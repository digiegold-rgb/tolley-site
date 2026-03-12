import { NextRequest, NextResponse } from "next/server";
import { refreshExpiringTokens } from "@/lib/content/scheduler";

export const runtime = "nodejs";

/**
 * POST /api/cron/token-refresh
 * Runs every 6 hours. Refreshes platform tokens expiring within 12 hours.
 * Auth: CRON_SECRET (Vercel) or x-sync-secret
 */
export async function POST(request: NextRequest) {
  const cronOk =
    process.env.CRON_SECRET &&
    request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  const syncOk =
    process.env.SYNC_SECRET &&
    request.headers.get("x-sync-secret") === process.env.SYNC_SECRET;

  if (!cronOk && !syncOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshExpiringTokens();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
