/**
 * POST /api/vater/youtube/[id]/reopen — `expired` → back to the gate it was
 * waiting on, with a fresh 7-day clock.
 *
 *   scriptApprovedAt set   → awaiting_engine (step 6)
 *   otherwise              → awaiting_script_approval (step 5)
 *
 * `notifiedScriptReadyAt` is reset so a reopened script gate can notify again
 * if it is rewritten. No charge, no DGX call.
 *
 * → 200 {project} · 409 {error,status} when not expired
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { nextApprovalExpiry } from "@/lib/vater/approval-expiry";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: { userId: true, status: true, scriptApprovedAt: true, script: true },
  });
  if (!project || !canAccessProject(project.userId, session.user.id, session.user.email)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (project.status !== "expired") {
    return NextResponse.json(
      { error: `Only an expired project can be reopened, currently '${project.status}'`, status: project.status },
      { status: 409 },
    );
  }

  const toEngine = !!project.scriptApprovedAt && !!(project.script ?? "").trim();
  const now = new Date();
  const claimed = await prisma.youTubeProject.updateMany({
    where: { id, status: "expired" },
    data: {
      status: toEngine ? "awaiting_engine" : "awaiting_script_approval",
      flowStep: toEngine ? 6 : 5,
      flowStepAt: now,
      approvalExpiresAt: nextApprovalExpiry(now),
      notifiedScriptReadyAt: null,
      errorMessage: null,
    },
  });
  if (claimed.count !== 1) {
    const fresh = await prisma.youTubeProject.findUnique({ where: { id }, select: { status: true } });
    return NextResponse.json(
      { error: "Project changed while reopening — refresh and try again", status: fresh?.status ?? null },
      { status: 409 },
    );
  }
  const reopened = await prisma.youTubeProject.findUniqueOrThrow({ where: { id } });
  console.log(`[vater/reopen] project=${id} → ${reopened.status}`);
  return NextResponse.json({ project: reopened });
}
