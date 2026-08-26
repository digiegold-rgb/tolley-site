/**
 * lib/vater/tenant-identity.ts
 *
 * "Whose studio is this userId, really?" — the one lookup every piece of
 * email-derived logic must use since workspaces (2026-08-27).
 *
 * A workspace tab is a hidden User row with email NULL (lib/vater/workspaces.ts).
 * The session keeps the REAL login's email, so anything that reads
 * `session.user.email` is already right. But a dozen places resolve the email
 * FROM THE DATABASE by userId — the Modal lane (`laneFor`), unmetered access,
 * the billing summary, Zernio profile naming, failure Telegrams — and for a
 * tab that lookup used to answer "no email", which silently demoted Trey's
 * second channel to the customer lane and beta tier. This module follows the
 * tab back to its root so those callers see the owner's identity.
 *
 * Contract: `userId` stays the TENANT for data (projects, ledger, rules);
 * `rootUserId` / `email` are the HUMAN for permissions and billing tier.
 */

import "server-only";

import { prisma } from "@/lib/prisma";
import { rootUserIdFor } from "@/lib/vater/workspaces";

export interface TenantIdentity {
  /** The id passed in — the data tenant. */
  userId: string;
  /** The real login. Same as userId unless this is a workspace tab. */
  rootUserId: string;
  isWorkspace: boolean;
  /** Login email of the root (what the allowlists and Stripe know). */
  email: string | null;
  /** Root's display name. */
  name: string | null;
}

const MEMO_TTL_MS = 60_000;
const memo = new Map<string, { value: TenantIdentity; at: number }>();

/** Test hook. */
export function resetTenantIdentityCache(): void {
  memo.clear();
}

export async function resolveTenantIdentity(userId: string): Promise<TenantIdentity> {
  const hit = memo.get(userId);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.value;

  const rootUserId = (await rootUserIdFor(userId)) || userId;
  const root = await prisma.user.findUnique({
    where: { id: rootUserId },
    select: { email: true, name: true },
  });
  const value: TenantIdentity = {
    userId,
    rootUserId,
    isWorkspace: rootUserId !== userId,
    email: root?.email ?? null,
    name: root?.name ?? null,
  };
  memo.set(userId, { value, at: Date.now() });
  if (memo.size > 2_000) memo.clear();
  return value;
}

/** Just the root's email — the drop-in for `prisma.user.findUnique({select:{email}})`. */
export async function tenantEmailFor(userId: string): Promise<string | null> {
  return (await resolveTenantIdentity(userId)).email;
}
