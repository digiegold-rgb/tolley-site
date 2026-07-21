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

// PATCH /api/hq/estate/leads/[id] — stage moves + field edits.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if ("stage" in body) {
    if (!isEstateLeadStage(body.stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    data.stage = body.stage;
  }
  if ("name" in body) {
    const name = cleanStr(body.name);
    if (name) data.name = name;
  }
  for (const key of ["phone", "email", "address", "notes"] as const) {
    if (key in body) data[key] = cleanStr(body[key]);
  }
  if ("city" in body) data.city = cleanStr(body.city) ?? "Independence";
  if ("source" in body) {
    const source = cleanStr(body.source);
    if (source && (ESTATE_LEAD_SOURCES as readonly string[]).includes(source)) {
      data.source = source;
    }
  }
  if ("walkthroughAt" in body) data.walkthroughAt = cleanDate(body.walkthroughAt);
  if ("saleId" in body) {
    data.saleId = cleanStr(body.saleId); // null unlinks
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No recognized fields" }, { status: 400 });
  }

  try {
    const lead = await prisma.estateLead.update({
      where: { id },
      data,
      include: { sale: { select: { id: true, slug: true, title: true } } },
    });
    return NextResponse.json({ ok: true, lead });
  } catch (err) {
    console.error("[hq/estate/leads PATCH]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

// DELETE — remove a lead (misfires/spam only; real outcomes use stage done|lost).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { authed } = await validateWdAdmin();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.estateLead.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
}
