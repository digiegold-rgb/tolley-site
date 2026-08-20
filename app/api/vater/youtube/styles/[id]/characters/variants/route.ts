/**
 * POST /api/vater/youtube/styles/[id]/characters/variants — Character Lab
 * (2026-08-20).
 *
 * One priced click renders THREE portrait takes of a described character on
 * the DGX (Qwen hex-descriptor + SDXL still each, in the style's own art
 * direction). No callbackUrl is sent, so NOTHING is auto-created — the
 * client polls the three jobs and the user adopts the take they like via
 * POST .../characters/adopt. This is the cheap way to audition a character
 * (99¢/batch) instead of burning $7 test renders per audition.
 *
 * Billing: checkBudget("character") gates, then a REAL ledger debit
 * (debitForAction, dedupeKey charbatch:<id>) — unmetered accounts pass the
 * gate with costCents 0 and are never debited.
 */
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { debitForAction } from "@/lib/vater/billing/ledger";
import { recordUsage } from "@/lib/vater/billing/record-usage";
import { getActionPrice } from "@/lib/vater-subscription";
import { ownerFieldsForSessionWithLane } from "@/lib/vater/owner-tier";
import { ownerKeyForUser } from "@/lib/vater/voice-ids";

type Ctx = { params: Promise<{ id: string }> };

const TAKES = 3;

/* Take flavors: same brief, nudged apart so three renders audition three
 * interpretations instead of one image thrice. (The descriptor LLM runs at
 * temperature 0.5, so even take 1's flavor adds useful spread.) */
const TAKE_FLAVORS = [
  "",
  " For this take, choose a different outfit, hair style and color palette than the most obvious reading of the brief — same person, different styling.",
  " For this take, vary the age impression, build and clothing style within the brief — a distinctly different casting of the same idea.",
] as const;

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const style = await prisma.youTubeStyle.findUnique({
    where: { id },
    include: { customArtStyle: true },
  });
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

  let body: { name?: string; brief?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const name = (body.name || "").trim();
  const brief = (body.brief || "").trim();
  if (!name || name.length > 80) {
    return NextResponse.json({ error: "name (1-80 chars) required" }, { status: 400 });
  }
  if (!brief || brief.length < 8) {
    return NextResponse.json({ error: "brief (≥8 chars) required" }, { status: 400 });
  }

  const autopilotUrl = (process.env.AUTOPILOT_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.CONTENT_API_KEY || "";
  if (!autopilotUrl || !apiKey) {
    return NextResponse.json({ error: "Autopilot not configured" }, { status: 500 });
  }

  // ── Billing gate BEFORE any GPU work ──────────────────────────────────
  const budget = await checkBudget(session.user.id, "character");
  if (!budget.allow) {
    return NextResponse.json({ error: "Billing check failed", budget }, { status: 402 });
  }

  // ── Kick off the takes (no callbackUrl → nothing auto-created) ────────
  const owner = await ownerFieldsForSessionWithLane(session);
  const ownerKey = ownerKeyForUser(session.user.id);
  const jobs: Array<{ jobId: string; take: number }> = [];
  for (let i = 0; i < TAKES; i++) {
    try {
      const r = await fetch(`${autopilotUrl}/vater/characters/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          styleId: id,
          name,
          briefDescription: `${brief}${TAKE_FLAVORS[i] ?? ""}`,
          customArtStyleDescription: style.customArtStyle?.description ?? null,
          ownerKey,
          ...owner,
        }),
      });
      if (!r.ok) throw new Error(`kickoff ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const data = (await r.json()) as { jobId: string };
      jobs.push({ jobId: data.jobId, take: i + 1 });
    } catch (err) {
      console.error(`[character-variants] take ${i + 1} kickoff failed`, err);
    }
  }
  if (jobs.length === 0) {
    // Nothing started → nothing charged.
    return NextResponse.json(
      { error: "Could not start character generation — the studio backend is unreachable. Nothing was charged." },
      { status: 502 },
    );
  }

  // ── Charge once per batch, only after kickoffs are in flight ──────────
  const priceCents = budget.costCents ?? getActionPrice("character").costCents;
  const batchId = randomUUID();
  if (priceCents > 0) {
    try {
      await debitForAction(
        session.user.id,
        priceCents,
        `charbatch:${batchId}`,
        `Character Lab — "${name}" (${jobs.length} takes)`,
      );
    } catch (err) {
      console.error(`[character-variants] debit failed batch=${batchId}`, err);
    }
    try {
      await recordUsage({
        userId: session.user.id,
        action: "character",
        idempotencyKey: `charbatch_${batchId}`,
      });
    } catch (err) {
      console.error(`[character-variants] recordUsage failed batch=${batchId}`, err);
    }
  }

  return NextResponse.json({ batchId, jobs, priceCents });
}
