import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Channel scoreboard: what each distribution channel puts OUT (pace-probe
// counts from the latest DGX calibration snapshot) vs what comes IN (site
// visits by referrer + email leads by source, 30d). The "is it working"
// view Jared asked for — output without inbound = channel not converting.

const PACE_KEYS: Record<string, string> = {
  "fb-treasure-pace": "Treasure Haul FB",
  "fb-wd-pace": "Wash&Dry FB",
  "fb-kchomes-pace": "Your KC Homes FB",
  "pinterest-pace": "Pinterest",
};

export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since30 = new Date(Date.now() - 30 * 86400_000);
  const [snapRow, refs, leads] = await Promise.all([
    prisma.empireSnapshot.findFirst({ where: { source: "dgx" }, orderBy: { createdAt: "desc" } }).catch(() => null),
    prisma.siteView.groupBy({
      by: ["referrer"],
      where: { createdAt: { gte: since30 }, referrer: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 12,
    }).catch(() => [] as { referrer: string | null; _count: { _all: number } }[]),
    prisma.emailLead.groupBy({
      by: ["source"],
      where: { createdAt: { gte: since30 } },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 12,
    }).catch(() => [] as { source: string | null; _count: { _all: number } }[]),
  ]);

  const connections = ((snapRow?.payload as { connections?: Record<string, { ok: boolean; detail?: string; checkedAt?: string }> } | null)?.connections) ?? {};
  const out = Object.entries(PACE_KEYS).map(([key, label]) => {
    const c = connections[key];
    const m = c?.detail?.match(/^(\d+)/);
    return {
      channel: label,
      out7d: m ? Number(m[1]) : null,
      target: c?.detail?.match(/target ~?(\d+)/)?.[1] ? Number(c.detail.match(/target ~?(\d+)/)![1]) : 30,
      healthy: c?.ok ?? null,
      detail: c?.detail ?? "not calibrated yet",
    };
  });

  return NextResponse.json({
    calibratedAt: snapRow ? (snapRow.payload as { generatedAt?: string })?.generatedAt ?? snapRow.createdAt : null,
    out,
    trafficIn: refs.map((r) => ({ source: r.referrer, visits30d: r._count._all })),
    leadsIn: leads.map((l) => ({ source: l.source ?? "unknown", leads30d: l._count._all })),
  });
}
