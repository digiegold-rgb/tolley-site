import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

const ENGINE_URL = process.env.CRYPTO_ENGINE_URL || "http://localhost:8950";
const SYNC_SECRET = process.env.SYNC_SECRET || "";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") || "overview";

  const endpoints: Record<string, string> = {
    overview: "/market/overview",
    gainers: "/market/gainers-losers",
    futures: "/market/futures",
    discovery: "/discovery",
    tv: "/signals/tv",
    sentiment: "/sentiment",
    sources: "/data-sources",
  };

  const path = endpoints[view];
  if (!path) {
    return NextResponse.json({ error: "Invalid view" }, { status: 400 });
  }

  try {
    const res = await fetch(`${ENGINE_URL}${path}`, {
      headers: { "x-sync-secret": SYNC_SECRET },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Engine unavailable" }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Engine offline" }, { status: 502 });
  }
}
