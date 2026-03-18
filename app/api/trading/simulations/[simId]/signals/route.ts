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

  // Get signals from DB
  const signals = await prisma.tradingSimulationSignal.findMany({
    where: { simulationId: simId },
    orderBy: { createdAt: "desc" },
  });

  if (signals.length > 0) {
    return NextResponse.json({ simulationId: simId, signals });
  }

  // Fallback to MiroFish live
  try {
    const res = await fetch(`${MIROFISH_URL}/simulations/${simId}/signals`, {
      headers: { "x-sync-secret": SYNC_SECRET },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) return NextResponse.json(await res.json());
  } catch {}

  return NextResponse.json({ simulationId: simId, signals: [] });
}
