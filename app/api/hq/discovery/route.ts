import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { normalizeAttribution } from "@/lib/discovery-attribution";
import { summarizeDiscovery } from "@/lib/discovery-report";
import { publicOfferings } from "@/lib/discovery";
import { getSkipHashes, getSkipIps, keepVisitRow } from "@/lib/visit-filters";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: NextRequest) {
  if (!(await validateWdAdmin()).authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const days = Math.max(1, Math.min(90, Number(req.nextUrl.searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 86400000);
  const [leads, payments, events, health, actions] = await Promise.all([
    prisma.growthLead.findMany({ where: { AND: [{ OR: [{ source: { in: ["cleanouts-page", "discovery-inquiry", "manual-discovery", "discovery-action"] } }, { attribution: { not: Prisma.DbNull } }, { discoveryStage: { not: null } }] }, { OR: [{ createdAt: { gte: since } }, { discoveryRevenue: { some: { collectedAt: { gte: since } } } }] }] }, orderBy: { createdAt: "desc" }, take: 5001 }),
    prisma.discoveryRevenue.findMany({ where: { collectedAt: { gte: since } }, orderBy: { collectedAt: "desc" }, take: 5001 }),
    prisma.siteEvent.findMany({ where: { createdAt: { gte: since }, event: { in: ["phone_click", "sms_click", "inquiry_success"] } }, take: 10001, orderBy: { createdAt: "desc" } }),
    prisma.siteEvent.findFirst({ where: { event: "discovery_health" }, orderBy: { createdAt: "desc" }, select: { createdAt: true, meta: true } }),
    prisma.leadAction.findMany({ where: { createdAt: { gte: since } }, take: 5001, orderBy: { createdAt: "desc" } }),
  ]);
  const roots = await prisma.growthLead.findMany({ where: { id: { in: [...new Set(leads.map(l => l.referralRootId).filter((v): v is string => !!v))] } } });
  const all = [...new Map([...leads, ...roots].map(l => [l.id, l])).values()];
  const skipIps = getSkipIps(), skipHashes = getSkipHashes(skipIps);
  const importedIds = new Set(all.map(l => l.id));
  const unimportedActions = actions.filter(a => !importedIds.has(`discovery-action:${a.id}`));
  const kept = events.filter(e => keepVisitRow(e, skipIps, skipHashes));
  return NextResponse.json({ days, ...summarizeDiscovery([...all, ...unimportedActions.map(a => ({ id: `action:${a.id}`, name: a.name || "Inquiry", offer: a.subsite === "realestate" ? "realestateanimated" : a.subsite, attribution: a.attribution, referralRootId: null, discoveryStage: null, createdAt: a.createdAt }))], payments, since), truncated: actions.length > 5000 || leads.length > 5000 || payments.length > 5000 || events.length > 10000,
    clicks: { phone: kept.filter(e => e.event === "phone_click").length, sms: kept.filter(e => e.event === "sms_click").length },
    leads: [...leads.map(l => ({ id: l.id, name: l.name, offer: l.offer, attribution: l.attribution, referralRootId: l.referralRootId, discoveryStage: l.discoveryStage, createdAt: l.createdAt })),
      ...unimportedActions.map(a => ({ id: `action:${a.id}`, name: a.name || a.email || "Inquiry", offer: a.subsite === "realestate" ? "realestateanimated" : a.subsite, attribution: a.attribution, referralRootId: null, discoveryStage: null, createdAt: a.createdAt }))].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 200),
    offerings: publicOfferings().map(s => ({ name: s.name, title: s.title })), health,
  }, { headers });
}
const create = z.object({ operation: z.literal("lead"), name: z.string().trim().min(1).max(120), offer: z.string(), reportedSource: z.string().max(300).optional(), referralRootId: z.string().optional(), contact: z.string().max(200).optional(), notes: z.string().max(2000).optional() });
const outcome = z.object({ operation: z.literal("outcome"), leadId: z.string().min(1), stage: z.enum(["qualified", "estimated", "booked", "lost"]) });
const revenue = z.object({ operation: z.literal("revenue"), leadId: z.string().min(1), receiptKey: z.string().trim().min(1).max(150), amountCents: z.number().int().positive().max(2147483647), collectedAt: z.iso.datetime() });
const schema = z.discriminatedUnion("operation", [create, outcome, revenue]);
// Materialize an existing action only when its owner records an outcome or
// relates another opportunity. Deterministic IDs make concurrent imports safe.
async function resolveLead(id: string) {
  if (!id.startsWith("action:")) return prisma.growthLead.findUnique({ where: { id } });
  const action = await prisma.leadAction.findUnique({ where: { id: id.slice(7) } });
  if (!action) return null;
  return prisma.growthLead.upsert({ where: { id: `discovery-action:${action.id}` }, update: {}, create: {
    id: `discovery-action:${action.id}`, name: action.name || action.email || "Inquiry",
    offer: action.subsite === "realestate" ? "realestateanimated" : action.subsite,
    source: "discovery-action", stage: "replied", phone: action.phone, email: action.email,
    attribution: action.attribution ?? Prisma.DbNull, createdAt: action.createdAt,
    notes: `Original inquiry: ${action.id} (${action.action}).`,
  } });
}
export async function POST(req: NextRequest) {
  if (!(await validateWdAdmin()).authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the required fields and amount." }, { status: 400 });
  const b = parsed.data;
  if (b.operation === "lead") {
    if (!publicOfferings().some(s => s.name === b.offer)) return NextResponse.json({ error: "Unknown offering" }, { status: 400 });
    const parent = b.referralRootId ? await resolveLead(b.referralRootId) : null;
    if (b.referralRootId && !parent) return NextResponse.json({ error: "Original lead not found" }, { status: 400 });
    const attribution = normalizeAttribution({ reportedSource: b.reportedSource, landingPath: "/" });
    const lead = await prisma.growthLead.create({ data: { name: b.name, offer: b.offer, source: "manual-discovery", stage: "replied", notes: b.notes || null, referralRootId: parent ? parent.referralRootId || parent.id : null, attribution, ...(b.contact?.includes("@") ? { email: b.contact } : { phone: b.contact || null }) } });
    return NextResponse.json({ ok: true, leadId: lead.id }, { headers });
  }
  const lead = await resolveLead(b.leadId);
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (b.operation === "outcome") {
    await prisma.growthLead.update({ where: { id: lead.id }, data: { discoveryStage: b.stage } });
  } else {
    if (new Date(b.collectedAt).getTime() > Date.now()) return NextResponse.json({ error: "Only record money already collected." }, { status: 400 });
    try { await prisma.discoveryRevenue.create({ data: { receiptKey: b.receiptKey, leadId: lead.id, amountCents: b.amountCents, collectedAt: new Date(b.collectedAt) } }); }
    catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ error: "This receipt is already recorded; no revenue was added." }, { status: 409 }); throw e; }
  }
  return NextResponse.json({ ok: true }, { headers });
}
