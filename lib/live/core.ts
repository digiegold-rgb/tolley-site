import { z } from "zod";

export const WHATNOT_PROFILE = "https://www.whatnot.com/user/treasure_hauls";
export const LIVE_PLATFORMS = ["facebook", "instagram", "youtube"] as const;
export type LivePlatform = typeof LIVE_PLATFORMS[number];
export const showSchema = z.object({
  title: z.string().trim().min(3).max(120),
  category: z.enum(["Electronics", "Home & Garden", "Estate / mixed finds"]),
  startsAt: z.iso.datetime({ offset: true }),
  durationMin: z.number().int().min(60).max(180),
  whatnotUrl: z.url().refine(value => {
    const u = new URL(value);
    return u.protocol === "https:" && ["whatnot.com", "www.whatnot.com"].includes(u.hostname) && /^\/(live|show)\/[a-zA-Z0-9-]+\/?$/.test(u.pathname) && !u.username && !u.password && !u.search && !u.hash;
  }, "Use the direct Whatnot show URL"),
});
export const ledgerSchema = z.object({
  sales: z.number().min(0), fees: z.number().min(0), inventory: z.number().min(0),
  fulfillment: z.number().min(0), refunds: z.number().min(0), ads: z.number().min(0),
  labor: z.number().min(0), minutes: z.number().positive().max(480), orders: z.number().int().min(0),
  settled: z.boolean(),
});
export type Ledger = z.infer<typeof ledgerSchema>;
export function contribution(l: Ledger) {
  const beforeAds = l.sales - l.fees - l.inventory - l.fulfillment - l.refunds;
  const margin = l.sales > 0 ? beforeAds / l.sales : 0;
  return { beforeAds, afterAds: beforeAds - l.ads, afterLabor: beforeAds - l.ads - l.labor,
    perHour: (beforeAds - l.ads - l.labor) * 60 / l.minutes,
    breakEvenExtraSales: margin > 0 ? l.ads / margin : null };
}
export function broadcastLabel(s: { armed: boolean; obs: { streaming: boolean }; destinations: Record<string, { running: boolean } | undefined> } | null) {
  if (!s) return "Status unknown";
  if (!s.armed) return "House idle";
  if (Object.values(s.destinations).some(d => d?.running)) return "Sending to platforms";
  return s.obs.streaming ? "Encoding · house armed" : "House armed · waiting for camera";
}
export const reviewSchema = z.object({
  transcriptSafe: z.boolean(), visualSafe: z.boolean(), humiliationFree: z.boolean(),
  profanityHandled: z.boolean(), noCurrentOffer: z.boolean(), confidence: z.number().min(0).max(1),
  reason: z.string().max(1000),
});
export function canAutoPublish(review: unknown) {
  const r = reviewSchema.safeParse(review);
  return r.success && r.data.transcriptSafe && r.data.visualSafe && r.data.humiliationFree && r.data.profanityHandled && r.data.noCurrentOffer && r.data.confidence >= .95;
}
export function campaignSource(value: string | null) { return value?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "direct"; }
