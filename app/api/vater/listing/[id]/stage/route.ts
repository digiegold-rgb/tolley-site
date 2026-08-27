/**
 * POST /api/vater/listing/[id]/stage — the ONE paid click.
 *
 * server re-lint → checkBudget → rate limit (root human) → owner/lane →
 * debitForAction(`re:<sku>:<id>`, projectId=id) → DGX `staging` job →
 * status `staging`. Every SKU starts with a staging job: the agent approves
 * the still (Step "Your approval") before any video money is spent on the
 * DGX side; `virtual_staging` IS the still.
 *
 * Refund path: a DGX kickoff that fails after the debit refunds immediately;
 * a job that fails later refunds from /poll (moderation | compliance |
 * qa_geometry | timeout).
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimited } from "@/lib/rate-limit";
import { autopilot } from "@/lib/vater/autopilot-client";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { debitForAction, refundOnFailure } from "@/lib/vater/billing/ledger";
import { queueVaterEvent } from "@/lib/vater/events";
import { ownerFieldsForSessionWithLane } from "@/lib/vater/owner-tier";
import { budgetActionFor, isListingSku, LISTING_SKUS, listingDebitKey } from "@/lib/vater/listing-pricing";
import { buildPromptJson } from "@/lib/vater/listing/prompts";
import {
  complianceSnapshot,
  computePreflight,
  endCardFromProfile,
  idempotencyKeyFor,
  listingError,
  listingFactsFor,
  loadOwnedJob,
  loginRequired,
  lookOf,
  NO_STORE,
  toDto,
} from "@/lib/vater/listing/store";
import type { Prisma } from "@prisma/client";

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

  if (job.status !== "draft" && job.status !== "failed") {
    return listingError(409, { error: `Listing is already ${job.status}.`, code: "bad_state" });
  }
  if (!isListingSku(job.sku)) return listingError(422, { error: "Pick what to make first.", code: "no_sku" });
  const sku = job.sku;
  const spec = LISTING_SKUS[sku];
  if (spec.phase !== "p0") {
    return listingError(422, { error: `${spec.label} is coming soon.`, code: "no_sku" });
  }

  // 1. Compliance + profile (budget is checked separately below with the real gate).
  const pre = await computePreflight({ job, rootUserId, balanceCents: Number.POSITIVE_INFINITY });
  if (!pre.ok) {
    return listingError(422, { error: "Fix the items below before we can start.", blockers: pre.blockers, code: pre.blockers[0]?.code });
  }

  // 2. Money gate at LIST price (unmetered accounts gate at 0¢).
  const budget = await checkBudget(userId, budgetActionFor(sku), null, pre.priceCents);
  if (!budget.allow) {
    return listingError(402, {
      error: "Not enough credit for this.",
      code: "insufficient_credits",
      needCents: Math.max(0, pre.priceCents - (budget.balanceCents ?? 0)),
      blockers: [{ code: "insufficient_credits", message: `Add credit to continue — this costs $${(pre.priceCents / 100).toFixed(2)}.`, step: 5 }],
    });
  }

  // 3. Abuse limit on the ROOT human, never the tab.
  const rl = await consumeRateLimit(`vater:listing:${rootUserId}`, 5, 600);
  if (!rl.allowed) return rateLimited(rl);

  // 4. Lane + owner stamping (lane follows unmetered, never ownerTier).
  const owner = await ownerFieldsForSessionWithLane(session, job.userId);

  // 5. Debit BEFORE the kickoff so a customer can never get a render they
  //    didn't pay for; refund immediately if the DGX refuses the job.
  const chargeCents = budget.costCents ?? 0;
  const note = `${spec.label}${job.address ? ` — ${job.address}` : ""}`;
  const debit = await debitForAction(userId, chargeCents, listingDebitKey(sku, id), note, { projectId: id });
  if (!debit.ok) {
    return NextResponse.json({ error: "Billing is not ready. Try again in a minute." }, { status: 503, headers: NO_STORE });
  }

  const profile = pre.profile;
  const photos = job.sourceImageUrls.map((url, i) => ({ url, room: job.roomType ?? undefined, label: i === 0 ? "primary" : undefined }));
  const inputs = { photos, style: job.style, roomType: job.roomType, look: job.look, lane: job.lane, n: job.restageCount };
  const idempotencyKey = await idempotencyKeyFor("staging", id, inputs);

  let created;
  try {
    created = await autopilot.createListingJob({
      sku: "staging",
      idempotencyKey,
      listingId: id,
      photos,
      style: job.style ?? undefined,
      roomType: job.roomType ?? undefined,
      look: lookOf(job),
      aspect: job.reel ? "9:16" : "16:9",
      // Every staging job also yields the unlabeled MLS-safe still; the export
      // itself stays license-gated on the site.
      mlsSafe: true,
      endCard: endCardFromProfile(profile),
      listingFacts: listingFactsFor(job),
      ...owner,
    });
  } catch (err) {
    console.error(`[listing/stage] DGX kickoff failed listing=${id}`, err);
    if (chargeCents > 0) await refundOnFailure(id, "Render could not be started").catch(() => undefined);
    return NextResponse.json(
      { error: "The render service is unavailable right now. You have not been charged.", detail: err instanceof Error ? err.message : "unknown" },
      { status: 502, headers: NO_STORE },
    );
  }

  const promptJson = buildPromptJson({ sku, roomType: job.roomType, style: job.style, look: lookOf(job), sourceKind: job.sourceKind, durationS: spec.durationS, reel: job.reel });
  const updated = await prisma.vaterListingJob.update({
    where: { id },
    data: {
      status: "staging",
      step: 5,
      dgxStagingJobId: created.jobId,
      priceCents: chargeCents,
      promptJson: promptJson as unknown as Prisma.InputJsonValue,
      complianceJson: complianceSnapshot(job, profile, pre),
      errorCode: null,
      errorMessage: null,
    },
  });

  queueVaterEvent({
    userId,
    kind: "render.phase",
    message: `Listing Studio: ${spec.label} started (staging).`,
    projectId: id,
    jobId: created.jobId,
    data: { sku, chargeCents, reused: created.reused, product: "realestate" },
  });

  return NextResponse.json({ job: toDto(updated), dgxJobId: created.jobId, chargedCents: chargeCents, reused: created.reused }, { headers: NO_STORE });
}
