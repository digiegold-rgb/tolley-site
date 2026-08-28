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
import { ownerFieldsForSessionWithLane } from "@/lib/vater/owner-tier";
import { readAgentProfile } from "@/lib/vater/listing/agent-profile";
import { isListingSku, LISTING_SKUS } from "@/lib/vater/listing-pricing";
import {
  DGX_SKU_FOR,
  endCardFromProfile,
  engineOf,
  idempotencyKeyFor,
  listingFactsFor,
  loadOwnedJob,
  loginRequired,
  lookOf,
  newProofToken,
  NO_STORE,
  REFUNDABLE_ERROR_CODES,
  toDto,
} from "@/lib/vater/listing/store";
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
  const { job, userId, rootUserId } = owned;

  // finishing = the Vertical Reel add-on's own 9:16 render, kicked below once
  // the landscape video is done.
  const phase =
    job.status === "staging" ? "staging" : job.status === "rendering" ? "rendering" : job.status === "finishing" ? "finishing" : null;
  const dgxId =
    phase === "staging" ? job.dgxStagingJobId : phase === "rendering" ? job.dgxRenderJobId : phase === "finishing" ? job.dgxVerticalJobId : null;
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
    } else if (phase === "finishing") {
      data = {
        ...costData,
        status: "ready",
        videoVerticalUrl: a.videoUrl ?? a.videoVerticalUrl ?? null,
        completedAt: new Date(),
      };
    } else {
      const videoSku = isListingSku(job.sku) && job.sku !== "virtual_staging" && LISTING_SKUS[job.sku].kind === "video" ? job.sku : null;
      const wantsReel = Boolean(job.reel) && videoSku !== null;
      data = {
        ...costData,
        videoUrl: a.videoUrl ?? null,
        finalUrl: a.videoUrl ?? null,
        videoVerticalUrl: a.videoVerticalUrl ?? null,
        mlsSafeStillUrl: job.mlsSafeStillUrl ?? a.stagedStillUrl ?? job.stagedStillUrl,
        proofToken: job.proofToken ?? newProofToken(),
        ...(wantsReel && !a.videoVerticalUrl ? { status: "finishing" } : { status: "ready", completedAt: new Date() }),
      };
      if (wantsReel && videoSku && !a.videoVerticalUrl) {
        // Vertical Reel add-on: same staged still, same recipe, 9:16 canvas.
        try {
          const sku = videoSku;
          const spec = LISTING_SKUS[sku];
          const profile = await readAgentProfile(rootUserId);
          const owner = await ownerFieldsForSessionWithLane(session, job.userId);
          const photos = job.sourceImageUrls.map((url, i) => ({ url, room: job.roomType ?? undefined, label: i === 0 ? "primary" : undefined }));
          const engine = engineOf(job);
          const inputs = { photos, stagedStillUrl: job.stagedStillUrl, engine, look: job.look, style: job.style, roomType: job.roomType, reel: true, aspect: "9:16", durationS: spec.durationS };
          const created = await autopilot.createListingJob({
            sku: DGX_SKU_FOR[sku],
            idempotencyKey: await idempotencyKeyFor(`${DGX_SKU_FOR[sku]}-vertical`, id, inputs),
            listingId: id,
            photos,
            stagedStillUrl: job.stagedStillUrl ?? undefined,
            engine,
            durationS: spec.durationS,
            resolution: engine === "modal-wan" ? "480p" : "720p",
            upscale: true,
            style: job.style ?? undefined,
            roomType: job.roomType ?? undefined,
            look: lookOf(job),
            aspect: "9:16",
            mlsSafe: job.lane === "mls",
            endCard: endCardFromProfile(profile),
            listingFacts: listingFactsFor(job),
            ...owner,
          });
          data.dgxVerticalJobId = created.jobId;
        } catch (err) {
          // The landscape video is done and paid for — never strand it on the
          // add-on. Deliver without the reel and say so.
          console.error(`[listing/poll] vertical kickoff failed listing=${id}`, err);
          data.status = "ready";
          data.completedAt = new Date();
          data.errorCode = "reel_failed";
          data.errorMessage = "Your video is ready. The Vertical Reel add-on could not be started — text us and we will run it by hand.";
        }
      }
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
  } else if (phase === "finishing") {
    // The reel add-on failed after the landscape video succeeded: deliver the
    // landscape, keep the reason on the row. (Add-on refund is a manual call.)
    await prisma.vaterListingJob.updateMany({
      where: { id, status: job.status },
      data: {
        ...costData,
        status: "ready",
        completedAt: new Date(),
        errorCode: "reel_failed",
        errorMessage: `Your video is ready. The Vertical Reel add-on did not finish (${(st.error ?? st.errorCode ?? "render failed").slice(0, 200)}) — text us and we will run it by hand.`,
      },
    });
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
