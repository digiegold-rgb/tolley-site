import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/hq/estate/vips — the estate-alerts VIP email list (the moat).
 * Count always; the address list only with ?list=1 (PII stays behind a
 * deliberate click). Same selection the alert cron blasts to.
 */
export async function GET(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = { source: "estate-alerts", optedIn: true } as const;
  try {
    const count = await prisma.emailLead.count({ where });
    if (request.nextUrl.searchParams.get("list") !== "1") {
      return NextResponse.json({ count });
    }
    const subscribers = await prisma.emailLead.findMany({
      where,
      select: { email: true, createdAt: true, tags: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ count, subscribers });
  } catch (err) {
    console.error("[hq/estate/vips GET]", err);
    return NextResponse.json({ error: "Failed to load VIP list" }, { status: 500 });
  }
}
