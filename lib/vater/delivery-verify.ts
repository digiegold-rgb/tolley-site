/**
 * lib/vater/delivery-verify.ts — persist a finished Animate mp4 as library-ready.
 *
 * Server-only. Idempotent. Does not call Spark, fal, or jelly-listen. Does
 * not require an audit HTML file. HEAD-checks the final URL, then CAS-flips
 * status=ready / flowStep=8.
 *
 * Called from:
 *   - syncProjectFromJob (the stitch just finished)
 *   - GET /api/vater/youtube and GET /api/vater/youtube/[id] (unstick #66)
 *   - GET /api/vater/youtube/progress-summary (after the badge poll)
 */
import "server-only";

import type { YouTubeProject } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { queueVaterEvent } from "@/lib/vater/events";
import { notifyFlowTransition } from "@/lib/vater/flow-notify";
import { readConcierge } from "@/lib/vater/concierge";
import { conciergeTelegram, projectTitle, tgSafe } from "@/lib/vater/concierge-operator";
import {
  READY_FLOW_STEP,
  STUCK_BEFORE_READY,
  auditDeliveryWarning,
  hasHttpsFinalUrl,
  probeFinalVideo,
  rowNeedsReadyPromote,
  rowLooksFileReady,
  type DeliveryRow,
  type FinalVideoProbe,
  type ProbeFn,
} from "@/lib/vater/delivery-ready";
import { auditMatchesFinal } from "@/lib/vater/concierge-client";

export type { FinalVideoProbe, ProbeFn };
export { probeFinalVideo };

const RECONCILE_LIMIT = 8;

export type PromoteKind = "already" | "promoted" | "not_ready" | "probe_failed";

export interface PromoteOutcome {
  kind: PromoteKind;
  projectId: string;
  status: string;
  flowStep: number | null;
  probe?: FinalVideoProbe;
  auditWarning?: ReturnType<typeof auditDeliveryWarning>;
}

function asDeliveryRow(project: YouTubeProject): DeliveryRow {
  return {
    status: project.status,
    finalVideoUrl: project.finalVideoUrl,
    progress: project.progress,
    completedAt: project.completedAt,
    autopilotJobId: project.autopilotJobId,
    flowStep: project.flowStep,
    stepDetails: project.stepDetails,
    settingsJson: project.settingsJson,
  };
}

function warningFor(project: YouTubeProject) {
  const ticket = readConcierge(project.settingsJson);
  const matches = auditMatchesFinal(ticket?.audit ?? null, {
    finalVideoUrl: project.finalVideoUrl,
    jobId: ticket?.jobId ?? project.autopilotJobId ?? null,
    composeJobId: ticket?.composeJobId ?? null,
  });
  return auditDeliveryWarning(ticket?.audit ?? null, matches);
}

async function notifyReady(
  project: YouTubeProject,
  source: "sync" | "reconcile" | "deliver",
  auditWarning: ReturnType<typeof auditDeliveryWarning>,
  opts: { fromStatus: string; telegram: boolean },
): Promise<void> {
  try {
    await notifyFlowTransition(project.id, "ready");
  } catch (err) {
    console.error(`[vater/delivery] ready notify failed project=${project.id}`, err);
  }

  if (opts.telegram) {
    const ticket = readConcierge(project.settingsJson);
    if (ticket) {
      const warn = auditWarning
        ? ` · ⚠️ ${auditWarning.code}${auditWarning.round != null ? ` r${auditWarning.round}` : ""}`
        : "";
      await conciergeTelegram(
        `✅ auto-ready ${ticket.code} · ${tgSafe(projectTitle(project))} · ${source}${warn}`,
      );
    }
  }

  if (project.userId) {
    queueVaterEvent({
      userId: project.userId,
      kind: "render.ready",
      message: `${opts.fromStatus} → ready (${source}${auditWarning ? `; ${auditWarning.code}` : ""})`,
      projectId: project.id,
      jobId: project.autopilotJobId,
      data: {
        from: opts.fromStatus,
        to: "ready",
        source,
        auditWarning: auditWarning?.code ?? null,
        finalVideoUrl: project.finalVideoUrl,
      },
    });
  }
}

/**
 * If the file is a live mp4 and the stitch is done, persist library-ready.
 * Idempotent: a second call is `already`.
 */
