import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { sendLeadViaInstantly } from "@/lib/hq-instantly";

export const runtime = "nodejs";

// Lead stages earlier than "contacted" — a successful send advances the lead.
const PRE_CONTACT_STAGES = ["scraped", "enriched", "demo_built"];

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

      // Email approvals SEND via Instantly. Offers without a live campaign
      // fall back to the plain "approved" status above so nothing breaks.
      if (existing.channel === "email") {
        const lead = await prisma.growthLead.findUnique({
          where: { id: existing.leadId },
          select: {
            id: true,
            email: true,
            offer: true,
            name: true,
            ownerName: true,
            stage: true,
            demoUrl: true,
            rating: true,
            reviews: true,
            category: true,
            city: true,
          },
        });

        if (lead && (lead.stage === "do_not_contact" || lead.stage === "dead")) {
          return NextResponse.json(
            { error: `Lead is marked ${lead.stage} — send blocked` },
            { status: 400 }
          );
        }

        if (lead) {
          let result: { ok: boolean; reason?: string; campaignId?: string };
          try {
            result = await sendLeadViaInstantly(lead);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("[hq/touches PATCH] instantly send failed", err);
            return NextResponse.json(
              { error: "Send failed: " + message },
              { status: 502 }
            );
          }

          if (result.ok) {
            data.status = "sent";
            data.sentAt = new Date();
            const existingMeta =
              existing.meta && typeof existing.meta === "object"
                ? (existing.meta as Record<string, unknown>)
                : {};
            data.meta = {
              ...existingMeta,
              instantly: true,
              campaignId: result.campaignId,
            };

            if (PRE_CONTACT_STAGES.includes(lead.stage)) {
              await prisma.growthLead.update({
                where: { id: lead.id },
                data: { stage: "contacted" },
              });
            }
          }
        }
      }
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
