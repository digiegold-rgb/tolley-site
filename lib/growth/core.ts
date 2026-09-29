import { centralDate, centralInstant, isLive } from "../live/campaign";
export const isAnnouncement = (kind: string) => /^announce_(start|reminder)_\d+$/.test(kind);
export function reportWindow(period: string, now = new Date()) {
  const today = centralDate(now);
  const date = new Date(`${today}T12:00:00Z`);
  const count = period === "yesterday" ? 1 : period === "7" ? 6 : period === "30" ? 29 : 0;
  date.setUTCDate(date.getUTCDate() - count);
  return { since: centralInstant(date.toISOString().slice(0, 10), "00:00"), until: period === "yesterday" ? centralInstant(today, "00:00") : now };
}
export function announcementSlot(show: Parameters<typeof isLive>[0] & { liveStartedAt: Date | null }, now: Date) {
  if (!isLive(show, now) || !show.liveStartedAt || show.liveStartedAt > now) return null;
  const slot = Math.floor((now.getTime() - show.liveStartedAt.getTime()) / 1800000);
  // No catch-up blasts: a missed slot is skipped, never replayed in a burst.
  return { slot, dueAt: new Date(show.liveStartedAt.getTime() + slot * 1800000), expiresAt: new Date(Math.min(show.confirmedUntil!.getTime(), show.liveStartedAt.getTime() + (slot + 1) * 1800000)) };
}
export function resaleMath(sale: number, cost: number, feesPercent: number, fixed: number, packing: number, desiredProfit: number, count = 1) {
  if (![sale, cost, feesPercent, fixed, packing, desiredProfit, count].every(Number.isFinite) || [sale, cost, fixed, packing, desiredProfit].some(n => n < 0) || feesPercent < 0 || feesPercent >= 100 || count < 1 || !Number.isInteger(count)) return null;
  const net = sale * (1 - feesPercent / 100) - fixed - packing;
  return { profit: net - cost, maximumBuy: net - desiredProfit, breakEvenSale: (cost + fixed + packing) / (1 - feesPercent / 100), unitCost: cost / count };
}