export async function promoteReadyIfDelivered(
  project: YouTubeProject,
  opts: { probe?: ProbeFn; source?: "sync" | "reconcile" | "deliver"; skipProbe?: boolean } = {},
): Promise<PromoteOutcome> {
  const source = opts.source ?? "reconcile";
  const row = asDeliveryRow(project);
  const auditWarning = warningFor(project);

  if (project.status === "ready" && (project.flowStep ?? 0) >= READY_FLOW_STEP) {
    if (!project.notifiedReadyAt) {
      await notifyReady(project, source, auditWarning, { fromStatus: project.status, telegram: false });
    }
    return {
      kind: "already",
      projectId: project.id,
      status: project.status,
      flowStep: project.flowStep,
      auditWarning,
    };
  }

  if (!rowNeedsReadyPromote(row) && !rowLooksFileReady(row)) {
    return {
      kind: "not_ready",
      projectId: project.id,
      status: project.status,
      flowStep: project.flowStep,
      auditWarning,
    };
  }

  if (!opts.skipProbe && hasHttpsFinalUrl(project.finalVideoUrl)) {
    const probe = await (opts.probe ?? probeFinalVideo)(project.finalVideoUrl!);
    if (!probe.ok) {
      console.warn(
        `[vater/delivery] probe failed project=${project.id} reason=${probe.reason} status=${probe.status}`,
      );
      return {
        kind: "probe_failed",
        projectId: project.id,
        status: project.status,
        flowStep: project.flowStep,
        probe,
        auditWarning,
      };
    }
  } else if (!hasHttpsFinalUrl(project.finalVideoUrl) && !opts.skipProbe) {
    return {
      kind: "not_ready",
      projectId: project.id,
      status: project.status,
      flowStep: project.flowStep,
      probe: { ok: false, status: null, contentType: null, contentLength: 0, reason: "not_https" },
      auditWarning,
    };
  }

  const now = new Date();
  const claimed = await prisma.youTubeProject.updateMany({
    where: {
      id: project.id,
      status: { not: "ready" },
    },
    data: {
      status: "ready",
      flowStep: READY_FLOW_STEP,
      flowStepAt: now,
      approvalExpiresAt: null,
      ...(project.completedAt ? {} : { completedAt: now }),
      ...(project.progress < 100 ? { progress: 100 } : {}),
    },
  });

  if (claimed.count === 0) {
    const flowFix = await prisma.youTubeProject.updateMany({
      where: {
        id: project.id,
        status: "ready",
        flowStep: { lt: READY_FLOW_STEP },
      },
      data: { flowStep: READY_FLOW_STEP, flowStepAt: now, approvalExpiresAt: null },
    });
    if (flowFix.count === 0 && project.notifiedReadyAt) {
      return {
        kind: "already",
        projectId: project.id,
        status: "ready",
        flowStep: Math.max(project.flowStep ?? 0, READY_FLOW_STEP),
        auditWarning,
      };
    }
  }

  const fresh =
    (await prisma.youTubeProject.findUnique({ where: { id: project.id } })) ?? {
      ...project,
      status: "ready",
      flowStep: READY_FLOW_STEP,
    };

  await notifyReady(
    { ...project, status: "ready", flowStep: READY_FLOW_STEP },
    source,
    auditWarning,
    { fromStatus: project.status, telegram: claimed.count > 0 },
  );

  console.log(
    `[vater/delivery] project=${project.id} ${project.status} → ready (${source}) flowStep=${READY_FLOW_STEP}` +
      (auditWarning ? ` warning=${auditWarning.code}` : ""),
  );

  return {
    kind: claimed.count > 0 ? "promoted" : "already",
    projectId: project.id,
    status: fresh.status,
    flowStep: fresh.flowStep,
    auditWarning,
  };
}

export interface ReconcileResult {
  checked: number;
  promoted: number;
  ids: string[];
}

/**
 * Find rows that look like #66 (progress 100 + https final + still in-flight)
 * and flip them. Spark is not contacted.
 */
export async function reconcileStuckDeliveries(opts?: {
  userId?: string;
  projectId?: string;
  limit?: number;
  probe?: ProbeFn;
}): Promise<ReconcileResult> {
  const limit = Math.min(Math.max(opts?.limit ?? RECONCILE_LIMIT, 1), 20);
  const candidates = await prisma.youTubeProject.findMany({
    where: {
      ...(opts?.userId ? { userId: opts.userId } : {}),
      ...(opts?.projectId ? { id: opts.projectId } : {}),
      projectType: "youtube",
      status: { in: [...STUCK_BEFORE_READY] },
      finalVideoUrl: { startsWith: "https://" },
      OR: [{ progress: { gte: 100 } }, { completedAt: { not: null } }],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  const ids: string[] = [];
  let promoted = 0;
  for (const row of candidates) {
    if (!rowLooksFileReady(asDeliveryRow(row))) continue;
    const out = await promoteReadyIfDelivered(row, {
      probe: opts?.probe,
      source: "reconcile",
    });
    if (out.kind === "promoted") {
      promoted += 1;
      ids.push(row.id);
    }
  }
  if (promoted > 0) {
    console.log(
      `[vater/delivery] reconcile promoted ${promoted}/${candidates.length}` +
        (opts?.userId ? ` user=${opts.userId}` : "") +
        (opts?.projectId ? ` project=${opts.projectId}` : ""),
    );
  }
  return { checked: candidates.length, promoted, ids };
}
