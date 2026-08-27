import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { rateLimitByIp } from "@/lib/rate-limit";
import { hasVaterAccountTable } from "@/lib/vater/schema-probe";
import {
  hasBetaInviteTable,
  isMissingRelationError,
} from "@/lib/vater/beta-schema";
import {
  ensureReferralCodes,
  INVITE_REJECTION_MESSAGE,
  normalizeInviteCode,
  redeemInviteTx,
  stampUserInvite,
  type InviteRejection,
} from "@/lib/vater/beta-invites";
import { queueVaterEvent } from "@/lib/vater/events";
import { grantStarterCredit } from "@/lib/vater/billing/ledger";
import { isStudioPath, productForPath, PRODUCT_NAME, type Product } from "@/lib/vater/product";
import { setAccountOrigin } from "@/lib/vater/listing/agent-profile";

export const runtime = "nodejs";

type RegisterPayload = {
  email?: string;
  password?: string;
  /** Click-wrap stamp from the Jelly Studio signup (lib/legal-animate TOS_VERSION). */
  termsVersion?: string;
  /** Where signup will land. `/animate…` = Jelly! Studio, `/realestateanimated…` = Listing Studio. */
  callbackUrl?: string;
  /** Beta invite code — required for Jelly Studio signups. */
  invite?: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Is this a Jelly Studio signup (invite-only) or one of the other lanes
 * (T-Agent leads, Ruthann's Kitchen, a Launchpad claim) that stay open?
 *
 * Two independent signals, either of which is enough, because the client
 * controls both: the callbackUrl it will land on, and the studio click-wrap
 * stamp that only the studio form sends.
 *
 * ⚠️ KNOWN LIMIT: registration is a public endpoint, so a caller who strips
 * both fields still gets a User row without an invite. That account is not a
 * back door into the beta — it gets NO VaterAccount row, NO betaInviteId and
 * NO starter credit, so it lands on /animate with nothing entitled. Gating the
 * studio itself on `beta.invited` (exposed by GET /api/vater/me) is the
 * durable fix and belongs with whoever owns BetaAccessBanner.
 */
function isStudioSignup(payload: RegisterPayload): boolean {
  const callbackUrl = typeof payload.callbackUrl === "string" ? payload.callbackUrl : "";
  // Either front door: /animate (Jelly! Studio) or /realestateanimated
  // (Listing Studio by Jelly!) — lib/vater/product.ts.
  if (isStudioPath(callbackUrl)) return true;
  return typeof payload.termsVersion === "string" && payload.termsVersion.trim().length > 0;
}

/** Which front door this signup came through; Jelly unless the callback says otherwise. */
function signupProduct(payload: RegisterPayload): Product {
  return productForPath(typeof payload.callbackUrl === "string" ? payload.callbackUrl : "") ?? "jelly";
}

// Rate limited to 5/hr per IP: signup is a public write that also runs a
// (deliberately slow) password hash, so it is both a spam and a CPU target.
export async function POST(request: Request) {
  try {
    const limited = await rateLimitByIp(request, "auth:register", 5, 3600);
    if (limited) return limited;

    const payload = (await request.json()) as RegisterPayload;
    const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const termsVersion =
      typeof payload.termsVersion === "string" && payload.termsVersion.trim()
        ? payload.termsVersion.trim().slice(0, 32)
        : null;
    const inviteCode = normalizeInviteCode(payload.invite);
    const studioSignup = isStudioSignup(payload);
    const origin = signupProduct(payload);

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    /* Invite gate. Enforced when this is a studio signup, and ALSO whenever a
     * code was supplied at all — a wrong code must never sail through just
     * because the caller forgot the callbackUrl.
     *
     * Pre-migration the BetaInvite table doesn't exist. Enforcing then would
     * mean nobody can sign up between the deploy and the migration, so the
     * gate opens and says so in the log. Once the table lands, it is real. */
    const inviteTableReady = await hasBetaInviteTable();
    const enforceInvite = (studioSignup || Boolean(inviteCode)) && inviteTableReady;

    if (!inviteTableReady && studioSignup) {
      console.warn(
        "[register] BetaInvite table missing — invite gate OPEN until migration 20260815_beta_invites is applied",
      );
    }

    if (enforceInvite && !inviteCode) {
      return NextResponse.json(
        {
          error: INVITE_REJECTION_MESSAGE.INVITE_REQUIRED,
          code: "INVITE_REQUIRED" satisfies InviteRejection,
        },
        { status: 403 },
      );
    }

    const passwordHash = await hashPassword(password);

    /* Explicit discriminated union. Without it TS infers a union of three
     * object literals whose non-shared keys become optional, and the
     * `"inviteRejected" in outcome` narrowing below doesn't hold. */
    type RegisterOutcome =
      | { error: "ACCOUNT_EXISTS" }
      | { inviteRejected: InviteRejection }
      | { userId: string; email: string | null; inviteId: string | null };

    const outcome = await prisma.$transaction(async (tx): Promise<RegisterOutcome> => {
      const existingUser = await tx.user.findUnique({
        where: { email },
        include: {
          credentialAuth: true,
        },
      });

      // SECURITY (2026-08-15): never attach a password to a pre-existing User
      // row (magic-link / seeded / admin accounts with no credentials) — that
      // was an account-takeover vector. Existing email = 409, full stop.
      //
      // This also means an existing account can never spend an invite code:
      // we bail before redeemInviteTx runs, so the code keeps its use.
      if (existingUser) {
        return { error: "ACCOUNT_EXISTS" as const };
      }

      /* Redeem BEFORE creating the user, inside the same transaction. If the
       * user create fails the redemption rolls back with it, so a failed
       * signup never burns a code. */
      let inviteId: string | null = null;
      if (enforceInvite) {
        const redeemed = await redeemInviteTx(tx, inviteCode, email);
        if (!redeemed.ok) {
          return { inviteRejected: redeemed.reason };
        }
        inviteId = redeemed.inviteId;
      }

      const user = await tx.user.create({
        data: {
          email,
        },
      });

      await tx.credentialAuth.create({
        data: {
          userId: user.id,
          passwordHash,
        },
      });

      return {
        userId: user.id,
        email: user.email,
        inviteId,
      };
    });

    if ("error" in outcome) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in." },
        { status: 409 },
      );
    }

    if ("inviteRejected" in outcome) {
      return NextResponse.json(
        {
          error: INVITE_REJECTION_MESSAGE[outcome.inviteRejected],
          code: outcome.inviteRejected,
        },
        { status: 403 },
      );
    }

    // Click-wrap stamp, recorded as a separate best-effort write. The columns
    // arrive with prisma/migrations/20260815_animate_terms; until that lands on
    // a given environment the UPDATE fails, and a failed acceptance stamp must
    // never cost the user their account — so it is raw SQL (the generated
    // client may not know the columns yet) inside its own try/catch.
    if (termsVersion) {
      try {
        await prisma.$executeRaw`
          UPDATE "User"
             SET "termsAcceptedAt" = NOW(),
                 "termsVersion" = ${termsVersion}
           WHERE "id" = ${outcome.userId}
        `;
      } catch (stampError) {
        console.error("register: terms acceptance stamp failed", stampError);
      }
    }

    // Same best-effort rule for the invite stamp (User.betaInviteId arrives
    // with migration 20260815_beta_invites). The code is already spent — the
    // stamp is provenance, not entitlement.
    if (outcome.inviteId) {
      await stampUserInvite(outcome.userId, outcome.inviteId);
    }

    /* Everything below is post-signup provisioning. None of it may fail the
     * request: the account exists and the user is about to be signed in. */
    if (studioSignup) {
      await provisionStudioAccount(outcome.userId, outcome.inviteId, origin);
    }

    queueVaterEvent({
      userId: outcome.userId,
      kind: "account.created",
      message: studioSignup
        ? `${PRODUCT_NAME[origin]} account created.`
        : "Account created.",
      data: { email, studio: studioSignup, origin },
    });
    if (outcome.inviteId) {
      queueVaterEvent({
        userId: outcome.userId,
        kind: "invite.accepted",
        message: `Beta invite ${inviteCode} accepted.`,
        data: { inviteId: outcome.inviteId },
      });
    }

    return NextResponse.json({
      ok: true,
      userId: outcome.userId,
      email: outcome.email,
    });
  } catch (error) {
    console.error("register route error", error);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 },
    );
  }
}

