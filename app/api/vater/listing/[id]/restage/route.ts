/**
 * POST /api/vater/listing/[id]/restage — "Re-stage" the still (99¢).
 *
 * New seed / tweaked style on the SAME photo. Debit `re:restage:<id>:<n>`
 * (projectId = id so a later refund nets it out), a fresh DGX staging job,
 * `restageCount++`, back to `staging`. Unmetered accounts gate at 0¢.
 * Optional body: { style?, roomType?, look? } to tweak before re-rolling.
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimited } from "@/lib/rate-limit";
import { autopilot } from "@/lib/vater/autopilot-client";
import { checkBudget } from "@/lib/vater/billing/check-budget";
import { debitForAction } from "@/lib/vater/billing/ledger";
import { queueVaterEvent } from "@/lib/vater/events";
import { ownerFieldsForSessionWithLane } from "@/lib/vater/owner-tier";
import { isListingSku, RESTAGE_PRICE_CENTS } from "@/lib/vater/listing-pricing";
import {
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
  validateDraft,
} from "@/lib/vater/listing/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const MAX_RESTAGES = 5;

export async function POST(request: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return loginRequired();
  const { id } = await ctx.params;
  const owned = await loadOwnedJob(session.user.id, id);
  if (!owned.ok) return owned.res;
  let { job } = owned;
  const { userId, rootUserId } = owned;

  if (job.status !== "awaiting_approval") {
    return listingError(409, { error: `Re-stage is only available while a still is awaiting your approval (listing is ${job.status}).`, code: "bad_state" });
  }
  if (!isListingSku(job.sku)) return listingError(422, { error: "No SKU on this listing.", code: "no_sku" });
  if (job.restageCount >= MAX_RESTAGES) {
    return listingError(409, { error: `You've re-staged this photo ${MAX_RESTAGES} times — try a different photo or style.`, code: "bad_state" });
  }

  // Optional tweaks (style / roomType / look) before the re-roll.
  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return listingError(400, { error: "Invalid JSON" });
  }
  const tweak = validateDraft(body);
  if (!tweak.ok) return listingError(400, { error: tweak.error });
  const allowed: Record<string, unknown> = {};
  for (const k of ["style", "roomType", "look"] as const) if (k in tweak.data) allowed[k] = tweak.data[k];
  if (Object.keys(allowed).length) {
    job = await prisma.vaterListingJob.update({ where: { id }, data: allowed });
  }

  const pre = await computePreflight({ job, rootUserId, balanceCents: Number.POSITIVE_INFINITY });
  if (!pre.ok) {
    return listingError(422, { error: "Fix the items below before re-staging.", blockers: pre.blockers, code: pre.blockers[0]?.code });
  }

  const budget = await checkBudget(userId, "scene", null, RESTAGE_PRICE_CENTS);
  if (!budget.allow) {
    return listingError(402, {
      error: "Not enough credit to re-stage.",
      code: "insufficient_credits",
      needCents: Math.max(0, RESTAGE_PRICE_CENTS - (budget.balanceCents ?? 0)),
    });
  }
  const rl = await consumeRateLimit(`vater:listing:${rootUserId}`, 5, 600);
  if (!rl.allowed) return rateLimited(rl);

  const n = job.restageCount + 1;
  const chargeCents = budget.costCents ?? 0;
  const debit = await debitForAction(userId, chargeCents, `re:restage:${id}:${n}`, `Re-stage #${n}`, { projectId: id });
  if (!debit.ok) {
    return NextResponse.json({ error: "Billing is not ready. Try again in a minute." }, { status: 503, headers: NO_STORE });
  }

  const owner = await ownerFieldsForSessionWithLane(session, job.userId);
  const photos = job.sourceImageUrls.map((url, i) => ({ url, room: job.roomType ?? undefined, label: i === 0 ? "primary" : undefined }));
  const idempotencyKey = await idempotencyKeyFor("staging", id, { photos, style: job.style, roomType: job.roomType, look: job.look, lane: job.lane, n });

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
      mlsSafe: true,
      endCard: endCardFromProfile(pre.profile),
      listingFacts: listingFactsFor(job),
      ...owner,
    });
  } catch (err) {
    console.error(`[listing/restage] DGX kickoff failed listing=${id}`, err);
    // Reverse just this 99¢ — the original job's still is still approved-able.
    if (chargeCents > 0) {
      await prisma.vaterCreditLedger
        .create({
          data: { userId, deltaCents: chargeCents, kind: "refund", projectId: id, dedupeKey: `refund:restage:${id}:${n}`, note: "Re-stage could not be started" },
        })
        .catch(() => undefined);
    }
    return NextResponse.json({ error: "The render service is unavailable right now. You have not been charged.", detail: err instanceof Error ? err.message : "unknown" }, { status: 502, headers: NO_STORE });
  }

  const updated = await prisma.vaterListingJob.update({
    where: { id },
    data: {
      status: "staging",
      restageCount: n,
      dgxStagingJobId: created.jobId,
      priceCents: job.priceCents + chargeCents,
      errorCode: null,
      errorMessage: null,
    },
  });
  queueVaterEvent({
    userId,
    kind: "render.phase",
    message: `Listing Studio: re-stage #${n} started.`,
    projectId: id,
    jobId: created.jobId,
    data: { restage: n, chargeCents, product: "realestate" },
  });
  return NextResponse.json({ job: toDto(updated), dgxJobId: created.jobId, chargedCents: chargeCents }, { headers: NO_STORE });
}
