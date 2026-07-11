import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { INBOUND_STATUSES } from "@/lib/hq";

export const runtime = "nodejs";

// GET /api/hq/inbound?status=new&subsite=pools — inbound leads, newest first.
// Merges three sources into one LeadAction-shaped list (id prefixes route
// PATCH updates back to the right table — see ./[id]/route.ts):
//   • LeadAction        — agent/structured submissions (plain cuid id)
//   • EmailLead         — network-wide email captures      (id "email_<cuid>")
//   • ClientPortalSignup — /client portal signups           (id "portal_<cuid>")
// Same gate as the rest of /hq (WD admin PIN cookie).
export async function GET(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const subsite = searchParams.get("subsite");

  const statusFilter =
    status && (INBOUND_STATUSES as readonly string[]).includes(status)
      ? status
      : null;

  try {
    const [actions, emailLeads, portalSignups] = await Promise.all([
      prisma.leadAction.findMany({
        where: {
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(subsite ? { subsite } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.emailLead.findMany({
        where: {
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(subsite ? { source: subsite } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      subsite && subsite !== "client"
        ? Promise.resolve([])
        : prisma.clientPortalSignup.findMany({
            where: { ...(statusFilter ? { status: statusFilter } : {}) },
            orderBy: { createdAt: "desc" },
            take: 500,
          }),
    ]);

    const emailRows = emailLeads.map((l) => ({
      id: `email_${l.id}`,
      subsite: l.source,
      action: "email_capture",
      name: l.name,
      email: l.email,
      phone: null,
      structured:
        l.data && typeof l.data === "object" && !Array.isArray(l.data)
          ? (l.data as Record<string, unknown>)
          : null,
      status: l.status,
      statusNote: l.statusNote,
      statusUpdatedAt: l.statusUpdatedAt,
      createdAt: l.createdAt,
    }));

    const portalRows = portalSignups.map((s) => ({
      id: `portal_${s.id}`,
      subsite: "client",
      action: `portal_signup_${s.type}`,
      name: null,
      email: s.email,
      phone: s.phone,
      structured: Object.fromEntries(
        Object.entries({
          role: s.role,
          city: s.city,
          zip: s.zip,
          referrer: s.referrer,
        }).filter(([, v]) => v != null)
      ),
      status: s.status,
      statusNote: s.statusNote,
      statusUpdatedAt: s.statusUpdatedAt,
      createdAt: s.createdAt,
    }));

    const rows = [...actions, ...emailRows, ...portalRows].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Counts by status for the tab badge + column headers.
    const grouped = await Promise.all([
      prisma.leadAction.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.emailLead.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.clientPortalSignup.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);
    const counts: Record<string, number> = {};
    for (const g of grouped.flat()) {
      counts[g.status] = (counts[g.status] ?? 0) + g._count._all;
    }

    return NextResponse.json({ leads: rows, counts });
  } catch (err) {
    console.error("[hq/inbound] load failed", err);
    return NextResponse.json({ error: "Failed to load inbound leads" }, { status: 500 });
  }
}
