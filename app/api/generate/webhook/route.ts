import { NextRequest, NextResponse } from "next/server";

import { generateWebhookSecret, verifyGenerateWebhook } from "@/lib/generate-auth-core";
import { applyModalResult, serializeJob } from "@/lib/generate-job-store";
import { isModalConfigured, pollModalCall } from "@/lib/generate-modal";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/generate/webhook
 *
 * Called by the Modal worker when a still finishes (or fails).
 * Auth: HMAC `x-generate-signature` or `Authorization: Bearer {GENERATE_WEBHOOK_SECRET}`.
 * Lives next to /api/generate/jobs (not under /jobs/[id]) so it cannot be
 * swallowed by the dynamic job-id segment.
 */
export async function POST(req: NextRequest) {
  const secret = generateWebhookSecret();
  const raw = await req.text();
  if (!verifyGenerateWebhook(raw, req.headers, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    job_id?: string;
    status?: string;
    output_urls?: string[];
    output_png_b64?: string[];
    outputs_ready?: boolean;
    error?: string | null;
    modal_call_id?: string;
  };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const jobId = typeof body.job_id === "string" ? body.job_id : "";
  if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  const row = await prisma.generateJob.findUnique({ where: { id: jobId } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (row.status === "done" && row.outputUrls.length) {
    return NextResponse.json({ ok: true, job: serializeJob(row), dup: true });
  }

  let applied = await applyModalResult(jobId, {
    status: body.status,
    output_urls: body.output_urls,
    output_png_b64: body.output_png_b64,
    outputs_ready: body.outputs_ready,
    error: body.error,
  });

  // Webhook stays small (no PNG bytes, no public URLs). Pull bytes from Modal
  // when the worker only signals that outputs are ready.
  if (
    applied.incomplete &&
    row.modalCallId &&
    isModalConfigured() &&
    body.status !== "failed"
  ) {
    try {
      const poll = await pollModalCall(row.modalCallId, process.env, 8000);
      if ("done" in poll && poll.done) {
        applied = await applyModalResult(jobId, poll.result);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.generateJob.update({
        where: { id: jobId },
        data: { status: "failed", error: message.slice(0, 2000), completedAt: new Date() },
      });
    }
  }

  const fresh = await prisma.generateJob.findUnique({ where: { id: jobId } });
  return NextResponse.json({ ok: true, job: fresh ? serializeJob(fresh) : null });
}
