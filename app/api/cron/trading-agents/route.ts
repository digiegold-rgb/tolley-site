import { NextRequest, NextResponse } from "next/server";
import { TIER1_TICKERS } from "@/lib/trading/aiResearch";

export const runtime = "nodejs";
export const maxDuration = 30;

const SERVICE_URL =
  process.env.TRADING_AGENTS_URL || "https://tradingagents.tolley.io";

export async function GET(request: NextRequest) {
  const cronOk =
    process.env.CRON_SECRET &&
    request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  if (!cronOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tickerParam = url.searchParams.get("ticker");
  const runDate =
    url.searchParams.get("date") ||
    new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);

  const tickers = tickerParam
    ? [tickerParam.toUpperCase()]
    : TIER1_TICKERS;

  const statusRes = await fetch(`${SERVICE_URL}/status`, {
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!statusRes || !statusRes.ok) {
    return NextResponse.json(
      { error: "TradingAgents service unreachable", url: SERVICE_URL },
      { status: 502 },
    );
  }

  // DGX queues all tickers and persists each to Neon as it completes.
  // No polling: local Qwen3.6 is ~2.5h/ticker, ~25h for tier1, longer than
  // any Vercel function lifetime. after() gets killed at maxDuration.
  const batchRes = await fetch(`${SERVICE_URL}/run-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tickers,
      date: runDate,
      skip_completed: true,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!batchRes.ok) {
    const body = await batchRes.text().catch(() => "");
    return NextResponse.json(
      { error: "run-batch enqueue failed", status: batchRes.status, body },
      { status: 502 },
    );
  }

  const batch = await batchRes.json();
  return NextResponse.json({
    runDate,
    requested: tickers.length,
    queued: batch.queued?.length ?? 0,
    skipped: batch.skipped?.length ?? 0,
    detail: batch,
  });
}
