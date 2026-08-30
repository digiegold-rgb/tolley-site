/**
 * Shared produce kickoff — THE money click.
 *
 * Used by POST [id]/produce and by POST [id]/approve-script when Script
 * Review sends an engine (own-script Approve & Animate).
 */
import "server-only";
import type { YouTubeProject } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { AutopilotError } from "@/lib/vater/autopilot-client";
import { startRunCreation, ScriptGateError } from "@/lib/vater/script-gate";
import { submitConcierge } from "@/lib/vater/concierge-submit";
import { nextApprovalExpiry } from "@/lib/vater/approval-expiry";
import type { ProduceEngine } from "@/lib/vater/animate-render";

export const PRODUCIBLE = new Set(["awaiting_engine", "scripted", "failed"]);

export type ProduceProjectResult =
  | {
      ok: true;
      status: 200;
      project: YouTubeProject;
      engine: ProduceEngine;
      jobId?: string;
      ticket?: string;
      estimateUsd?: number;
    }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function produceApprovedProject(input: {
  project: YouTubeProject;
  userId: string;
  email: string | null | undefined;
  engine: ProduceEngine;
  script: string;
}): Promise<ProduceProjectResult> {
  const { project, userId, email, engine, script } = input;
  const id = project.id;

  if (engine === "fable5") {
    const result = await submitConcierge({
      project,
      userId,
      email,
      script,
    });
    if (!result.ok) return { ok: false, status: result.status, body: result.body };
    console.log(
      `[vater/produce] project=${id} engine=fable5 ticket=${result.ticket.code} est=$${result.estimateUsd.toFixed(2)}`,
    );
    return {
      ok: true,
      status: 200,
      project: result.project,
      engine,
      ticket: result.ticket.code,
      estimateUsd: result.estimateUsd,
    };
  }

  const budget = await checkBudget(userId, "scene", null, undefined, { projectId: id });
  if (!budget.allow) {
    return { ok: false, status: 402, body: { error: "Billing check failed", budget } };
  }

  const now = new Date();
  // `queued` is in IN_FLIGHT_STATUSES so every poll kicker calls /poll.
  // `scripted` is not — writing that word left Spark-done rows parked forever.
  const claimed = await prisma.youTubeProject.updateMany({
    where: { id, status: { in: [...PRODUCIBLE] } },
    data: {
      status: "queued",
      flowStep: 7,
      flowStepAt: now,
      approvalExpiresAt: null,
      notifiedReadyAt: null,
      progress: 30,
      errorMessage: null,
      ...(project.scriptApprovedAt ? {} : { scriptApprovedAt: now }),
    },
  });
  if (claimed.count !== 1) {
    const fresh = await prisma.youTubeProject.findUnique({
      where: { id },
      select: { status: true },
    });
    return {
      ok: false,
      status: 409,
      body: {
        error: "Project changed while starting — refresh and try again",
        status: fresh?.status ?? null,
      },
    };
  }
  const claimedRow = await prisma.youTubeProject.findUniqueOrThrow({ where: { id } });

  try {
    const jobId = await startRunCreation(claimedRow, { scriptOverride: script });
    const withJob = await prisma.youTubeProject.update({
      where: { id },
      data: { autopilotJobId: jobId },
    });
    console.log(`[vater/produce] project=${id} engine=auto job=${jobId} — render started`);
    return { ok: true, status: 200, project: withJob, engine, jobId };
  } catch (err) {
    const detail =
      err instanceof AutopilotError
        ? `[${err.status}] ${err.body || err.message}`
        : err instanceof Error
          ? err.message
          : "unknown error";
    const recoverable = err instanceof ScriptGateError;
    const failed = await prisma.youTubeProject.update({
      where: { id },
      data: {
        status: recoverable ? "awaiting_engine" : "failed",
        flowStep: recoverable ? 6 : 7,
        flowStepAt: new Date(),
        approvalExpiresAt: recoverable ? nextApprovalExpiry() : null,
        errorMessage: `render kickoff failed: ${detail}`.slice(0, 1000),
      },
    });
    return {
      ok: false,
      status: recoverable ? 400 : 502,
      body: { error: "render kickoff failed", detail, project: failed },
    };
  }
}
