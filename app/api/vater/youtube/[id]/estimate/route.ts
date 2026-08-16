/**
 * GET /api/vater/youtube/[id]/estimate
 *
 * What this render is expected to cost, before a GPU-second is spent on it —
 * quoted twice, because "draft" (stills only) and "full" (the wan motion pass)
 * are different products at ~6× the compute:
 *
 *   { draftUsd, fullUsd, breakdown: { stills, tts, motion, ops },
 *     minutes, sceneCount, source: "dgx" | "local" }
 *
 * TWO SOURCES, ONE SHAPE. The DGX has the planner and therefore the exact
 * numbers (POST /vater/projects/{id}/estimate, feature contract 2026-08-16).
 * That endpoint is shipping on a different lane, so until it exists this route
 * answers from the measured per-minute rates in lib/vater/billing/estimate.ts
 * and says so via `source`. A 404 (and any other upstream failure) is a
 * fallback, never an error the user sees — a customer who cannot get a price
 * is a customer who does not press render.
 *
 * The ops line is added HERE, never upstream: the DGX does not know the ops
 * rate and must never be given a reason to invent one.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkProjectAccess } from "@/lib/vater/project-access";
import { getOpsRate } from "@/lib/vater/billing/ops-fee";
import {
  fromDgxEstimate,
  localEstimate,
  plannedMinutes,
  type DgxEstimatePayload,
  type RenderEstimate,
} from "@/lib/vater/billing/estimate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Upstream is best-effort by design, so keep the wait short — this runs while
 *  someone is looking at a button. */
const DGX_TIMEOUT_MS = 4000;

/**
 * Ask the DGX for the planner's own estimate. Returns null on anything at all
 * (not configured, 404, timeout, malformed body) — the caller falls back.
 *
 * Called directly rather than through lib/vater/autopilot-client.ts on
 * purpose: that module is shared by every lane building on this contract, and
 * an endpoint that may not exist yet does not belong in the typed client until
 * it does.
 */
async function fetchDgxEstimate(
  projectId: string,
): Promise<DgxEstimatePayload | null> {
  const base = (process.env.AUTOPILOT_URL || "").replace(/\/$/, "");
  const key = process.env.CONTENT_API_KEY || "";
  if (!base || !key) return null;

  try {
    const res = await fetch(
      `${base}/vater/projects/${encodeURIComponent(projectId)}/estimate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        cache: "no-store",
        signal: AbortSignal.timeout(DGX_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      // 404 = the endpoint has not shipped yet. Anything else is worth a line
      // in the log, but never worth failing the quote over.
      if (res.status !== 404) {
        console.warn(
          `[vater/estimate] DGX estimate ${res.status} for project=${projectId}`,
        );
      }
      return null;
    }
    return (await res.json()) as DgxEstimatePayload;
  } catch (err) {
    console.warn(`[vater/estimate] DGX estimate unavailable project=${projectId}`, err);
    return null;
  }
}

const countWords = (text: string | null | undefined): number =>
  (text ?? "").split(/\s+/).filter(Boolean).length;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await checkProjectAccess(id, session.user.id, session.user.email);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: {
      id: true,
      script: true,
      audioDuration: true,
      targetDuration: true,
      animUntilS: true,
      scenesJson: true,
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const opsRate = getOpsRate();

  const minutes = plannedMinutes({
    audioDuration: project.audioDuration,
    scriptWords: countWords(project.script),
    targetDuration: project.targetDuration,
  });

  const scenes = Array.isArray(project.scenesJson) ? project.scenesJson : [];

  /* Hybrid renders animate only the opening window (`animUntilS`) and run Ken
   * Burns stills after it. Quoting a whole-video motion bill for one of those
   * would overstate the full price by several dollars, so the motion line is
   * scaled to the share of runtime that actually gets the wan pass. */
  const runtimeSec = minutes * 60;
  const motionFraction =
    project.animUntilS && project.animUntilS > 0 && runtimeSec > 0
      ? Math.min(1, project.animUntilS / runtimeSec)
      : 1;

  const dgx = await fetchDgxEstimate(id);
  const estimate: RenderEstimate =
    (dgx ? fromDgxEstimate(dgx, opsRate) : null) ??
    localEstimate({
      minutes,
      sceneCount: scenes.length,
      opsRatePerMinute: opsRate,
      motionFraction,
    });

  return NextResponse.json(
    { ...estimate, opsRatePerMinute: opsRate },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
