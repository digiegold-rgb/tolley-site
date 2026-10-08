import { z } from "zod";

export const TREASURE_PAGE = "1156652300855210";
export const ACCOUNT_ID = "facebook-treasure";
export const USED_STATUSES = ["sending", "posted", "uncertain"];
export function morningFormat(elapsedDays: number): "text" | "image" {
  return (elapsedDays + Math.floor(elapsedDays / 30)) % 2 === 0 ? "image" : "text";
}
export const programStatuses = ["unknown", "not_invited", "invited", "active", "restricted"] as const;
const count = z.number().int().min(0).max(2_000_000_000).nullable();
const cents = z.number().int().min(0).max(100_000_000);
export const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enable") }),
  z.object({ action: z.literal("pause"), paused: z.boolean() }),
  z.object({ action: z.literal("sync") }),
  z.object({ action: z.literal("verify"), programStatus: z.enum(programStatuses), payoutsVerified: z.boolean(), evidence: z.string().trim().min(5).max(500) }),
  z.object({ action: z.literal("metrics"), postId: z.string().min(1), views: count, qualifiedViews: count, reactions: count, comments: count, shares: count, follows: count, earningsCents: cents.nullable(), measuredAt: z.iso.datetime({ offset: true }), evidence: z.string().trim().min(5).max(500) }),
  z.object({ action: z.literal("receipt"), externalId: z.string().trim().min(3).max(150), amountCents: cents, status: z.enum(["pending", "paid", "reversed"]), period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), evidence: z.string().trim().min(5).max(500) }),
  z.object({ action: z.literal("reconcile"), postId: z.string().min(1), externalId: z.string().regex(/^\d+_\d+$/) }),
]);
export function receiptTotals(rows: { amountCents: number; status: string }[]) {
  return rows.reduce((s, r) => {
    if (r.status === "pending") s.pendingCents += r.amountCents;
    if (r.status === "paid") s.paidCents += r.amountCents;
    if (r.status === "reversed") s.reversedCents += r.amountCents;
    return s;
  }, { pendingCents: 0, paidCents: 0, reversedCents: 0 });
}
export function performanceScore(p: { views: number | null; shares: number | null; follows: number | null; comments: number | null }) {
  if (p.views === null || p.views < 100 || p.shares === null) return null;
  return 1000 * (p.shares * 3 + (p.follows ?? 0) * 5 + (p.comments ?? 0)) / p.views;
}
export function allowedFeedSlots(input: { used: number; reservedPreview: boolean; hasUncertain: boolean }) {
  return input.hasUncertain ? 0 : Math.max(0, 2 - input.used - Number(input.reservedPreview));
}
export function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "Operation failed")
    .replace(/(?:Bearer|Key)\s+\S+/gi, "[redacted]").replace(/(access_token|token|secret|key)=[^\s&]+/gi, "$1=[redacted]").slice(0, 300);
}
