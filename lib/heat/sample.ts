import type { HeatRows, HeatSnapshot, Hvac } from "./types";
import { addIsoDays, chicagoDate, chicagoHour } from "./time";

const SAMPLE_REVIEW = `## Sample review

This note is built into the preview so the dashboard has something to show before Spark posts. It is not a reading from the house.

Upstairs carried the cold part of the day. The loft sat a few degrees over the kitchen until the destratification fan ran and pulled that gap down. Outdoor air sat in the 30s, and the gas estimate landed near the 0.11 CCF per degree-day baseline.

No short-cycling showed up in this sample.`;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Deterministic house-shaped rows relative to `now`, for previews with an empty table. */
export function sampleHeatRows(now: Date): HeatRows {
  const today = chicagoDate(now);
  const days = [];
  for (let ago = 21; ago >= 1; ago--) {
    const date = addIsoDays(today, -ago);
    const n = hashString(date);
    const hdd = 6 + (n % 20);
    const upstairs = round1(1.5 + ((n >>> 2) % 40) / 10);
    const downstairs = round1(0.8 + ((n >>> 5) % 30) / 10);
    const ccf = round3(0.085 + (n % 55) / 1000);
    const therms = ccf * hdd;
    const price = 1.35;
    days.push({
      date,
      upstairsHeatH: upstairs,
      downstairsHeatH: downstairs,
      upstairsCycles: 3 + (n % 8),
      downstairsCycles: 2 + ((n >>> 3) % 6),
      outdoorLow: 22 + (n % 12),
      outdoorHigh: 40 + (n % 15),
      outdoorAvg: 32 + (n % 10),
      hdd65: hdd,
      estThermsLow: round2(therms * 0.92),
      estThermsHigh: round2(therms * 1.08),
      estCostLow: round2(therms * 0.92 * price),
      estCostHigh: round2(therms * 1.08 * price),
      ccfPerHdd: ccf,
    });
  }

  const snapshots: HeatSnapshot[] = [];
  const start = now.getTime() - 24 * 60 * 60 * 1000;
  let energyWh = 2500;
  for (let t = start; t <= now.getTime(); t += 10 * 60 * 1000) {
    const at = new Date(t);
    const hour = chicagoHour(at);
    const upHeat = (hour >= 5 && hour < 8) || (hour >= 16 && hour < 21);
    const downHeat = hour >= 6 && hour < 9;
    const outdoor = round1(36 + 8 * Math.sin(((hour - 15) / 24) * Math.PI * 2));
    const kitchen = round1(70.2 + (outdoor - 40) * 0.04 + (upHeat ? 1.1 : 0));
    const hvac: Hvac = upHeat ? "heat" : hour >= 9 && hour < 16 ? "fan" : "off";
    const fanOn = hour >= 11 && hour < 17;
    const stratification = fanOn ? 0.6 : 3.4;
    if (fanOn) energyWh += 6;
    snapshots.push({
      recordedAt: at.toISOString(),
      kitchenF: kitchen,
      loftF: round1(kitchen + stratification),
      kitchenRh: 38,
      loftRh: 36,
      outdoorF: outdoor,
      upstairs: { setpoint: 70, mode: "heat", hvac, fanMode: "auto" },
      downstairs: {
        setpoint: 68,
        mode: "heat",
        hvac: downHeat ? "heat" : "off",
        fanMode: null,
      },
      loftFan: {
        on: fanOn,
        watts: fanOn ? 36 : 0,
        energyWh,
        decision: fanOn ? `on: loft-living ${stratification.toFixed(1)}F, heat ${upHeat ? "on" : "off"}` : "off: quiet hours",
      },
    });
  }

  return {
    latest: snapshots[snapshots.length - 1] ?? null,
    snapshots,
    days,
    review: { date: addIsoDays(today, -1), text: SAMPLE_REVIEW },
  };
}
