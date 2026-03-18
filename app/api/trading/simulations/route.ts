import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const SYNC_SECRET = process.env.SYNC_SECRET || "";
const MIROFISH_URL = process.env.MIROFISH_ENGINE_URL || "http://localhost:8954";

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: any = {};
  if (status) where.status = status;

  const simulations = await prisma.tradingSimulation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ simulations });
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdminApiSession();
  if (!adminCheck.ok) return adminCheck.response;

  const body = await request.json();
  const { event, agentCount, roundCount, targets, scenario, eventType } = body;

  if (!event) {
    return NextResponse.json({ error: "Event name required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${MIROFISH_URL}/simulate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-secret": SYNC_SECRET,
      },
      body: JSON.stringify({
        event,
        agent_count: agentCount || 50,
        round_count: roundCount || 20,
        targets: targets || ["crypto", "polymarket"],
        scenario: scenario || "",
        event_type: eventType || "manual",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `MiroFish returned ${res.status}` }, { status: 502 });
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: "MiroFish service unavailable", detail: String(e) },
      { status: 503 }
    );
  }
}
