import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { secretEquals } from "@/lib/secret-compare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * No UI caller — agent/curl only (kept on purpose). SMS is off, so nothing in
 * /hq reads this yet; the ingest lane is driven by vault-ingest.mjs.
 *
 * Contact Vault — the phone-keyed merge of Jared's and Ruthann's address books.
 *
 * POST (x-sync-secret): ~/business-os/bin/vault-ingest.mjs pushes parsed batches.
 * On upsert each number is cross-referenced against the people we already know
 * (W/D clients, estate leads, growth leads, SMS conversations) so we never treat
 * a paying customer like a stranger — and any prior opt-out anywhere in the
 * system carries in as permanent suppression.
 *
 * GET (admin cookie): vault stats + rows for /hq.
 */

async function authorized(request: NextRequest): Promise<boolean> {
  const secret = request.headers.get("x-sync-secret");
  if (secret && secretEquals(secret, process.env.SYNC_SECRET)) return true;
  const { authed } = await validateWdAdmin();
  return authed;
}

/** Last 10 digits — the only reliable join key against free-form stored phones. */
function last10(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = v.replace(/[^\d]/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
}

interface IncomingEntry {
  phoneE164: string;
  displayName?: string | null;
  org?: string | null;
  emails?: string[];
  sources?: string[];
  isPerson?: boolean;
  areaCode?: string | null;
  isKcMetro?: boolean;
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { entries?: IncomingEntry[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const entries = (body.entries || []).filter((e) => /^\+1\d{10}$/.test(e.phoneE164 || ""));
  if (entries.length === 0) {
    return NextResponse.json({ error: "no valid entries (need E.164 +1XXXXXXXXXX)" }, { status: 400 });
  }
  if (entries.length > 500) {
    return NextResponse.json({ error: "batch too large (max 500)" }, { status: 400 });
  }

  // ── Build the known-people index once per batch, keyed on last-10 digits ──
  const keys = new Set(entries.map((e) => e.phoneE164.slice(-10)));

  const [wdClients, estateLeads, growthLeads, smsConvos, leadActions] = await Promise.all([
    prisma.wdClient.findMany({ select: { id: true, phone: true } }),
    prisma.estateLead.findMany({ select: { id: true, phone: true } }),
    prisma.growthLead.findMany({ select: { id: true, phone: true, stage: true } }),
    prisma.smsConversation.findMany({ select: { id: true, phoneNumber: true, status: true } }),
    prisma.leadAction.findMany({ select: { id: true, phone: true } }),
  ]);

  // Priority order matters: a paying W/D client outranks a scraped growth lead.
  const known = new Map<string, { type: string; id: string; relationship: string }>();
  const put = (phone: string | null, type: string, id: string, relationship: string) => {
    const k = last10(phone);
    if (!k || !keys.has(k) || known.has(k)) return;
    known.set(k, { type, id, relationship });
  };
  for (const c of wdClients) put(c.phone, "wd_client", c.id, "customer");
  for (const l of estateLeads) put(l.phone, "estate_lead", l.id, "customer");
  for (const s of smsConvos) put(s.phoneNumber, "sms_known", s.id, "recent_2way");
  for (const a of leadActions) put(a.phone, "lead_action", a.id, "known");
  for (const g of growthLeads) put(g.phone, "growth_lead", g.id, "known");

  // ── Suppression: any prior opt-out anywhere is permanent and global ──
  const suppress = new Map<string, string>();
  for (const s of smsConvos) {
    if (s.status === "opted_out") {
      const k = last10(s.phoneNumber);
      if (k) suppress.set(k, "sms STOP");
    }
  }
  for (const g of growthLeads) {
    if (g.stage === "do_not_contact" || g.stage === "dead") {
      const k = last10(g.phone);
      if (k) suppress.set(k, `crm ${g.stage}`);
    }
  }

  let upserted = 0;
  let linked = 0;
  let suppressed = 0;

  for (const e of entries) {
    const k = e.phoneE164.slice(-10);
    const hit = known.get(k);
    const stop = suppress.get(k);

    const base = {
      displayName: e.displayName?.slice(0, 200) || null,
      org: e.org?.slice(0, 200) || null,
      emails: (e.emails || []).slice(0, 5),
      sources: e.sources || [],
      isPerson: e.isPerson ?? true,
      areaCode: e.areaCode || null,
      isKcMetro: e.isKcMetro ?? false,
      linkedType: hit?.type || null,
      linkedId: hit?.id || null,
      relationship: hit?.relationship || (e.isPerson === false ? "business" : "unknown"),
      ...(stop
        ? { suppressed: true, suppressedAt: new Date(), suppressReason: stop }
        : {}),
    };

    await prisma.contactVaultEntry.upsert({
      where: { phoneE164: e.phoneE164 },
      // Never un-suppress on re-ingest: a later import must not resurrect
      // someone who opted out. `suppressed` is only ever set true here.
      update: base,
      create: { phoneE164: e.phoneE164, ...base },
    });

    upserted++;
    if (hit) linked++;
    if (stop) suppressed++;
  }

  return NextResponse.json({ ok: true, upserted, linked, suppressed });
}

export async function GET(request: NextRequest) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);

  // Audience-sync export: every invitable number, phones only, cursor-paged.
  // Deliberately separate from the /hq view so the UI payload stays small and
  // the sync never silently truncates at some display limit.
  if (url.searchParams.get("export") === "phones") {
    const cursor = url.searchParams.get("cursor");
    const kcOnly = url.searchParams.get("kcOnly") === "1";
    const page = await prisma.contactVaultEntry.findMany({
      where: {
        isPerson: true,
        suppressed: false,
        ...(kcOnly ? { isKcMetro: true } : {}),
      },
      orderBy: { phoneE164: "asc" },
      take: 1000,
      ...(cursor ? { skip: 1, cursor: { phoneE164: cursor } } : {}),
      select: { phoneE164: true, emails: true },
    });
    return NextResponse.json({
      phones: page.map((p) => p.phoneE164),
      emails: page.flatMap((p) => p.emails),
      nextCursor: page.length === 1000 ? page[page.length - 1].phoneE164 : null,
    });
  }

  const [total, people, kc, linked, suppressed, withEmail, rows] = await Promise.all([
    prisma.contactVaultEntry.count(),
    prisma.contactVaultEntry.count({ where: { isPerson: true } }),
    prisma.contactVaultEntry.count({ where: { isKcMetro: true, isPerson: true } }),
    prisma.contactVaultEntry.count({ where: { linkedType: { not: null } } }),
    prisma.contactVaultEntry.count({ where: { suppressed: true } }),
    prisma.contactVaultEntry.count({ where: { emails: { isEmpty: false } } }),
    prisma.contactVaultEntry.findMany({
      where: { isPerson: true, suppressed: false },
      orderBy: [{ relationship: "asc" }, { updatedAt: "desc" }],
      take: limit,
      select: {
        id: true, phoneE164: true, displayName: true, org: true, sources: true,
        areaCode: true, isKcMetro: true, linkedType: true, relationship: true,
        emails: true, invites: true,
      },
    }),
  ]);

  return NextResponse.json({
    stats: { total, people, kcMetro: kc, linkedToCustomers: linked, suppressed, withEmail },
    rows,
  });
}
