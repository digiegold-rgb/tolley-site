import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { INBOUND_STATUSES } from "@/lib/hq";

export const runtime = "nodejs";

// PATCH /api/hq/inbound/[id] — advance an inbound lead's status and/or note.
// Body: { status?, note? }
export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: { status?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) {
    const status = String(body.status);
    if (!(INBOUND_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. One of: ${INBOUND_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }
    data.status = status;
    data.statusUpdatedAt = new Date();
  }
  if (body.note !== undefined) {
    data.statusNote = String(body.note).slice(0, 2000);
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    // Prefixed ids route to the merged sources (see ../route.ts). Plain cuids
    // never contain "_", so the prefixes are unambiguous.
    let lead: unknown;
    if (id.startsWith("email_")) {
      lead = await prisma.emailLead.update({
        where: { id: id.slice("email_".length) },
        data,
      });
    } else if (id.startsWith("portal_")) {
      lead = await prisma.clientPortalSignup.update({
        where: { id: id.slice("portal_".length) },
        data,
      });
    } else {
      lead = await prisma.leadAction.update({ where: { id }, data });
    }
    return NextResponse.json({ lead });
  } catch (err) {
    console.error("[hq/inbound] update failed", err);
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
}
