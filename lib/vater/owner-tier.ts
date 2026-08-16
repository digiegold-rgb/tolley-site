/**
 * lib/vater/owner-tier.ts
 *
 * Per-tenant fields the DGX autopilot needs on every job kickoff
 * (content-autopilot 9cbe9a6): `/vater/run-creation` and
 * `/vater/animate-all-scenes` accept `ownerId`, `ownerTier` and an optional
 * `maxWords`. `ownerTier: "owner"` is exempt from the concurrency cap;
 * anything else is capped and over-cap jobs park as status "queued", phase
 * "queued (#N in line)".
 *
 * Two entry points because the callers differ:
 *   - route handlers already hold the session → `ownerFieldsForSession`
 *     (no DB hit)
 *   - lib/vater/script-gate.ts + course-pipeline only hold a project row →
 *     `ownerFieldsForProject` (one User lookup)
 *
 * NOTE (2026-08-15): the tenancy agent is landing async
 * `resolveVaterTier(userId, email)` in lib/admin-auth.ts returning
 * public|studio|owner off a new VaterAccount table. This module deliberately
 * stays a thin isVaterAdminEmail wrapper so the two don't collide; once
 * VaterAccount is live, `ownerTierFor*` should delegate to resolveVaterTier
 * and map studio|public → "beta".
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { isVaterAdminEmail } from "@/lib/admin-auth";
import { scriptCapFor } from "./billing/script-cap";
import { BETA_MAX_WORDS } from "./script-limits";

export type OwnerTier = "owner" | "beta";

/** Script length ceiling for a non-owner render with no purchased credit.
 *  Defined in `script-limits.ts` so the browser can quote the same number.
 *  ⚠️ This is the FLOOR, not the answer: an account with purchased balance
 *  renders up to PAID_MAX_WORDS. Use the async entry points below (or
 *  lib/vater/billing/script-cap.ts directly) rather than this constant. */
export const NON_OWNER_MAX_WORDS = BETA_MAX_WORDS;

export interface OwnerFields {
  ownerId: string;
  ownerTier: OwnerTier;
  /** Undefined for the owner — the DGX treats a missing cap as no cap. */
  maxWords?: number;
}

function build(ownerId: string, email: string | null | undefined): OwnerFields {
  const ownerTier: OwnerTier = isVaterAdminEmail(email) ? "owner" : "beta";
  return {
    ownerId,
    ownerTier,
    ...(ownerTier === "owner" ? {} : { maxWords: NON_OWNER_MAX_WORDS }),
  };
}

/**
 * For route handlers. `projectUserId` wins when present (the job belongs to
 * the project's tenant, not whoever clicked), falling back to the session.
 */
export function ownerFieldsForSession(
  session: { user?: { id?: string | null; email?: string | null } | null },
  projectUserId?: string | null,
): OwnerFields {
  const sessionUserId = session?.user?.id ?? "";
  return build(projectUserId ?? sessionUserId, session?.user?.email);
}

/**
 * The async form of `ownerFieldsForSession`, and the one any path that sends
 * a SCRIPT to the DGX should use.
 *
 * `ownerFieldsForSession` cannot answer "how long a script may this account
 * render" — that depends on their purchased balance, which is a query. The
 * sync version stays for the callers that only need ownerId/ownerTier (the
 * concurrency cap), so nothing that does not care pays for a DB round trip.
 */
export async function ownerFieldsForSessionWithCap(
  session: { user?: { id?: string | null; email?: string | null } | null },
  projectUserId?: string | null,
): Promise<OwnerFields> {
  const base = ownerFieldsForSession(session, projectUserId);
  return withCap(base, session?.user?.email);
}

/**
 * For lib-side kickoffs that only have the project row (script-gate,
 * course-pipeline). A null `userId` is a legacy pre-multi-tenancy project,
 * which is the owner's by definition.
 */
export async function ownerFieldsForProject(
  projectUserId: string | null,
): Promise<OwnerFields> {
  if (!projectUserId) return { ownerId: "", ownerTier: "owner" };
  const user = await prisma.user.findUnique({
    where: { id: projectUserId },
    select: { email: true },
  });
  return withCap(build(projectUserId, user?.email), user?.email);
}

/**
 * Replace the placeholder beta cap with this account's real one.
 *
 * The owner keeps NO maxWords key at all (the DGX reads a missing cap as
 * uncapped), so this only ever touches the non-owner branch.
 */
async function withCap(
  fields: OwnerFields,
  email: string | null | undefined,
): Promise<OwnerFields> {
  if (fields.ownerTier === "owner") return fields;
  const cap = await scriptCapFor(fields.ownerId, email ?? null);
  if (cap.maxWords === undefined) {
    // Uncapped: the key must be ABSENT, not undefined — it is JSON.stringify'd
    // into the run-creation body, and `maxWords: undefined` and no key at all
    // happen to serialise the same but only one of them says so.
    return { ownerId: fields.ownerId, ownerTier: fields.ownerTier };
  }
  return { ...fields, maxWords: cap.maxWords };
}
