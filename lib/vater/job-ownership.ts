/**
 * lib/vater/job-ownership.ts
 *
 * Map a DGX autopilot jobId back to the YouTubeProject that owns it, so the
 * job proxy routes can enforce tenant isolation (Phase 1 beta lockdown,
 * 2026-08-15).
 *
 * A jobId can be recorded on a project in four places:
 *   1. `autopilotJobId`   — the run-creation job (the common case)
 *   2. `animateAllJobId`  — the most recent batch animate job
 *   3. `costJson.byJob`   — every job whose cost has been reconciled onto
 *                           the project (see lib/vater/video-cost.ts)
 *   4. `stepDetails.jobId` — some worker phases stamp the job id here
 *
 * Jobs that match none of those are "unattributed": inline Style-editor
 * work (reference transcribe, character gen, custom-art-style describer)
 * that never belongs to a project. Those stay reachable by studio tier only.
 *
 * ── KNOWN GAP — Phase 3 (logged 2026-08-15, confirmed with the tenancy
 *    agent; deliberately NOT fixed in Phase 1) ─────────────────────────────
 * The unattributed branch is the one place studio tier is not owner-scoped,
 * so ALL studio-tier users share a single job pool: any studio user can poll
 * any other studio user's inline Style-editor job. Today the studio tier is
 * an env allowlist of two people (Trey + Jared), so it is a non-issue — but
 * VaterAccount.tier='studio' is meant to be handed to beta invites, and the
 * moment a second studio tenant exists this becomes a real cross-tenant read.
 *
 * Not enumerable in the meantime: live job ids are 16-char hex (64 bits) and
 * the route regex rejects anything outside [a-zA-Z0-9_-]{8,64}, so it only
 * matters if a job id leaks.
 *
 * The fix, when Phase 3 lands: stamp the requesting userId at inline-job
 * creation, then extend JobOwnership with a third variant
 * `{ kind: "inline"; userId: string }` so findJobOwnership can return an
 * owner for these too — and make unattributed-with-no-owner a hard deny
 * instead of a tier check. Self-contained to this file plus the callers that
 * start inline jobs; needs nothing from schema.prisma or admin-auth.ts.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { canAccessProjectAsync } from "@/lib/vater/project-access";

export type JobOwnership =
  | { kind: "project"; projectId: string; projectUserId: string | null }
  | { kind: "unattributed" };

/** Callers must validate jobId shape before calling (raw SQL interpolation). */
export async function findJobOwnership(jobId: string): Promise<JobOwnership> {
  const direct = await prisma.youTubeProject.findFirst({
    where: {
      OR: [{ autopilotJobId: jobId }, { animateAllJobId: jobId }],
    },
    select: { id: true, userId: true },
  });
  if (direct) {
    return { kind: "project", projectId: direct.id, projectUserId: direct.userId };
  }

  // costJson.byJob keys + stepDetails.jobId aren't reachable through the
  // Prisma JSON filter API in a way that survives missing paths, so probe
  // them with jsonb operators. `jobId` is parameterised, not interpolated.
  const rows = await prisma.$queryRaw<{ id: string; userId: string | null }[]>`
    SELECT "id", "userId"
    FROM "YouTubeProject"
    WHERE jsonb_exists("costJson" -> 'byJob', ${jobId})
       OR "stepDetails" ->> 'jobId' = ${jobId}
    LIMIT 1
  `;
  const row = rows[0];
  if (row) {
    return { kind: "project", projectId: row.id, projectUserId: row.userId };
  }

  return { kind: "unattributed" };
}

/** True when `jobId` is recorded on the given project. */
export async function jobBelongsToProject(
  jobId: string,
  projectId: string,
): Promise<boolean> {
  const ownership = await findJobOwnership(jobId);
  return ownership.kind === "project" && ownership.projectId === projectId;
}

/**
 * Org-aware access check for a DGX job (team seats, 2026-08-16).
 *
 * The job proxy routes historically resolved ownership here and then called
 * canAccessProject (sync) on the result. That sync helper cannot see team
 * seats — it resolves the owner tier from env allowlists and nothing else —
 * so a teammate polling a shared project's render got a 404 while the project
 * itself opened fine.
 *
 * This is the async, org-aware version for the project branch. It deliberately
 * does NOT touch the `unattributed` branch: that is the Phase 3 gap documented
 * in the header above, and quietly widening it from "all studio users" to "all
 * studio users plus their orgs" would make a known cross-tenant read bigger
 * instead of smaller.
 */
export async function canAccessJob(
  jobId: string,
  sessionUserId: string,
  sessionEmail: string | null | undefined,
): Promise<{ allowed: boolean; ownership: JobOwnership }> {
  const ownership = await findJobOwnership(jobId);
  if (ownership.kind !== "project") return { allowed: false, ownership };
  return {
    allowed: await canAccessProjectAsync(
      ownership.projectUserId,
      sessionUserId,
      sessionEmail,
    ),
    ownership,
  };
}
