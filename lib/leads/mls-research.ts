import { z } from "zod";
import { scoreListing } from "@/lib/lead-scoring";

const amount = z.number().finite().nonnegative().nullable().default(null);
export const mlsCaptureSchema = z.object({
  provider: z.literal("remine"), recordId: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  mlsNumber: z.string().regex(/^\d{1,12}$/),
  observedAt: z.iso.datetime(), sourceUrl: z.url().refine(value => { const u = new URL(value); return u.protocol === "https:" && u.hostname === "hmls.remine.com" && !u.search && !u.hash; }),
  address: z.string().trim().min(3).max(250), city: z.string().trim().min(2).max(80), state: z.enum(["MO", "KS"]), zip: z.string().regex(/^\d{5}$/),
  status: z.enum(["Active", "Expired", "Withdrawn", "Canceled", "Off Market", "Pending", "Sold", "Unknown"]),
  daysOnMarket: z.number().int().min(0).max(10000).nullable().default(null), listPrice: amount, originalListPrice: amount,
  beds: amount, baths: amount, sqft: amount, estimatedValue: amount, equity: amount,
  ownershipYears: amount, sellScore: z.enum(["High", "Medium", "Low"]).nullable().default(null),
  ownerName: z.string().trim().max(200).nullable().default(null),
  remarks: z.string().max(12000).default(""), detailText: z.string().min(100).max(24000),
  detailVerified: z.literal(true), plan: z.string().max(100).default("Available account access"),
});
export type MlsCapture = z.infer<typeof mlsCaptureSchema>;
export const mlsSweepSchema = z.object({
  runId: z.uuid(), observedAt: z.iso.datetime(), status: z.enum(["ready", "empty", "reauth_required", "error"]),
  message: z.string().max(500), captures: z.array(mlsCaptureSchema).max(20),
}).superRefine((v, ctx) => {
  if (v.status !== "ready" && v.captures.length) ctx.addIssue({code:"custom",message:"Only a successful sweep can include captures",path:["captures"]});
  if (v.status === "ready" && !v.captures.length) ctx.addIssue({code:"custom",message:"Use empty for a sweep without matches",path:["status"]});
});
export function inMlsFarm(c: Pick<MlsCapture, "city" | "state">) {
  return (c.city.toLowerCase() === "independence" && c.state === "MO") || (c.city.toLowerCase() === "kansas city" && ["MO", "KS"].includes(c.state));
}
export function scoreMlsCapture(c: MlsCapture) {
  if (!inMlsFarm(c) || !["Active", "Expired", "Withdrawn", "Canceled", "Off Market"].includes(c.status)) return {score:0,reasons:["Outside current target criteria"]};
  const result = scoreListing({...c, status:c.status === "Canceled" ? "Withdrawn" : c.status, propertyType:null});
  let score = result.score;
  const reasons = Object.entries(result.factors).filter(([,points]) => points > 0).map(([name,points]) => `${name}: +${points}`);
  if (c.sellScore === "High") { score += 20; reasons.push("Remine High sell score: +20"); }
  if (c.equity !== null && c.estimatedValue && c.equity / c.estimatedValue >= .4) { score += 10; reasons.push("Reported equity at least 40% of estimated value: +10"); }
  if (c.ownershipYears !== null && c.ownershipYears >= 10) { score += 10; reasons.push("Reported ownership at least 10 years: +10"); }
  return {score:Math.min(100, score),reasons};
}
export const privateMlsResearchSchema = z.object({version:z.literal(1),runId:z.uuid(),capture:mlsCaptureSchema,score:z.number().min(0).max(100),reasons:z.array(z.string())});
export type PrivateMlsResearch = z.infer<typeof privateMlsResearchSchema>;

export function mlsObservationIsStale(observedAt: string) {
  return Date.now() - new Date(observedAt).getTime() > 36 * 3600000;
}
