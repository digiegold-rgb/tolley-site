import { z } from "zod";

export const WORKER_APP = "tolley-shop-videos";
export const RECIPE_VERSION = "store-display-v1";
export const providers = ["fal", "modal"] as const;
export const formats = ["hybrid", "boomerang"] as const;
export const scenes = ["original", "countertop", "shelf", "studio"] as const;
export const activeStatuses = ["queued", "dispatching", "rendering"];

function httpsUrl(value: string): URL {
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password || u.port) throw new Error("Use an HTTPS URL without credentials or a port");
  return u;
}
export function tiktokProductId(value: string): string | null {
  const u = httpsUrl(value);
  if (!(u.hostname === "tiktok.com" || u.hostname.endsWith(".tiktok.com"))) throw new Error("Use a TikTok product link");
  return u.pathname.match(/\/product\/(\d{10,25})(?:\/|$)/)?.[1] || u.searchParams.get("product_id") || null;
}
export function isInputUrl(value: string): boolean {
  try {
    const h = httpsUrl(value).hostname;
    return h.endsWith(".public.blob.vercel-storage.com") || h.endsWith(".tiktokcdn-us.com") ||
      h.endsWith(".tiktokcdn.com") || h.endsWith(".ibyteimg.com") || h === "www.tolley.io";
  } catch { return false; }
}
const media = z.string().url().refine(isInputUrl, "Upload media here, or use an authorized TikTok product image URL");
export const productSchema = z.object({
  title: z.string().trim().min(2).max(180),
  productId: z.string().regex(/^\d{10,25}$/, "Enter the TikTok product ID"),
  productUrl: z.string().url(),
  imageUrl: media,
  realVideoUrl: media.nullish().or(z.literal("")),
  seller: z.string().trim().min(1).max(120),
  variant: z.string().trim().min(1).max(160),
  commissionBps: z.number().int().min(0).max(10000),
  priceCents: z.number().int().min(0).max(10000000),
  rightsConfirmed: z.literal(true),
  authenticityConfirmed: z.literal(true),
  realFootageConfirmed: z.boolean().default(false),
}).superRefine((v, ctx) => {
  try {
    const extracted = tiktokProductId(v.productUrl);
    if (extracted && extracted !== v.productId) ctx.addIssue({code:"custom",path:["productId"],message:"Product ID does not match the link"});
  } catch { ctx.addIssue({code:"custom",path:["productUrl"],message:"Use an HTTPS TikTok product link"}); }
  if (v.realFootageConfirmed && !v.realVideoUrl) ctx.addIssue({code:"custom",path:["realVideoUrl"],message:"Upload the real product demonstration first"});
});
export const accountSchema = z.object({
  externalAccountId: z.string().min(1).max(100),
  dailyQuota: z.number().int().min(1).max(30),
  weeklyQuota: z.number().int().min(1).max(210),
  affiliateAccessConfirmed: z.literal(true),
  quotaConfirmed: z.literal(true),
});
export const batchSchema = z.object({
  requestKey: z.string().uuid(),
  accountId: z.string().min(1),
  productIds: z.array(z.string().min(1)).min(1).max(20).refine(v => new Set(v).size === v.length,"Choose each product once per batch"),
  provider: z.enum(providers),
  format: z.enum(formats).default("hybrid"),
  scene: z.enum(scenes).default("original"),
  overlay: z.string().trim().min(1).max(120),
  maxSpendCents: z.number().int().min(5).max(2000),
});
export function allowanceCents(provider: string, scene: string): number {
  if (provider === "fal") return scene === "original" ? 5 : 8;
  if (provider === "modal") return scene === "original" ? 150 : 153;
  throw new Error("Only fal.ai and Modal generation are supported");
}
export function accountIsVerified(account: { verifiedAt: Date | string | null }, now = new Date()): boolean {
  if (!account.verifiedAt) return false;
  const age = now.getTime() - new Date(account.verifiedAt).getTime();
  return age >= 0 && age < 7 * 86400000;
}
export function publicationId(value: string, username: string): string {
  const u = httpsUrl(value);
  if (u.hostname !== "www.tiktok.com" && u.hostname !== "tiktok.com") throw new Error("Paste the published TikTok video URL");
  const match = u.pathname.match(/^\/@([^/]+)\/video\/(\d{10,25})\/?$/);
  if (!match || match[1].toLowerCase() !== username.replace(/^@/,"").toLowerCase()) throw new Error("Video URL must belong to the selected TikTok account");
  return match[2];
}
export const commissionSchema = z.object({
  externalId: z.string().trim().min(1).max(150),
  jobId: z.string().min(1),
  amountCents: z.number().int().min(0).max(10000000),
  status: z.enum(["pending", "settled", "reversed"]),
  evidence: z.string().trim().min(3).max(500),
});
export const reviewSchema = z.object({
  action: z.literal("approve"),
  productMatches: z.literal(true),
  claimsAccurate: z.literal(true),
  rightsConfirmed: z.literal(true),
  precheckPassed: z.boolean().default(false),
});
export const handoffSchema = z.object({
  action: z.literal("handoff"),
  disclosureConfirmed: z.literal(true),
  commercialAudioConfirmed: z.literal(true),
  productLinkConfirmed: z.literal(true),
});
export function commissionTotals(rows: { status: string; amountCents: number }[]) {
  return rows.reduce((sum,r) => { if (r.status === "pending") sum.pendingCents += r.amountCents; if (r.status === "settled") sum.settledCents += r.amountCents; if (r.status === "reversed") sum.reversedCents += r.amountCents; return sum; },{pendingCents:0,settledCents:0,reversedCents:0});
}
export function videoRange(header: string | null, size: number): {start:number;end:number;partial:boolean} {
  if (!Number.isSafeInteger(size) || size < 1) throw new Error("Missing video");
  if (!header) return {start:0,end:size-1,partial:false};
  const m = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!m || (!m[1] && !m[2])) throw new Error("Invalid range");
  const start = m[1] ? Number(m[1]) : Math.max(0,size-Number(m[2]));
  const end = m[1] && m[2] ? Math.min(size-1,Number(m[2])) : size-1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) throw new Error("Invalid range");
  return {start,end,partial:true};
}
