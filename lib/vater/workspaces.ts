/**
 * lib/vater/workspaces.ts
 *
 * Jelly Studio WORKSPACES — the tab strip above the logo (2026-08-27).
 *
 * ── WHAT A TAB IS ────────────────────────────────────────────────────────
 * One login, many fully separate studios. Each tab has its own library,
 * styles, characters, voices, YouTube/social connections, rules, credit
 * ledger, system log — everything — as if it were a separate account with a
 * separate email and a separate meter. Trey's ten channels never touch.
 *
 * ── HOW, IN ONE SENTENCE ─────────────────────────────────────────────────
 * A tab IS a hidden `User` row (email NULL, no credentials, can never sign
 * in). The signed `jelly_ws` cookie names it, the auth.ts session callback
 * swaps `session.user.id` to it — exactly the mechanism admin "view as"
 * already uses (lib/vater/acting-as.ts) — and every one of the ~170
 * /api/vater routes, which all read `session.user.id`, becomes per-tab
 * without a single change. That is also why "every site edit applies to
 * every tab": tabs share 100% of the code and differ only by userId.
 *
 * What is NOT swapped: `session.user.email` stays the REAL login. Admin /
 * studio / unmetered gates are keyed on email, and a tab inherits all of them
 * from its owner. Where code looks the email up FROM THE DATABASE by userId
 * instead (lane, tier, billing summary), it must go through
 * lib/vater/tenant-identity.ts, which follows the tab back to its root.
 *
 * ── THE PRIMARY TAB ──────────────────────────────────────────────────────
 * The login itself (ownerUserId == userId). It is inserted lazily on the first
 * list so existing accounts need no migration and today's data IS tab one.
 *
 * ── COOKIE ───────────────────────────────────────────────────────────────
 *   jelly_ws = "<wsUserId>.<hmac>"
 *   hmac     = HMAC-SHA256(AUTH_SECRET, "jelly-ws:<rootUserId>:<wsUserId>")
 * The ROOT is inside the signed payload but NOT in the cookie, so a cookie is
 * only meaningful to the login that minted it — pasted into another browser
 * session it verifies against a different root and is silently ignored. No
 * expiry: switching tabs is a preference, not a grant (the grant is the
 * NextAuth session), and the callback re-checks the row is live anyway.
 *
 * ── RESILIENCE ───────────────────────────────────────────────────────────
 * Code deploys on `git push main`; the Neon migration is applied by hand.
 * Every read here answers "no workspaces" while the table is missing, which
 * is exactly today's behaviour — one studio per login. Never widens on error.
 */

import "server-only";

import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { isMissingRelationError } from "@/lib/vater/beta-schema";
import { hasVaterAccountTable } from "@/lib/vater/schema-probe";

/** Hard ceiling per login. Jared's number ("he wants 10 channels"). */
export const MAX_WORKSPACES = Math.max(
  1,
  Number(process.env.JELLY_MAX_WORKSPACES) || 10,
);

export const DEFAULT_PRIMARY_NAME = "My Studio";
export const MAX_NAME_LENGTH = 40;

const NEGATIVE_TTL_MS = 30_000;
let tableProbe: { present: boolean; checkedAt: number } | null = null;

