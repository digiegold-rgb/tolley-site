/**
 * GET /api/vater/listing/[id]/poll — transition-on-change from the DGX.
 *
 *   staging  + done   → awaiting_approval (staged URLs, proof token)
 *                       virtual_staging → ready (mlsSafeStillUrl, finalUrl=labeled)
 *   rendering + done  → ready (videoUrl / finalUrl / vertical)
 *   any + failed      → failed; refund when errorCode ∈ REFUNDABLE_ERROR_CODES
 *   any + cancelled   → cancelled + refund
 *
 * Idempotent: only `staging` / `rendering` rows are polled upstream; the
 * transition is an updateMany guarded on the CURRENT status so two
 * concurrent polls cannot double-apply. Costs merge via mergeVideoCost,
 * which no-ops when the DGX job id is already in `byJob`.
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autopilot, type ListingJobStatus } from "@/lib/vater/autopilot-client";
import { refundOnFailure } from "@/lib/vater/billing/ledger";
import { queueVaterEvent } from "@/lib/vater/events";
import { mergeVideoCost } from "@/lib/vater/video-cost";
import { loadOwnedJob, loginRequired, newProofToken, NO_STORE, REFUNDABLE_ERROR_CODES, toDto } from "@/lib/vater/listing/store";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return loginRequired();
  const { id } = await ctx.params;
  const owned = await loadOwnedJob(session.user.id, id);
  if (!owned.ok) return owned.res;
  const { job, userId } = owned;

  const phase = job.status === "staging" ? "staging" : job.status === "rendering" ? "rendering" : null;
  const dgxId = phase === "staging" ? job.dgxStagingJobId : phase === "rendering" ? job.dgxRenderJobId : null;
  if (!phase || !dgxId) {
    return NextResponse.json({ job: toDto(job), dgx: null }, { headers: NO_STORE });
  }

  let st: ListingJobStatus;
  try {
    st = await autopilot.getListingJob(dgxId);
  } catch (err) {
    // Transient DGX outage: report the row as-is; the client keeps polling.
    console.error(`[listing/poll] DGX unreachable listing=${id} job=${dgxId}`, err);
    return NextResponse.json({ job: toDto(job), dgx: { status: "unknown", error: err instanceof Error ? err.message : "unreachable" } }, { headers: NO_STORE });
  }

  const dgx = { status: st.status, phase: st.phase, progress: st.progress, queuePosition: st.queuePosition ?? null, logs: st.logs?.slice(-5) ?? [] };

  if (st.status === "pending" || st.status === "running" || st.status === "queued") {
    return NextResponse.json({ job: toDto(job), dgx }, { headers: NO_STORE });
  }

  const costs = mergeVideoCost(job.costJson, st.result?.costs, dgxId);
  const costData: Prisma.VaterListingJobUpdateInput = costs ? { costJson: costs as unknown as Prisma.InputJsonValue } : {};

  if (st.status === "done") {
    const a = st.result?.assets ?? {};
    let data: Prisma.VaterListingJobUpdateInput;
    if (phase === "staging") {
      const staged = a.stagedStillUrl ?? null;
      const labeled = a.stagedStillLabeledUrl ?? staged;
      const isStill = job.sku === "virtual_staging";
      data = {
        ...costData,
        stagedStillUrl: staged,
        stagedStillLabeledUrl: labeled,
        proofToken: job.proofToken ?? newProofToken(),
        ...(isStill
          ? { status: "ready", mlsSafeStillUrl: staged, finalUrl: labeled, completedAt: new Date() }
          : { status: "awaiting_approval" }),
      };
    } else {
      data = {
        ...costData,
        status: "ready",
        videoUrl: a.videoUrl ?? null,
        finalUrl: a.videoUrl ?? null,
        videoVerticalUrl: a.videoVerticalUrl ?? null,
        mlsSafeStillUrl: job.mlsSafeStillUrl ?? a.stagedStillUrl ?? job.stagedStillUrl,
        proofToken: job.proofToken ?? newProofToken(),
        completedAt: new Date(),
      };
    }
    const r = await prisma.vaterListingJob.updateMany({ where: { id, status: job.status }, data });
    if (r.count > 0) {
      queueVaterEvent({
        userId,
        kind: phase === "rendering" || job.sku === "virtual_staging" ? "render.ready" : "render.phase",
        message: phase === "staging" ? (job.sku === "virtual_staging" ? "Listing Studio: your staged photo is ready." : "Listing Studio: staged still ready for your approval.") : "Listing Studio: your video is ready.",
        projectId: id,
        jobId: dgxId,
        data: { phase, product: "realestate" },
      });
    }
  } else {
    // failed | cancelled
    const errorCode = st.errorCode ?? (st.status === "cancelled" ? "cancelled" : "upstream");
    const errorMessage = (st.error ?? (st.status === "cancelled" ? "Cancelled" : "Render failed")).slice(0, 500);
    const r = await prisma.vaterListingJob.updateMany({
      where: { id, status: job.status },
      data: { ...costData, status: st.status === "cancelled" ? "cancelled" : "failed", errorCode, errorMessage },
    });
    if (r.count > 0) {
      const refundable = st.status === "cancelled" || REFUNDABLE_ERROR_CODES.has(errorCode);
      let refunded = false;
      if (refundable) {
        try {
          refunded = (await refundOnFailure(id, `Listing Studio ${phase} failed: ${errorCode}`)).refunded;
        } catch (err) {
          console.error(`[listing/poll] refund failed listing=${id}`, err);
        }
      }
      queueVaterEvent({
        userId,
        kind: "render.failed",
        level: "error",
        message: `Listing Studio: ${phase} failed (${errorCode})${refunded ? " — refunded" : ""}.`,
        projectId: id,
        jobId: dgxId,
        data: { errorCode, errorMessage, refunded, product: "realestate" },
      });
    }
  }

  const fresh = await prisma.vaterListingJob.findUnique({ where: { id } });
  return NextResponse.json({ job: toDto(fresh ?? job), dgx }, { headers: NO_STORE });
}
