/**
 * GET  /api/vater/me   — who the /animate client is and what it may render
 * PATCH /api/vater/me  — per-user preferences the studio owns
 * (showcaseOptOut, smsOptIn, agentProfile, characterStudioCopy)
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
import { scriptCapFor } from "@/lib/vater/billing/script-cap";
import { workspaceForUser, MAX_WORKSPACES } from "@/lib/vater/workspaces";
import {
  animateSmsDisplayNumber,
  animateSmsPhoneRequiredError,
  parseAnimateSmsLeadFields,
} from "@/lib/animate-sms";
import { toE164 } from "@/lib/phone";
import { studioAccessAllowed } from "@/lib/vater/beta-access";
import {
  AgentProfileNotReadyError,
  readAgentProfile,
  sanitizeAgentProfilePatch,
  writeAgentProfile,
} from "@/lib/vater/listing/agent-profile";
import {
  CHARACTER_STUDIO_COPY_DEFAULT,
  readCharacterStudioCopyFlag,
} from "@/lib/vater/character-studio-copy";

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

async function readSmsFlags(
  userId: string,
): Promise<{ optIn: boolean; phone: string | null }> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ animateSmsOptIn: boolean; animateSmsPhone: string | null }>
    >`
      SELECT "animateSmsOptIn", "animateSmsPhone" FROM "User" WHERE "id" = ${userId} LIMIT 1
    `;
    const row = rows[0];
    return {
      optIn: Boolean(row?.animateSmsOptIn),
      phone: row?.animateSmsPhone ?? null,
    };
  } catch (err) {
    if (!isMissingRelationError(err)) {
      console.error("[vater/me] sms flag read failed", err);
    }
    return { optIn: false, phone: null };
  }
}

/**
 * characterStudioCopy is a later column (20260901). Isolated read so a
 * missing-column environment still boots /animate with the product default
 * (ON) instead of failing the whole flags query.
 */
