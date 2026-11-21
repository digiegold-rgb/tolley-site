import type { FanDayPoint, FanEffectPoint, FanEnergySource, HeatSnapshot, LoftFanReading, LoftFanView } from "./types";
import {
  ELECTRIC_USD_PER_KWH,
  FAN_HISTORY_DAYS,
  HEAT_GAP_MS,
  LOFT_FAN_NAMEPLATE_W,
  addIsoDays,
  chicagoDate,
  chicagoDayStartMs,
} from "./time";

const WATT_ON_THRESHOLD = 5;

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

function byTime(a: HeatSnapshot, b: HeatSnapshot): number {
  return Date.parse(a.recordedAt) - Date.parse(b.recordedAt);
}

export function fanKnown(reading: LoftFanReading): boolean {
  return reading.on != null || reading.watts != null || reading.energyWh != null || Boolean(reading.decision);
}

/** The boolean wins. Without it, a few watts of plug noise stays off. */
export function fanOnState(reading: LoftFanReading): boolean | null {
  if (reading.on != null) return reading.on;
  if (reading.watts == null) return null;
  return reading.watts >= WATT_ON_THRESHOLD;
}

function onHours(snapshots: HeatSnapshot[], fromMs: number, toMs: number): number {
  const sorted = snapshots.filter((s) => Date.parse(s.recordedAt) < toMs);
  let hours = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (fanOnState(sorted[i].loftFan) !== true) continue;
    const startAt = Date.parse(sorted[i].recordedAt);
    const nextAt = i + 1 < sorted.length ? Date.parse(sorted[i + 1].recordedAt) : toMs;
    const start = Math.max(startAt, fromMs);
    const end = Math.min(nextAt, toMs, startAt + HEAT_GAP_MS);
    if (end <= start) continue;
    hours += (end - start) / 3_600_000;
  }
  return round2(hours);
}

function onCycles(snapshots: HeatSnapshot[], fromMs: number, toMsExclusive: number): number {
  let last: boolean | null = null;
  let cycles = 0;
  for (const row of snapshots) {
    const t = Date.parse(row.recordedAt);
    if (t >= toMsExclusive) break;
    const on = fanOnState(row.loftFan);
    if (on == null) continue;
    if (t >= fromMs && on && last !== true) cycles += 1;
    last = on;
  }
  return cycles;
}

/**
 * Watt-hours inside [fromMs, toMs] from the plug's cumulative counter.
 * Energy between two readings is spread evenly across that interval, so a
 * reading that crosses midnight is split between the two Chicago days.
 * A counter that steps backward (plug reboot) contributes nothing for that step.
 * Returns null when the counter does not cover the window.
 */
function meterWh(snapshots: HeatSnapshot[], fromMs: number, toMs: number): number | null {
  const points = snapshots.filter((s) => s.loftFan.energyWh != null && Date.parse(s.recordedAt) <= toMs);
  if (points.length < 2) return null;
  let wh = 0;
  let used = false;
  for (let i = 1; i < points.length; i++) {
    const t0 = Date.parse(points[i - 1].recordedAt);
    const t1 = Date.parse(points[i].recordedAt);
    if (t1 <= fromMs || t0 >= toMs || t1 <= t0) continue;
    used = true;
    const delta = (points[i].loftFan.energyWh ?? 0) - (points[i - 1].loftFan.energyWh ?? 0);
    if (delta <= 0) continue;
    const overlap = Math.min(t1, toMs) - Math.max(t0, fromMs);
    wh += delta * (overlap / (t1 - t0));
  }
  return used ? wh : null;
}

function integratedWh(snapshots: HeatSnapshot[], fromMs: number, toMs: number): { wh: number; source: FanEnergySource } | null {
  let wh = 0;
  let sawWatt = false;
  let sawNameplate = false;
  let sawAny = false;
  const sorted = snapshots.filter((s) => Date.parse(s.recordedAt) < toMs);
  for (let i = 0; i < sorted.length; i++) {
    const startAt = Date.parse(sorted[i].recordedAt);
    const nextAt = i + 1 < sorted.length ? Date.parse(sorted[i + 1].recordedAt) : toMs;
    const start = Math.max(startAt, fromMs);
    const end = Math.min(nextAt, toMs, startAt + HEAT_GAP_MS);
    if (end <= start) continue;
    const reading = sorted[i].loftFan;
    const on = fanOnState(reading);
    if (!fanKnown(reading)) continue;
    sawAny = true;
    const hours = (end - start) / 3_600_000;
    if (reading.watts != null) {
      wh += reading.watts * hours;
      sawWatt = true;
    } else if (on === true) {
      wh += LOFT_FAN_NAMEPLATE_W * hours;
      sawNameplate = true;
    }
  }
  if (!sawAny) return null;
  if (sawWatt) return { wh, source: "watts" };
  if (sawNameplate) return { wh, source: "nameplate" };
  return { wh: 0, source: "none" };
}

