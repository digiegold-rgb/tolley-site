/**
 * lib/vater/approval-expiry.ts — lazy 7-day expiry of the approval gates.
 *
 * A project parked at `awaiting_script_approval` (step 5) or `awaiting_engine`
 * (step 6) carries `approvalExpiresAt`. There is NO cron (vercel.json's
 * functions block is full at 50): every read path that lists or opens
 * projects calls one of these first, so a stale gate flips to `expired` the
 * moment anyone looks at it. `approvalExpiresAt` is left as-is so the UI can
 * print "expired 3 days ago"; POST [id]/reopen restarts the clock.
 *
 * Both are single CAS `updateMany`s — concurrent readers can race freely and
 * the row is flipped exactly once.
 */
import { prisma } from "@/lib/prisma";
import { APPROVAL_TTL_MS } from "@/lib/vater/create-steps";

export const EXPIRABLE_STATUSES = ["awaiting_script_approval", "awaiting_engine"] as const;

export function nextApprovalExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + APPROVAL_TTL_MS);
}

/** Batch form: every due gate for one tenant (or every tenant when omitted). */
export async function expireStaleApprovals(userId?: string): Promise<number> {
  const now = new Date();
  const res = await prisma.youTubeProject.updateMany({
    where: {
      ...(userId ? { userId } : {}),
      status: { in: [...EXPIRABLE_STATUSES] },
      approvalExpiresAt: { lt: now },
    },
    data: { status: "expired", flowStepAt: now },
  });
  if (res.count > 0) {
    console.log(`[vater/approval-expiry] expired ${res.count} gate(s)${userId ? ` user=${userId}` : ""}`);
  }
  return res.count;
}

/**
 * Single-row form for GET [id] / the poll: returns the row as it should be
 * read NOW (re-fetched only when the flip happened, so the common path costs
 * nothing).
 */
export async function expireProjectIfDue<
  T extends { id: string; status: string; approvalExpiresAt: Date | null },
>(project: T): Promise<T> {
  if (
    !(EXPIRABLE_STATUSES as readonly string[]).includes(project.status) ||
    !project.approvalExpiresAt ||
    project.approvalExpiresAt.getTime() >= Date.now()
  ) {
    return project;
  }
  const now = new Date();
  const res = await prisma.youTubeProject.updateMany({
    where: {
      id: project.id,
      status: { in: [...EXPIRABLE_STATUSES] },
      approvalExpiresAt: { lt: now },
    },
    data: { status: "expired", flowStepAt: now },
  });
  if (res.count === 0) return project;
  console.log(`[vater/approval-expiry] expired project=${project.id} (was ${project.status})`);
  return { ...project, status: "expired", flowStepAt: now };
}
