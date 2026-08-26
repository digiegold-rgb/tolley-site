/**
 * Display-only day grouping for the /hq SMS thread view.
 * Calendar days are America/Chicago so Jared's inbox matches local time.
 * Nothing here sends, drafts, or skips a message.
 */

export const HQ_SMS_TZ = "America/Chicago";

export type SmsDayStamp = {
  createdAt: string;
  sentAt?: string | null;
};

/** Instant used for day grouping: sentAt when present, otherwise createdAt. */
export function smsDayInstant(msg: SmsDayStamp): string {
  return msg.sentAt || msg.createdAt;
}

/** YYYY-MM-DD in America/Chicago. Empty string if the timestamp is invalid. */
export function chicagoDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: HQ_SMS_TZ });
}

function shiftDayKey(key: string, delta: number): string {
  const [year, month, day] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + delta));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Thread date-line label. Today / Yesterday for the current Chicago day,
 * otherwise "Wednesday, Aug 26" (year added when it is not the current year).
 */
export function formatSmsDayLabel(iso: string, now: Date = new Date()): string {
  const key = chicagoDayKey(iso);
  if (!key) return "";
  const todayKey = chicagoDayKey(now.toISOString());
  if (key === todayKey) return "Today";
  if (key === shiftDayKey(todayKey, -1)) return "Yesterday";

  const [year, month, day] = key.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12));
  const weekday = noonUtc.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  const mon = noonUtc.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const nowYear = Number(todayKey.slice(0, 4));
  if (year !== nowYear) return `${weekday}, ${mon} ${day}, ${year}`;
  return `${weekday}, ${mon} ${day}`;
}

export type SmsDayRow<T extends SmsDayStamp> = {
  message: T;
  dayLabel: string | null;
};

/**
 * Insert a date label on the first message and whenever the Chicago calendar
 * day changes. Same-day messages keep dayLabel null.
 */
export function withSmsDayDividers<T extends SmsDayStamp>(
  messages: T[],
  now: Date = new Date(),
): SmsDayRow<T>[] {
  let prevKey = "";
  return messages.map((message) => {
    const key = chicagoDayKey(smsDayInstant(message));
    const show = Boolean(key) && key !== prevKey;
    if (key) prevKey = key;
    return {
      message,
      dayLabel: show ? formatSmsDayLabel(smsDayInstant(message), now) : null,
    };
  });
}
