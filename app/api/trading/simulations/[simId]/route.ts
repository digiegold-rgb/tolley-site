import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const SYNC_SECRET = process.env.SYNC_SECRET || "";
const MIROFISH_URL = process.env.MIROFISH_ENGINE_URL || "http://localhost:8954";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ simId: string }> }
) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { simId } = await params;

  // Try DB first
  const dbSim = await prisma.tradingSimulation.findFirst({
    where: { simulationId: simId },
  });

  if (dbSim) {
    return NextResponse.json(dbSim);
  }

  // Fallback to live fetch from MiroFish
  try {
    const res = await fetch(`${MIROFISH_URL}/simulations/${simId}`, {
      headers: { "x-sync-secret": SYNC_SECRET },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      return NextResponse.json(await res.json());
    }
    return NextResponse.json({ error: "Simulation not found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "MiroFish unavailable" }, { status: 503 });
  }
}
