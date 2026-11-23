import { z } from "zod";
import { addIsoDays, chicagoDate, isIsoDate, SNAPSHOT_RETENTION_MS } from "./time";
import type { HeatBatch, HeatDay, HeatReview, HeatSnapshot, Hvac, Zone } from "./types";

const MAX_SNAPSHOTS = 500;
const MAX_DAYS = 400;
const MAX_REVIEWS = 90;
const FUTURE_SKEW_MS = 15 * 60 * 1000;

const temp = z.number().finite().min(-80).max(140).nullish();
const rh = z.number().finite().min(0).max(100).nullish();
const hvac = z.enum(["heat", "fan", "off"]);

const zoneSchema = z.object({
  setpoint: z.number().finite().min(40).max(99).nullish(),
  mode: z.string().max(40).nullish(),
  hvac,
  fan_mode: z.string().max(40).nullish(),
});

const snapshotSchema = z.object({
  timestamp: z.union([z.string().min(4).max(64), z.number().finite()]),
  kitchen_f: temp,
  loft_f: temp,
  kitchen_rh: rh,
  loft_rh: rh,
  outdoor_f: temp,
  upstairs: zoneSchema,
  downstairs: zoneSchema,
  loft_fan_on: z.boolean().nullish(),
  loft_fan_w: z.number().finite().min(0).max(4000).nullish(),
  loft_fan_energy_wh_total: z.number().finite().min(0).max(1_000_000_000).nullish(),
  loft_fan_decision: z.string().max(280).nullish(),
  humid_on: z.boolean().nullish(),
  humid_target_rh: rh,
  humid_today_h: z.number().finite().min(0).max(24.5).nullish(),
  humid_decision: z.string().max(280).nullish(),
});

const dailySchema = z.object({
  date: z.string(),
  upstairs_heat_h: z.number().finite().min(0).max(24.5),
  downstairs_heat_h: z.number().finite().min(0).max(24.5),
  upstairs_cycles: z.number().int().min(0).max(500),
  downstairs_cycles: z.number().int().min(0).max(500),
  outdoor_low: temp,
  outdoor_high: temp,
  outdoor_avg: temp,
  hdd65: z.number().finite().min(0).max(120).nullish(),
  est_therms_low: z.number().finite().min(0).max(100).nullish(),
  est_therms_high: z.number().finite().min(0).max(100).nullish(),
  est_cost_low: z.number().finite().min(0).max(2000).nullish(),
  est_cost_high: z.number().finite().min(0).max(2000).nullish(),
  ccf_per_hdd: z.number().finite().min(0).max(5).nullish(),
  humid_on_h: z.number().finite().min(0).max(24.5).nullish(),
  humid_cycles: z.number().int().min(0).max(2000).nullish(),
  humid_kwh: z.number().finite().min(0).max(1000).nullish(),
  humid_cost: z.number().finite().min(0).max(1000).nullish(),
  humid_water_gal: z.number().finite().min(0).max(10000).nullish(),
});

const reviewSchema = z.object({
  date: z.string(),
  text: z.string().min(1).max(20_000),
});

const envelopeSchema = z.object({
  snapshot: snapshotSchema.optional(),
  snapshots: z.array(snapshotSchema).max(MAX_SNAPSHOTS).optional(),
  daily: dailySchema.optional(),
  dailies: z.array(dailySchema).max(MAX_DAYS).optional(),
  days: z.array(dailySchema).max(MAX_DAYS).optional(),
  review: reviewSchema.optional(),
  reviews: z.array(reviewSchema).max(MAX_REVIEWS).optional(),
});

type SnapshotInput = z.infer<typeof snapshotSchema>;
type DailyInput = z.infer<typeof dailySchema>;
type ReviewInput = z.infer<typeof reviewSchema>;

export type ParseResult = { ok: true; batch: HeatBatch } | { ok: false; error: string };

const ENVELOPE_KEYS = new Set(["snapshot", "snapshots", "daily", "dailies", "days", "review", "reviews"]);

function zodMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue?.path?.length ? issue.path.join(".") : "body";
  return `${path}: ${issue?.message ?? "invalid"}`;
}

function blank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function zoneOf(input: z.infer<typeof zoneSchema>): Zone {
  return {
    setpoint: input.setpoint ?? null,
    mode: blank(input.mode),
    hvac: input.hvac as Hvac,
    fanMode: blank(input.fan_mode),
  };
}

function timestampMs(value: string | number): number | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value < 1e12 ? value * 1000 : value;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function snapshotOf(input: SnapshotInput, now: Date): { ok: true; row: HeatSnapshot } | { ok: false; error: string } {
  const ms = timestampMs(input.timestamp);
  if (ms == null) return { ok: false, error: "timestamp is not a valid date" };
  if (ms > now.getTime() + FUTURE_SKEW_MS) return { ok: false, error: "timestamp is too far in the future" };
  if (ms < now.getTime() - SNAPSHOT_RETENTION_MS) return { ok: false, error: "timestamp is older than 90 days" };
  return {
    ok: true,
    row: {
      recordedAt: new Date(ms).toISOString(),
      kitchenF: input.kitchen_f ?? null,
      loftF: input.loft_f ?? null,
      kitchenRh: input.kitchen_rh ?? null,
      loftRh: input.loft_rh ?? null,
      outdoorF: input.outdoor_f ?? null,
      upstairs: zoneOf(input.upstairs),
      downstairs: zoneOf(input.downstairs),
      loftFan: {
        on: input.loft_fan_on ?? null,
        watts: input.loft_fan_w ?? null,
        energyWh: input.loft_fan_energy_wh_total ?? null,
        decision: blank(input.loft_fan_decision),
      },
      humid: {
        on: input.humid_on ?? null,
        targetRh: input.humid_target_rh ?? null,
        todayH: input.humid_today_h ?? null,
        decision: blank(input.humid_decision),
      },
    },
  };
}

