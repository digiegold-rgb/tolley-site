/**
 * lib/vater/billing/script-cap.ts — how long a script this account may render.
 *
 * ONE function decides it, because a cap enforced in four places with four
 * copies of the rule is a cap that will disagree with itself. Everything that
 * needs the number — the from-script guard, the context/run-creation guard,
 * the `maxWords` handed to the DGX, and GET /api/vater/me (which is how the
 * editor knows what to show) — calls `maxWordsFor()`.
 *
 * The rule, in order:
 *   owner                      → no cap at all (that is the point of owning
 *                                the box; the DGX treats a missing maxWords
 *                                as uncapped)
 *   purchased balance > 0      → PAID_MAX_WORDS (~20:00)
 *   everyone else              → BETA_MAX_WORDS (~9:00)
 *
 * PURCHASED, not "balance": a $10 promotional grant is our money, and a
 * 20-minute render can eat most of one. Someone spending credit they bought
 * is taking their own risk on a longer render, which is the whole difference.
 * `getBalance().purchasedCents` already excludes unspent grant credit.
 *
 * Degrades DOWN, never up: an unmigrated ledger, a DB blip or an unknown user
 * all land on the beta cap. Failing open here would hand a 20-minute render to
 * an account that has never paid.
 */
import "server-only";

import { prisma } from "@/lib/prisma";
import { isVaterAdminEmail } from "@/lib/admin-auth";
import { BETA_MAX_WORDS, PAID_MAX_WORDS } from "@/lib/vater/script-limits";

import { getBalance } from "./ledger";

export type ScriptCapTier = "owner" | "paid" | "beta";

export interface ScriptCap {
  /** Undefined for the owner — uncapped, and the DGX reads it that way. */
  maxWords?: number;
  tier: ScriptCapTier;
}

/** True when this account has spendable credit it actually paid for. */
export async function hasPurchasedBalance(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const balance = await getBalance(userId);
    return balance.ready && balance.purchasedCents > 0;
  } catch (err) {
    console.error("[script-cap] balance read failed", { userId, err });
    return false;
  }
}

/**
 * The cap for `userId`. Pass `email` when the caller already has it (a route
 * with a session does) to skip the User lookup.
 */
export async function scriptCapFor(
  userId: string | null | undefined,
  email?: string | null,
): Promise<ScriptCap> {
  if (!userId) return { maxWords: BETA_MAX_WORDS, tier: "beta" };

  let ownerEmail = email;
  if (ownerEmail === undefined) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    ownerEmail = user?.email ?? null;
  }
  if (isVaterAdminEmail(ownerEmail)) return { tier: "owner" };

  return (await hasPurchasedBalance(userId))
    ? { maxWords: PAID_MAX_WORDS, tier: "paid" }
    : { maxWords: BETA_MAX_WORDS, tier: "beta" };
}

/**
 * Just the number, for guards that compare a word count.
 *
 * Returns Infinity for the owner so `words > maxWordsFor(...)` reads correctly
 * without every call site special-casing the owner first.
 */
export async function maxWordsFor(
  userId: string | null | undefined,
  email?: string | null,
): Promise<number> {
  const cap = await scriptCapFor(userId, email);
  return cap.maxWords ?? Number.POSITIVE_INFINITY;
}
