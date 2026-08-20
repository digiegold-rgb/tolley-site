/**
 * POST /api/vater/youtube/styles/[id]/characters/from-image
 *
 * Create a character using a USER-PROVIDED image (uploaded to Vercel Blob)
 * as the IP-Adapter face anchor. Auto-descriptor via Gemini Vision.
 * The image becomes the SAME image used in every scene render → true
 * brand-mascot consistency, matching TubeGen's character pattern.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { publicSiteUrl } from "@/lib/vater/site-url";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { debitForAction } from "@/lib/vater/billing/ledger";
import { recordUsage } from "@/lib/vater/billing/record-usage";
import { ownerFieldsForSessionWithLane } from "@/lib/vater/owner-tier";
import { ownerKeyForUser } from "@/lib/vater/voice-ids";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const style = await prisma.youTubeStyle.findUnique({ where: { id } });
  if (!style) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (style.userId && style.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (style.isSystem) {
    return NextResponse.json(
      { error: "System styles are immutable. Clone first." },
      { status: 403 },
    );
  }

  let body: { name?: string; imageUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = (body.name || "").trim();
  const imageUrl = (body.imageUrl || "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!imageUrl || !imageUrl.includes("://")) {
    return NextResponse.json({ error: "imageUrl required (must be a URL)" }, { status: 400 });
  }

  const autopilotUrl = (process.env.AUTOPILOT_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.CONTENT_API_KEY || "";
  if (!autopilotUrl || !apiKey) {
    return NextResponse.json({ error: "Autopilot not configured" }, { status: 500 });
  }
  // ── Billing gate (Character Lab 2026-08-20): 49¢ per import, real ledger
  // debit AFTER a successful kickoff. Unmetered accounts gate at 0¢. ──────
  const budget = await checkBudget(session.user.id, "character_import");
  if (!budget.allow) {
    return NextResponse.json({ error: "Billing check failed", budget }, { status: 402 });
  }

  // Reuse the existing /characters/callback route — same target, same payload shape
  const callbackUrl = `${publicSiteUrl()}/api/vater/youtube/styles/${id}/characters/callback`;

  try {
    const owner = await ownerFieldsForSessionWithLane(session);
    const r = await fetch(`${autopilotUrl}/vater/characters/from-image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        styleId: id,
        name,
        imageUrl,
        callbackUrl,
        ownerKey: ownerKeyForUser(session.user.id),
        // Inline jobs have no project row, so ownerId is the ONLY record of
        // whose job it is — the poll route scopes on it. Lane fields route
        // the GPU spend to the right Modal invoice lane.
        ...owner,
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return NextResponse.json(
        { error: "Autopilot kickoff failed", status: r.status, detail: detail.slice(0, 500) },
        { status: 502 },
      );
    }
    const data = (await r.json()) as { jobId: string };
    const priceCents = budget.costCents ?? 0;
    if (priceCents > 0) {
      const importId = randomUUID();
      try {
        await debitForAction(
          session.user.id,
          priceCents,
          `charimport:${importId}`,
          `Character import — "${name}"`,
        );
        await recordUsage({
          userId: session.user.id,
          action: "character_import",
          idempotencyKey: `charimport_${importId}`,
        });
      } catch (err) {
        console.error(`[characters/from-image] billing failed job=${data.jobId}`, err);
      }
    }
    return NextResponse.json({ jobId: data.jobId, priceCents });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Autopilot unreachable",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 },
    );
  }
}
