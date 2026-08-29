/**
 * GET /api/vater/youtube/[id]/log — the worker-log tail for ONE render.
 *
 * Jared 2026-08-28: "I want to see those terminal lines for every render,
 * always, in Progress." The old rolling tail (RenderProgress) read
 * `project.stepDetails.logs`, which only advances while some client polls
 * `[id]/poll` — and the Fable-5 / concierge lane is never polled by the site
 * at all (by design: /poll must not touch concierge rows). This route is the
 * read-only side channel that feeds `components/animate/RenderTerminal.tsx`
 * on every lane.
 *
 * Job-id resolution, first hit wins:
 *   1. settingsJson.concierge.composeJobId   Fable 5 — the compose step while it runs
 *   2. settingsJson.concierge.jobId          Fable 5 — the ticket's render job
 *   3. project.animateAllJobId               editor animate-all
 *   4. project.autopilotJobId                Jelly auto lane (script / pipeline)
 *
 * READ-ONLY: one GET to the DGX, never a DB write. A 404 from the DGX (job
 * finished and swept) is a 200 with `status: "unknown"` and whatever tail the
 * project row still holds — a swept job must never 500 the Progress tab.
 *
 * `gate` (2026-08-28, after F5-B0A50J was delivered before its audit ran):
 * for a concierge row the terminal must never say a bare "done" — the
 * render is finished but the ticket is not delivered until the delivery
 * audit passes. `gate.lane` is "concierge" | "auto"; for concierge rows it
 * carries the ticket stage and the latest audit summary (or null).
 *
 * → 200 { jobId, status, phase, progress, updatedAt, lines, gate }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { readConcierge } from "@/lib/vater/concierge";
import { autopilot, AutopilotConfigError, AutopilotError } from "@/lib/vater/autopilot-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Last N lines the UI gets — the DGX buffer is ~30, stepDetails keeps 60. */
const TAIL = 40;

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export interface RenderLogGate {
  lane: "concierge" | "auto";
  /** Concierge ticket stage (null on the auto lane). */
  stage: string | null;
  audit: { round: number; passed: boolean; hardFails: number; sceneCount: number } | null;
}

export interface RenderLogResponse {
  jobId: string | null;
  status: string | null;
  phase: string | null;
  progress: number | null;
  updatedAt: string | null;
  lines: string[];
  gate: RenderLogGate;
}

function gateFor(ticket: ReturnType<typeof readConcierge>): RenderLogGate {
  if (!ticket) return { lane: "auto", stage: null, audit: null };
  const a = ticket.audit ?? null;
  return {
    lane: "concierge",
    stage: ticket.stage,
    audit: a ? { round: a.round, passed: a.passed, hardFails: a.hardFails, sceneCount: a.sceneCount } : null,
  };
}

function stepDetailLogs(stepDetails: unknown): string[] {
  if (!stepDetails || typeof stepDetails !== "object" || Array.isArray(stepDetails)) return [];
  const logs = (stepDetails as { logs?: unknown }).logs;
  return Array.isArray(logs) ? logs.filter((l): l is string => typeof l === "string" && !!l) : [];
}

function stepDetailPhase(stepDetails: unknown): string | null {
  if (!stepDetails || typeof stepDetails !== "object" || Array.isArray(stepDetails)) return null;
  const phase = (stepDetails as { phase?: unknown }).phase;
  return typeof phase === "string" && phase ? phase : null;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
  }

  const { id } = await ctx.params;
  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      userId: true,
      status: true,
      progress: true,
      updatedAt: true,
      stepDetails: true,
      settingsJson: true,
      autopilotJobId: true,
      animateAllJobId: true,
    },
  });
  if (!project || !canAccessProject(project.userId, session.user.id, session.user.email)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404, headers: NO_STORE });
  }

  const ticket = readConcierge(project.settingsJson);
  const gate = gateFor(ticket);
  const jobId =
    ticket?.composeJobId || ticket?.jobId || project.animateAllJobId || project.autopilotJobId || null;

  const rowLines = stepDetailLogs(project.stepDetails);
  const rowPhase = stepDetailPhase(project.stepDetails);
  const rowUpdatedAt = project.updatedAt?.toISOString() ?? null;

  if (!jobId) {
    const body: RenderLogResponse = {
      jobId: null,
      status: null,
      phase: null,
      progress: null,
      updatedAt: rowUpdatedAt,
      lines: rowLines.slice(-TAIL),
      gate,
    };
    return NextResponse.json(body, { headers: NO_STORE });
  }

  try {
    const job = await autopilot.getJob(jobId);
    const dgxLines = Array.isArray(job.logs)
      ? job.logs.filter((l): l is string => typeof l === "string" && !!l)
      : [];
    // The DGX buffer is the live truth; fall back to the row's own tail when
    // the job has none yet (queued behind the per-tenant cap, or a lane whose
    // worker appends to stepDetails instead).
    const lines = (dgxLines.length ? dgxLines : rowLines).slice(-TAIL);
    const body: RenderLogResponse = {
      jobId,
      status: job.status ?? null,
      phase: job.phase ?? rowPhase,
      progress: Number.isFinite(job.progress) ? job.progress : (project.progress ?? null),
      updatedAt: job.updatedAt ?? rowUpdatedAt,
      lines,
      gate,
    };
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (err) {
    // Finished-and-swept job, or the DGX is unreachable / unconfigured: hand
    // back what the row remembers rather than breaking the UI.
    const swept = err instanceof AutopilotError && err.status === 404;
    if (!swept && !(err instanceof AutopilotConfigError)) {
      console.warn(`[vater/log] project=${id} job=${jobId} DGX read failed:`, err instanceof Error ? err.message : err);
    }
    const body: RenderLogResponse = {
      jobId,
      status: "unknown",
      phase: rowPhase,
      progress: project.progress ?? null,
      updatedAt: rowUpdatedAt,
      lines: rowLines.slice(-TAIL),
      gate,
    };
    return NextResponse.json(body, { headers: NO_STORE });
  }
}
