/**
 * lib/vater/beta-schema.ts
 *
 * Runtime feature-detection for the 2026-08-15 Phase-3 beta migration
 * (prisma/migrations/20260815_beta_invites: BetaInvite, AdminImpersonation,
 * VaterEvent, User.betaInviteId, User.sessionVersion).
 *
 * Same doctrine as lib/vater/schema-probe.ts, which covers the earlier
 * tenancy migration: code ships to Vercel on `git push main`, but the prod
 * Neon migration is applied by hand from /hq's Must Complete queue, so there
 * is a window where the deployed code is newer than the database. Without a
 * probe, every invite check and every system-log read throws P2021 in that
 * window.
 *
 * ⚠️ EVERY read/write of these tables in this codebase goes through RAW SQL,
 * not the generated Prisma client. Two reasons:
 *   1. `npx prisma generate` could not be run when this shipped, so the
 *      checked-in client has no `prisma.betaInvite` / `prisma.vaterEvent`
 *      delegate and typechecking against it would fail.
 *   2. It keeps the code honest about the fact that the table may genuinely
 *      not be there yet — you cannot forget the try/catch when you had to
 *      write the SQL by hand.
 * This mirrors what app/api/auth/register/route.ts already does for the
 * termsVersion click-wrap stamp.
 *
 * Fail direction differs per caller and is deliberate:
 *   - INVITE ENFORCEMENT fails OPEN only when the table is missing entirely
 *     (pre-migration), because otherwise nobody could sign up at all between
 *     the deploy and the migration. Once the table exists it is enforced.
 *   - SYSTEM LOG / INVITE ADMIN fail CLOSED with a 503 "feature not ready",
 *     because a silently-empty log is worse than an honest error.
 */

import { prisma } from "@/lib/prisma";

/** Re-probe a missing table/column at most this often. */
const NEGATIVE_TTL_MS = 30_000;

type ProbeState = { present: boolean; checkedAt: number };

const cache = new Map<string, ProbeState>();

async function probe(key: string, run: () => Promise<boolean>): Promise<boolean> {
  const hit = cache.get(key);
  if (hit?.present) return true; // permanent — schema only moves forward
  if (hit && Date.now() - hit.checkedAt < NEGATIVE_TTL_MS) return false;

  let present = false;
  try {
    present = await run();
  } catch {
    present = false; // a probe that errors means "assume not migrated"
  }
  cache.set(key, { present, checkedAt: Date.now() });
  return present;
}

function tableProbe(table: string): Promise<boolean> {
  return probe(`table:${table}`, async () => {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n
      FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = ${table}
    `;
    return Number(rows[0]?.n ?? 0) > 0;
  });
}

function columnProbe(table: string, column: string): Promise<boolean> {
  return probe(`column:${table}.${column}`, async () => {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = ${table}
        AND column_name = ${column}
    `;
    return Number(rows[0]?.n ?? 0) > 0;
  });
}

/** True once the BetaInvite table exists in the connected database. */
export function hasBetaInviteTable(): Promise<boolean> {
  return tableProbe("BetaInvite");
}

/** True once the VaterEvent table exists. */
export function hasVaterEventTable(): Promise<boolean> {
  return tableProbe("VaterEvent");
}

/** True once the AdminImpersonation table exists. */
export function hasAdminImpersonationTable(): Promise<boolean> {
  return tableProbe("AdminImpersonation");
}

/** True once User.sessionVersion exists (password-reset revocation). */
export function hasSessionVersionColumn(): Promise<boolean> {
  return columnProbe("User", "sessionVersion");
}

/**
 * "The schema is behind the code" — covers both the typed-client codes
 * (P2021 table missing / P2022 column missing) and the raw-query wrapper
 * (P2010, whose meta carries the Postgres SQLSTATE: 42P01 undefined_table,
 * 42703 undefined_column).
 */
export function isMissingRelationError(err: unknown): boolean {
  const e = err as
    | { code?: string; meta?: { code?: string; message?: string } }
    | null
    | undefined;
  if (!e) return false;
  if (e.code === "P2021" || e.code === "P2022") return true;
  const sqlState = e.meta?.code;
  if (sqlState === "42P01" || sqlState === "42703") return true;
  const message = String(e.meta?.message ?? (err as Error)?.message ?? "");
  return /does not exist|undefined_table|undefined_column|42P01|42703/i.test(message);
}

/** Standard 503 body for a surface whose table has not been migrated yet. */
export const FEATURE_NOT_READY = {
  error: "FEATURE_NOT_READY",
  message:
    "This feature is deployed but its database migration has not been applied yet. " +
    "Run prisma/migrations/20260815_beta_invites/migration.sql (staged on /hq → Must Complete).",
} as const;

/** Test hook — drops the memoised probe results. */
export function resetBetaSchemaProbeCache(): void {
  cache.clear();
}