/**
 * Give a fresh Jelly Studio account the two things it needs to be usable:
 * a VaterAccount row at tier `public`, and the $10 promo starter credit.
 *
 * ⚠️ tier is `public`, never `studio` — see the "KNOWN GAP" block in
 * lib/vater/job-ownership.ts. Studio tier shares inline Style-editor jobs
 * across accounts, so handing it to a beta invite is a cross-tenant read.
 *
 * grantStarterCredit is idempotent (dedupeKey `grant:starter:<userId>`) and
 * already no-ops when the ledger table hasn't been migrated, so a re-run or a
 * pre-migration environment costs nothing and grants nothing twice.
 */
async function provisionStudioAccount(
  userId: string,
  inviteId: string | null,
  origin: Product = "jelly",
): Promise<void> {
  try {
    if (await hasVaterAccountTable()) {
      await prisma.vaterAccount.upsert({
        where: { userId },
        create: {
          userId,
          tier: "public",
          unmetered: false,
          invitedBy: inviteId,
          notes: origin === "realestate" ? "listing studio invite signup" : "beta invite signup",
        },
        update: {},
      });
      // Origin stamp is a separate, probe-guarded raw UPDATE: the column
      // arrives with 20260827_vater_account_origin_license and the upsert
      // above must keep working on a database that predates it.
      await setAccountOrigin(userId, origin);
    }
  } catch (err) {
    if (!isMissingRelationError(err)) {
      console.error("register: VaterAccount provisioning failed", err);
    }
  }

  try {
    const grant = await grantStarterCredit(userId);
    if (!grant.granted) {
      console.info(`[register] starter credit not granted (${grant.reason ?? "unknown"})`);
    }
  } catch (err) {
    console.error("register: starter credit grant failed", err);
  }

  // Two single-use referral codes, minted at signup so they are already
  // waiting the first time the user opens the referral card. Idempotent and
  // self-swallowing (see ensureReferralCodes) — this can never fail a signup.
  await ensureReferralCodes(userId);
}