function energyInWindow(snapshots: HeatSnapshot[], fromMs: number, toMs: number): { kwh: number | null; source: FanEnergySource } {
  const metered = meterWh(snapshots, fromMs, toMs);
  if (metered != null) return { kwh: metered / 1000, source: "meter" };
  const integrated = integratedWh(snapshots, fromMs, toMs);
  if (!integrated) return { kwh: null, source: "none" };
  return { kwh: integrated.wh / 1000, source: integrated.source };
}

function dayPoint(date: string, snapshots: HeatSnapshot[], fromMs: number, toMs: number, cycleEnd: number): FanDayPoint | null {
  const runtimeH = onHours(snapshots, fromMs, toMs);
  const cycles = onCycles(snapshots, fromMs, cycleEnd);
  const energy = energyInWindow(snapshots, fromMs, toMs);
  if (energy.kwh == null && runtimeH === 0 && cycles === 0) return null;
  const kwh = energy.kwh == null ? null : round3(energy.kwh);
  return {
    date,
    runtimeH,
    cycles,
    kwh,
    cost: kwh == null ? null : cents(kwh * ELECTRIC_USD_PER_KWH),
    source: energy.source,
  };
}

function emptyToday(date: string): FanDayPoint {
  return { date, runtimeH: 0, cycles: 0, kwh: null, cost: null, source: "none" };
}

export function emptyLoftFan(now = new Date()): LoftFanView {
  return {
    hasData: false,
    rateUsdPerKwh: ELECTRIC_USD_PER_KWH,
    nameplateW: LOFT_FAN_NAMEPLATE_W,
    now: null,
    today: emptyToday(chicagoDate(now)),
    days: [],
    series: [],
  };
}

export function buildLoftFan(snapshots: HeatSnapshot[], now = new Date()): LoftFanView {
  const sorted = [...snapshots].sort(byTime);
  if (!sorted.some((s) => fanKnown(s.loftFan))) return emptyLoftFan(now);

  const today = chicagoDate(now);
  const nowMs = now.getTime();
  const days: FanDayPoint[] = [];
  for (let ago = FAN_HISTORY_DAYS - 1; ago >= 0; ago--) {
    const date = addIsoDays(today, -ago);
    const fromMs = chicagoDayStartMs(date);
    const nextMs = chicagoDayStartMs(addIsoDays(date, 1));
    const toMs = date === today ? nowMs : nextMs;
    const cycleEnd = date === today ? nowMs + 1 : nextMs;
    const point = dayPoint(date, sorted, fromMs, toMs, cycleEnd);
    if (point) days.push(point);
  }

  const from24 = nowMs - 24 * 60 * 60 * 1000;
  const series: FanEffectPoint[] = sorted
    .filter((s) => {
      const t = Date.parse(s.recordedAt);
      return t >= from24 && t <= nowMs + 15 * 60 * 1000;
    })
    .map((s) => {
      const gap = s.loftF != null && s.kitchenF != null ? round1(s.loftF - s.kitchenF) : null;
      return {
        t: s.recordedAt,
        kitchenF: s.kitchenF,
        loftF: s.loftF,
        gapF: gap,
        fanOn: fanOnState(s.loftFan),
      };
    });

  const latest = sorted[sorted.length - 1];
  const knownNow = latest && fanKnown(latest.loftFan);
  return {
    hasData: true,
    rateUsdPerKwh: ELECTRIC_USD_PER_KWH,
    nameplateW: LOFT_FAN_NAMEPLATE_W,
    now: knownNow
      ? { on: fanOnState(latest.loftFan), watts: latest.loftFan.watts, decision: latest.loftFan.decision }
      : null,
    today: days.find((d) => d.date === today) ?? emptyToday(today),
    days,
    series,
  };
}
