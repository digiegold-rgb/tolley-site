import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import {
  ESTATE_LEAD_SOURCES,
  cleanDate,
  cleanStr,
  isEstateLeadStage,
} from "@/lib/estate-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/hq/estate/leads — seller-lead pipeline, newest first.
export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const leads = await prisma.estateLead.findMany({
      orderBy: { createdAt: "desc" },
      include: { sale: { select: { id: true, slug: true, title: true } } },
    });
    return NextResponse.json({ leads });
  } catch (err) {
    console.error("[hq/estate/leads GET]", err);
    return NextResponse.json({ error: "Failed to load leads" }, { status: 500 });
  }
}

/**
 * POST — create a seller lead. Either raw fields, or { fromLeadActionId }
 * to promote a circle/inbound LeadAction row into the pipeline.
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

  try {
    if (typeof body.fromLeadActionId === "string" && body.fromLeadActionId) {
      const action = await prisma.leadAction.findUnique({
        where: { id: body.fromLeadActionId },
      });
      if (!action) {
        return NextResponse.json({ error: "LeadAction not found" }, { status: 404 });
      }
      const lead = await prisma.estateLead.create({
        data: {
          name: action.name || action.email || "Unknown (inbound)",
          email: action.email,
          phone: action.phone,
          source: action.subsite === "circle" ? "circle" : "inbound",
          notes: `Promoted from inbound ${action.subsite}/${action.action} (${action.id})`,
        },
      });
      return NextResponse.json({ ok: true, lead });
    }

    const name = cleanStr(body.name);
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

    const source = cleanStr(body.source);
    const lead = await prisma.estateLead.create({
      data: {
        name,
        phone: cleanStr(body.phone),
        email: cleanStr(body.email),
        address: cleanStr(body.address),
        city: cleanStr(body.city) ?? "Independence",
        source:
          source && (ESTATE_LEAD_SOURCES as readonly string[]).includes(source)
            ? source
            : "manual",
        stage: isEstateLeadStage(body.stage) ? body.stage : "inquiry",
        notes: cleanStr(body.notes),
        walkthroughAt: cleanDate(body.walkthroughAt),
      },
    });
    return NextResponse.json({ ok: true, lead });
  } catch (err) {
    console.error("[hq/estate/leads POST]", err);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}
