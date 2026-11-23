import "server-only";

import { prisma } from "@/lib/prisma";
import type { HeatBatch, HeatDay, HeatRows, HeatSnapshot, Hvac } from "./types";
import { sampleHeatRows } from "./sample";
import { ensureLoftFanColumns } from "./ensure-columns";
import { FAN_HISTORY_DAYS, SNAPSHOT_RETENTION_MS } from "./time";
import { buildHeatView, emptyHeatView } from "./view";
import type { HeatView } from "./types";

type SnapshotRow = {
  recordedAt: Date;
  kitchenF: number | null;
  loftF: number | null;
  kitchenRh: number | null;
  loftRh: number | null;
  outdoorF: number | null;
  upSetpoint: number | null;
  upMode: string | null;
  upHvac: string;
  upFanMode: string | null;
  downSetpoint: number | null;
  downMode: string | null;
  downHvac: string;
  downFanMode: string | null;
  loftFanOn: boolean | null;
  loftFanW: number | null;
  loftFanEnergyWh: number | null;
  loftFanDecision: string | null;
  humidOn?: boolean | null;
  humidTargetRh?: number | null;
  humidTodayH?: number | null;
  humidDecision?: string | null;
};

function hvacOf(value: string): Hvac {
  return value === "heat" || value === "fan" || value === "off" ? value : "off";
}

function fromSnapshot(row: SnapshotRow): HeatSnapshot {
  return {
    recordedAt: row.recordedAt.toISOString(),
    kitchenF: row.kitchenF,
    loftF: row.loftF,
    kitchenRh: row.kitchenRh,
    loftRh: row.loftRh,
    outdoorF: row.outdoorF,
    upstairs: {
      setpoint: row.upSetpoint,
      mode: row.upMode,
      hvac: hvacOf(row.upHvac),
      fanMode: row.upFanMode,
    },
    downstairs: {
      setpoint: row.downSetpoint,
      mode: row.downMode,
      hvac: hvacOf(row.downHvac),
      fanMode: row.downFanMode,
    },
    loftFan: {
      on: row.loftFanOn,
      watts: row.loftFanW,
      energyWh: row.loftFanEnergyWh,
      decision: row.loftFanDecision,
    },
    humid: {
      on: row.humidOn ?? null,
      targetRh: row.humidTargetRh ?? null,
      todayH: row.humidTodayH ?? null,
      decision: row.humidDecision ?? null,
    },
  };
}

function snapshotData(row: HeatSnapshot) {
  return {
    recordedAt: new Date(row.recordedAt),
    kitchenF: row.kitchenF,
    loftF: row.loftF,
    kitchenRh: row.kitchenRh,
    loftRh: row.loftRh,
    outdoorF: row.outdoorF,
    upSetpoint: row.upstairs.setpoint,
    upMode: row.upstairs.mode,
    upHvac: row.upstairs.hvac,
    upFanMode: row.upstairs.fanMode,
    downSetpoint: row.downstairs.setpoint,
    downMode: row.downstairs.mode,
    downHvac: row.downstairs.hvac,
    downFanMode: row.downstairs.fanMode,
    loftFanOn: row.loftFan.on,
    loftFanW: row.loftFan.watts,
    loftFanEnergyWh: row.loftFan.energyWh,
    loftFanDecision: row.loftFan.decision,
    humidOn: row.humid?.on ?? null,
    humidTargetRh: row.humid?.targetRh ?? null,
    humidTodayH: row.humid?.todayH ?? null,
    humidDecision: row.humid?.decision ?? null,
  };
}

function dayData(row: HeatDay) {
  return {
    date: row.date,
    upstairsHeatH: row.upstairsHeatH,
    downstairsHeatH: row.downstairsHeatH,
    upstairsCycles: row.upstairsCycles,
    downstairsCycles: row.downstairsCycles,
    outdoorLow: row.outdoorLow,
    outdoorHigh: row.outdoorHigh,
    outdoorAvg: row.outdoorAvg,
    hdd65: row.hdd65,
    estThermsLow: row.estThermsLow,
    estThermsHigh: row.estThermsHigh,
    estCostLow: row.estCostLow,
    estCostHigh: row.estCostHigh,
    ccfPerHdd: row.ccfPerHdd,
    humidOnH: row.humidOnH ?? null,
    humidCycles: row.humidCycles ?? null,
    humidKwh: row.humidKwh ?? null,
    humidCost: row.humidCost ?? null,
    humidWaterGal: row.humidWaterGal ?? null,
  };
}

