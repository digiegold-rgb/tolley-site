import { NextRequest, NextResponse } from "next/server";
import { runPoolsIntelligence } from "@/lib/pools-intelligence";

export const maxDuration = 120;

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

  try {
    const result = await runPoolsIntelligence();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    console.error("[pools-intelligence] Error:", err);
    return NextResponse.json(
      { error: "Intelligence run failed", details: String(err) },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
