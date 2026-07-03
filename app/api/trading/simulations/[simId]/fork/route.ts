import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";

const SYNC_SECRET = process.env.SYNC_SECRET || "";
const MIROFISH_URL = process.env.MIROFISH_ENGINE_URL || "http://localhost:8954";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ simId: string }> }
) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { simId } = await params;
  const body = await request.json();

  try {
    const res = await fetch(`${MIROFISH_URL}/simulations/${simId}/fork`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": SYNC_SECRET,
      },
      body: JSON.stringify({
        fork_at_round: body.forkAtRound,
        counterfactual: body.counterfactual,
      }),
      signal: AbortSignal.timeout(15000),
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
      { error: "MiroFish fork unavailable" },
      { status: 503 }
    );
  }
}
