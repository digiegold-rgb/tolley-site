/**
 * lib/vater/project-access.ts
 *
 * Tenant isolation for YouTubeProject (added 2026-06-11 for the public
 * pay-per-video launch). Rules:
 *   - project.userId === session user → allowed (owner)
 *   - project.userId is NULL (legacy, pre-multi-tenancy) → vater admins only
 *   - anything else → treated as not-found (404, never 403 — don't leak
 *     project existence)
 */

import { prisma } from "@/lib/prisma";
import { isVaterAdminEmail } from "@/lib/admin-auth";
import type { Prisma } from "@prisma/client";

export function canAccessProject(
  projectUserId: string | null,
  sessionUserId: string,
  sessionEmail: string | null | undefined,
): boolean {
  if (projectUserId === sessionUserId) return true;
  if (projectUserId === null) return isVaterAdminEmail(sessionEmail);
  // Admins can also reach customer projects (support).
  return isVaterAdminEmail(sessionEmail);
}

/** Prisma where-clause scoping a project list to what the session may see. */
export function scopedProjectWhere(
  sessionUserId: string,
  sessionEmail: string | null | undefined,
): Prisma.YouTubeProjectWhereInput {
  if (isVaterAdminEmail(sessionEmail)) return {}; // admins see everything
  return { userId: sessionUserId };
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
  if (!project || !canAccessProject(project.userId, sessionUserId, sessionEmail)) {
    return { ok: false, status: 404, error: "Project not found" };
  }
  return { ok: true, projectUserId: project.userId };
}
