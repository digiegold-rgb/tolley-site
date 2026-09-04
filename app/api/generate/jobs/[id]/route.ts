import { NextRequest, NextResponse } from "next/server";

import { requireGenerateAdmin } from "@/lib/generate-auth";
import { applyModalResult, serializeJob } from "@/lib/generate-job-store";
import { isModalConfigured, pollModalCall } from "@/lib/generate-modal";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/generate/jobs/[id]
 * If the job is still running and Modal is configured, poll FunctionCall.get
 * (short timeout) and persist URLs when the call is finished.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireGenerateAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  const row = await prisma.generateJob.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
