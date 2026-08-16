/**
 * GET /api/v1/videos/{id} — public API: the state of one render.
 *
 * Auth: `Authorization: Bearer jly_live_…`, scoped exactly as a session is —
 * a key can only read projects its owner can read, including projects shared
 * with them through a team seat (lib/vater/project-access.ts). A foreign id
 * returns 404, never 403, so the endpoint cannot be used to enumerate which
 * project ids exist.
 *
 * 200: {
 *   id, status, phase, progress, queuePosition, title,
 *   finalUrl, error, receipt: { computeUsd, opsUsd, totalUsd, minutes,
 *   durationSeconds, chargedUsd }, createdAt, completedAt
 * }
 *
 * `status` is the project-level state the studio shows (draft, scripted,
 * generating_scenes, ready, failed …). `phase` is the DGX worker's finer-
 * grained stage and is null once the job is terminal. Integrators should
 * branch on `status`; `phase` is for progress copy.
 *
 * THIS ENDPOINT IS THE AUTHORITY. Webhooks are a convenience with at-most-once
 * delivery and no retry queue (lib/vater/api-webhooks.ts) — an integration
 * that must not miss a completion polls this.
 *
 * Note the DGX call is best-effort: `queuePosition` and `phase` come from the
 * live job, but if the DGX is unreachable this still answers from the database
 * rather than failing. A render in progress is not a reason to 502.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/vater/direct-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { canAccessProjectAsync } from "@/lib/vater/project-access";
import { buildDebitLine, getProjectDebit } from "@/lib/vater/billing/ledger";
import { autopilot } from "@/lib/vater/autopilot-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** Polls per key per minute. Generous — polling is the documented pattern. */
const READ_LIMIT = 120;
const READ_WINDOW_SEC = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireApiKey(req);
  if (!auth.ok) return auth.response;

  const rl = await consumeRateLimit(
    `v1:read:${auth.keyId}`,
    READ_LIMIT,
    READ_WINDOW_SEC,
  );
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: `This key may poll ${READ_LIMIT} times per minute. Try again in ${rl.retryAfterSeconds}s.`,
        retryAfterSeconds: rl.retryAfterSeconds,
      },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSeconds) },
      },
    );
  }

  const { id } = await ctx.params;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { email: true },
  });

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      progress: true,
      sourceTitle: true,
      publishTitle: true,
      finalVideoUrl: true,
      errorMessage: true,
      audioDuration: true,
      targetDuration: true,
      costJson: true,
      autopilotJobId: true,
      createdAt: true,
      completedAt: true,
    },
  });

  const notFound = NextResponse.json(
    { error: "not_found", message: "No video with that id." },
    { status: 404, headers: NO_STORE },
  );
  if (!project) return notFound;
  if (
    !(await canAccessProjectAsync(project.userId, auth.userId, user?.email ?? null))
  ) {
    return notFound;
  }

  // Live job detail. Never fatal — the database already has the answer that
  // matters, and an integrator polling every 10s must not see a 502 because
  // the DGX tunnel blipped.
  let phase: string | null = null;
  let queuePosition: number | null = null;
  const terminal = project.status === "ready" || project.status === "failed";
  if (project.autopilotJobId && !terminal) {
    try {
      const job = await autopilot.getJob(project.autopilotJobId);
      phase = job.phase ?? null;
      queuePosition = job.queuePosition ?? null;
    } catch (err) {
      console.warn(
        `[v1/videos] job read failed project=${id} job=${project.autopilotJobId}`,
        err,
      );
    }
  }

  const { line } = buildDebitLine(project);
  const debit = project.userId ? await getProjectDebit(id) : null;

  return NextResponse.json(
    {
      id: project.id,
      status: project.status,
      phase,
      progress: project.progress,
      queuePosition,
      title: project.publishTitle ?? project.sourceTitle ?? null,
      finalUrl: project.finalVideoUrl ?? null,
      error: project.status === "failed" ? (project.errorMessage ?? null) : null,
      receipt: {
        computeUsd: line.computeUsd,
        opsUsd: line.opsUsd,
        totalUsd: line.totalUsd,
        minutes: line.minutes,
        durationSeconds: Math.round(Number(project.audioDuration ?? 0)),
        // What was actually taken off the balance — null while the render is
        // unfinished, zero-ish for unmetered accounts.
        chargedUsd: debit ? Math.round(-debit.deltaCents) / 100 : null,
      },
      createdAt: project.createdAt,
      completedAt: project.completedAt,
    },
    { headers: NO_STORE },
  );
}