/** True once the VaterWorkspace table exists. Positive result is permanent. */
export async function hasWorkspaceTable(): Promise<boolean> {
  if (tableProbe?.present) return true;
  if (tableProbe && Date.now() - tableProbe.checkedAt < NEGATIVE_TTL_MS) {
    return false;
  }
  let present = false;
  try {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n
      FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'VaterWorkspace'
    `;
    present = Number(rows[0]?.n ?? 0) >= 1;
  } catch {
    present = false; // fail closed
  }
  tableProbe = { present, checkedAt: Date.now() };
  return present;
}

/** Test hook — drops every memo in this module. */
export function resetWorkspaceCaches(): void {
  tableProbe = null;
  rootMemo.clear();
  liveMemo.clear();
}

// ── Cookie (pure helpers live in workspace-token.ts) ──────────────────────
export {
  WS_COOKIE,
  WS_COOKIE_MAX_AGE,
  buildWsToken,
  parseWsToken,
  buildWsCookie,
  clearWsCookie,
} from "@/lib/vater/workspace-token";
import { WS_COOKIE as _WS_COOKIE, parseWsToken as _parseWsToken } from "@/lib/vater/workspace-token";

/**
 * Read + verify the cookie from the ambient request for this root login.
 * Returns null outside a request scope (build-time render) rather than throw.
 */
export async function readWsUserId(rootUserId: string): Promise<string | null> {
  try {
    const store = await cookies();
    return _parseWsToken(store.get(_WS_COOKIE)?.value ?? null, rootUserId);
  } catch {
    return null;
  }
}

// ── Rows ──────────────────────────────────────────────────────────────────

export interface WorkspaceRow {
  id: string;
  ownerUserId: string;
  userId: string;
  name: string;
  sortOrder: number;
  archivedAt: Date | null;
  createdAt: Date;
}

const ROW_SELECT = {
  id: true,
  ownerUserId: true,
  userId: true,
  name: true,
  sortOrder: true,
  archivedAt: true,
  createdAt: true,
} as const;

export function isPrimary(row: Pick<WorkspaceRow, "ownerUserId" | "userId">): boolean {
  return row.ownerUserId === row.userId;
}

/** Wire shape for the tab strip / Settings → Studios. `id` is the tab's userId. */
export function shapeWorkspace(row: WorkspaceRow, activeUserId: string) {
  return {
    id: row.userId,
    name: row.name,
    sortOrder: row.sortOrder,
    isPrimary: isPrimary(row),
    active: row.userId === activeUserId,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function cleanName(raw: unknown, fallback = DEFAULT_PRIMARY_NAME): string {
  const s = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  return (s || fallback).slice(0, MAX_NAME_LENGTH);
}

/**
 * The tab row a userId acts as, or null when the userId is a plain login with
 * no tabs yet (or the table is missing). Cheap and uncached — callers that
 * need it on a hot path use rootUserIdFor / isLiveWorkspace below.
 */
export async function workspaceForUser(userId: string): Promise<WorkspaceRow | null> {
  if (!userId || !(await hasWorkspaceTable())) return null;
  try {
    return await prisma.vaterWorkspace.findUnique({
      where: { userId },
      select: ROW_SELECT,
    });
  } catch (err) {
    if (isMissingRelationError(err)) return null;
    throw err;
  }
}

/** 60s memo: tab userId → root login id. Identity when not a tab. */
const MEMO_TTL_MS = 60_000;
const rootMemo = new Map<string, { root: string; at: number }>();

function remember<T>(map: Map<string, { at: number } & T>, key: string, value: T) {
  map.set(key, { ...value, at: Date.now() });
  if (map.size > 2_000) map.clear(); // warm-instance cache, not a store
}

/**
 * Root login for a session. Prefer the workspace stamp auth.ts already
 * attached; otherwise follow the tab row back to its owner. Never looks up
 * email by the tab's hidden User id.
 */
export async function sessionRootUserId(session: {
  user?: { id?: string | null } | null;
  workspace?: { rootUserId: string } | null;
}): Promise<string> {
  if (session.workspace?.rootUserId) return session.workspace.rootUserId;
  const id = session.user?.id ?? "";
  return id ? rootUserIdFor(id) : "";
}

/**
 * The real login behind `userId`. Returns `userId` itself for a plain login,
 * the primary tab, an unknown id, or while the table is missing — so callers
 * can use it unconditionally.
 */
export async function rootUserIdFor(userId: string): Promise<string> {
  if (!userId) return userId;
  const hit = rootMemo.get(userId);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.root;
  let root = userId;
  const row = await workspaceForUser(userId).catch(() => null);
  if (row && row.ownerUserId) root = row.ownerUserId;
  remember(rootMemo, userId, { root });
  return root;
}

/** 60s memo keyed "root:ws" — is this tab live and owned by this root? */
const liveMemo = new Map<string, { live: boolean; at: number }>();

/**
 * The check the session callback runs on every request that carries a
 * jelly_ws cookie. Memoised so the studio's dozens of parallel fetches cost
 * one query per minute, not one per fetch. An archived tab answers false and
 * the caller falls back to the primary studio.
 */
export async function isLiveWorkspace(rootUserId: string, wsUserId: string): Promise<boolean> {
  if (!rootUserId || !wsUserId) return false;
  const key = `${rootUserId}:${wsUserId}`;
  const hit = liveMemo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.live;
  let live = false;
  try {
    const row = await workspaceForUser(wsUserId);
    live = Boolean(row && row.ownerUserId === rootUserId && !row.archivedAt);
  } catch {
    live = false;
  }
  remember(liveMemo, key, { live });
  return live;
}

/** Drop the live/root memos for one tab (after archive/rename). */
export function forgetWorkspace(rootUserId: string, wsUserId: string): void {
  liveMemo.delete(`${rootUserId}:${wsUserId}`);
  rootMemo.delete(wsUserId);
}

/**
 * Every tab for a login, primary first then by sortOrder. Inserts the primary
 * row on first call (idempotent via the UNIQUE(userId)). Archived tabs are
 * excluded unless asked for.
 */
export async function listWorkspaces(
  ownerUserId: string,
  opts?: { includeArchived?: boolean },
): Promise<WorkspaceRow[]> {
  if (!ownerUserId || !(await hasWorkspaceTable())) return [];
  try {
    let rows = await prisma.vaterWorkspace.findMany({
      where: { ownerUserId },
      select: ROW_SELECT,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    if (!rows.some((r) => r.userId === ownerUserId)) {
      await ensurePrimary(ownerUserId);
      rows = await prisma.vaterWorkspace.findMany({
        where: { ownerUserId },
        select: ROW_SELECT,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      });
    }
    const primary = rows.filter((r) => r.userId === ownerUserId);
    const rest = rows.filter((r) => r.userId !== ownerUserId);
    const all = [...primary, ...rest];
    return opts?.includeArchived ? all : all.filter((r) => !r.archivedAt);
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    throw err;
  }
}

async function ensurePrimary(ownerUserId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { name: true, email: true },
  });
  const fallback = user?.name?.trim() || DEFAULT_PRIMARY_NAME;
  await prisma.$executeRaw`
    INSERT INTO "VaterWorkspace" ("id", "ownerUserId", "userId", "name", "sortOrder", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${ownerUserId}, ${ownerUserId}, ${cleanName(fallback)}, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO NOTHING
  `;
}

export type CreateWorkspaceResult =
  | { ok: true; row: WorkspaceRow }
  | { ok: false; reason: "not_ready" | "limit" | "bad_name" };

/**
 * Mint a new tab: a hidden User row + the workspace row, in one transaction.
 *
 * The hidden User has NO email and NO credentials — nothing can sign in as
 * it. Its VaterAccount (tier/unmetered) is cloned from the root so a
 * studio-tier customer's second tab is also studio-tier without touching the
 * env allowlists. Nothing else is copied: a new tab starts EMPTY (no
 * characters, voices, connections, rules, keys) — that is the point.
 */
export async function createWorkspace(
  ownerUserId: string,
  rawName: string,
): Promise<CreateWorkspaceResult> {
  if (!(await hasWorkspaceTable())) return { ok: false, reason: "not_ready" };
  const name = cleanName(rawName, "");
  if (!name) return { ok: false, reason: "bad_name" };

  const existing = await listWorkspaces(ownerUserId);
  if (existing.length >= MAX_WORKSPACES) return { ok: false, reason: "limit" };
  const sortOrder = existing.reduce((m, r) => Math.max(m, r.sortOrder), 0) + 1;

  const cloneAccount = await hasVaterAccountTable();

  const row = await prisma.$transaction(async (tx) => {
    const hidden = await tx.user.create({
      data: { name, email: null },
      select: { id: true },
    });
    if (cloneAccount) {
      // Inherit tier + unmetered from the root. `invitedBy` records the
      // lineage so /hq can tell a tab from a real signup at a glance.
      await tx.$executeRaw`
        INSERT INTO "VaterAccount" ("userId", "tier", "unmetered", "invitedBy", "notes", "createdAt", "updatedAt")
        SELECT ${hidden.id}, a."tier", a."unmetered", ${`workspace:${ownerUserId}`}, 'Jelly Studio tab', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        FROM "VaterAccount" a WHERE a."userId" = ${ownerUserId}
        ON CONFLICT ("userId") DO NOTHING
      `;
    }
    return tx.vaterWorkspace.create({
      data: { ownerUserId, userId: hidden.id, name, sortOrder },
      select: ROW_SELECT,
    });
  });

  return { ok: true, row };
}

/** Rename. The caller has already checked ownership via listWorkspaces. */
export async function renameWorkspace(
  ownerUserId: string,
  wsUserId: string,
  rawName: string,
): Promise<WorkspaceRow | null> {
  const name = cleanName(rawName, "");
  if (!name) return null;
  const changed = await prisma.vaterWorkspace.updateMany({
    where: { ownerUserId, userId: wsUserId },
    data: { name },
  });
  if (changed.count === 0) return null;
  // The hidden User's display name mirrors the tab so /hq and Telegram
  // receipts read "Channel 2", not a bare cuid. The primary is the real login
  // — its name is theirs, leave it alone.
  if (wsUserId !== ownerUserId) {
    await prisma.user.update({ where: { id: wsUserId }, data: { name } }).catch(() => undefined);
  }
  return workspaceForUser(wsUserId);
}

/**
 * Persist a new order. `orderedUserIds` is the full list of the login's live
 * tabs in the wanted order; ids that are not theirs are ignored, ids they
 * omitted keep a higher sortOrder than anything named.
 */
export async function reorderWorkspaces(
  ownerUserId: string,
  orderedUserIds: string[],
): Promise<void> {
  const mine = await listWorkspaces(ownerUserId);
  const allowed = new Set(mine.map((r) => r.userId));
  const seen = new Set<string>();
  const ordered = orderedUserIds.filter((id) => allowed.has(id) && !seen.has(id) && seen.add(id));
  const tail = mine.map((r) => r.userId).filter((id) => !seen.has(id));
  const finalOrder = [...ordered, ...tail];
  await prisma.$transaction(
    finalOrder.map((userId, i) =>
      prisma.vaterWorkspace.updateMany({
        where: { ownerUserId, userId },
        data: { sortOrder: i },
      }),
    ),
  );
}

/**
 * Archive (never delete — the ledger and renders behind it must survive).
 * The primary tab cannot be archived: it is the login.
 */
export async function archiveWorkspace(
  ownerUserId: string,
  wsUserId: string,
): Promise<"archived" | "primary" | "missing"> {
  if (wsUserId === ownerUserId) return "primary";
  const changed = await prisma.vaterWorkspace.updateMany({
    where: { ownerUserId, userId: wsUserId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  forgetWorkspace(ownerUserId, wsUserId);
  return changed.count > 0 ? "archived" : "missing";
}

/** Restore an archived tab (from the Settings → Workspaces list). */
export async function restoreWorkspace(
  ownerUserId: string,
  wsUserId: string,
): Promise<boolean> {
  const live = await listWorkspaces(ownerUserId);
  if (live.length >= MAX_WORKSPACES) return false;
  const changed = await prisma.vaterWorkspace.updateMany({
    where: { ownerUserId, userId: wsUserId },
    data: { archivedAt: null },
  });
  forgetWorkspace(ownerUserId, wsUserId);
  return changed.count > 0;
}

/**
 * userIds of every tab (live or archived) a login owns, EXCLUDING the login
 * itself. For /hq roll-ups and roster filtering. Empty while the table is
 * missing.
 */
export async function workspaceUserIdsFor(ownerUserId: string): Promise<string[]> {
  if (!(await hasWorkspaceTable())) return [];
  try {
    const rows = await prisma.vaterWorkspace.findMany({
      where: { ownerUserId, userId: { not: ownerUserId } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    throw err;
  }
}

/**
 * Every non-primary tab across ALL logins, with owner + name — one query for
 * /hq to fold tabs under their human. Empty while the table is missing.
 */
export async function listAllWorkspaceTabs(): Promise<
  Array<{ userId: string; ownerUserId: string; name: string; archivedAt: Date | null }>
> {
  if (!(await hasWorkspaceTable())) return [];
  try {
    const rows = await prisma.$queryRaw<
      Array<{ userId: string; ownerUserId: string; name: string; archivedAt: Date | null }>
    >`
      SELECT "userId", "ownerUserId", "name", "archivedAt"
      FROM "VaterWorkspace"
      WHERE "userId" <> "ownerUserId"
      ORDER BY "ownerUserId", "sortOrder"
      LIMIT 5000
    `;
    return rows;
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    throw err;
  }
}
