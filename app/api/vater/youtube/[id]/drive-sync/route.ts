/**
 * POST /api/vater/youtube/[id]/drive-sync — manual "Sync to Drive" retry.
 *
 * The automatic sync runs in `after()` on approve-script; this is the button
 * for when it failed (driveError set) or the user linked Drive after
 * approving. Runs synchronously and returns the fresh project row.
 *   200 {project}            — success OR failure (project.driveError says which)
 *   409 {error}              — script not approved yet
 *   412 {error, reason:"not_linked"} — no usable Drive connection
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { syncApprovedScriptToDrive } from "@/lib/vater/drive-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const project = await prisma.youTubeProject.findUnique({
    where: { id },
    select: { userId: true, scriptApprovedAt: true },
  });
  if (!project || !canAccessProject(project.userId, session.user.id, session.user.email)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!project.scriptApprovedAt) {
    return NextResponse.json(
      { error: "Approve the script first — only approved scripts sync to Drive" },
      { status: 409 },
    );
  }

  const result = await syncApprovedScriptToDrive(id);
  if (result.skipped === "not_linked") {
    return NextResponse.json(
      { error: "Google Drive is not linked to this account", reason: "not_linked" },
      { status: 412 },
    );
  }
  if (result.skipped === "no_script") {
    return NextResponse.json({ error: "No approved script to sync" }, { status: 409 });
  }

  const fresh = await prisma.youTubeProject.findUniqueOrThrow({ where: { id } });
  return NextResponse.json({ project: fresh }, { headers: { "Cache-Control": "private, no-store" } });
}
