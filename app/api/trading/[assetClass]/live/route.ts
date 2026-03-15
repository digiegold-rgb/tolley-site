import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

const SYNC_SECRET = process.env.SYNC_SECRET || "";
const ENGINE_URLS: Record<string, string> = {
  crypto: process.env.CRYPTO_ENGINE_URL || "http://localhost:8950",
  stocks_conservative: process.env.STOCKS_CONSERVATIVE_ENGINE_URL || "http://localhost:8951",
  stocks_aggressive: process.env.STOCKS_AGGRESSIVE_ENGINE_URL || "http://localhost:8952",
  polymarket: process.env.POLYMARKET_ENGINE_URL || "http://localhost:8953",
};

const VALID_ASSET_CLASSES = ["crypto", "stocks_conservative", "stocks_aggressive", "polymarket"];

interface RouteContext {
  params: Promise<{ assetClass: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { assetClass } = await context.params;

  if (!VALID_ASSET_CLASSES.includes(assetClass)) {
    return NextResponse.json({ error: "Invalid asset class" }, { status: 400 });
  }

  const engineUrl = ENGINE_URLS[assetClass];

  try {
    const res = await fetch(`${engineUrl}/status`, {
      headers: { "x-sync-secret": SYNC_SECRET },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Engine unavailable" }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Engine offline" }, { status: 502 });
  }
}
