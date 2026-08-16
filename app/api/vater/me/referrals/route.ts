/**
 * GET /api/vater/me/referrals — the caller's referral codes, their links, and
 * what they have earned.
 *
 * {
 *   ready: boolean,          // false = BetaInvite table not migrated here
 *   bonusCents: number,      // what a successful referral pays
 *   earnedCents: number,     // paid to date (grant rows keyed `ref:<id>`)
 *   codes: [{ code, display, link, used, expiresAt }]
 * }
 *
 * Codes are minted lazily: an account that predates the referral feature (or
 * one whose signup ran before the BetaInvite migration landed) gets its two
 * codes on the first read, rather than needing a backfill script.
 *
 * A code is only a code to its owner — this route reads the SESSION user and
 * never accepts a userId, so nobody can enumerate someone else's invites.
 */

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  ensureReferralCodes,
  formatInviteCode,
  inviteLink,
} from "@/lib/vater/beta-invites";
import {
  REFERRAL_BONUS_CENTS,
  referralEarningsCents,
} from "@/lib/vater/billing/ledger";
import { publicSiteUrl } from "@/lib/vater/site-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const [codes, earnedCents] = await Promise.all([
    ensureReferralCodes(userId),
    referralEarningsCents(userId),
  ]);

  const base = publicSiteUrl();

  return NextResponse.json(
    {
      ready: codes.length > 0,
      bonusCents: REFERRAL_BONUS_CENTS,
      earnedCents,
      codes: codes.map((c) => ({
        code: c.code,
        display: formatInviteCode(c.code),
        link: inviteLink(c.code, base),
        // A single-use code that has been spent is a referral in flight (or
        // already paid) — the UI greys it out rather than hiding it, so the
        // count of codes never changes under the user.
        used: c.usedCount >= c.maxUses,
        expiresAt: c.expiresAt,
      })),
    },
    { headers: NO_STORE },
  );
}