export async function readHeatRows(now: Date): Promise<HeatRows> {
  await ensureLoftFanColumns();
  const since = new Date(now.getTime() - FAN_HISTORY_DAYS * 24 * 60 * 60 * 1000);
  const [latest, snapshots, days, review] = await Promise.all([
    prisma.heatSnapshot.findFirst({ orderBy: { recordedAt: "desc" } }),
    prisma.heatSnapshot.findMany({ where: { recordedAt: { gte: since } }, orderBy: { recordedAt: "asc" } }),
    prisma.heatDay.findMany({ orderBy: { date: "asc" } }),
    prisma.heatReview.findFirst({ orderBy: { date: "desc" } }),
  ]);
  return {
    latest: latest ? fromSnapshot(latest) : null,
    snapshots: snapshots.map(fromSnapshot),
    days: days.map((row) => ({
      date: row.date,
      upstairsHeatH: row.upstairsHeatH,
      downstairsHeatH: row.downstairsHeatH,
      upstairsCycles: row.upstairsCycles,
      downstairsCycles: row.downstairsCycles,
      outdoorLow: row.outdoorLow,
      outdoorHigh: row.outdoorHigh,
      outdoorAvg: row.outdoorAvg,
      hdd65: row.hdd65,
      estThermsLow: row.estThermsLow,
      estThermsHigh: row.estThermsHigh,
      estCostLow: row.estCostLow,
      estCostHigh: row.estCostHigh,
      ccfPerHdd: row.ccfPerHdd,
      humidOnH: row.humidOnH,
      humidCycles: row.humidCycles,
      humidKwh: row.humidKwh,
      humidCost: row.humidCost,
      humidWaterGal: row.humidWaterGal,
    })),
    review: review ? { date: review.date, text: review.text } : null,
  };
}

function hasRows(rows: HeatRows): boolean {
  return Boolean(rows.latest || rows.snapshots.length || rows.days.length || rows.review);
}

function allowSample(): boolean {
  return process.env.HEAT_SAMPLE === "1" || process.env.VERCEL_ENV === "preview";
}

export async function loadHeatView(now = new Date()): Promise<HeatView> {
  try {
    const rows = await readHeatRows(now);
    if (!hasRows(rows) && allowSample()) {
      return { ...buildHeatView(sampleHeatRows(now), now), sample: true };
    }
    return buildHeatView(rows, now);
  } catch (error) {
    if (allowSample()) {
      console.warn("[heat] showing sample view", error instanceof Error ? error.name : "error");
      return { ...buildHeatView(sampleHeatRows(now), now), sample: true };
    }
    throw error;
  }
}

export async function saveHeatIngest(batch: HeatBatch, now = new Date()): Promise<{
  snapshots: number;
  days: number;
  reviews: number;
  pruned: number;
}> {
  await ensureLoftFanColumns();
  const cutoff = new Date(now.getTime() - SNAPSHOT_RETENTION_MS);
  const pruned = await prisma.$transaction(
    async (tx) => {
      for (const row of batch.snapshots) {
        const data = snapshotData(row);
        await tx.heatSnapshot.upsert({
          where: { recordedAt: data.recordedAt },
          create: data,
          update: data,
        });
      }
      for (const row of batch.days) {
        const data = dayData(row);
        await tx.heatDay.upsert({
          where: { date: row.date },
          create: data,
          update: data,
        });
      }
      for (const row of batch.reviews) {
        await tx.heatReview.upsert({
          where: { date: row.date },
          create: { date: row.date, text: row.text },
          update: { text: row.text },
        });
      }
      const deleted = await tx.heatSnapshot.deleteMany({ where: { recordedAt: { lt: cutoff } } });
      return deleted.count;
    },
    { timeout: 30_000 },
  );
  return {
    snapshots: batch.snapshots.length,
    days: batch.days.length,
    reviews: batch.reviews.length,
    pruned,
  };
}

export { emptyHeatView };
