import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { PlannerEvent } from "./planner-schema";

export async function savePlannerEvents(events: PlannerEvent[]) {
  const json = (x: unknown) => x as Prisma.InputJsonValue;
  await prisma.$transaction(async tx => {
    for (const e of events) {
      if (e.kind === "learned") {
        await tx.heatLearned.upsert({ where: { id: e.id }, update: {}, create: {
          id: e.id, ts: new Date(e.ts), season: e.season, param: e.param!, key: e.key!, value: e.value!, n: e.n!, prevValue: e.prev_value,
        } });
      } else {
        await tx.heatDecision.upsert({ where: { id: e.id }, update: {}, create: {
          id: e.id, ts: new Date(e.ts), kind: e.kind, season: e.season, mode: e.mode,
          period: e.period, reasonCode: e.reason_code, why: e.why, payload: json(e),
        } });
      }
      if (e.kind === "command_ack") {
        await tx.heatCommand.updateMany({ where: { id: e.command_id, status: "queued" }, data: { status: e.result } });
      }
      if (e.kind === "daily_model" && typeof e.daily?.date === "string") {
        await tx.heatDay.updateMany({ where: { date: e.daily.date }, data: { planner: json(e.daily) } });
      }
    }
    const cutoff = new Date(Date.now() - 2 * 366 * 86400_000);
    await tx.heatDecision.deleteMany({ where: { ts: { lt: cutoff } } });
    await tx.heatLearned.deleteMany({ where: { ts: { lt: cutoff } } });
  }, { timeout: 30_000 });
  return { event_ids: events.map(e => e.id) };
}

export async function loadPlannerView() {
  const [latest, decisions, learned, daily, commands, reliability, review] = await Promise.all([
    prisma.heatDecision.findFirst({ where: { kind: "decision" }, orderBy: { ts: "desc" } }),
    prisma.heatDecision.findMany({ where: { kind: { in: ["decision", "write_attempt", "watchdog"] } }, orderBy: { ts: "desc" }, take: 200 }),
    prisma.heatLearned.findMany({ orderBy: { ts: "desc" }, take: 500 }),
    prisma.heatDecision.findMany({ where: { kind: "daily_model" }, orderBy: { ts: "desc" }, take: 300 }),
    prisma.heatCommand.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.heatDecision.findMany({ where: { kind: "watchdog" }, orderBy: { ts: "desc" }, take: 1 }),
    prisma.heatDecision.findFirst({ where: { kind: "review_model" }, orderBy: { ts: "desc" } }),
  ]);
  const perDay = new Map<string, unknown>();
  for (const row of daily) {
    const e = row.payload as { daily?: { date?: string } };
    if (e.daily?.date && !perDay.has(e.daily.date)) perDay.set(e.daily.date, e.daily);
  }
  return {
    latest: latest?.payload ?? null, decisions: decisions.map(r => r.payload),
    learned, days: [...perDay.values()], commands,
    watchdog: reliability[0]?.payload ?? null,
    review: review?.payload ?? null,
    generatedAt: new Date().toISOString(),
  };
}
