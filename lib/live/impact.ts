import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { WHATNOT_PROFILE } from "./core";
import { canPromote } from "./campaign";
import { IMPACT_PROGRAM, IMPACT_PROPERTY, validImpactLink, validAffiliateDestination, summarizeImpactActions, type ImpactAction } from "./impact-core";

const configured = () => !!(process.env.IMPACT_ACCOUNT_SID && process.env.IMPACT_AUTH_TOKEN);
const root = () => `/Mediapartners/${process.env.IMPACT_ACCOUNT_SID}`;
const code = (url: string) => `hauls-impact-${createHash("sha256").update(url).digest("hex").slice(0, 24)}`;
async function impact(path: string, method = "GET") {
  if (!configured() || !path.startsWith(root() + "/")) throw new Error("Impact connection is unavailable");
  const r = await fetch(`https://api.impact.com${path}`, { method, headers: { Accept: "application/json", Authorization: `Basic ${Buffer.from(`${process.env.IMPACT_ACCOUNT_SID}:${process.env.IMPACT_AUTH_TOKEN}`).toString("base64")}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Impact request failed (${r.status})`);
  return r.json();
}
export async function cachedImpactLink(destination: string) {
  const row = await prisma.affiliateLink.findUnique({ where: { shortCode: code(destination) }, select: { affiliateUrl: true, isActive: true, productUrl: true } }).catch(() => null);
  return row?.isActive && row.productUrl === destination && validImpactLink(row.affiliateUrl) ? row.affiliateUrl : null;
}
export async function ensureImpactLink(destination: string, label: string) {
  if (!validAffiliateDestination(destination)) throw new Error("Use a direct Whatnot profile or show URL, never an invite URL");
  const existing = await cachedImpactLink(destination);
  if (existing) return existing;
  const program = await impact(`${root()}/Campaigns/${IMPACT_PROGRAM}`);
  if (program.ContractStatus !== "Active" || String(program.AllowsDeeplinking) !== "true") throw new Error("Whatnot affiliate contract or deep linking is inactive");
  const params = new URLSearchParams({ Type: "Regular", DeepLink: destination, MediaPartnerPropertyId: IMPACT_PROPERTY, subId1: "tolley_live", subId2: label.slice(0, 80) });
  const result = await impact(`${root()}/Programs/${IMPACT_PROGRAM}/TrackingLinks?${params}`, "POST");
  if (!validImpactLink(result.TrackingURL)) throw new Error("Impact returned an unexpected tracking domain");
  await prisma.affiliateLink.upsert({ where: { shortCode: code(destination) }, create: { network: "impact-whatnot", shortCode: code(destination), productUrl: destination, affiliateUrl: result.TrackingURL, title: `Treasure Hauls · ${label}`, category: "live" }, update: { affiliateUrl: result.TrackingURL, isActive: true } });
  return result.TrackingURL as string;
}
export async function impactSnapshot() {
  const event = await prisma.siteEvent.findFirst({ where: { site: "live", event: "impact_snapshot" }, orderBy: { createdAt: "desc" }, select: { createdAt: true, meta: true } });
  return { configured: configured(), snapshot: event?.meta ?? null, checkedAt: event?.createdAt ?? null };
}
/** Aggregate a complete rolling 30-day window; no buyer/order data is retained. */
export async function syncImpact() {
  const program = await impact(`${root()}/Campaigns/${IMPACT_PROGRAM}`);
  const active = program.ContractStatus === "Active";
  if (!active) await prisma.affiliateLink.updateMany({ where: { network: "impact-whatnot" }, data: { isActive: false } });
  const until = new Date(Math.floor(Date.now() / 1000) * 1000), since = new Date(until.getTime() - 30 * 86400000);
  // Impact rejects fractional seconds even though they are valid ISO-8601.
  let path = `${root()}/Actions?${new URLSearchParams({ CampaignId: IMPACT_PROGRAM, ActionDateStart: since.toISOString().replace(".000Z", "Z"), ActionDateEnd: until.toISOString().replace(".000Z", "Z"), PageSize: "100" })}`;
  const actions: ImpactAction[] = [];
  for (let page = 0; path; page++) {
    if (page >= 50) throw new Error("Impact report exceeded the complete-report limit; use Impact for the full export");
    const result = await impact(path);
    if (!Array.isArray(result.Actions)) throw new Error("Impact report is unavailable");
    actions.push(...result.Actions);
    path = result["@nextpageuri"] || "";
    if (path && !path.startsWith(`${root()}/Actions?`)) throw new Error("Unexpected Impact pagination path");
  }
  const summary = { ...summarizeImpactActions(actions, since, until), since: since.toISOString(), until: until.toISOString(), program: "Whatnot Affiliates", contractStatus: program.ContractStatus, source: "Impact Actions API", paidCash: null };
  await prisma.siteEvent.create({ data: { site: "live", path: "/stream/growth", event: "impact_snapshot", meta: summary } });
  if (active) {
    await ensureImpactLink(WHATNOT_PROFILE, "profile");
    const shows = await prisma.liveShow.findMany({ where: { status: { in: ["confirmed", "live"] } }, orderBy: { startsAt: "asc" }, take: 20 });
    for (const show of shows.filter(s => canPromote(s))) await ensureImpactLink(show.whatnotUrl, `show_${show.id}`);
  }
  return summary;
}
export async function syncImpactIfDue() {
  if (!configured()) return;
  const last = await prisma.siteEvent.findFirst({ where: { site: "live", event: { in: ["impact_sync_attempt", "impact_snapshot"] } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (last && Date.now() - last.createdAt.getTime() < 24 * 3600000) return;
  await prisma.siteEvent.create({ data: { site: "live", path: "/stream/growth", event: "impact_sync_attempt" } });
  try { await syncImpact(); } catch { await prisma.siteEvent.create({ data: { site: "live", path: "/stream/growth", event: "impact_sync_error", meta: { message: "Impact sync failed; the previous snapshot remains visible. Retry from Growth." } } }); }
}
