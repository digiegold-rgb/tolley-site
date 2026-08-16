/**
 * lib/vater/project-access.ts
 *
 * Tenant isolation for YouTubeProject (added 2026-06-11 for the public
 * pay-per-video launch; tightened 2026-08-15 for the invite-only beta).
 *
 * Rules:
 *   - project.userId === session user            → allowed (owner of the row)
 *   - session is the OWNER tier                  → allowed (support access)
 *   - session shares a VaterOrg with project.userId
 *                                                → allowed to READ; writing
 *     additionally requires an editor/owner seat (canEditProjectAsync).
 *     Async helpers only — the sync ones cannot query. Added 2026-08-16 with
 *     team seats; see lib/vater/org-access.ts for why an org is a visibility
 *     grant and never a billing one.
 *   - anything else, including NULL project.userId
 *                                                → treated as not-found
 *     (404, never 403 — don't leak project existence)
 *
 * 🔴 What changed 2026-08-15: "studio" used to mean "sees every project".
 * That conflated a FEATURE grant (script review, Direct, voices, course)
 * with a DATA grant, so every studio invite was a cross-tenant leak, and the
 * 208 legacy userId=null rows were readable by anyone on the studio list.
 * Now only the owner tier crosses tenant lines. Trey keeps every studio
 * feature and sees only his own 24 projects.
 *
 * NULL userId is no longer a permission state at all. The legacy rows were
 * assigned to the owner by scripts/assign-legacy-projects.ts; a NULL that
 * turns up after that is an orphan and is denied rather than shared out.
 *
 * Sync vs async: the sync helpers resolve the owner tier from the env
 * allowlists (ADMIN_ALLOWLIST_EMAILS / VATER_ADMIN_ALLOWLIST_EMAILS), which
 * is where the owner is actually defined, so ~25 existing route call sites
 * keep working unchanged. The async variants additionally honour a
 * VaterAccount row with tier "owner" — use those in new code.
 */

import { prisma } from "@/lib/prisma";
import { isVaterAdminEmail, isVaterOwnerUser } from "@/lib/admin-auth";
import { orgVisibleUserIds, sharesOrg } from "@/lib/vater/org-access";
import type { Prisma } from "@prisma/client";

export function canAccessProject(
  projectUserId: string | null,
  sessionUserId: string,
  sessionEmail: string | null | undefined,
): boolean {
  if (projectUserId !== null && projectUserId === sessionUserId) return true;
  // Owner-only cross-tenant read (support). NOT studio tier.
  return isVaterAdminEmail(sessionEmail);
}

/** Prisma where-clause scoping a project list to what the session may see. */
export function scopedProjectWhere(
  sessionUserId: string,
  sessionEmail: string | null | undefined,
): Prisma.YouTubeProjectWhereInput {
  if (isVaterAdminEmail(sessionEmail)) return {}; // owner sees everything
  return { userId: sessionUserId };
}

/**
 * Async variant of canAccessProject that also honours VaterAccount tier AND
 * team seats (2026-08-16).
 *
 * Org membership grants READ. A viewer seat can open a teammate's project;
 * writing to it needs canEditProjectAsync below. When the org tables are not
 * migrated yet, sharesOrg() answers "no" and this is byte-for-byte the old
 * owner-only behaviour — org support can only ever widen access deliberately,
 * never by failing.
 */
export async function canAccessProjectAsync(
  projectUserId: string | null,
  sessionUserId: string,
  sessionEmail: string | null | undefined,
): Promise<boolean> {
  if (projectUserId !== null && projectUserId === sessionUserId) return true;
  if (await isVaterOwnerUser(sessionUserId, sessionEmail)) return true;
  if (projectUserId === null) return false; // orphan — never shared out
  return (await sharesOrg(sessionUserId, projectUserId)).shared;
}

/**
 * Write gate. Same as canAccessProjectAsync except a `viewer` seat is denied.
 *
 * Kept SEPARATE from the read check rather than bolted on with a flag: the
 * ~25 existing call sites all mean "read", and silently letting them mean
 * "write" is exactly how a viewer seat ends up spending the owner's credits.
 * New mutating routes opt IN to this one.
 */
export async function canEditProjectAsync(
  projectUserId: string | null,
  sessionUserId: string,
  sessionEmail: string | null | undefined,
): Promise<boolean> {
  if (projectUserId !== null && projectUserId === sessionUserId) return true;
  if (await isVaterOwnerUser(sessionUserId, sessionEmail)) return true;
  if (projectUserId === null) return false;
  const { shared, viewerRole } = await sharesOrg(sessionUserId, projectUserId);
  return shared && (viewerRole === "owner" || viewerRole === "editor");
}

/** Async variant of scopedProjectWhere that also honours VaterAccount tier. */
export async function scopedProjectWhereAsync(
  sessionUserId: string,
  sessionEmail: string | null | undefined,
): Promise<Prisma.YouTubeProjectWhereInput> {
  if (await isVaterOwnerUser(sessionUserId, sessionEmail)) return {};
  const userIds = await orgVisibleUserIds(sessionUserId);
  // Single-element list stays an equality filter so the existing
  // YouTubeProject."userId" index is used exactly as before.
  return userIds.length > 1
    ? { userId: { in: userIds } }
    : { userId: sessionUserId };
}

export interface ProjectAccessDenied {
  ok: false;
  status: 404;
  error: string;
}

export interface ProjectAccessGranted {
  ok: true;
  projectUserId: string | null;
}

/**
 * Fetch-and-check helper for [id] routes. Returns 404-shaped denial for both
 * missing and foreign projects.
 */
export async function checkProjectAccess(
  projectId: string,
  sessionUserId: string,
  sessionEmail: string | null | undefined,
): Promise<ProjectAccessDenied | ProjectAccessGranted> {
  const project = await prisma.youTubeProject.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (
    !project ||
    !(await canAccessProjectAsync(project.userId, sessionUserId, sessionEmail))
  ) {
    return { ok: false, status: 404, error: "Project not found" };
  }
  return { ok: true, projectUserId: project.userId };
}
