/**
 * /api/vater/direct/runner/poll — DGX runner work discovery.
 * GET (bearer VATER_DIRECT_RUNNER_TOKEN) →
 *   { job?: oldest queued job with its messages,
 *     replies?: undelivered trey replies on awaiting_reply jobs }
 * Bearer-only (no session fallback) — see lib/vater/direct-auth.ts.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateDirectRunnerBearer } from "@/lib/vater/direct-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authResult = validateDirectRunnerBearer(req);
  if (!authResult.ok) return authResult.response;

  const [job, replies] = await Promise.all([
    prisma.vaterDirectJob.findFirst({
      where: { status: "queued" },
      orderBy: { createdAt: "asc" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.vaterDirectMessage.findMany({
      where: {
        role: "trey",
        deliveredToRunner: false,
        job: { status: "awaiting_reply" },
      },
      orderBy: { createdAt: "asc" },
      include: {
        job: { select: { id: true, status: true, claudeSessionId: true } },
      },
    }),
  ]);

  return NextResponse.json({
    job: job
      ? {
          id: job.id,
          status: job.status,
          createdAt: job.createdAt,
          messages: job.messages.map((m) => ({
            id: m.id,
            role: m.role,
            kind: m.kind,
            text: m.text,
          })),
        }
      : null,
    replies: replies.map((r) => ({
      id: r.id,
      jobId: r.jobId,
      text: r.text,
      claudeSessionId: r.job.claudeSessionId,
    })),
  });
}
