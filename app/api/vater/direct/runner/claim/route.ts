/**
 * /api/vater/direct/runner/claim — atomic work claim.
 * POST (bearer) { jobId } → claim a queued job (queued → running), or
 * POST (bearer) { jobId, replyId } → claim a trey reply (mark delivered,
 *   awaiting_reply → running).
 * 409 if the state moved underneath us (lost race / stale poll).
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateDirectRunnerBearer } from "@/lib/vater/direct-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const authResult = validateDirectRunnerBearer(req);
  if (!authResult.ok) return authResult.response;

  let body: { jobId?: string; replyId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const jobId = String(body.jobId ?? "");
  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  if (body.replyId) {
    const claimed = await prisma.$transaction(async (tx) => {
      const reply = await tx.vaterDirectMessage.updateMany({
        where: { id: body.replyId, jobId, deliveredToRunner: false },
        data: { deliveredToRunner: true },
      });
      if (reply.count === 0) return false;
      await tx.vaterDirectJob.updateMany({
        where: { id: jobId, status: "awaiting_reply" },
        data: { status: "running" },
      });
      return true;
    });
    if (!claimed) {
      return NextResponse.json({ error: "Already claimed" }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  }

  const res = await prisma.vaterDirectJob.updateMany({
    where: { id: jobId, status: "queued" },
    data: { status: "running" },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "Already claimed" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
