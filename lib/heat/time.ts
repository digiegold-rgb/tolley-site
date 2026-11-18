/** Home heat uses the house clock in Kansas City. Dates on daily rows are calendar dates. */
export const ZONE = "America/Chicago";
export const SNAPSHOT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const CCF_BASELINE = 0.11;
/** A missed push must not be counted as hours of heat. */
export const HEAT_GAP_MS = 20 * 60 * 1000;

export function chicagoDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function chicagoHour(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return hour % 24;
}

function chicagoOffsetMs(utc: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utc);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - utc.getTime();
}

/** UTC instant of local midnight for the Chicago calendar day containing `now`. */
export function startOfChicagoDay(now: Date): Date {
  const [y, m, d] = chicagoDate(now).split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d, 0, 0, 0);
  const adjusted = utcMidnight - chicagoOffsetMs(new Date(utcMidnight));
  const refined = utcMidnight - chicagoOffsetMs(new Date(adjusted));
  return new Date(refined);
}

export function addIsoDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** Monday of the calendar week containing `iso`, as a YYYY-MM-DD date. */
export function weekStartMonday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const back = weekday === 0 ? 6 : weekday - 1;
  return addIsoDays(iso, -back);
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 8)}01`;
}

export function isIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
