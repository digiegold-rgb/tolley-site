/**
 * /api/vater/direct/runner/status — runner updates job lifecycle.
 * POST (bearer) { jobId, status, claudeSessionId? }
 * status ∈ running | awaiting_reply | done | failed | canceled
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateDirectRunnerBearer } from "@/lib/vater/direct-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set([
  "running",
  "awaiting_reply",
  "done",
  "failed",
  "canceled",
]);

export async function POST(req: NextRequest) {
  const authResult = validateDirectRunnerBearer(req);
  if (!authResult.ok) return authResult.response;

  let body: { jobId?: string; status?: string; claudeSessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const jobId = String(body.jobId ?? "");
  const status = String(body.status ?? "");
  if (!jobId || !STATUSES.has(status)) {
    return NextResponse.json(
      { error: "jobId and valid status required" },
      { status: 400 },
    );
  }

  try {
    const job = await prisma.vaterDirectJob.update({
      where: { id: jobId },
      data: {
        status,
        ...(body.claudeSessionId
          ? { claudeSessionId: String(body.claudeSessionId).slice(0, 64) }
          : {}),
      },
    });
    return NextResponse.json({ job: { id: job.id, status: job.status } });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
