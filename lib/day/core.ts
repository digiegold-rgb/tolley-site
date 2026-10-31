import { z } from "zod";
import { dailyBounds, DAILY_TIME_ZONE } from "@/lib/leads/daily-plan";

export const DAY_ZONE = DAILY_TIME_ZONE;
export const SECTION_IDS = ["stripe", "cleanouts", "pay", "mls", "whatnot", "calendar"] as const;
export type SectionId = typeof SECTION_IDS[number];
export const SECTION_LABELS: Record<SectionId, string> = {
  stripe: "Money today", cleanouts: "Cleanout inquiries", pay: "Paid pay pages",
  mls: "MLS seller alerts", whatnot: "Last Whatnot show", calendar: "Today’s calendar",
};
export const sectionSchema = z.object({
  status: z.enum(["live", "stub"]), source: z.string(), note: z.string(),
  metrics: z.array(z.object({ label: z.string(), value: z.string() })),
  items: z.array(z.string()),
});
export type DaySection = z.infer<typeof sectionSchema>;
export const snapshotSchema = z.object({
  version: z.literal(1), generatedAt: z.iso.datetime(), day: z.string(),
  sections: z.object({ stripe: sectionSchema, cleanouts: sectionSchema, pay: sectionSchema,
    mls: sectionSchema, whatnot: sectionSchema, calendar: sectionSchema }),
});
export type DaySnapshot = z.infer<typeof snapshotSchema>;
export type DayView = { snapshot: DaySnapshot | null; storage: "ready" | "unavailable" };

export function dayKey(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DAY_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export { dailyBounds };
export function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(cents / 100);
}
export function stub(source: string, note: string): DaySection {
  return { status: "stub", source, note, metrics: [], items: [] };
}
export function isSixCentral(now: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: DAY_ZONE, hour: "2-digit", hourCycle: "h23" }).format(now) === "06";
}
export function isStale(snapshot: DaySnapshot, now = new Date()) {
  return snapshot.day !== dayKey(now) || now.getTime() - Date.parse(snapshot.generatedAt) > 26 * 60 * 60 * 1000;
}

/** Exactly three lines; missing sources never read as zero. No customer details. */
export function summaryText(snapshot: DaySnapshot | null, now = new Date()): string {
  if (!snapshot) return "Money: stub — no saved snapshot.\nWork: stub — open /day and refresh.\nCalendar and Whatnot: stub — no saved snapshot.\n";
  const s = snapshot.sections;
  const metric = (id: SectionId) => s[id].status === "stub" ? "stub" : s[id].metrics.map(m => `${m.label} ${m.value}`).join(", ");
  const time = new Date(snapshot.generatedAt).toLocaleString("en-US", { timeZone: DAY_ZONE, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const lines = [
    `${isStale(snapshot, now) ? "STALE snapshot" : "Snapshot"} ${time} CT. Money: ${metric("stripe")}.`,
    `Cleanouts: ${metric("cleanouts")}. Paid pay pages: ${metric("pay")}. MLS: ${metric("mls")}.`,
    `Calendar: ${metric("calendar")}. Last Whatnot: ${metric("whatnot")}.`,
  ];
  return lines.map(line => line.replace(/[\r\n]+/g, " ")).join("\n") + "\n";
}
