import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";

export const runtime = "nodejs";

// PATCH /api/hq/touches/[id]
// { action: "approve" } → status=approved (sender cron picks these up later)
// { action: "discard" } → status=discarded
// { subject?, body? }   → edit a draft in place
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.growthTouch.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payload = await request.json();
    const data: Record<string, unknown> = {};

    if (payload.action === "approve") {
      if (existing.status !== "draft") {
        return NextResponse.json(
          { error: `Only drafts can be approved (status is "${existing.status}")` },
          { status: 400 }
        );
      }
      data.status = "approved";
    } else if (payload.action === "discard") {
      if (existing.status !== "draft" && existing.status !== "approved") {
        return NextResponse.json(
          { error: `Only drafts can be discarded (status is "${existing.status}")` },
          { status: 400 }
        );
      }
      data.status = "discarded";
    } else if (payload.action !== undefined) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    if ("subject" in payload || "body" in payload) {
      if (existing.status !== "draft") {
        return NextResponse.json(
          { error: `Only drafts can be edited (status is "${existing.status}")` },
          { status: 400 }
        );
      }
      if ("subject" in payload) {
        data.subject =
          typeof payload.subject === "string" && payload.subject.trim()
            ? payload.subject.trim()
            : null;
      }
      if ("body" in payload) {
        if (typeof payload.body !== "string" || !payload.body.trim()) {
          return NextResponse.json({ error: "Body cannot be empty" }, { status: 400 });
        }
        data.body = payload.body.trim();
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.growthTouch.update({
      where: { id },
      data,
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            offer: true,
            city: true,
            email: true,
            phone: true,
            stage: true,
          },
        },
      },
    });

    return NextResponse.json({ touch: updated });
  } catch (err) {
    console.error("[hq/touches PATCH]", err);
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }
}
