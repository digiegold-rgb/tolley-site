/**
 * /api/vater/listing — Listing Studio by Jelly! (tolley.io/realestateanimated)
 *
 *   POST → create a draft VaterListingJob (wizard Step 1 autosave)
 *   GET  → the caller's listings, newest first (?status=ready&limit=50)
 *
 * Wire contract: lib/vater/listing/contract.ts. Owner = the session's
 * userId (a workspace tab owns its own listings); abuse limits key on the
 * ROOT human (lib/vater/tenant-identity.ts). FEATURE_NOT_READY (503) until
 * prisma/migrations/20260827_vater_listing_jobs is applied.
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimited } from "@/lib/rate-limit";
import { isMissingRelationError } from "@/lib/vater/beta-schema";
import { resolveTenantIdentity } from "@/lib/vater/tenant-identity";
import { listingError, listingReady, loginRequired, NO_STORE, notReadyResponse, toDto, validateDraft } from "@/lib/vater/listing/store";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return loginRequired();
  if (!(await listingReady())) return notReadyResponse();

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));

  try {
    const rows = await prisma.vaterListingJob.findMany({
      where: { userId: session.user.id, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ jobs: rows.map(toDto) }, { headers: NO_STORE });
  } catch (err) {
    if (isMissingRelationError(err)) return notReadyResponse();
    console.error("[vater/listing] GET failed", err);
    return NextResponse.json({ error: "Could not load listings" }, { status: 500, headers: NO_STORE });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return loginRequired();
  if (!(await listingReady())) return notReadyResponse();

  const ident = await resolveTenantIdentity(session.user.id);
  const rl = await consumeRateLimit(`vater:listing:create:${ident.rootUserId}`, 30, 3600);
  if (!rl.allowed) return rateLimited(rl);

  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return listingError(400, { error: "Invalid JSON" });
  }
  const v = validateDraft(body);
  if (!v.ok) return listingError(400, { error: v.error });

  try {
    const row = await prisma.vaterListingJob.create({
      data: {
        ...(v.data as Prisma.VaterListingJobCreateInput),
        userId: session.user.id,
        status: "draft",
      },
    });
    return NextResponse.json({ job: toDto(row) }, { status: 201, headers: NO_STORE });
  } catch (err) {
    if (isMissingRelationError(err)) return notReadyResponse();
    console.error("[vater/listing] POST failed", err);
    return NextResponse.json({ error: "Could not create the listing" }, { status: 500, headers: NO_STORE });
  }
}
