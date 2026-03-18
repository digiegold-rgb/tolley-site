import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const SYNC_SECRET = process.env.SYNC_SECRET || "";
const MIROFISH_URL = process.env.MIROFISH_ENGINE_URL || "http://localhost:8954";

export async function GET(request: NextRequest) {
  const cronOk =
    process.env.CRON_SECRET &&
    request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
  const syncOk =
    process.env.SYNC_SECRET &&
    request.headers.get("x-sync-secret") === process.env.SYNC_SECRET;

  if (!cronOk && !syncOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let synced = 0;
  let signalsSynced = 0;

  try {
    // Fetch all simulations from MiroFish
    const res = await fetch(`${MIROFISH_URL}/simulations?limit=50`, {
      headers: { "x-sync-secret": SYNC_SECRET },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `MiroFish returned ${res.status}` });
    }

    const { simulations } = await res.json();

    for (const sim of simulations || []) {
      try {
        // Upsert simulation
        await prisma.tradingSimulation.upsert({
          where: { simulationId: sim.id },
          create: {
            simulationId: sim.id,
            event: sim.event,
            eventType: sim.event_type || "manual",
            triggerType: sim.trigger_type || "manual",
            status: sim.status,
            agentCount: sim.agent_count,
            roundCount: sim.round_count,
            currentRound: sim.current_round || 0,
            startedAt: sim.started_at ? new Date(sim.started_at) : null,
            completedAt: sim.completed_at ? new Date(sim.completed_at) : null,
          },
          update: {
            status: sim.status,
            currentRound: sim.current_round || 0,
            completedAt: sim.completed_at ? new Date(sim.completed_at) : null,
          },
        });
        synced++;

        // If completed, fetch full details with signals + report
        if (sim.status === "completed") {
          try {
            const detailRes = await fetch(`${MIROFISH_URL}/simulations/${sim.id}`, {
              headers: { "x-sync-secret": SYNC_SECRET },
              signal: AbortSignal.timeout(10000),
            });

            if (detailRes.ok) {
              const detail = await detailRes.json();

              // Update with signals and report
              await prisma.tradingSimulation.update({
                where: { simulationId: sim.id },
                data: {
                  signals: detail.signals || null,
                  report: detail.report || null,
                },
              });

              // Sync individual signals
              if (detail.signals?.signals) {
                for (const [engine, signal] of Object.entries(detail.signals.signals) as [string, any][]) {
                  const existing = await prisma.tradingSimulationSignal.findFirst({
                    where: { simulationId: sim.id, targetEngine: engine },
                  });

                  if (!existing) {
                    await prisma.tradingSimulationSignal.create({
                      data: {
                        simulationId: sim.id,
                        targetEngine: engine,
                        direction: signal.direction || "NEUTRAL",
                        confidence: signal.confidence || 0,
                        magnitude: signal.magnitude || null,
                        rationale: signal.rationale || null,
                        agentConsensus: detail.signals.agent_consensus || null,
                      },
                    });
                    signalsSynced++;
                  }
                }
              }
            }
          } catch (e) {
            console.error(`[sim-sync] Detail fetch failed for ${sim.id}:`, e);
          }
        }
      } catch (e) {
        console.error(`[sim-sync] Upsert failed for ${sim.id}:`, e);
      }
    }

    // Prune old simulations (keep 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    await prisma.tradingSimulation.deleteMany({
      where: { createdAt: { lt: ninetyDaysAgo } },
    });

  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }

  return NextResponse.json({
    ok: true,
    simulations_synced: synced,
    signals_synced: signalsSynced,
    synced_at: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
