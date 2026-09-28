import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { ledgerSchema, contribution } from "@/lib/live/core";
import { metricsSchema } from "@/lib/live/campaign";
import { impactSnapshot } from "@/lib/live/impact";
export const dynamic = "force-dynamic";
const cell = (value: unknown) => '"' + String(value ?? "").replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
export async function GET() {
  if (!(await validateWdAdmin()).authed) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const since = new Date(Date.now() - 7 * 86400000);
  const [shows, clicks, posts] = await Promise.all([
    prisma.liveShow.findMany({ where: { startsAt: { gte: since, lte: new Date() } }, orderBy: { startsAt: "asc" } }),
    prisma.siteEvent.groupBy({ by: ["event", "label"], where: { site: "live", event: { in: ["show_click", "referral_click", "campaign_visit", "impact_click"] }, createdAt: { gte: since } }, _count: true }),
    prisma.liveCampaignPost.groupBy({ by: ["platform", "status"], where: { dueAt: { gte: since, lte: new Date() } }, _count: true }),
  ]);
  const rows: unknown[][] = [["Weekly Treasure Hauls report", new Date().toISOString()], ["Show", "Start UTC", "Status", "Viewers (reported)", "Bookmarks (reported)", "Metric source", "Orders", "Sales", "Ads", "Contribution after labor", "Settled"]];
  for (const show of shows) {
    const l = ledgerSchema.safeParse(show.ledger), m = metricsSchema.safeParse(show.metrics);
    rows.push([show.title, show.startsAt.toISOString(), show.status, m.success ? m.data.viewers : "", m.success ? m.data.bookmarks : "", m.success ? m.data.source : "", l.success ? l.data.orders : "", l.success ? l.data.sales : "", l.success ? l.data.ads : "", l.success ? contribution(l.data).afterLabor : "", l.success ? l.data.settled : ""]);
  }
  rows.push([], ["Event", "Source", "Count"]);
  for (const c of clicks) rows.push([c.event, c.label, c._count]);
  rows.push([], ["Platform", "Post status", "Count"]);
  for (const p of posts) rows.push([p.platform, p.status, p._count]);
  const impact = await impactSnapshot();
  rows.push([], ["Impact affiliate snapshot (separate rolling 30-day window)", impact.checkedAt?.toISOString() || "Not synced"], ["Snapshot JSON", JSON.stringify(impact.snapshot)], ["Approved commission is not cash received. Do not add affiliate-attributed order amounts to show sales."]);
  rows.push([], ["Clicks are not purchases or referral conversions. Missing metrics are unknown, not zero. Viewer definitions remain those of the source; do not sum as unique people."]);
  return new Response(rows.map(r => r.map(cell).join(",")).join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="treasure-hauls-weekly.csv"', "Cache-Control": "no-store" } });
}