async function readCharacterStudioCopy(userId: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ characterStudioCopy: boolean }>>`
      SELECT "characterStudioCopy" FROM "User" WHERE "id" = ${userId} LIMIT 1
    `;
    return readCharacterStudioCopyFlag(rows[0]?.characterStudioCopy);
  } catch (err) {
    if (!isMissingRelationError(err)) {
      console.error("[vater/me] characterStudioCopy read failed", err);
    }
    return CHARACTER_STUDIO_COPY_DEFAULT;
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

  /* Workspace TAB (lib/vater/workspaces.ts). The session id is the tab's
   * hidden User; beta/terms/showcase flags are the HUMAN's, so read them off
   * the root login. Looked up from the DB rather than session.workspace so a
   * support "view as" session pointed at a tab still reports it correctly. */
  const ws = await workspaceForUser(session.user.id);
  const rootUserId = ws?.ownerUserId ?? session.user.id;
  const flags = await readUserFlags(rootUserId);
  const sms = await readSmsFlags(rootUserId);
  const characterStudioCopy = await readCharacterStudioCopy(rootUserId);

  /* How long a script this account may render. The editor needs the same
   * number the from-script / context guards enforce — otherwise the Script
   * screen greys out Approve at 1,700 words for someone the API would happily
   * have taken 3,700 from. `undefined` = uncapped (owner). */
  const cap = await scriptCapFor(session.user.id, email);

  /* Listing Studio (2026-08-27). `product` is which front door the HUMAN
   * came through (VaterAccount.origin on the root login, 'jelly' until the
   * origin migration lands). The agent profile drives end cards + license
   * gates; `capabilities.license` / `.mls` are what the wizard reads. */
  const agentProfile = await readAgentProfile(rootUserId);
  const product = agentProfile.origin;
  const licenseOk = agentProfile.licenseStatus === "verified";
  const mlsOk =
    licenseOk &&
    (agentProfile.licenseState === "MO" || agentProfile.licenseState === "KS") &&
    Boolean(process.env.MLS_GRID_TOKEN);

  return NextResponse.json(
    {
      tier,
      email,
      userId: session.user.id,
      product,
      agentProfile,
      /** Which studio tab this session is inside. `null` until the workspace
       *  table exists — the tab strip hides itself. `isPrimary` = the login's
       *  own studio (today's data). */
      workspace: ws
        ? {
            id: ws.userId,
            name: ws.name,
            isPrimary: ws.userId === ws.ownerUserId,
            rootUserId: ws.ownerUserId,
            max: MAX_WORKSPACES,
          }
        : null,
      capabilities: {
        // Studio-gated surfaces (isVaterStudioEmail).
        // 8/25: the GLOBAL rulebook + a user's own rules are for everyone;
        // the house rulebook (Trey's) stays studio.
        rules: true,
        houseRules: studio,
        direct: studio,
        course: studio,
        latestCosts: studio,
        // Proxy reads are open to any signed-in user; writes stay studio.
        voicesRead: true,
        voicesWrite: studio,
        pipelineStatus: true,
        // RSS feeds are per-user since 2026-08-17 (auto-pipeline stays owner).
        rss: true,
        // Owner-only surfaces (isVaterAdminEmail).
        chat: owner,
        observer: owner,
        // Site-admin content calendar (/api/content/posts).
        publishingPosts: siteAdmin,
        // Listing Studio: verified real-estate license (MLS-safe export,
        // REALTOR® mark) and MLS pull (license + MO/KS + MLS Grid token).
        license: licenseOk,
        mls: mlsOk,
      },
      // Nav subset per product (lib/vater/nav-visibility.ts `products`).
      routes: routeIdsForTier(tier, true, product),
      /** Script length ceiling. null = uncapped. See script-cap.ts for the
       *  rule; `capTier` is why, so the UI can say "buy credit for longer". */
      maxWords: cap.maxWords ?? null,
      capTier: cap.tier,
      /** Beta / legal state. `invited` is true once the account redeemed a
       *  BetaInvite (Listing Studio still gates on it; Jelly public beta
       *  does not). */
      beta: {
        invited: flags.invited,
        showcaseOptOut: flags.showcaseOptOut,
        /** Owner + studio accounts are grandfathered. Jelly is a public
         *  beta — a signed-in /animate account is enough. Listing Studio
         *  still requires a redeemed invite. */
        accessAllowed: studioAccessAllowed({
          owner,
          studio,
          invited: flags.invited,
          product,
        }),
        /** Current click-wrap version accepted? Existing accounts (pre-8/15)
         *  get a one-time accept modal in the Shell (BetaGate). */
        termsAccepted: flags.termsVersion === TOS_VERSION,
        tosVersion: TOS_VERSION,
      },
      /** Optional Jelly Studio account texts. Never inferred as opted-in. */
      sms: {
        optIn: sms.optIn,
        phone: sms.phone,
        displayNumber: animateSmsDisplayNumber(),
      },
      /** Account-global Animate flags (root login). Default ON. */
      settings: {
        characterStudioCopy,
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
 * PATCH { showcaseOptOut?: boolean, characterStudioCopy?: boolean, … }
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

  let body: { showcaseOptOut?: unknown; acceptTerms?: unknown; smsOptIn?: unknown; phone?: unknown; agentProfile?: unknown; characterStudioCopy?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }

  // Listing Studio agent profile (end card + license). Written on the ROOT
  // login: the broker and license belong to the human, not the tab. Writes
  // under view-as are already blocked in proxy.ts (403 on non-GET).
  if (body.agentProfile !== undefined) {
    if (!body.agentProfile || typeof body.agentProfile !== "object") {
      return NextResponse.json({ error: "agentProfile must be an object" }, { status: 400, headers: NO_STORE });
    }
    const patch = sanitizeAgentProfilePatch(body.agentProfile);
    try {
      const agentProfile = await writeAgentProfile(session.user.id, patch);
      return NextResponse.json({ ok: true, agentProfile }, { headers: NO_STORE });
    } catch (err) {
      if (err instanceof AgentProfileNotReadyError) {
        return NextResponse.json(
          { error: "FEATURE_NOT_READY", message: "The VaterAccount origin/license columns have not been migrated yet." },
          { status: 503, headers: NO_STORE },
        );
      }
      console.error("[vater/me] agentProfile update failed", err);
      return NextResponse.json({ error: "Could not save your profile." }, { status: 500, headers: NO_STORE });
    }
  }

  // One-time click-wrap for accounts that pre-date the Terms (or a new
  // TOS_VERSION). Stamps the CURRENT version + timestamp; never downgrades.
  // Always on the ROOT login: consent belongs to the human, not the tab.
  if (body.acceptTerms === true) {
    try {
      const rootId = session.workspace?.rootUserId ?? session.user.id;
      await prisma.user.update({
        where: { id: rootId },
        data: { termsAcceptedAt: new Date(), termsVersion: TOS_VERSION },
      });
    } catch (err) {
      console.error("[vater/me] acceptTerms failed", err);
      return NextResponse.json({ error: "Could not record acceptance." }, { status: 500, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true, termsAccepted: true, tosVersion: TOS_VERSION }, { headers: NO_STORE });
  }

  if (typeof body.smsOptIn === "boolean") {
    const sms = parseAnimateSmsLeadFields({ smsOptIn: body.smsOptIn, phone: body.phone });
    const smsError = animateSmsPhoneRequiredError(sms);
    if (smsError) {
      return NextResponse.json({ error: smsError }, { status: 400, headers: NO_STORE });
    }
    const phone = sms.phone ? toE164(sms.phone) ?? sms.phone : null;
    const rootId = session.workspace?.rootUserId ?? session.user.id;
    try {
      await prisma.$executeRaw`
        UPDATE "User"
        SET "animateSmsOptIn" = ${sms.smsOptIn},
            "animateSmsPhone" = ${phone},
            "animateSmsOptedInAt" = ${sms.smsOptIn ? new Date() : null}
        WHERE "id" = ${rootId}
      `;
    } catch (err) {
      if (isMissingRelationError(err)) {
        return NextResponse.json(
          { error: "FEATURE_NOT_READY", message: "The Animate SMS columns have not been migrated yet." },
          { status: 503, headers: NO_STORE },
        );
      }
      console.error("[vater/me] smsOptIn update failed", err);
      return NextResponse.json(
        { error: "Could not save that setting." },
        { status: 500, headers: NO_STORE },
      );
    }
    return NextResponse.json(
      { ok: true, sms: { optIn: sms.smsOptIn, phone, displayNumber: animateSmsDisplayNumber() } },
      { headers: NO_STORE },
    );
  }

  if (typeof body.characterStudioCopy === "boolean") {
    const rootId = session.workspace?.rootUserId ?? session.user.id;
    try {
      await prisma.$executeRaw`
        UPDATE "User"
        SET "characterStudioCopy" = ${body.characterStudioCopy}
        WHERE "id" = ${rootId}
      `;
    } catch (err) {
      if (isMissingRelationError(err)) {
        return NextResponse.json(
          { error: "FEATURE_NOT_READY", message: "The character-studio-copy column has not been migrated yet." },
          { status: 503, headers: NO_STORE },
        );
      }
      console.error("[vater/me] characterStudioCopy update failed", err);
      return NextResponse.json(
        { error: "Could not save that setting." },
        { status: 500, headers: NO_STORE },
      );
    }
    return NextResponse.json(
      { ok: true, characterStudioCopy: body.characterStudioCopy },
      { headers: NO_STORE },
    );
  }

  if (typeof body.showcaseOptOut !== "boolean") {
    return NextResponse.json(
      { error: "showcaseOptOut (boolean) required" },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    await prisma.user.update({
      where: { id: session.workspace?.rootUserId ?? session.user.id },
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
