import { z } from "zod";
import { DAILY_TIME_ZONE, dailyBounds } from "./daily-plan";

export const WEEKDAY_TARGET_LIMIT = 5;
export const WEEKDAY_MIN_SCORE = 50;
export const sellerDraftSchema = z.object({
  version: z.literal(1), score: z.number().min(0).max(100), dossierId: z.string(),
  researchedAt: z.iso.datetime(), address: z.string(), reasons: z.array(z.string()),
  body: z.string().trim().min(1).max(4000),
});
export type SellerDraft = z.infer<typeof sellerDraftSchema>;
export function readSellerDraft(description: string | null): SellerDraft | null {
  try { const parsed = sellerDraftSchema.safeParse(JSON.parse(description || "")); return parsed.success ? parsed.data : null; }
  catch { return null; }
}
export function weekdayDropClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: DAILY_TIME_ZONE, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const weekday = parts.find(p => p.type === "weekday")!.value;
  const hour = Number(parts.find(p => p.type === "hour")!.value);
  return { eligible: !["Sat", "Sun"].includes(weekday) && hour === 8, day: dailyBounds(now).start.toISOString().slice(0, 10) };
}
export function sellerDraftBody(address: string) {
  return `Hi, I’m reaching out about ${address}. If selling is something you’re considering, I’d be happy to talk through your timing and the options for the property. Would a brief conversation this week be useful?`;
}
