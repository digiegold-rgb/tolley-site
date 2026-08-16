/**
 * lib/auth/session-version.ts
 *
 * JWT revocation for password resets.
 *
 * PROBLEM: sessions are JWTs (auth.ts `session: { strategy: "jwt" }`) with a
 * 30-day maxAge and nothing server-side backing them. Resetting a password
 * therefore did NOT log anyone out — an attacker holding a stolen session
 * cookie kept it for a month after the victim did the one thing everybody
 * assumes fixes exactly that.
 *
 * FIX: User.sessionVersion, embedded in every JWT. A reset bumps the column;
 * the auth.ts jwt callback notices the token is behind and kills it.
 *
 * ⚠️ THE CHECK FAILS OPEN, deliberately. If the column does not exist yet
 * (code deployed, migration not run) or the DB hiccups, we keep the session.
 * Failing closed here would log out every user on the site the moment Neon
 * blipped, which is a far worse outage than a revocation arriving late.
 *
 * ⚠️ Raw SQL on purpose — see the header of lib/vater/beta-schema.ts.
 */

import { prisma } from "@/lib/prisma";
import {
  hasSessionVersionColumn,
  isMissingRelationError,
} from "@/lib/vater/beta-schema";

/**
 * Current sessionVersion for a user, or null when it can't be determined
 * (column missing / DB error / no such user) — callers treat null as "don't
 * revoke anything".
 */
export async function readSessionVersion(userId: string): Promise<number | null> {
  if (!userId) return null;
  try {
    if (!(await hasSessionVersionColumn())) return null;
    const rows = await prisma.$queryRaw<Array<{ sessionVersion: number }>>`
      SELECT "sessionVersion" FROM "User" WHERE "id" = ${userId} LIMIT 1
    `;
    const value = rows[0]?.sessionVersion;
    return typeof value === "number" ? value : null;
  } catch (err) {
    if (!isMissingRelationError(err)) {
      console.error("[session-version] read failed", err);
    }
    return null;
  }
}

/**
 * Invalidate every outstanding JWT for this user. Returns true when the bump
 * actually landed, so the caller can tell the user the truth about whether
 * their other devices were signed out.
 */
export async function bumpSessionVersion(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const changed = await prisma.$executeRaw`
      UPDATE "User"
         SET "sessionVersion" = COALESCE("sessionVersion", 0) + 1
       WHERE "id" = ${userId}
    `;
    return changed > 0;
  } catch (err) {
    if (!isMissingRelationError(err)) {
      console.error("[session-version] bump failed", err);
    }
    return false;
  }
}
