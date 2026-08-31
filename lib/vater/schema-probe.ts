/**
 * lib/vater/schema-probe.ts
 *
 * Runtime feature-detection for the 2026-08-15 tenancy migration
 * (prisma/migrations/20260815_vater_account).
 *
 * WHY THIS EXISTS: code ships to Vercel on `git push main`, but the prod Neon
 * migration is applied by hand from /hq's Must Complete queue. So there is a
 * window — possibly hours — where the deployed code is newer than the
 * database. Without a probe, every /animate pill and /hq billing strip throws
 * P2022 ("column VaterPayment.userId does not exist") during that window.
 *
 * Behaviour when the schema is BEHIND the code:
 *   - VaterAccount missing  → tier/unmetered resolution falls back to the env
 *     allowlists, which is exactly how access worked before the table existed.
 *   - VaterPayment.userId missing → payments are attributed to the single
 *     pre-tenancy billing tenant (Trey), and every other tenant correctly
 *     sees zero payments. Never "all payments count for everyone".
 *
 * ⚠️ Fail CLOSED, never open: a probe that errors returns false (assume the
 * migration has not run) rather than letting an unscoped query through.
 *
 * Caching: a positive result is permanent for the life of the process — a
 * table cannot un-migrate. A negative result is re-checked after
 * NEGATIVE_TTL_MS so a warm serverless instance starts working on its own
 * once Jared runs the migration, with no redeploy and no cold start needed.
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
    present = false; // fail closed
  }
  cache.set(key, { present, checkedAt: Date.now() });
  return present;
}

/** True once the VaterAccount table exists in the connected database. */
export function hasVaterAccountTable(): Promise<boolean> {
  return probe("VaterAccount", async () => {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n
      FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'VaterAccount'
    `;
    return Number(rows[0]?.n ?? 0) > 0;
  });
}

/** True once VaterPayment.userId exists in the connected database. */
export function hasVaterPaymentUserId(): Promise<boolean> {
  return probe("VaterPayment.userId", async () => {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'VaterPayment'
        AND column_name = 'userId'
    `;
    return Number(rows[0]?.n ?? 0) > 0;
  });
}

/**
 * True once the VaterCreditLedger table exists (prepaid credits, migration
 * prisma/migrations/20260815_vater_credit_ledger).
 *
 * Behaviour when it is missing: balances read as "not ready" (never as $0
 * spendable, which would look like a real empty wallet), and the budget gate
 * falls back to the pre-credits rules instead of blocking every render in the
 * studio until Jared runs the migration.
 */
export function hasVaterCreditLedgerTable(): Promise<boolean> {
  return probe("VaterCreditLedger", async () => {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n
      FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'VaterCreditLedger'
    `;
    return Number(rows[0]?.n ?? 0) > 0;
  });
}

/**
 * True once the VaterListingJob table exists (Listing Studio by Jelly!,
 * migration prisma/migrations/20260827_vater_listing_jobs).
 *
 * ⚠️ NOT "ListingJob" — that name is the shop cross-listing queue.
 * Behaviour when missing: every /api/vater/listing/* route answers
 * FEATURE_NOT_READY and the proof page 404s.
 */
export function hasVaterListingJobTable(): Promise<boolean> {
  return probe("VaterListingJob", async () => {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n
      FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'VaterListingJob'
    `;
    return Number(rows[0]?.n ?? 0) > 0;
  });
}

/**
 * True once VaterAccount carries the origin + license/agent-profile columns
 * (migration prisma/migrations/20260827_vater_account_origin_license).
 * Probes the first and last column of that migration so a half-applied
 * script reads as "not ready".
 */
export function hasVaterAccountOriginColumns(): Promise<boolean> {
  return probe("VaterAccount.origin+narMember", async () => {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'VaterAccount'
        AND column_name IN ('origin', 'narMember')
    `;
    return Number(rows[0]?.n ?? 0) === 2;
  });
}

/**
 * True once both Socials snapshot tables exist (migration
 * prisma/migrations/20260830_socials_stats). Probes both names so a
 * half-applied script reads as "not ready".
 *
 * Behaviour when missing: collector + /api/vater/socials/stats skip the
 * tables and return empty cards rather than 500.
 */
export function hasSocialsStatsTables(): Promise<boolean> {
  return probe("SocialChannelStat+SocialPostStat", async () => {
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name IN ('SocialChannelStat', 'SocialPostStat')
    `;
    return Number(rows[0]?.n ?? 0) === 2;
  });
}

/**
 * Prisma "table does not exist" (P2021) / "column does not exist" (P2022).
 * Used as a belt-and-braces catch alongside the probes above, for the race
 * where the probe succeeds and the migration is rolled back under us.
 */
export function isMissingSchemaError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "P2021" || code === "P2022";
}

/** Test hook — drops the memoised probe results. */
export function resetSchemaProbeCache(): void {
  cache.clear();
}
