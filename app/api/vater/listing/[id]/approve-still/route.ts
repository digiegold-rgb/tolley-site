/**
 * POST /api/vater/listing/[id]/approve-still — `awaiting_approval` → `rendering`.
 *
 * The agent approved the staged still. Video SKUs kick the DGX video job
 * with `stagedStillUrl` (no re-spend on the still); `virtual_staging` is
 * already delivered and flips straight to `ready`. Money moved at /stage —
 * nothing is charged here. Compliance is re-checked (profile may have changed).
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { autopilot } from "@/lib/vater/autopilot-client";
import { queueVaterEvent } from "@/lib/vater/events";
import { ownerFieldsForSessionWithLane } from "@/lib/vater/owner-tier";
import { isListingSku, LISTING_SKUS } from "@/lib/vater/listing-pricing";
import {
  computePreflight,
  DGX_SKU_FOR,
  endCardFromProfile,
  engineOf,
  idempotencyKeyFor,
  listingError,
  listingFactsFor,
  loadOwnedJob,
  loginRequired,
  lookOf,
  newProofToken,
  NO_STORE,
  toDto,
} from "@/lib/vater/listing/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return loginRequired();
  const { id } = await ctx.params;
  const owned = await loadOwnedJob(session.user.id, id);
  if (!owned.ok) return owned.res;
  const { job, userId, rootUserId } = owned;

  if (job.status !== "awaiting_approval") {
    return listingError(409, { error: `Nothing to approve — listing is ${job.status}.`, code: "bad_state" });
  }
  if (!isListingSku(job.sku)) return listingError(422, { error: "No SKU on this listing.", code: "no_sku" });
  if (!job.stagedStillUrl) return listingError(409, { error: "The staged still has not arrived yet.", code: "bad_state" });
  const sku = job.sku;
  const spec = LISTING_SKUS[sku];

  if (sku === "virtual_staging") {
    const updated = await prisma.vaterListingJob.update({
      where: { id },
      data: {
        status: "ready",
        completedAt: new Date(),
        mlsSafeStillUrl: job.mlsSafeStillUrl ?? job.stagedStillUrl,
        finalUrl: job.finalUrl ?? job.stagedStillLabeledUrl ?? job.stagedStillUrl,
        proofToken: job.proofToken ?? newProofToken(),
      },
    });
    return NextResponse.json({ job: toDto(updated) }, { headers: NO_STORE });
  }

  // Re-run compliance: the end card is generated NOW from the profile, and
  // the state rule must still be satisfiable. Budget already cleared at /stage.
  const pre = await computePreflight({ job, rootUserId, balanceCents: Number.POSITIVE_INFINITY });
  if (!pre.ok) {
    return listingError(422, { error: "Fix the items below before filming.", blockers: pre.blockers, code: pre.blockers[0]?.code });
  }

  const owner = await ownerFieldsForSessionWithLane(session, job.userId);
  const photos = job.sourceImageUrls.map((url, i) => ({ url, room: job.roomType ?? undefined, label: i === 0 ? "primary" : undefined }));
  const dgxSku = DGX_SKU_FOR[sku];
  const engine = engineOf(job);
  const inputs = { photos, stagedStillUrl: job.stagedStillUrl, engine, look: job.look, style: job.style, roomType: job.roomType, reel: job.reel, durationS: spec.durationS };
  const idempotencyKey = await idempotencyKeyFor(dgxSku, id, inputs);

  let created;
  try {
    created = await autopilot.createListingJob({
      sku: dgxSku,
      idempotencyKey,
      listingId: id,
      photos,
      stagedStillUrl: job.stagedStillUrl,
      engine,
      durationS: spec.durationS,
      resolution: engine === "modal-wan" ? "480p" : "720p",
      upscale: true,
      style: job.style ?? undefined,
      roomType: job.roomType ?? undefined,
      look: lookOf(job),
      aspect: job.reel ? "9:16" : "16:9",
      mlsSafe: job.lane === "mls",
      endCard: endCardFromProfile(pre.profile),
      listingFacts: listingFactsFor(job),
      ...owner,
    });
  } catch (err) {
    console.error(`[listing/approve-still] DGX kickoff failed listing=${id}`, err);
    return NextResponse.json(
      { error: "The render service is unavailable right now. Your approval was not lost — try again in a minute.", detail: err instanceof Error ? err.message : "unknown" },
      { status: 502, headers: NO_STORE },
    );
  }

  const updated = await prisma.vaterListingJob.update({
    where: { id },
    data: { status: "rendering", dgxRenderJobId: created.jobId, errorCode: null, errorMessage: null },
  });
  queueVaterEvent({
    userId,
    kind: "render.phase",
    message: `Listing Studio: still approved — filming ${spec.label}.`,
    projectId: id,
    jobId: created.jobId,
    data: { sku, dgxSku, engine, reused: created.reused, product: "realestate" },
  });
  return NextResponse.json({ job: toDto(updated), dgxJobId: created.jobId, reused: created.reused }, { headers: NO_STORE });
}
