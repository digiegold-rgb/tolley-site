/**
 * GET  /api/vater/me   — who the /animate client is and what it may render
 * PATCH /api/vater/me  — per-user preferences the studio owns (showcaseOptOut)
 *
 * Single source of truth the /animate client uses to decide what to render.
 * Without this the Sidebar advertised owner-only screens (RSS Feeds,
 * Autopilot, Discord) to every paying customer, who then hit a 401 wall.
 *
 * Returns the caller's tier, the capability flags each gated surface checks,
 * the nav route ids they should see, the beta/showcase state, and — when an
 * admin is running a support session — who they are viewing as. Never cached:
 * tier is per-user and impersonation is per-request.
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  isAdminEmail,
  isVaterAdminEmail,
  isVaterStudioEmail,
} from "@/lib/admin-auth";
import { routeIdsForTier, type VaterTier } from "@/lib/vater/nav-visibility";
import { resolveActor } from "@/lib/vater/acting-as";
import { isMissingRelationError } from "@/lib/vater/beta-schema";
import { TOS_VERSION } from "@/lib/legal-animate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/**
 * showcaseOptOut / betaInviteId in one read.
 *
 * betaInviteId arrives with migration 20260815_beta_invites, so this is raw
 * SQL guarded by a catch: on an environment where the column is missing the
 * whole /animate shell must still boot, just without the beta flag.
 */
async function readUserFlags(
  userId: string,
): Promise<{ showcaseOptOut: boolean; invited: boolean; termsVersion: string | null }> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ showcaseOptOut: boolean; betaInviteId: string | null; termsVersion: string | null }>
    >`
      SELECT "showcaseOptOut", "betaInviteId", "termsVersion" FROM "User" WHERE "id" = ${userId} LIMIT 1
    `;
    const row = rows[0];
    return {
      showcaseOptOut: Boolean(row?.showcaseOptOut),
      invited: Boolean(row?.betaInviteId),
      termsVersion: row?.termsVersion ?? null,
    };
  } catch (err) {
    if (!isMissingRelationError(err)) {
      console.error("[vater/me] flag read failed", err);
    }
    return { showcaseOptOut: false, invited: false, termsVersion: null };
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }

  const actor = resolveActor(session);
  const email = session.user.email ?? null;

  /* ⚠️ Tier is resolved from the EFFECTIVE email. While viewing as a customer
   * that is the customer's address, so an admin support session correctly
   * sees the customer's (smaller) nav — which is the entire point of the
   * feature. `impersonating` is what the UI keys the red banner off. */
  const owner = isVaterAdminEmail(email);
  const studio = isVaterStudioEmail(email);
  const siteAdmin = isAdminEmail(email);

  const tier: VaterTier = owner ? "owner" : studio ? "studio" : "public";
  const flags = await readUserFlags(session.user.id);

  return NextResponse.json(
    {
      tier,
      email,
      userId: session.user.id,
      capabilities: {
        // Studio-gated surfaces (isVaterStudioEmail).
        rules: studio,
        direct: studio,
        course: studio,
        latestCosts: studio,
        // Proxy reads are open to any signed-in user; writes stay studio.
        voicesRead: true,
        voicesWrite: studio,
        pipelineStatus: true,
        // Owner-only surfaces (isVaterAdminEmail).
        rss: owner,
        chat: owner,
        observer: owner,
        // Site-admin content calendar (/api/content/posts).
        publishingPosts: siteAdmin,
      },
      routes: routeIdsForTier(tier),
      /** Beta / legal state. `invited` is true once the account redeemed a
       *  BetaInvite — the durable signal for gating the studio itself. */
      beta: {
        invited: flags.invited,
        showcaseOptOut: flags.showcaseOptOut,
        /** Owner + studio accounts (Trey) are grandfathered; everyone else
         *  must have redeemed an invite to use the studio at all. */
        accessAllowed: owner || studio || flags.invited,
        /** Current click-wrap version accepted? Existing accounts (pre-8/15)
         *  get a one-time accept modal in the Shell (BetaGate). */
        termsAccepted: flags.termsVersion === TOS_VERSION,
        tosVersion: TOS_VERSION,
      },
      /** Set only during an admin support session. readOnly is enforced in
       *  proxy.ts, not here — this is just what the banner reads. */
      impersonation: actor?.isImpersonating
        ? { active: true, adminEmail: actor.adminEmail, readOnly: true }
        : { active: false, adminEmail: null, readOnly: false },
    },
    { headers: NO_STORE },
  );
}

/**
 * PATCH { showcaseOptOut: boolean }
 *
 * Backs the Terms § 7 promotional-license opt-out. false (the default) means
 * inputs/outputs may appear in showcases; true means they may not.
 *
 * ⚠️ Blocked during a support session — proxy.ts 403s every non-GET to
 * /api/vater while jelly_view_as is set, so an admin can never flip a
 * customer's licensing choice for them. That is a legal consent, not a
 * setting.
 */
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }

  let body: { showcaseOptOut?: unknown; acceptTerms?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }

  // One-time click-wrap for accounts that pre-date the Terms (or a new
  // TOS_VERSION). Stamps the CURRENT version + timestamp; never downgrades.
  if (body.acceptTerms === true) {
    try {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { termsAcceptedAt: new Date(), termsVersion: TOS_VERSION },
      });
    } catch (err) {
      console.error("[vater/me] acceptTerms failed", err);
      return NextResponse.json({ error: "Could not record acceptance." }, { status: 500, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true, termsAccepted: true, tosVersion: TOS_VERSION }, { headers: NO_STORE });
  }

  if (typeof body.showcaseOptOut !== "boolean") {
    return NextResponse.json(
      { error: "showcaseOptOut (boolean) required" },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { showcaseOptOut: body.showcaseOptOut },
    });
  } catch (err) {
    if (isMissingRelationError(err)) {
      return NextResponse.json(
        { error: "FEATURE_NOT_READY", message: "The showcase opt-out column has not been migrated yet." },
        { status: 503, headers: NO_STORE },
      );
    }
    console.error("[vater/me] showcaseOptOut update failed", err);
    return NextResponse.json(
      { error: "Could not save that setting." },
      { status: 500, headers: NO_STORE },
    );
  }

  return NextResponse.json(
    { ok: true, showcaseOptOut: body.showcaseOptOut },
    { headers: NO_STORE },
  );
}
