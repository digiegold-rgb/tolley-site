/**
 * lib/vater/org-access.ts
 *
 * Team seats for Jelly Studio (migration 20260816_api_keys_orgs, 2026-08-16).
 *
 * ── WHAT AN ORG IS, AND IS NOT ───────────────────────────────────────────
 * An org is a VISIBILITY grant layered on top of the tenant isolation in
 * lib/vater/project-access.ts. It is NOT a billing grant and NOT a tier.
 *
 *   - `YouTubeProject.userId` keeps meaning exactly what it meant before:
 *     the account that paid for that render. Credits are debited from that
 *     user and nobody else, no matter who clicked Render.
 *   - Membership only decides who ELSE may open the project, and whether they
 *     may change it.
 *
 * That split is deliberate. Making an org a billing unit would mean a viewer
 * seat could spend the owner's balance through a route that only checks
 * "can you see this project", and there are ~25 such call sites. Keeping the
 * money on `userId` means a seat can never spend what it doesn't own even if
 * a future route forgets to ask.
 *
 * ── ROLES ────────────────────────────────────────────────────────────────
 *   owner  — the paying account. Invites, removes, renames, full write.
 *   editor — read + write on any project owned by an org member.
 *   viewer — read only.
 * An unknown role string is treated as `viewer` (fail closed).
 *
 * ── RESILIENCE ───────────────────────────────────────────────────────────
 * Raw SQL + a probe throughout, for the same reason as beta-schema.ts: the
 * prod migration is applied by hand after the deploy. Every read here answers
 * "no org" when the tables are missing, which is precisely today's behaviour —
 * owner-only visibility. It NEVER widens access on error.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { isMissingRelationError } from "@/lib/vater/beta-schema";

export type OrgRole = "owner" | "editor" | "viewer";

const NEGATIVE_TTL_MS = 30_000;
let tablesProbe: { present: boolean; checkedAt: number } | null = null;

/** True once VaterOrg AND VaterOrgMember both exist. */
export async function hasOrgTables(): Promise<boolean> {
  if (tablesProbe?.present) return true;
  if (tablesProbe && Date.now() - tablesProbe.checkedAt < NEGATIVE_TTL_MS) {
    return false;
  }
  let present = false;
  try {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name IN ('VaterOrg', 'VaterOrgMember')
    `;
    present = Number(rows[0]?.n ?? 0) >= 2;
  } catch {
    present = false; // fail closed
  }
  tablesProbe = { present, checkedAt: Date.now() };
  return present;
}

/** Test hook — drops the memoised probe and the invite-join throttle. */
export function resetOrgProbeCache(): void {
  tablesProbe = null;
  inviteJoinAttempted.clear();
}

export interface OrgRow {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: Date;
}

export interface OrgMemberRow {
  id: string;
  orgId: string;
  userId: string;
  role: OrgRole;
  createdAt: Date;
  email: string | null;
  name: string | null;
}

function asRole(value: string | null | undefined): OrgRole {
  return value === "owner" || value === "editor" ? value : "viewer";
}

interface MembershipRow {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: Date;
  role: string;
}

function queryMembership(userId: string): Promise<MembershipRow[]> {
  return prisma.$queryRaw<MembershipRow[]>`
    SELECT o."id", o."name", o."ownerUserId", o."createdAt", m."role"
    FROM "VaterOrgMember" m
    JOIN "VaterOrg" o ON o."id" = m."orgId"
    WHERE m."userId" = ${userId}
    ORDER BY m."createdAt" ASC
    LIMIT 1
  `;
}

/**
 * Throttle for the lazy invite join. Most accounts are a team of one and will
 * never have an org invite, so retrying the lookup on every project-list load
 * would be a permanent two-query tax to answer "still no" — while a 5-minute
 * retry still gets a freshly-invited teammate seated without them doing
 * anything. Per-process, so a cold Vercel instance simply retries sooner.
 */
const INVITE_JOIN_RETRY_MS = 5 * 60_000;
const inviteJoinAttempted = new Map<string, number>();

function shouldAttemptInviteJoin(userId: string): boolean {
  const last = inviteJoinAttempted.get(userId);
  if (last && Date.now() - last < INVITE_JOIN_RETRY_MS) return false;
  inviteJoinAttempted.set(userId, Date.now());
  // Bound the map — this is a warm-instance cache, not a session store.
  if (inviteJoinAttempted.size > 500) inviteJoinAttempted.clear();
  return true;
}

/**
 * The org this user belongs to, plus their role in it, or null.
 *
 * One org per user by design: a project's visibility must have exactly one
 * answer, and "which of my three orgs is this project shared into" is a
 * question the data model would then have to answer on every read. If
 * multi-org is ever needed, the join table already supports it — this
 * resolver is the only thing that assumes one.
 */
export async function getUserOrg(
  userId: string,
): Promise<{ org: OrgRow; role: OrgRole } | null> {
  if (!(await hasOrgTables())) return null;
  try {
    let rows = await queryMembership(userId);
    if (rows.length === 0 && shouldAttemptInviteJoin(userId)) {
      // Nothing seated. Before concluding "solo account", check whether this
      // person redeemed a team invite — see ensureOrgMembershipFromInvite for
      // why the join happens here rather than in the signup transaction. The
      // attempt is throttled per process so a solo user's every page load
      // doesn't pay for a join that will never happen.
      await ensureOrgMembershipFromInvite(userId);
      rows = await queryMembership(userId);
    }
    const row = rows[0];
    if (!row) return null;
    return {
      org: {
        id: row.id,
        name: row.name,
        ownerUserId: row.ownerUserId,
        createdAt: row.createdAt,
      },
      role: asRole(row.role),
    };
  } catch (err) {
    if (isMissingRelationError(err)) return null;
    throw err;
  }
}

/** Members of an org, oldest seat first, joined to User for display. */
export async function listOrgMembers(orgId: string): Promise<OrgMemberRow[]> {
  if (!(await hasOrgTables())) return [];
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        orgId: string;
        userId: string;
        role: string;
        createdAt: Date;
        email: string | null;
        name: string | null;
      }>
    >`
      SELECT m."id", m."orgId", m."userId", m."role", m."createdAt",
             u."email", u."name"
      FROM "VaterOrgMember" m
      LEFT JOIN "User" u ON u."id" = m."userId"
      WHERE m."orgId" = ${orgId}
      ORDER BY m."createdAt" ASC
      LIMIT 200
    `;
    return rows.map((r) => ({ ...r, role: asRole(r.role) }));
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    throw err;
  }
}

/**
 * Every userId whose projects `userId` may READ — themselves plus their org
 * siblings. Always contains `userId`, so callers can use it unconditionally.
 */
export async function orgVisibleUserIds(userId: string): Promise<string[]> {
  const membership = await getUserOrg(userId);
  if (!membership) return [userId];
  try {
    const rows = await prisma.$queryRaw<{ userId: string }[]>`
      SELECT "userId" FROM "VaterOrgMember" WHERE "orgId" = ${membership.org.id} LIMIT 200
    `;
    const ids = new Set(rows.map((r) => r.userId));
    ids.add(userId);
    return [...ids];
  } catch (err) {
    if (isMissingRelationError(err)) return [userId];
    throw err;
  }
}

/**
 * Do these two accounts share an org? `viewerRole` is the viewer's role, so
 * the caller can decide read vs write without a second query.
 */
export async function sharesOrg(
  viewerUserId: string,
  ownerUserId: string,
): Promise<{ shared: boolean; viewerRole: OrgRole | null }> {
  if (viewerUserId === ownerUserId) return { shared: true, viewerRole: "owner" };
  const membership = await getUserOrg(viewerUserId);
  if (!membership) return { shared: false, viewerRole: null };
  try {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM "VaterOrgMember"
      WHERE "orgId" = ${membership.org.id} AND "userId" = ${ownerUserId}
    `;
    const shared = Number(rows[0]?.n ?? 0) > 0;
    // viewerRole is null when nothing is shared, so a caller that reads the
    // role without checking `shared` first cannot mistake "editor somewhere
    // else" for "editor here".
    return { shared, viewerRole: shared ? membership.role : null };
  } catch (err) {
    if (isMissingRelationError(err)) return { shared: false, viewerRole: null };
    throw err;
  }
}

