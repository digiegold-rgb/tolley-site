export const IMPACT_PROGRAM = "23513";
export const IMPACT_PROPERTY = "8918206";
export const AFFILIATE_DISCLOSURE = "Affiliate disclosure: We may earn a commission on qualifying purchases through our Whatnot links.";
export const IMPACT_TAG = "https://utt.impactcdn.com/P-A7857130-2756-44ed-b3bc-09c24a5382361.js";

export function validImpactLink(value: string) {
  try { const u = new URL(value); return u.protocol === "https:" && u.hostname === "whatnot.pxf.io" && !u.username && !u.password && u.pathname.startsWith("/c/7857130/") && u.pathname.endsWith("/23513"); } catch { return false; }
}
export function validAffiliateDestination(value: string) {
  try { const u = new URL(value); return u.protocol === "https:" && ["www.whatnot.com", "whatnot.com"].includes(u.hostname) && !u.username && !u.password && /^\/(user|live|show)\/[a-zA-Z0-9_-]+\/?$/.test(u.pathname) && !u.search && !u.hash; } catch { return false; }
}
export type ImpactAction = { Id: string; CampaignId: string | number; State: string; Payout: string; Currency: string; EventDate: string };
export function summarizeImpactActions(actions: ImpactAction[], since: Date, until: Date) {
  const seen = new Set<string>();
  const groups = new Map<string, { state: string; currency: string; actions: number; commission: number }>();
  for (const a of actions) {
    if (String(a.CampaignId) !== IMPACT_PROGRAM || new Date(a.EventDate) < since || new Date(a.EventDate) > until) continue;
    if (!a.Id || !Number.isFinite(Date.parse(a.EventDate)) || !["PENDING", "APPROVED", "REVERSED"].includes(a.State) || !/^[A-Z]{3}$/.test(a.Currency) || !Number.isFinite(Number(a.Payout)) || !a.Payout.trim()) throw new Error("Impact returned an incomplete action");
    if (seen.has(a.Id)) continue;
    seen.add(a.Id);
    const key = `${a.State}:${a.Currency}`;
    const g = groups.get(key) || { state: a.State, currency: a.Currency, actions: 0, commission: 0 };
    g.actions++; g.commission += Number(a.Payout); groups.set(key, g);
  }
  return { actions: seen.size, groups: [...groups.values()].map(g => ({ ...g, commission: Math.round(g.commission * 100) / 100 })) };
}
