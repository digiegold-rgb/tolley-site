import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const engineUrl = process.env.CRYPTO_ENGINE_URL || "http://localhost:8950";
  const syncSecret = process.env.SYNC_SECRET || "";

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") || "50";

  try {
    const res = await fetch(`${engineUrl}/optimizer/history?limit=${limit}`, {
      headers: { "x-sync-secret": syncSecret },
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
