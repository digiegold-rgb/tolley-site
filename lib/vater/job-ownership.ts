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
 * ── Phase 3 — CLOSED 2026-08-17 ────────────────────────────────────────────
 * The unattributed branch used to be the one place studio tier was not
 * owner-scoped: ALL studio-tier users shared a single job pool, so any studio
 * user could poll any other studio user's inline Style-editor job. That was
 * survivable only while studio was an env allowlist of two people, and
 * VaterAccount.tier='studio' is meant to be handed to beta invites.
 *
 * The fix, as planned: every inline kickoff now stamps the requesting userId
 * on the DGX job (`_inline_owner` in content-autopilot/vater.py), and
 * `resolveInlineOwner` below reads it back, so an inline job resolves to a
 * real owner. The poll route scopes on that owner and treats an inline job
 * with NO owner as a hard deny rather than a tier check.
 *
 * ⚠️ Jobs created before this landed carry no ownerId and are therefore
 * deniable to everyone but the owner tier. That is deliberate — they are
 * minutes-long Style-editor jobs, so the window is small, and failing closed
 * on an un-ownable job is the whole point of the change.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { canAccessProjectAsync } from "@/lib/vater/project-access";
import { autopilot } from "@/lib/vater/autopilot-client";

export type JobOwnership =
  | { kind: "project"; projectId: string; projectUserId: string | null }
  /** An inline Style-editor job that carries the requester's id (Phase 3).
   *  Not reachable from Postgres — the DGX job dict is the only record, so
   *  `resolveInlineOwner` below reads it from there. */
  | { kind: "inline"; userId: string }
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

/**
 * Owner of an INLINE job, read from the DGX job dict.
 *
 * Deliberately a second call rather than folded into `findJobOwnership`:
 * that function is a pure Postgres lookup used on every poll, and inline jobs
 * are the rare branch. Callers reach here only after Postgres has already said
 * "no project owns this".
 *
 * Returns `unattributed` — which callers must treat as a DENY — when the job
 * is gone, unreachable, or predates the ownerId stamp. Never fail open: an
 * inline job payload carries prompts, scripts and log tails.
 */
export async function resolveInlineOwner(jobId: string): Promise<JobOwnership> {
  try {
    const job = (await autopilot.getJob(jobId)) as { ownerId?: unknown };
    const ownerId = typeof job.ownerId === "string" ? job.ownerId : "";
    return ownerId ? { kind: "inline", userId: ownerId } : { kind: "unattributed" };
  } catch {
    return { kind: "unattributed" };
  }
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
