import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { cleanChecklist, cleanDate, cleanStr } from "@/lib/estate-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hq/estate/sales — all sales (newest first) + lead counts.
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sales = await prisma.estateSale.findMany({
      orderBy: { startsAt: "desc" },
      include: { _count: { select: { leads: true } } },
    });
    return NextResponse.json({ sales });
  } catch (err) {
    console.error("[hq/estate/sales GET]", err);
    return NextResponse.json({ error: "Failed to load sales" }, { status: 500 });
  }
}

/**
 * POST — create a sale row. Creating a row with photos is what arms the
 * announcement email (cron pass 2), so photos are NOT accepted here; they're
 * added afterwards via the photos endpoint, keeping "row exists" and
 * "announcement armed" two deliberate steps.
 */
export async function POST(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = cleanStr(body.slug);
  const title = cleanStr(body.title);
  const areaLabel = cleanStr(body.areaLabel) ?? "Independence, MO";
  const startsAt = cleanDate(body.startsAt);
  const endsAt = cleanDate(body.endsAt);

  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json(
      { error: "slug required — lowercase-kebab, e.g. independence-aug-14-15" },
      { status: 400 },
    );
  }
  if (!title || !startsAt || !endsAt) {
    return NextResponse.json({ error: "title, startsAt, endsAt required" }, { status: 400 });
  }
  if (endsAt < startsAt) {
    return NextResponse.json({ error: "endsAt before startsAt" }, { status: 400 });
  }

  const days = Array.isArray(body.days) ? body.days : [];

  try {
    const sale = await prisma.estateSale.create({
      data: {
        slug,
        title,
        areaLabel,
        startsAt,
        endsAt,
        days,
        description: cleanStr(body.description),
        highlights: Array.isArray(body.highlights)
          ? (body.highlights.filter((h) => typeof h === "string" && h.trim()) as string[])
          : [],
        checklist: cleanChecklist(body.checklist) ?? {},
      },
    });
    return NextResponse.json({ ok: true, sale });
  } catch (err) {
    console.error("[hq/estate/sales POST]", err);
    const message = err instanceof Error && err.message.includes("Unique")
      ? "Slug already exists"
      : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