/** Create an org and seat its creator as owner. Idempotent per user. */
export async function createOrg(userId: string, name: string): Promise<OrgRow | null> {
  if (!(await hasOrgTables())) return null;
  const existing = await getUserOrg(userId);
  if (existing) return existing.org;

  const clean = (name || "").trim().slice(0, 120) || "My team";
  const rows = await prisma.$queryRaw<OrgRow[]>`
    INSERT INTO "VaterOrg" ("id", "name", "ownerUserId", "createdAt")
    VALUES (gen_random_uuid()::text, ${clean}, ${userId}, CURRENT_TIMESTAMP)
    RETURNING "id", "name", "ownerUserId", "createdAt"
  `;
  const org = rows[0];
  if (!org) return null;
  await addOrgMember(org.id, userId, "owner");
  return org;
}

/**
 * Seat a user. ON CONFLICT DO NOTHING against the UNIQUE(orgId, userId) is the
 * concurrency guard — two tabs racing the lazy invite-join below cannot create
 * a duplicate seat, and a re-invite does not reset an existing role.
 */
export async function addOrgMember(
  orgId: string,
  userId: string,
  role: OrgRole,
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO "VaterOrgMember" ("id", "orgId", "userId", "role", "createdAt")
    VALUES (gen_random_uuid()::text, ${orgId}, ${userId}, ${role}, CURRENT_TIMESTAMP)
    ON CONFLICT ("orgId", "userId") DO NOTHING
  `;
}

/** Change a seat's role. The org owner's own seat is never demotable. */
export async function setOrgMemberRole(
  orgId: string,
  userId: string,
  role: OrgRole,
): Promise<boolean> {
  const changed = await prisma.$executeRaw`
    UPDATE "VaterOrgMember" m
       SET "role" = ${role}
      FROM "VaterOrg" o
     WHERE m."orgId" = ${orgId}
       AND m."userId" = ${userId}
       AND o."id" = m."orgId"
       AND o."ownerUserId" <> m."userId"
  `;
  return changed > 0;
}

/** Remove a seat. The org owner cannot be removed from their own org. */
export async function removeOrgMember(orgId: string, userId: string): Promise<boolean> {
  const changed = await prisma.$executeRaw`
    DELETE FROM "VaterOrgMember" m
     USING "VaterOrg" o
     WHERE m."orgId" = ${orgId}
       AND m."userId" = ${userId}
       AND o."id" = m."orgId"
       AND o."ownerUserId" <> m."userId"
  `;
  return changed > 0;
}

/**
 * LAZY INVITE JOIN.
 *
 * A team owner invites a seat by minting a BetaInvite with `orgId` set. The
 * signup transaction (app/api/auth/register) is owned by the invite lane and
 * knows nothing about orgs — so rather than reach into it, the join happens
 * here, on the invited account's next authenticated load.
 *
 * Two consequences worth knowing:
 *   1. An account that redeemed an org invite BEFORE this code shipped still
 *      lands in the org the first time it loads /animate. No backfill needed.
 *   2. The join is keyed on User.betaInviteId — the invite the account
 *      actually redeemed — not on a bare email match. An attacker cannot
 *      join an org by signing up with an address someone once invited,
 *      because they would have to have spent that code to do it.
 *
 * Cheap enough to call on every /api/vater/me: it is one indexed lookup that
 * returns nothing for accounts that already have a seat.
 */
export async function ensureOrgMembershipFromInvite(userId: string): Promise<void> {
  if (!(await hasOrgTables())) return;
  try {
    const existing = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM "VaterOrgMember" WHERE "userId" = ${userId}
    `;
    if (Number(existing[0]?.n ?? 0) > 0) return;

    const rows = await prisma.$queryRaw<{ orgId: string | null }[]>`
      SELECT i."orgId"
      FROM "User" u
      JOIN "BetaInvite" i ON i."id" = u."betaInviteId"
      WHERE u."id" = ${userId} AND i."orgId" IS NOT NULL
      LIMIT 1
    `;
    const orgId = rows[0]?.orgId;
    if (!orgId) return;

    // The invited seat is an editor: a viewer who cannot render is not a
    // useful teammate, and the owner can demote from the Team screen.
    await addOrgMember(orgId, userId, "editor");
    console.log(`[org-access] user=${userId} joined org=${orgId} via invite`);
  } catch (err) {
    // A failed join must never block the studio from booting — the user just
    // sees their own projects until the next load retries.
    if (!isMissingRelationError(err)) {
      console.error("[org-access] lazy invite join failed", err);
    }
  }
}

/** Attach an org to an invite the caller just minted. Best-effort. */
export async function tagInviteWithOrg(inviteId: string, orgId: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      UPDATE "BetaInvite" SET "orgId" = ${orgId} WHERE "id" = ${inviteId}
    `;
  } catch (err) {
    if (!isMissingRelationError(err)) {
      console.error("[org-access] tagInviteWithOrg failed", err);
    }
  }
}

/** Invites minted for an org that nobody has redeemed yet (pending seats). */
export async function listPendingOrgInvites(
  orgId: string,
): Promise<Array<{ id: string; code: string; email: string | null; createdAt: Date }>> {
  try {
    return await prisma.$queryRaw`
      SELECT "id", "code", "email", "createdAt"
      FROM "BetaInvite"
      WHERE "orgId" = ${orgId} AND "usedCount" < "maxUses"
      ORDER BY "createdAt" DESC
      LIMIT 50
    `;
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    throw err;
  }
}
