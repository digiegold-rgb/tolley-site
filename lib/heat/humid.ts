import type { HeatDay, HeatSnapshot, HeatTotals, HumidDayPoint, HumidReading, HumidView } from "./types";
import {
  ELECTRIC_USD_PER_KWH,
  FAN_HISTORY_DAYS,
  HEAT_GAP_MS,
  HUMIDIFIER_GPH_EACH,
  HUMIDIFIER_UNITS,
  HUMIDIFIER_W_EACH,
  addIsoDays,
  chicagoDate,
  startOfChicagoDay,
} from "./time";

/** Both whole-home humidifiers run together on one relay. */
export const HUMIDIFIER_TOTAL_W = HUMIDIFIER_UNITS * HUMIDIFIER_W_EACH;
/** A live runtime counter older than this falls back to the daily row or snapshots. */
const LIVE_MAX_AGE_MS = 30 * 60 * 1000;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

export function humidKnown(reading: HumidReading | undefined | null): reading is HumidReading {
  return Boolean(
    reading && (reading.on != null || reading.targetRh != null || reading.todayH != null || reading.decision),
  );
}

/** Runtime priced at the combined nameplate watts and the heat page's electric rate. */
export function pricedHumidDay(date: string, runtimeH: number, cycles: number | null = null): HumidDayPoint {
  const hours = Math.max(0, runtimeH);
  const kwh = round3((hours * HUMIDIFIER_TOTAL_W) / 1000);
  return {
    date,
    runtimeH: round2(hours),
    cycles,
    kwh,
    cost: cents(kwh * ELECTRIC_USD_PER_KWH),
    waterGal: round1(hours * HUMIDIFIER_UNITS * HUMIDIFIER_GPH_EACH),
  };
}

/** Spark's own numbers win; anything it left out is priced here. */
export function humidDayFromRow(day: HeatDay): HumidDayPoint | null {
  if (day.humidOnH == null) return null;
  const priced = pricedHumidDay(day.date, day.humidOnH, day.humidCycles ?? null);
  return {
    ...priced,
    kwh: day.humidKwh != null ? round3(day.humidKwh) : priced.kwh,
    cost: day.humidCost != null ? cents(day.humidCost) : priced.cost,
    waterGal: day.humidWaterGal != null ? round1(day.humidWaterGal) : priced.waterGal,
  };
}

/** Relay-on hours from 5-minute snapshots. Gaps over 20 minutes are not counted. Null without readings. */
export function humidOnHours(snapshots: HeatSnapshot[], fromMs: number, toMs: number): number | null {
  const sorted = snapshots.filter((s) => Date.parse(s.recordedAt) < toMs);
  let hours = 0;
  let seen = false;
  for (let i = 0; i < sorted.length; i++) {
    const reading = sorted[i].humid;
    if (!humidKnown(reading) || reading.on == null) continue;
    const startAt = Date.parse(sorted[i].recordedAt);
    const nextAt = i + 1 < sorted.length ? Date.parse(sorted[i + 1].recordedAt) : toMs;
    const start = Math.max(startAt, fromMs);
    const end = Math.min(nextAt, toMs, startAt + HEAT_GAP_MS);
    if (end <= start) continue;
    seen = true;
    if (reading.on) hours += (end - start) / 3_600_000;
  }
  return seen ? round2(hours) : null;
}

export function emptyHumid(now = new Date()): HumidView {
  return {
    hasData: false,
    units: HUMIDIFIER_UNITS,
    watts: HUMIDIFIER_TOTAL_W,
    rateUsdPerKwh: ELECTRIC_USD_PER_KWH,
    now: null,
    today: { ...pricedHumidDay(chicagoDate(now), 0), source: "none" },
    days: [],
  };
}

export function buildHumid(snapshots: HeatSnapshot[], days: HeatDay[], now = new Date()): HumidView {
  const today = chicagoDate(now);
  const sorted = [...snapshots].sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
  const known = sorted.filter((s) => humidKnown(s.humid));
  const latest = known.length ? known[known.length - 1] : null;
  const rows = new Map<string, HumidDayPoint>();
  for (const day of days) {
    const point = humidDayFromRow(day);
    if (point) rows.set(day.date, point);
  }
  if (!latest && rows.size === 0) return emptyHumid(now);

  const reported = rows.get(today) ?? null;
  let todayPoint: HumidView["today"];
  const liveH = latest?.humid?.todayH;
  const latestAt = latest ? Date.parse(latest.recordedAt) : 0;
  if (
    latest &&
    liveH != null &&
    chicagoDate(new Date(latestAt)) === today &&
    now.getTime() - latestAt <= LIVE_MAX_AGE_MS &&
    liveH >= (reported?.runtimeH ?? 0)
  ) {
    todayPoint = { ...pricedHumidDay(today, liveH, reported?.cycles ?? null), source: "live" };
  } else if (reported) {
    todayPoint = { ...reported, source: "reported" };
  } else {
    const snapH = humidOnHours(sorted, startOfChicagoDay(now).getTime(), now.getTime());
    todayPoint = snapH == null ? { ...pricedHumidDay(today, 0), source: "none" } : { ...pricedHumidDay(today, snapH), source: "estimated" };
  }

  const history: HumidDayPoint[] = [];
  for (let back = FAN_HISTORY_DAYS - 1; back >= 1; back--) {
    const date = addIsoDays(today, -back);
    const row = rows.get(date);
    if (row) history.push(row);
  }
  history.push({
    date: todayPoint.date,
    runtimeH: todayPoint.runtimeH,
    cycles: todayPoint.cycles,
    kwh: todayPoint.kwh,
    cost: todayPoint.cost,
    waterGal: todayPoint.waterGal,
  });

  return {
    hasData: true,
    units: HUMIDIFIER_UNITS,
    watts: HUMIDIFIER_TOTAL_W,
    rateUsdPerKwh: ELECTRIC_USD_PER_KWH,
    now: latest?.humid
      ? {
          on: latest.humid.on,
          targetRh: latest.humid.targetRh,
          decision: latest.humid.decision,
          rh: latest.kitchenRh,
          recordedAt: latest.recordedAt,
        }
      : null,
    today: todayPoint,
    days: history,
  };
}

/** Humidifier runtime, kWh and dollars for a totals window: daily rows before today plus today's live number. */
export function humidTotals(
  totals: HeatTotals,
  days: HeatDay[],
  humid: HumidView,
  today: string,
): { runtimeH: number; kwh: number | null; cost: number | null } {
  const points: HumidDayPoint[] = [];
  for (const day of days) {
    if (day.date >= totals.from && day.date <= totals.to && day.date !== today) {
      const point = humidDayFromRow(day);
      if (point) points.push(point);
    }
  }
  if (humid.today.source !== "none" && today >= totals.from && today <= totals.to) points.push(humid.today);
  if (!points.length) return { runtimeH: 0, kwh: null, cost: null };
  return {
    runtimeH: round2(points.reduce((sum, p) => sum + p.runtimeH, 0)),
    kwh: round3(points.reduce((sum, p) => sum + (p.kwh ?? 0), 0)),
    cost: cents(points.reduce((sum, p) => sum + (p.cost ?? 0), 0)),
  };
}
