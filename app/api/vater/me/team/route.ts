/**
 * GET  /api/vater/me/team — the caller's org, their role, the seats, and any
 *                           invites that haven't been redeemed yet
 * POST /api/vater/me/team — { name } creates the org (first call only), or
 *                           { email } invites a seat
 *
 * Session-gated. Backs the /animate → Team screen.
 *
 * ── HOW A SEAT IS FILLED ─────────────────────────────────────────────────
 * Inviting mints a BetaInvite carrying this org's id. The invitee signs up
 * with that code through the ordinary invite flow — no separate "accept team
 * invite" path, no second way into the studio to keep secure — and lands in
 * the org on their next /animate load (lib/vater/org-access.ts explains why
 * the join is lazy rather than part of the signup transaction).
 *
 * Consequence worth stating plainly: an invited seat has to redeem the code
 * to join. Sending it is not adding them. The Team screen shows unredeemed
 * invites as pending precisely so "I invited them and nothing happened" is
 * visible rather than mysterious.
 *
 * ── WHO MAY DO WHAT ──────────────────────────────────────────────────────
 * Only the org owner invites, removes, or changes roles. Editors and viewers
 * can read the roster and nothing else. The owner is the account that pays —
 * an editor who could add seats would be spending someone else's money.
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { hasBetaInviteTable } from "@/lib/vater/beta-schema";
import { mintInvites, inviteLink } from "@/lib/vater/beta-invites";
import {
  createOrg,
  getUserOrg,
  hasOrgTables,
  listOrgMembers,
  listPendingOrgInvites,
  tagInviteWithOrg,
} from "@/lib/vater/org-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

/** Seats per org during the beta, owner included. */
const MAX_SEATS = 10;

const NOT_READY = {
  error: "FEATURE_NOT_READY",
  message:
    "Team seats are deployed but the database migration has not been applied yet. " +
    "Run prisma/migrations/20260816_api_keys_orgs/migration.sql (staged on /hq → Must Complete).",
} as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }
  if (!(await hasOrgTables())) {
    return NextResponse.json(NOT_READY, { status: 503, headers: NO_STORE });
  }

  const userId = session.user.id;
  const membership = await getUserOrg(userId);
  if (!membership) {
    // Not an error — most accounts are a team of one and have never opened
    // this screen. The client renders the "Create a team" state.
    return NextResponse.json(
      { org: null, role: null, members: [], pending: [], maxSeats: MAX_SEATS },
      { headers: NO_STORE },
    );
  }

  const [members, pending] = await Promise.all([
    listOrgMembers(membership.org.id),
    listPendingOrgInvites(membership.org.id),
  ]);

  return NextResponse.json(
    {
      org: {
        id: membership.org.id,
        name: membership.org.name,
        isOwner: membership.org.ownerUserId === userId,
      },
      role: membership.role,
      members: members.map((m) => ({
        userId: m.userId,
        email: m.email,
        name: m.name,
        role: m.role,
        joinedAt: m.createdAt,
        isYou: m.userId === userId,
      })),
      pending: pending.map((p) => ({
        id: p.id,
        email: p.email,
        code: p.code,
        link: inviteLink(p.code),
        createdAt: p.createdAt,
      })),
      maxSeats: MAX_SEATS,
    },
    { headers: NO_STORE },
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "LOGIN_REQUIRED" }, { status: 401, headers: NO_STORE });
  }
  if (!(await hasOrgTables())) {
    return NextResponse.json(NOT_READY, { status: 503, headers: NO_STORE });
  }

  let body: { name?: unknown; email?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }

  const membership = await getUserOrg(session.user.id);

  // ── Create the org ──────────────────────────────────────────────────────
  if (!membership) {
    if (typeof body.email === "string" && body.email.trim()) {
      return NextResponse.json(
        {
          error: "NO_TEAM",
          message: "Create your team first, then invite people to it.",
        },
        { status: 409, headers: NO_STORE },
      );
    }
    const org = await createOrg(
      session.user.id,
      typeof body.name === "string" ? body.name : "",
    );
    if (!org) {
      return NextResponse.json(
        { error: "CREATE_FAILED", message: "Could not create that team." },
        { status: 500, headers: NO_STORE },
      );
    }
    console.log(`[me/team] user=${session.user.id} created org=${org.id}`);
    return NextResponse.json(
      { org: { id: org.id, name: org.name, isOwner: true }, role: "owner" },
      { status: 201, headers: NO_STORE },
    );
  }

  // ── Invite a seat ───────────────────────────────────────────────────────
  if (membership.org.ownerUserId !== session.user.id) {
    return NextResponse.json(
      {
        error: "FORBIDDEN",
        message: "Only the team owner can invite people.",
      },
      { status: 403, headers: NO_STORE },
    );
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "BAD_EMAIL", message: "Enter the email address to invite." },
      { status: 400, headers: NO_STORE },
    );
  }

  if (!(await hasBetaInviteTable())) {
    return NextResponse.json(
      {
        error: "FEATURE_NOT_READY",
        message: "Invites are not available on this environment yet.",
      },
      { status: 503, headers: NO_STORE },
    );
  }

  // Seats + outstanding invites both count against the cap: a cap you can
  // exceed by sending ten invites at once is not a cap.
  const [members, pending] = await Promise.all([
    listOrgMembers(membership.org.id),
    listPendingOrgInvites(membership.org.id),
  ]);
  if (members.length + pending.length >= MAX_SEATS) {
    return NextResponse.json(
      {
        error: "SEATS_FULL",
        message: `This team is capped at ${MAX_SEATS} seats during the beta (invites you have already sent count too).`,
      },
      { status: 409, headers: NO_STORE },
    );
  }
  if (members.some((m) => m.email?.toLowerCase() === email)) {
    return NextResponse.json(
      { error: "ALREADY_MEMBER", message: "That person is already on the team." },
      { status: 409, headers: NO_STORE },
    );
  }
  const already = pending.find((p) => p.email?.toLowerCase() === email);
  if (already) {
    // Re-send rather than mint a second code — two live codes for one person
    // is how you end up with two accounts for one seat.
    return NextResponse.json(
      {
        ok: true,
        resent: true,
        invite: { id: already.id, email, code: already.code, link: inviteLink(already.code) },
      },
      { headers: NO_STORE },
    );
  }

  const [invite] = await mintInvites({
    count: 1,
    maxUses: 1,
    email,
    note: `team seat — org ${membership.org.id}`,
    createdBy: session.user.email ?? session.user.id,
  });
  if (!invite) {
    return NextResponse.json(
      { error: "INVITE_FAILED", message: "Could not create that invite." },
      { status: 500, headers: NO_STORE },
    );
  }
  await tagInviteWithOrg(invite.id, membership.org.id);

  console.log(
    `[me/team] org=${membership.org.id} invited ${email} code=${invite.code}`,
  );

  /* No email is sent from here. Per feedback_no_autonomous_sends the site
   * never triggers customer-facing mail on its own — the owner copies the
   * link and sends it themselves, which is also why `link` is in the reply. */
  return NextResponse.json(
    {
      ok: true,
      invite: {
        id: invite.id,
        email,
        code: invite.code,
        link: inviteLink(invite.code),
      },
    },
    { status: 201, headers: NO_STORE },
  );
}
