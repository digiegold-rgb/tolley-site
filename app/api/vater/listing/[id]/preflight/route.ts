/**
 * GET /api/vater/listing/[id]/preflight — { blockers, warnings, priceCents … }
 *
 * Compliance (Fair Housing + prompt blocklist + state end-card rule) +
 * agent profile + budget, in the exact shape MoneyConfirmModal consumes.
 * The modal cannot open while `blockers` is non-empty; /stage re-runs the
 * same check server-side so a direct POST can't skip it.
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { computePreflight, loadOwnedJob, loginRequired, NO_STORE } from "@/lib/vater/listing/store";
import type { ListingPreflight } from "@/lib/vater/listing/contract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return loginRequired();
  const { id } = await ctx.params;
  const owned = await loadOwnedJob(session.user.id, id);
  if (!owned.ok) return owned.res;

  const pre = await computePreflight({ job: owned.job, rootUserId: owned.rootUserId });
  const body: ListingPreflight = {
    ok: pre.ok,
    blockers: pre.blockers,
    warnings: pre.warnings,
    priceCents: pre.priceCents,
    estCostCents: pre.estCostCents,
    balanceCents: pre.balanceCents,
    agentProfileComplete: pre.agentProfileComplete,
    licenseVerified: pre.licenseVerified,
    lines: pre.lines,
  };
  return NextResponse.json(body, { headers: NO_STORE });
}
