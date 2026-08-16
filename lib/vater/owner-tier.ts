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
import { BETA_MAX_WORDS } from "./script-limits";

export type OwnerTier = "owner" | "beta";

/** Script length ceiling for non-owner renders. Owner is uncapped.
 *  Defined in `script-limits.ts` so the browser can quote the same number. */
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
  return build(projectUserId, user?.email);
}
