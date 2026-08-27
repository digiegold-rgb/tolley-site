/**
 * /api/vater/listing/[id]
 *   GET   → one listing (owner only)
 *   PATCH → step-save draft fields (validated; only while status is `draft`)
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isMissingRelationError } from "@/lib/vater/beta-schema";
import { listingError, loadOwnedJob, loginRequired, NO_STORE, notReadyResponse, toDto, validateDraft } from "@/lib/vater/listing/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return loginRequired();
  const { id } = await ctx.params;
  const owned = await loadOwnedJob(session.user.id, id);
  if (!owned.ok) return owned.res;
  return NextResponse.json({ job: toDto(owned.job) }, { headers: NO_STORE });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return loginRequired();
  const { id } = await ctx.params;
  const owned = await loadOwnedJob(session.user.id, id);
  if (!owned.ok) return owned.res;
  if (owned.job.status !== "draft" && owned.job.status !== "failed") {
    return listingError(409, { error: `Listing is ${owned.job.status} — fields are locked once it is submitted.`, code: "bad_state" });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return listingError(400, { error: "Invalid JSON" });
  }
  const v = validateDraft(body);
  if (!v.ok) return listingError(400, { error: v.error });

  try {
    const row = await prisma.vaterListingJob.update({
      where: { id },
      // A failed job edited in the wizard goes back to draft for a clean retry.
      data: { ...v.data, ...(owned.job.status === "failed" ? { status: "draft", errorCode: null, errorMessage: null } : {}) },
    });
    return NextResponse.json({ job: toDto(row) }, { headers: NO_STORE });
  } catch (err) {
    if (isMissingRelationError(err)) return notReadyResponse();
    console.error("[vater/listing] PATCH failed", err);
    return NextResponse.json({ error: "Could not save" }, { status: 500, headers: NO_STORE });
  }
}
