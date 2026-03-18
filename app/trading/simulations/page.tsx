import { requireAdminPageSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import SimulationDashboard from "@/components/trading/SimulationDashboard";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export default async function SimulationsPage() {
  await requireAdminPageSession("/trading/simulations");

  const simulations = await prisma.tradingSimulation.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const serialized = simulations.map((s) => ({
    id: s.id,
    simulationId: s.simulationId,
    event: s.event,
    eventType: s.eventType,
    triggerType: s.triggerType,
    status: s.status,
    agentCount: s.agentCount,
    roundCount: s.roundCount,
    currentRound: s.currentRound,
    signals: s.signals as any,
    report: s.report,
    startedAt: s.startedAt?.toISOString() || null,
    completedAt: s.completedAt?.toISOString() || null,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/trading"
          className="text-xs text-white/20 hover:text-amber-400/60 transition-colors"
        >
          &larr; Trading Dashboard
        </Link>
      </div>
      <SimulationDashboard initialSimulations={serialized} />
    </div>
  );
}
