/**
 * POST /api/vater/youtube/[id]/animate-all/finalize?animateAllJobId=<id>
 *
 * Copy a finished animate-all batch into the project and bill it. The work
 * itself lives in lib/vater/animate-all-finalize.ts so a server-side sweeper
 * can do the same job for a customer whose tab closed — see that file for why
 * (video #51: five clips rendered, paid for, never delivered, never billed).
 *
 * This handler is now only auth + access control + status mapping.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessProject } from "@/lib/vater/project-access";
import { finalizeAnimateAll } from "@/lib/vater/animate-all-finalize";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const animateAllJobId = req.nextUrl.searchParams.get("animateAllJobId");
  if (!animateAllJobId) {
    return NextResponse.json({ error: "animateAllJobId required" }, { status: 400 });
  }

  // Access is checked BEFORE any work: finalize both writes scenes and books
  // a charge, so it must never run for a caller who cannot see the project.
  const owner = await prisma.youTubeProject.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (
    !owner ||
    !canAccessProject(owner.userId, session.user.id, session.user.email)
  ) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const out = await finalizeAnimateAll(id, animateAllJobId);
  if (!out.ok) {
    return NextResponse.json(
      { error: out.error, animateAllJobId, ...(out.upstream ? { upstream: out.upstream } : {}) },
      { status: out.status },
    );
  }
  return NextResponse.json(out);
}
