import { NextRequest, NextResponse } from "next/server";
import { publishDuePosts } from "@/lib/content/scheduler";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/cron/content-publish
 * Runs every 5 minutes. Publishes scheduled content posts.
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

  const result = await publishDuePosts(20);
  return NextResponse.json({ ok: true, ...result });
}

/** Vercel cron calls GET by default */
export async function GET(request: NextRequest) {
  return POST(request);
}
