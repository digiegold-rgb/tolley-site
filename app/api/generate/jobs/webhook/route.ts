import { NextRequest, NextResponse } from "next/server";

import { generateWebhookSecret, verifyGenerateWebhook } from "@/lib/generate-auth-core";
import { applyModalResult, serializeJob } from "@/lib/generate-job-store";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/generate/jobs/webhook
 *
 * Called by the Modal worker when a still finishes (or fails).
 * Auth: HMAC `x-generate-signature` or `Authorization: Bearer {GENERATE_WEBHOOK_SECRET}`.
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

  await applyModalResult(jobId, {
    status: body.status,
    output_urls: body.output_urls,
    output_png_b64: body.output_png_b64,
    error: body.error,
  });
  const fresh = await prisma.generateJob.findUnique({ where: { id: jobId } });
  return NextResponse.json({ ok: true, job: fresh ? serializeJob(fresh) : null });
}
