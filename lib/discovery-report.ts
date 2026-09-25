import { attributionSource, normalizeAttribution, reportedSourceKey } from "./discovery-attribution";
export type DiscoveryLead = { id: string; name: string; offer: string; attribution: unknown; referralRootId: string | null; discoveryStage: string | null; createdAt: Date; };
export type DiscoveryPayment = { receiptKey: string; leadId: string; amountCents: number; collectedAt: Date };
export function summarizeDiscovery(leads: DiscoveryLead[], payments: DiscoveryPayment[], since: Date, until = new Date()) {
  const byId = new Map(leads.map(l => [l.id, l]));
  const groups = new Map<string, { source: string; evidence: string; offering: string; inquiries: number; customers: Set<string>; qualified: number; estimated: number; booked: number; collectedCents: number }>();
  function group(l: DiscoveryLead) {
    const root = byId.get(l.referralRootId || l.id) || l;
    const a = normalizeAttribution(root.attribution);
    const reported = reportedSourceKey(a?.reportedSource);
    const source = reported || attributionSource(a);
    const evidence = reported ? "customer-reported" : a?.campaignSource || a?.shareSource ? "campaign" : a?.referrerHost ? "browser-referral" : "unknown";
    const key = `${source}:${evidence}:${l.offer}`;
    if (!groups.has(key)) groups.set(key, { source, evidence, offering: l.offer, inquiries: 0, customers: new Set(), qualified: 0, estimated: 0, booked: 0, collectedCents: 0 });
    return groups.get(key)!;
  }
  const customers = new Set<string>();
  for (const l of leads) {
    if (l.createdAt < since || l.createdAt > until) continue;
    const g = group(l); g.inquiries++; g.customers.add(l.referralRootId || l.id); customers.add(l.referralRootId || l.id);
    if (["qualified", "estimated", "booked"].includes(l.discoveryStage || "")) g.qualified++;
    if (["estimated", "booked"].includes(l.discoveryStage || "")) g.estimated++;
    if (l.discoveryStage === "booked") g.booked++;
  }
  const receipts = new Set<string>();
  for (const p of payments) {
    if (receipts.has(p.receiptKey) || p.collectedAt < since || p.collectedAt > until) continue;
    const l = byId.get(p.leadId); if (!l) continue;
    receipts.add(p.receiptKey); group(l).collectedCents += p.amountCents;
  }
  return { customers: customers.size, collectedCents: [...groups.values()].reduce((n, g) => n + g.collectedCents, 0), groups: [...groups.values()].map(g => ({ ...g, customers: g.customers.size })) };
}
