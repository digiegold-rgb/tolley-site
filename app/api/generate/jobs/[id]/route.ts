import { NextRequest, NextResponse } from "next/server";

import { requireGenerateAdmin } from "@/lib/generate-auth";
import { applyModalResult, serializeJob } from "@/lib/generate-job-store";
import { isModalConfigured, pollModalCall } from "@/lib/generate-modal";
import {
  falModelIdFromCard,
  isMotionRecipe,
  persistMotionVideo,
  pollFalMotion,
} from "@/lib/generate-motion";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/generate/jobs/[id]
 * Running stills: poll Modal FunctionCall.get.
 * Running motion: poll fal.ai queue for Wan I2V / FLF2V.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const row = await prisma.generateJob.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (row.status === "running" && row.modalCallId && isMotionRecipe(row.recipe)) {
    try {
      const falModel = falModelIdFromCard(row.cardJson, row.recipe);
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
        if (fresh) return NextResponse.json({ job: serializeJob(fresh) });
      }
      if ("done" in poll && poll.done) {
        const url = await persistMotionVideo(row.id, poll.videoUrl, poll.contentType);
        await applyModalResult(row.id, { status: "done", output_urls: [url] });
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