function dateAllowed(iso: string, now: Date): boolean {
  if (!isIsoDate(iso)) return false;
  const latest = addIsoDays(chicagoDate(now), 1);
  return iso >= "2020-01-01" && iso <= latest;
}

function dayOf(input: DailyInput, now: Date): { ok: true; row: HeatDay } | { ok: false; error: string } {
  if (!dateAllowed(input.date, now)) return { ok: false, error: `date ${input.date} is not a usable calendar date` };
  return {
    ok: true,
    row: {
      date: input.date,
      upstairsHeatH: input.upstairs_heat_h,
      downstairsHeatH: input.downstairs_heat_h,
      upstairsCycles: input.upstairs_cycles,
      downstairsCycles: input.downstairs_cycles,
      outdoorLow: input.outdoor_low ?? null,
      outdoorHigh: input.outdoor_high ?? null,
      outdoorAvg: input.outdoor_avg ?? null,
      hdd65: input.hdd65 ?? null,
      estThermsLow: input.est_therms_low ?? null,
      estThermsHigh: input.est_therms_high ?? null,
      estCostLow: input.est_cost_low ?? null,
      estCostHigh: input.est_cost_high ?? null,
      ccfPerHdd: input.ccf_per_hdd ?? null,
      humidOnH: input.humid_on_h ?? null,
      humidCycles: input.humid_cycles ?? null,
      humidKwh: input.humid_kwh ?? null,
      humidCost: input.humid_cost ?? null,
      humidWaterGal: input.humid_water_gal ?? null,
    },
  };
}

function reviewOf(input: ReviewInput, now: Date): { ok: true; row: HeatReview } | { ok: false; error: string } {
  if (!dateAllowed(input.date, now)) return { ok: false, error: `date ${input.date} is not a usable calendar date` };
  const text = input.text.trim();
  if (!text) return { ok: false, error: "review text is empty" };
  return { ok: true, row: { date: input.date, text } };
}

function finish(
  snapshots: HeatSnapshot[],
  days: HeatDay[],
  reviews: HeatReview[],
): ParseResult {
  const snapMap = new Map<string, HeatSnapshot>();
  for (const row of snapshots) snapMap.set(row.recordedAt, row);
  const dayMap = new Map<string, HeatDay>();
  for (const row of days) dayMap.set(row.date, row);
  const reviewMap = new Map<string, HeatReview>();
  for (const row of reviews) reviewMap.set(row.date, row);
  return {
    ok: true,
    batch: {
      snapshots: [...snapMap.values()],
      days: [...dayMap.values()],
      reviews: [...reviewMap.values()],
    },
  };
}

function collect(
  snapshots: SnapshotInput[],
  days: DailyInput[],
  reviews: ReviewInput[],
  now: Date,
): ParseResult {
  const snapRows: HeatSnapshot[] = [];
  for (const input of snapshots) {
    const row = snapshotOf(input, now);
    if (!row.ok) return row;
    snapRows.push(row.row);
  }
  const dayRows: HeatDay[] = [];
  for (const input of days) {
    const row = dayOf(input, now);
    if (!row.ok) return row;
    dayRows.push(row.row);
  }
  const reviewRows: HeatReview[] = [];
  for (const input of reviews) {
    const row = reviewOf(input, now);
    if (!row.ok) return row;
    reviewRows.push(row.row);
  }
  return finish(snapRows, dayRows, reviewRows);
}

function looksDaily(obj: Record<string, unknown>): boolean {
  return ["upstairs_heat_h", "downstairs_heat_h", "hdd65", "ccf_per_hdd", "est_cost_low", "est_therms_low"].some(
    (key) => key in obj,
  );
}

function looksSnapshot(obj: Record<string, unknown>): boolean {
  return ["timestamp", "upstairs", "kitchen_f", "loft_f"].some((key) => key in obj);
}

export function parseHeatBody(input: unknown, now = new Date()): ParseResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Expected a JSON object" };
  }
  const obj = input as Record<string, unknown>;
  if (Object.keys(obj).some((key) => ENVELOPE_KEYS.has(key))) {
    const parsed = envelopeSchema.safeParse(obj);
    if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
    const data = parsed.data;
    return collect(
      [...(data.snapshot ? [data.snapshot] : []), ...(data.snapshots ?? [])],
      [...(data.daily ? [data.daily] : []), ...(data.dailies ?? []), ...(data.days ?? [])],
      [...(data.review ? [data.review] : []), ...(data.reviews ?? [])],
      now,
    );
  }

  const kind = obj.kind;
  if (kind === "daily" || (kind == null && looksDaily(obj))) {
    const parsed = dailySchema.safeParse(obj);
    if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
    return collect([], [parsed.data], [], now);
  }
  if (kind === "review" || (kind == null && typeof obj.text === "string" && typeof obj.date === "string")) {
    const parsed = reviewSchema.safeParse(obj);
    if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
    return collect([], [], [parsed.data], now);
  }
  if (kind === "snapshot" || (kind == null && looksSnapshot(obj))) {
    const parsed = snapshotSchema.safeParse(obj);
    if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
    return collect([parsed.data], [], [], now);
  }
  return { ok: false, error: "Unrecognized heat payload" };
}
