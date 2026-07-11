import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { sendLeadViaInstantly, campaignIdForOffer } from "@/lib/hq-instantly";

export const runtime = "nodejs";

const PRE_CONTACT_STAGES = ["scraped", "enriched", "demo_built"];

/**
 * POST /api/hq/touches/bulk-approve
 * { offer: "site" | "delivery" | ..., count?: number (default 10, max 25), dryRun?: boolean }
 *
 * One-click batch send: picks the top-N draft EMAIL touches (one per lead,
 * ranked by fit score then review count) whose lead has an email and hasn't
 * been contacted, pushes each into the offer's Instantly campaign (which owns
 * the timed follow-up sequence + stop-on-reply), and marks touch sent /
 * lead contacted — the same transition as approving one-by-one in the queue.
 * dryRun returns the ranked batch without sending anything.
 */
export async function POST(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { offer?: string; count?: number; dryRun?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // empty body → defaults
  }
  const offer = (body.offer || "site").trim();
  const count = Math.min(Math.max(Number(body.count) || 10, 1), 25);
  const dryRun = Boolean(body.dryRun);

  if (!campaignIdForOffer(offer)) {
    return NextResponse.json(
      { error: `No Instantly campaign configured for offer "${offer}"` },
      { status: 400 },
    );
  }

  // Ranked candidates: draft email touches on uncontacted leads with emails.
  const touches = await prisma.growthTouch.findMany({
    where: {
      status: "draft",
      channel: "email",
      lead: {
        offer,
        email: { not: null },
        stage: { in: PRE_CONTACT_STAGES },
      },
    },
    include: {
      lead: {
        select: {
          id: true, name: true, email: true, offer: true, ownerName: true,
          stage: true, score: true, reviews: true, rating: true,
          category: true, city: true, demoUrl: true,
        },
      },
    },
    orderBy: [
      { lead: { score: "desc" } },
      { lead: { reviews: "desc" } },
    ],
    take: count * 4, // headroom for the one-per-lead dedupe below
  });

  // One touch per lead AND per email (multi-location businesses share an
  // inbox — don't burn two batch slots on the same recipient), ranking order.
  const seenLead = new Set<string>();
  const seenEmail = new Set<string>();
  const batch = touches.filter((t) => {
    const email = t.lead.email!.toLowerCase();
    if (seenLead.has(t.leadId) || seenEmail.has(email)) return false;
    seenLead.add(t.leadId);
    seenEmail.add(email);
    return true;
  }).slice(0, count);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      offer,
      batch: batch.map((t) => ({
        touchId: t.id,
        lead: t.lead.name,
        email: t.lead.email,
        score: t.lead.score,
        reviews: t.lead.reviews,
        demoUrl: t.lead.demoUrl,
      })),
    });
  }

  const sent: { lead: string; email: string }[] = [];
  const failed: { lead: string; error: string }[] = [];

  for (const t of batch) {
    try {
      const result = await sendLeadViaInstantly(t.lead);
      if (!result.ok) {
        failed.push({ lead: t.lead.name ?? t.leadId, error: result.reason ?? "unknown" });
        continue;
      }
      const existingMeta =
        t.meta && typeof t.meta === "object" ? (t.meta as Record<string, unknown>) : {};
      await prisma.growthTouch.update({
        where: { id: t.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          meta: { ...existingMeta, instantly: true, campaignId: result.campaignId, bulk: true },
        },
      });
      if (PRE_CONTACT_STAGES.includes(t.lead.stage)) {
        await prisma.growthLead.update({
          where: { id: t.lead.id },
          data: { stage: "contacted" },
        });
      }
      sent.push({ lead: t.lead.name ?? t.leadId, email: t.lead.email! });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[hq/bulk-approve] send failed for", t.lead.name, err);
      failed.push({ lead: t.lead.name ?? t.leadId, error: message });
    }
  }

  return NextResponse.json({ offer, requested: count, sent, failed });
}
