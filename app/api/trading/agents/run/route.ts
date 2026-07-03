import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVICE_URL =
  process.env.TRADING_AGENTS_URL || "https://tradingagents.tolley.io";

export async function POST(request: NextRequest) {
  await requireAdminApiSession();

  const body = await request.json().catch(() => ({}));
  const ticker = String(body.ticker ?? "").toUpperCase().trim();
  const date = body.date ? String(body.date) : undefined;

  if (!ticker || !/^[A-Z.\-]{1,12}$/.test(ticker)) {
    return NextResponse.json({ error: "invalid ticker" }, { status: 400 });
  }

  const res = await fetch(`${SERVICE_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, ...(date ? { date } : {}) }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "service error", status: res.status, detail: text.slice(0, 500) },
      { status: 502 },
    );
  }

  return NextResponse.json(await res.json());
}

export async function GET() {
  await requireAdminApiSession();
  const res = await fetch(`${SERVICE_URL}/status`, {
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!res || !res.ok) {
    return NextResponse.json({ online: false }, { status: 200 });
  }
  const data = await res.json();
  return NextResponse.json({ online: true, ...data });
}
