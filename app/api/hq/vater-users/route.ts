/**
 * /api/hq/vater-users — the beta-tester roster behind the /hq "Studio users" card.
 *
 *   GET  → every Jelly Studio account: tier, unmetered, credit balance, last
 *          project, last error, invite provenance — plus the invite list.
 *   POST → { action: "mint-invite" | "set-tier" | "set-unmetered" }
 *
 * Auth: validateWdAdmin() (the /hq PIN cookie), matching every other /api/hq
 * route. Note this is a DIFFERENT credential from the NextAuth admin session
 * that /api/admin/vater/view-as requires — see that route's header for why
 * impersonation can't ride on the PIN.
 *
 * "Studio account" = anyone with a VaterAccount row, a Jelly render, or a
 * redeemed beta invite. Deliberately a union rather than "every User row":
 * tolley.io has leads/food/Launchpad users who have nothing to do with the
 * studio, and burying nine beta testers in that list makes the card useless.
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateWdAdmin } from "@/lib/wd-auth";
import { getBalance } from "@/lib/vater/billing/ledger";
import { hasVaterAccountTable } from "@/lib/vater/schema-probe";
import {
  hasBetaInviteTable,
  isMissingRelationError,
} from "@/lib/vater/beta-schema";
import {
  formatInviteCode,
  inviteLink,
  listInvites,
  mintInvites,
} from "@/lib/vater/beta-invites";
import { readLastErrorByUser } from "@/lib/vater/events";
import { sendInviteLinkEmail } from "@/lib/vater/animate-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;
const VALID_TIERS = new Set(["public", "studio", "owner"]);

interface StudioUserRow {
  userId: string;
  email: string | null;
  tier: string;
  unmetered: boolean;
  balanceUsd: number | null;
  projectCount: number;
  lastProjectAt: string | null;
  lastProjectTitle: string | null;
  lastError: { message: string; at: string } | null;
  invited: boolean;
  createdAt: string | null;
}

async function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE });
}

export async function GET() {
  const { authed } = await validateWdAdmin();
  if (!authed) return unauthorized();

  try {
    /* Candidate set: VaterAccount rows ∪ owners of a YouTubeProject ∪ anyone
     * who redeemed an invite. Three cheap id queries then ONE user fetch —
     * not a per-user round-trip. */
    const userIds = new Set<string>();

    if (await hasVaterAccountTable()) {
      const accounts = await prisma.vaterAccount.findMany({ select: { userId: true } });
      for (const a of accounts) userIds.add(a.userId);
    }

    const projectOwners = await prisma.youTubeProject.groupBy({
      by: ["userId"],
      _count: { _all: true },
      _max: { updatedAt: true },
    });
    for (const p of projectOwners) if (p.userId) userIds.add(p.userId);

    let invitedIds: string[] = [];
    try {
      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "betaInviteId" IS NOT NULL
      `;
      invitedIds = rows.map((r) => r.id);
      for (const id of invitedIds) userIds.add(id);
    } catch (err) {
      if (!isMissingRelationError(err)) throw err;
    }

    const ids = [...userIds];
    if (ids.length === 0) {
      return NextResponse.json(
        { users: [], invites: [], inviteTableReady: await hasBetaInviteTable() },
        { headers: NO_STORE },
      );
    }

    const [users, accounts, lastErrors] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, email: true, createdAt: true },
      }),
      hasVaterAccountTable()
        .then((ready) =>
          ready
            ? prisma.vaterAccount.findMany({
                where: { userId: { in: ids } },
                select: { userId: true, tier: true, unmetered: true },
              })
            : [],
        )
        .catch(() => []),
      readLastErrorByUser(ids),
    ]);

    const accountByUser = new Map(accounts.map((a) => [a.userId, a]));
    const projectStats = new Map(
      projectOwners
        .filter((p): p is typeof p & { userId: string } => Boolean(p.userId))
        .map((p) => [p.userId, { count: p._count._all, lastAt: p._max.updatedAt }]),
    );
    const invitedSet = new Set(invitedIds);

    // Newest project per user, for a human label on the "last project" column.
    const latestProjects = await prisma.youTubeProject.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, sourceTitle: true, topic: true, id: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
    const latestByUser = new Map<string, (typeof latestProjects)[number]>();
    for (const p of latestProjects) {
      if (p.userId && !latestByUser.has(p.userId)) latestByUser.set(p.userId, p);
    }

    /* Balance comes from the credit ledger, which already returns an empty
     * balance when its table hasn't been migrated. Per-user, but the roster is
     * nine people during the beta — a join isn't worth the coupling. */
    const balances = await Promise.all(
      ids.map(async (id) => {
        try {
          const balance = await getBalance(id);
          // `ready: false` means the ledger table isn't migrated — report
          // "unknown", never a confident $0.00 that isn't real.
          return [id, balance.ready ? balance.balanceCents / 100 : null] as const;
        } catch {
          return [id, null] as const;
        }
      }),
    );
    const balanceByUser = new Map<string, number | null>(balances);

    const rows: StudioUserRow[] = users
      .map((u) => {
        const account = accountByUser.get(u.id);
        const stats = projectStats.get(u.id);
        const latest = latestByUser.get(u.id);
        const err = lastErrors.get(u.id);
        return {
          userId: u.id,
          email: u.email,
          tier: account?.tier ?? "public",
          unmetered: account?.unmetered ?? false,
          balanceUsd: balanceByUser.get(u.id) ?? null,
          projectCount: stats?.count ?? 0,
          lastProjectAt: stats?.lastAt ? stats.lastAt.toISOString() : null,
          lastProjectTitle: latest ? latest.sourceTitle || latest.topic || latest.id : null,
          lastError: err ? { message: err.message, at: err.createdAt.toISOString() } : null,
          invited: invitedSet.has(u.id),
          createdAt: u.createdAt ? u.createdAt.toISOString() : null,
        };
      })
      .sort((a, b) => (b.lastProjectAt ?? "").localeCompare(a.lastProjectAt ?? ""));

    const inviteTableReady = await hasBetaInviteTable();
    const invites = inviteTableReady ? await listInvites(50) : [];

    return NextResponse.json(
      {
        users: rows,
        inviteTableReady,
        invites: invites.map((i) => ({
          id: i.id,
          code: i.code,
          display: formatInviteCode(i.code),
          link: inviteLink(i.code),
          email: i.email,
          usedCount: i.usedCount,
          maxUses: i.maxUses,
          expiresAt: i.expiresAt ? i.expiresAt.toISOString() : null,
          spendable:
            i.usedCount < i.maxUses &&
            (!i.expiresAt || i.expiresAt.getTime() > Date.now()),
          note: i.note,
          createdAt: i.createdAt.toISOString(),
        })),
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    console.error("[hq/vater-users] GET failed", err);
    return NextResponse.json(
      { error: "Failed to load studio users" },
      { status: 500, headers: NO_STORE },
    );
  }
}

export async function POST(request: NextRequest) {
  const { authed } = await validateWdAdmin();
  if (!authed) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: NO_STORE });
  }

  const action = typeof body.action === "string" ? body.action : "";

  try {
    if (action === "mint-invite") {
      if (!(await hasBetaInviteTable())) {
        return NextResponse.json(
          {
            error: "FEATURE_NOT_READY",
            message:
              "Apply prisma/migrations/20260815_beta_invites/migration.sql first (staged on Must Complete).",
          },
          { status: 503, headers: NO_STORE },
        );
      }
      const email =
        typeof body.email === "string" && body.email.includes("@") ? body.email : null;
      const count = Number(body.count ?? 1);
      const created = await mintInvites({
        count: Number.isFinite(count) ? count : 1,
        maxUses: email ? 1 : Number(body.maxUses ?? 1) || 1,
        email,
        note: typeof body.note === "string" ? body.note : "minted from /hq",
        createdBy: "hq",
      });
      // { send: true } + a locked email → email the link too and close any
      // open invite-request Must Complete item for that address.
      let sent = false;
      let sendError: string | null = null;
      if (body.send === true && email && created[0]) {
        try {
          await sendInviteLinkEmail(email, inviteLink(created[0].code), formatInviteCode(created[0].code));
          sent = true;
          const lower = email.toLowerCase();
          await prisma.leadAction.updateMany({
            where: { subsite: "animate", action: "invite-request", email: lower, status: { notIn: ["won", "lost"] } },
            data: { status: "won", statusNote: `Invite ${formatInviteCode(created[0].code)} emailed`, statusUpdatedAt: new Date() },
          }).catch(() => undefined);
          await prisma.mustCompleteItem.updateMany({
            where: { source: "animate-invite-request", status: "open", title: `Invite request — ${lower}` },
            data: { status: "done", completedAt: new Date() },
          }).catch(() => undefined);
        } catch (err) {
          sendError = err instanceof Error ? err.message : String(err);
          console.error("[hq/vater-users] invite email failed", err);
        }
      }
      return NextResponse.json(
        {
          ok: true,
          sent,
          sendError,
          invites: created.map((i) => ({
            code: i.code,
            display: formatInviteCode(i.code),
            link: inviteLink(i.code),
            email: i.email,
          })),
        },
        { headers: NO_STORE },
      );
    }

    if (action === "set-tier" || action === "set-unmetered") {
      const userId = typeof body.userId === "string" ? body.userId : "";
      if (!userId) {
        return NextResponse.json({ error: "userId required" }, { status: 400, headers: NO_STORE });
      }
      if (!(await hasVaterAccountTable())) {
        return NextResponse.json(
          {
            error: "FEATURE_NOT_READY",
            message: "VaterAccount has not been migrated on this database yet.",
          },
          { status: 503, headers: NO_STORE },
        );
      }

      if (action === "set-tier") {
        const tier = typeof body.tier === "string" ? body.tier : "";
        if (!VALID_TIERS.has(tier)) {
          return NextResponse.json(
            { error: "tier must be public | studio | owner" },
            { status: 400, headers: NO_STORE },
          );
        }
        /* 🔴 Guard-rail, not a formality. Studio tier shares inline
         * Style-editor jobs across accounts (see the KNOWN GAP block in
         * lib/vater/job-ownership.ts), so promoting a beta invite to "studio"
         * is a live cross-tenant read. Requires an explicit acknowledgement
         * so it can never be a stray click on a dropdown. */
        if (tier !== "public" && body.acknowledgeCrossTenant !== true) {
          return NextResponse.json(
            {
              error: "CONFIRM_REQUIRED",
              message:
                "studio/owner tier can read other accounts' inline style jobs (job-ownership.ts KNOWN GAP). Re-send with acknowledgeCrossTenant: true if that's intended.",
            },
            { status: 409, headers: NO_STORE },
          );
        }
        await prisma.vaterAccount.upsert({
          where: { userId },
          create: { userId, tier, unmetered: false, notes: "set from /hq" },
          update: { tier },
        });
        console.warn(`[hq/vater-users] tier ${tier} set for ${userId}`);
        return NextResponse.json({ ok: true, userId, tier }, { headers: NO_STORE });
      }

      const unmetered = body.unmetered === true;
      await prisma.vaterAccount.upsert({
        where: { userId },
        create: { userId, tier: "public", unmetered, notes: "set from /hq" },
        update: { unmetered },
      });
      console.warn(`[hq/vater-users] unmetered=${unmetered} set for ${userId}`);
      return NextResponse.json({ ok: true, userId, unmetered }, { headers: NO_STORE });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400, headers: NO_STORE });
  } catch (err) {
    if (isMissingRelationError(err)) {
      return NextResponse.json(
        { error: "FEATURE_NOT_READY", message: "Required migration has not been applied." },
        { status: 503, headers: NO_STORE },
      );
    }
    console.error("[hq/vater-users] POST failed", err);
    return NextResponse.json({ error: "Action failed" }, { status: 500, headers: NO_STORE });
  }
}
