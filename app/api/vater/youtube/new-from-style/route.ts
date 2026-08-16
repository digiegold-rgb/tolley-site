/**
 * POST /api/vater/youtube/new-from-style
 *
 * Pure Prisma insert — creates an empty YouTubeProject shell tied to a
 * Style. The TubeGen-parity v2 dashboard hits this immediately after the
 * user picks a Style in StylePickerModal, before any source has been
 * chosen. The user lands in the project shell with the stepper on the
 * Title step.
 *
 * Why not `[id]/draft/`? `/api/vater/youtube/[id]/draft/` already exists
 * as the snapshot-revert system (post-generation editor). Naming this
 * collection-level endpoint `draft/` would be a confusing collision.
 *
 * Body: { styleId, remixOf? }
 *   remixOf — optional project id to copy the SETUP from (voice, soundtrack,
 *   length, feature bag). Same code path as POST /[id]/remix; see
 *   lib/vater/project-remix.ts for exactly what does and doesn't carry over.
 *   When omitted this behaves exactly as it always has.
 * Returns: { project }
 *
 * Errors (no silent catches per feedback_silent_failures_leads.md):
 *   401 — unauthenticated
 *   400 — missing/invalid styleId
 *   403 — style is owned by another user
 *   404 — style (or remixOf project) not found
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canAccessProject } from "@/lib/vater/project-access";
import { createProjectFromStyle } from "@/lib/vater/project-remix";

interface CreateBody {
  styleId?: string;
  remixOf?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.styleId || typeof body.styleId !== "string") {
    return NextResponse.json(
      { error: "styleId is required" },
      { status: 400 },
    );
  }

  // Optional remix source — must be a project this caller can see, or we'd
  // be handing them another tenant's setup.
  let source = null;
  if (typeof body.remixOf === "string" && body.remixOf.trim()) {
    source = await prisma.youTubeProject.findUnique({
      where: { id: body.remixOf.trim() },
    });
    if (
      !source ||
      !canAccessProject(source.userId, session.user.id, session.user.email)
    ) {
      return NextResponse.json(
        { error: "Project to remix not found" },
        { status: 404 },
      );
    }
  }

  // Style ownership + the actual insert live in the shared helper.
  const created = await createProjectFromStyle({
    userId: session.user.id,
    styleId: body.styleId,
    source,
  });
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status });
  }

  console.log(
    `[vater/new-from-style] user=${session.user.id} style=${body.styleId} project=${created.project.id}${
      source ? ` remixOf=${source.id}` : ""
    }`,
  );

  return NextResponse.json({ project: created.project }, { status: 201 });
}
