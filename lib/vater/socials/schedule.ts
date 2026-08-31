/**
 * lib/vater/socials/schedule.ts
 *
 * Pure drip-cadence helpers. The API route enumerates slots, then hands
 * each one to publish-core. Same batchId retry is an identity check on
 * existing VaterSocialPost.batchId rows — never a second vendor create.
 */

export interface DripSlot {
  index: number;
  /** Instant the post should fire (UTC Date). */
  at: Date;
  /** Vendor wall-clock "YYYY-MM-DDTHH:mm:ss" in `timezone`. */
  wallClock: string;
}

const TIME_OF_DAY = /^(\d{1,2}):(\d{2})$/;

export function parseTimeOfDay(raw: string | undefined, fallback = "09:00"): { hh: number; mm: number } {
  const m = TIME_OF_DAY.exec((raw ?? fallback).trim());
  const hh = m ? Number(m[1]) : 9;
  const mm = m ? Number(m[2]) : 0;
  return {
    hh: Math.min(23, Math.max(0, Number.isFinite(hh) ? hh : 9)),
    mm: Math.min(59, Math.max(0, Number.isFinite(mm) ? mm : 0)),
  };
}

/** Local wall-clock "YYYY-MM-DDTHH:mm:ss" in `tz` for an instant. */
export function wallClock(iso: string, tz: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hh = g("hour") === "24" ? "00" : g("hour");
  return `${g("year")}-${g("month")}-${g("day")}T${hh}:${g("minute")}:${g("second")}`;
}

/**
 * Spread `count` posts from `startAt` at `perDay` cadence, all firing at
 * `timeOfDay` in `timezone`. Day 0 is the calendar day of startAt in tz
 * (or the next day if that wall-clock has already passed).
 */
export function enumerateDripSlots(input: {
  startAt: Date;
  timezone: string;
  perDay: number;
  timeOfDay: string;
  count: number;
}): DripSlot[] {
  const perDay = Math.min(50, Math.max(1, Math.floor(input.perDay) || 1));
  const { hh, mm } = parseTimeOfDay(input.timeOfDay);
  const tz = input.timezone || "UTC";
  const count = Math.max(0, Math.floor(input.count));
  const slots: DripSlot[] = [];
  if (count === 0) return slots;

  const startDay = calendarYmd(input.startAt, tz);
  let first = zonedDate(startDay.y, startDay.m, startDay.d, hh, mm, tz);
  if (first.getTime() <= input.startAt.getTime() + 60_000) {
    const next = addCalendarDays(startDay, 1);
    first = zonedDate(next.y, next.m, next.d, hh, mm, tz);
  }

  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor(i / perDay);
    const at = new Date(first.getTime() + dayOffset * 86_400_000);
    // Re-derive from calendar so DST does not drift the wall-clock.
    const ymd = calendarYmd(at, tz);
    const instant = zonedDate(ymd.y, ymd.m, ymd.d, hh, mm, tz);
    slots.push({
      index: i,
      at: instant,
      wallClock: wallClock(instant.toISOString(), tz),
    });
  }
  return slots;
}

export function dripRequestId(batchId: string, index: number): string {
  return `drip:${batchId}:${index}`;
}

interface Ymd {
  y: number;
  m: number;
  d: number;
}

function calendarYmd(d: Date, tz: string): Ymd {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return { y: g("year"), m: g("month"), d: g("day") };
}

function addCalendarDays(ymd: Ymd, days: number): Ymd {
  const utc = Date.UTC(ymd.y, ymd.m - 1, ymd.d + days);
  const d = new Date(utc);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

/** Instant corresponding to y-m-d hh:mm in `tz`. */
function zonedDate(y: number, m: number, d: number, hh: number, mm: number, tz: string): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const asTz = calendarParts(guess, tz);
  const wanted = Date.UTC(y, m - 1, d, hh, mm, 0);
  const got = Date.UTC(asTz.y, asTz.m - 1, asTz.d, asTz.hh, asTz.mm, 0);
  return new Date(guess.getTime() + (wanted - got));
}

function calendarParts(d: Date, tz: string): Ymd & { hh: number; mm: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const hh = g("hour") === 24 ? 0 : g("hour");
  return { y: g("year"), m: g("month"), d: g("day"), hh, mm: g("minute") };
}
