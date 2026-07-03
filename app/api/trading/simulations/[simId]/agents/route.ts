import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

const SYNC_SECRET = process.env.SYNC_SECRET || "";
const MIROFISH_URL = process.env.MIROFISH_ENGINE_URL || "http://localhost:8954";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ simId: string }> }
) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { simId } = await params;

  try {
    const res = await fetch(`${MIROFISH_URL}/simulations/${simId}/agents`, {
      headers: { "x-sync-secret": SYNC_SECRET },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `MiroFish returned ${res.status}` },
        { status: res.status }
      );
    }

    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(
      { error: "MiroFish unavailable" },
      { status: 503 }
    );
  }
}
