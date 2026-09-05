import { NextRequest, NextResponse } from "next/server";

import { requireGenerateAdmin } from "@/lib/generate-auth";
import {
  falT2IModelId,
  falT2VModelId,
  isFalImageRecipe,
  isFalVideoRecipe,
  persistFalStill,
  pollFalImage,
} from "@/lib/generate-engine";
import { applyModalResult, serializeJob } from "@/lib/generate-job-store";
import { isModalConfigured, pollModalCall } from "@/lib/generate-modal";
import { syncBeatQueueFromChild } from "@/lib/generate-beats-store";
import {
  falModelIdFromCard,
  persistMotionVideo,
  pollFalMotion,
} from "@/lib/generate-motion";
import { prisma } from "@/lib/prisma";

function cardWantsSlowMo(cardJson: unknown): boolean {
  return Boolean(
    cardJson &&
      typeof cardJson === "object" &&
      !Array.isArray(cardJson) &&
      (cardJson as { slow_mo?: unknown }).slow_mo === true,
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// vercel.json functions is at the 50-key schema cap — do not add this route there.
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/generate/jobs/[id]
 * Running stills: poll Modal FunctionCall.get.
 * Running motion / T2V / I2V: poll fal.ai video queue.
 * Running T2I: poll fal.ai FLUX queue.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const row = await prisma.generateJob.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (row.status === "running" && row.modalCallId && isFalImageRecipe(row.recipe)) {
    try {
      const poll = await pollFalImage(falT2IModelId(), row.modalCallId);
      if ("pending" in poll && poll.pending) {
        return NextResponse.json({ job: serializeJob(row) });
      }
      if ("failed" in poll && poll.failed) {
        await prisma.generateJob.update({
          where: { id: row.id },
          data: { status: "failed", error: poll.error.slice(0, 2000), completedAt: new Date() },
        });
        const fresh = await prisma.generateJob.findUnique({ where: { id: row.id } });
        if (fresh) return NextResponse.json({ job: serializeJob(fresh) });
      }
      if ("done" in poll && poll.done) {
        const stored = await persistFalStill(row.id, poll.imageUrl);
        await applyModalResult(row.id, { status: "done", output_urls: [stored] });
        const fresh = await prisma.generateJob.findUnique({ where: { id: row.id } });
        if (fresh) return NextResponse.json({ job: serializeJob(fresh) });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.generateJob.update({
        where: { id: row.id },
        data: { status: "failed", error: message.slice(0, 2000), completedAt: new Date() },
      });
      const fresh = await prisma.generateJob.findUnique({ where: { id: row.id } });
      if (fresh) return NextResponse.json({ job: serializeJob(fresh) });
    }
    return NextResponse.json({ job: serializeJob(row) });
  }

  if (row.status === "running" && row.modalCallId && isFalVideoRecipe(row.recipe)) {
    try {
      const falModel =
        row.recipe === "fal-wan-t2v" ? falT2VModelId() : falModelIdFromCard(row.cardJson, row.recipe);
      const poll = await pollFalMotion(falModel, row.modalCallId);
      if ("pending" in poll && poll.pending) {
        return NextResponse.json({ job: serializeJob(row) });
      }
      if ("failed" in poll && poll.failed) {
        await prisma.generateJob.update({
          where: { id: row.id },
          data: { status: "failed", error: poll.error.slice(0, 2000), completedAt: new Date() },
        });
        const fresh = await prisma.generateJob.findUnique({ where: { id: row.id } });
        if (fresh) {
          await syncBeatQueueFromChild(fresh);
          return NextResponse.json({ job: serializeJob(fresh) });
        }
      }
      if ("done" in poll && poll.done) {
        const url = await persistMotionVideo(row.id, poll.videoUrl, poll.contentType, {
          slowMo: cardWantsSlowMo(row.cardJson),
        });
        await applyModalResult(row.id, { status: "done", output_urls: [url] });
        const fresh = await prisma.generateJob.findUnique({ where: { id: row.id } });
        if (fresh) {
          await syncBeatQueueFromChild(fresh);
          return NextResponse.json({ job: serializeJob(fresh) });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.generateJob.update({
        where: { id: row.id },
        data: { status: "failed", error: message.slice(0, 2000), completedAt: new Date() },
      });
      const fresh = await prisma.generateJob.findUnique({ where: { id: row.id } });
      if (fresh) {
        await syncBeatQueueFromChild(fresh);
        return NextResponse.json({ job: serializeJob(fresh) });
      }
    }
    return NextResponse.json({ job: serializeJob(row) });
  }

  if (row.status === "running" && row.modalCallId && isModalConfigured()) {
    try {
      const poll = await pollModalCall(row.modalCallId);
      if ("done" in poll && poll.done) {
        await applyModalResult(row.id, poll.result);
        const fresh = await prisma.generateJob.findUnique({ where: { id: row.id } });
        if (fresh) return NextResponse.json({ job: serializeJob(fresh) });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.generateJob.update({
        where: { id: row.id },
        data: { status: "failed", error: message.slice(0, 2000), completedAt: new Date() },
      });
      const fresh = await prisma.generateJob.findUnique({ where: { id: row.id } });
      if (fresh) return NextResponse.json({ job: serializeJob(fresh) });
    }
  }

  return NextResponse.json({ job: serializeJob(row) });
}

/** POST /api/generate/jobs/[id] — explicit poll/refresh. */
export async function POST(req: NextRequest, ctx: Ctx) {
  return GET(req, ctx);
}
